/*
 * COURSE-P2-03 — Main-thread driver for the Pyodide worker.
 *
 * This is the safety-critical half of the feature and the half that is unit-tested.
 * Pyodide cannot be interrupted cooperatively, so "stop the run" means "kill the
 * thread". Everything here exists to make that survivable:
 *
 *   - a hard per-run timeout that calls `terminate()` and reports it honestly;
 *   - a GENERATION counter, so messages still in flight from a worker we just killed
 *     are dropped instead of resolving the next run with stale data;
 *   - a promise-chain queue, because one interpreter cannot run two cells at once;
 *   - LAZY restart — a killed worker is not respawned until the next Run click, so a
 *     timeout never silently re-downloads 15 MB.
 *
 * The worker is INJECTED (`spawn`), not constructed here. That is what makes this
 * file testable: Jest's projects run in the `node` environment (no jsdom, no
 * `Worker`), and `new URL(..., import.meta.url)` would not survive the CJS
 * transform. The real spawner lives in `spawn.ts`, which nothing but the UI imports.
 */

import {
  LOAD_TIMEOUT_MS,
  RUN_TIMEOUT_MS,
  type LoadStage,
  type RunRequest,
  type InitRequest,
  type WorkerMessage,
} from "./protocol";

/* Re-exported so the UI can type its handlers without a VALUE import from anything
 * under this directory — that would drag the CDN URL into the lesson's first-load
 * chunk, which `scripts/check-bundle.ts` forbids. */
export type { LoadStage } from "./protocol";

/** The slice of the DOM `Worker` interface this client actually uses. */
export interface WorkerLike {
  postMessage(message: unknown): void;
  terminate(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export interface RunHandlers {
  /** Streamed as Python writes it — not buffered to the end of the run. */
  onOutput?: (stream: "stdout" | "stderr", text: string) => void;
  onLoading?: (stage: LoadStage, pct: number, detail?: string) => void;
  onPlot?: (plot: { xs: number[]; ys: number[]; label?: string }) => void;
}

export type RunResult =
  | { ok: true }
  /** The student's code raised — `error` is the full traceback. */
  | { ok: false; kind: "python"; error: string }
  /**
   * Killed by the timeout. `phase` distinguishes "download too slow" from "loop too
   * long"; `ms` carries the budget that was exceeded so the UI can name it without
   * importing the constant (see the re-export note above).
   */
  | { ok: false; kind: "timeout"; phase: "load" | "run"; ms: number }
  /** Killed on purpose (`stop()`/`reset()`). */
  | { ok: false; kind: "stopped" }
  /** The worker itself died (OOM on mobile is the realistic cause). */
  | { ok: false; kind: "crashed"; error: string };

interface PendingRun {
  id: number;
  handlers: RunHandlers;
  resolve: (result: RunResult) => void;
}

export interface PyodideClientOptions {
  runTimeoutMs?: number;
  loadTimeoutMs?: number;
}

export class PyodideClient {
  private readonly spawn: () => WorkerLike;
  private readonly runTimeoutMs: number;
  private readonly loadTimeoutMs: number;

  private worker: WorkerLike | null = null;
  /** Bumped on every kill. Messages tagged with an older generation are ignored. */
  private generation = 0;
  private nextRunId = 1;
  private pending: PendingRun | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Serialises runs: one interpreter, one cell at a time. */
  private queue: Promise<unknown> = Promise.resolve();
  private disposed = false;

  constructor(spawn: () => WorkerLike, options: PyodideClientOptions = {}) {
    this.spawn = spawn;
    this.runTimeoutMs = options.runTimeoutMs ?? RUN_TIMEOUT_MS;
    this.loadTimeoutMs = options.loadTimeoutMs ?? LOAD_TIMEOUT_MS;
  }

  /** True once a worker exists — i.e. the runtime download has at least started. */
  get isStarted(): boolean {
    return this.worker !== null;
  }

  /**
   * Queue `code` for execution. Resolves (never rejects) with a `RunResult`, so
   * callers can render every outcome without a try/catch.
   */
  run(code: string, packages: string[], handlers: RunHandlers = {}): Promise<RunResult> {
    const task = this.queue.then(() => this.execute(code, packages, handlers));
    // Keep the chain alive regardless of outcome; `execute` never rejects, but a
    // broken link here would deadlock every later cell on the page.
    this.queue = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }

  /**
   * Kill the interpreter. Any in-flight run settles as `stopped`; module-level
   * Python state is gone, and the next `run()` spawns a fresh worker.
   */
  reset(): void {
    if (!this.worker && !this.pending) return;
    this.killWorker();
    this.settle({ ok: false, kind: "stopped" });
  }

  /** Terminal cleanup — call when the last cell on the page unmounts. */
  dispose(): void {
    this.disposed = true;
    this.reset();
  }

  /* ── internals ───────────────────────────────────────────────────────── */

  private execute(code: string, packages: string[], handlers: RunHandlers): Promise<RunResult> {
    if (this.disposed) {
      return Promise.resolve({ ok: false, kind: "stopped" as const });
    }

    return new Promise<RunResult>((resolve) => {
      let worker: WorkerLike;
      try {
        worker = this.ensureWorker(packages);
      } catch (err) {
        resolve({ ok: false, kind: "crashed", error: describe(err) });
        return;
      }

      const id = this.nextRunId++;
      this.pending = { id, handlers, resolve };

      // The LOAD budget until the worker says `ready`; the run budget after that.
      // Charging a 15 MB cold download against the 10 s run budget would fail every
      // first run on a slow connection.
      this.arm(this.loadTimeoutMs, "load");

      const request: RunRequest = { type: "run", id, code, packages };
      worker.postMessage(request);
    });
  }

  private ensureWorker(packages: string[]): WorkerLike {
    if (this.worker) return this.worker;

    const worker = this.spawn();
    const generation = this.generation;
    worker.onmessage = (event) => this.handleMessage(generation, event.data);
    worker.onerror = (event) => this.handleError(generation, event);
    this.worker = worker;

    // Start the download the moment the worker exists, rather than waiting for the
    // `run` message to be processed.
    const init: InitRequest = { type: "init", packages };
    worker.postMessage(init);
    return worker;
  }

  private handleMessage(generation: number, data: unknown): void {
    if (generation !== this.generation) return; // in-flight message from a killed worker
    const message = data as WorkerMessage;
    const pending = this.pending;
    if (!pending) return;

    switch (message.type) {
      case "loading":
        pending.handlers.onLoading?.(message.stage, message.pct, message.detail);
        break;

      case "ready":
        // The interpreter is up and about to execute: switch to the run budget.
        pending.handlers.onLoading?.("ready", 100);
        this.arm(this.runTimeoutMs, "run");
        break;

      case "stdout":
      case "stderr":
        if (message.id === pending.id) pending.handlers.onOutput?.(message.type, message.text);
        break;

      case "plot":
        if (message.id === pending.id) {
          pending.handlers.onPlot?.({ xs: message.xs, ys: message.ys, label: message.label });
        }
        break;

      case "result":
        if (message.id !== pending.id) break;
        this.settle(
          message.ok
            ? { ok: true }
            : { ok: false, kind: "python", error: message.error ?? "Error desconocido" },
        );
        break;
    }
  }

  private handleError(generation: number, event: unknown): void {
    if (generation !== this.generation) return;
    this.killWorker();
    this.settle({ ok: false, kind: "crashed", error: describe(event) });
  }

  private arm(ms: number, phase: "load" | "run"): void {
    this.clearTimer();
    const generation = this.generation;
    this.timer = setTimeout(() => {
      if (generation !== this.generation) return;
      // The ONLY way to stop running Python. Everything after this point assumes
      // module-level state is gone.
      this.killWorker();
      this.settle({ ok: false, kind: "timeout", phase, ms });
    }, ms);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private killWorker(): void {
    const worker = this.worker;
    this.worker = null;
    this.generation += 1;
    if (worker) {
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
    }
  }

  private settle(result: RunResult): void {
    this.clearTimer();
    const pending = this.pending;
    this.pending = null;
    pending?.resolve(result);
  }
}

function describe(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (typeof value === "object" && value !== null && "message" in value) {
    return String((value as { message: unknown }).message);
  }
  return String(value);
}

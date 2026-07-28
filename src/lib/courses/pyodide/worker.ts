/*
 * COURSE-P2-03 — The Web Worker that actually runs the student's Python.
 *
 * Loaded from `spawn.ts` as a module worker; the bundler emits it as its own asset
 * under /_next/static, so it is same-origin ('self' in worker-src) and inherits the
 * document's CSP. Pyodide itself comes from jsDelivr at the version pinned in
 * protocol.ts — hence `https://cdn.jsdelivr.net` in script-src/connect-src/worker-src.
 *
 * NOTHING here may be assumed recoverable. The main thread kills this worker on a
 * timeout, so every bit of interpreter state is expendable by design.
 *
 * TWO THINGS THAT ARE EASY TO GET WRONG HERE:
 *
 * 1. The CDN import must be hidden from the bundler. `import(url)` with a runtime
 *    URL would otherwise be resolved (or rewritten) at build time. Next 16 builds
 *    with Turbopack and this repo has no custom webpack rule, so BOTH magic comments
 *    are present — dropping either brings the "works in dev, fails in prod" class of
 *    bug back.
 *
 * 2. Streaming output cannot be flushed on a timer. A tight Python loop never yields
 *    to this worker's event loop, so a `setTimeout` flush would deliver nothing until
 *    the run had already finished — exactly backwards from what a training loop needs.
 *    Instead the stdout callback itself decides whether to post, comparing
 *    `performance.now()` (which needs no event loop) and a line cap. `postMessage`
 *    works fine from a busy worker; it is the MAIN thread's loop that has to be free,
 *    and it is.
 *
 * Progress is reported as named STAGES, not bytes. Pyodide exposes no byte-level
 * progress without hand-rolling the wasm fetch, and a spinner with no progress at all
 * reads as broken on a 15 MB download.
 */

import {
  LOAD_PCT,
  PYODIDE_CDN_BASE,
  PYTHON_PREAMBLE,
  type InitRequest,
  type RunRequest,
  type WorkerMessage,
} from "./protocol";

/* Minimal structural type for the bits of the Pyodide API we use — the package is
 * not an npm dependency (it is fetched at runtime), so there are no types to import. */
interface PyodideApi {
  loadPackage(
    names: string[],
    options?: { messageCallback?: (msg: string) => void; errorCallback?: (msg: string) => void },
  ): Promise<unknown>;
  runPython(code: string): unknown;
  runPythonAsync(code: string): Promise<unknown>;
  registerJsModule(name: string, module: object): void;
  setStdout(options: { write: (buffer: Uint8Array) => number }): void;
  setStderr(options: { write: (buffer: Uint8Array) => number }): void;
}

/* `lib: ["dom"]` already declares a global `self` typed as a Window, and
 * `DedicatedWorkerGlobalScope` lives in lib.webworker which this project does not
 * include. Cast to the narrow shape we need instead of fighting the lib config. */
interface WorkerScope {
  postMessage(message: WorkerMessage): void;
  onmessage: ((event: { data: unknown }) => void) | null;
}

const ctx = globalThis as unknown as WorkerScope;

const post = (message: WorkerMessage) => ctx.postMessage(message);

/* ── Output batching ───────────────────────────────────────────────────── */

const FLUSH_INTERVAL_MS = 16;
const FLUSH_CHARS = 4096;

/**
 * Buffers the bytes Python writes and posts them VERBATIM.
 *
 * Note the `join("")`: the `write` handler is called per write syscall, not per
 * line. `print("suma:", x)` produces several calls for ONE line, so inserting
 * separators here would split a single line into several. Newlines are carried in
 * the payload itself, and `appendChunk` on the React side reassembles the lines.
 */
class OutputBuffer {
  private parts: string[] = [];
  private lastFlush = 0;
  private size = 0;

  constructor(
    private readonly stream: "stdout" | "stderr",
    private readonly runId: () => number,
  ) {}

  push(text: string): void {
    this.parts.push(text);
    this.size += text.length;
    const now = performance.now();
    if (this.size >= FLUSH_CHARS || now - this.lastFlush >= FLUSH_INTERVAL_MS) {
      this.flush();
    }
  }

  flush(): void {
    if (this.parts.length === 0) return;
    const text = this.parts.join("");
    this.parts = [];
    this.size = 0;
    this.lastFlush = performance.now();
    post({ type: this.stream, id: this.runId(), text });
  }
}

const decoder = new TextDecoder();

let currentRunId = 0;
const stdout = new OutputBuffer("stdout", () => currentRunId);
const stderr = new OutputBuffer("stderr", () => currentRunId);

/* ── Runtime lifecycle ─────────────────────────────────────────────────── */

let runtime: Promise<PyodideApi> | null = null;
const loadedPackages = new Set<string>();

async function bootstrap(packages: string[]): Promise<PyodideApi> {
  post({ type: "loading", stage: "runtime", pct: LOAD_PCT.runtime });

  const moduleUrl = `${PYODIDE_CDN_BASE}pyodide.mjs`;
  const { loadPyodide } = (await import(
    /* webpackIgnore: true */ /* turbopackIgnore: true */ moduleUrl
  )) as { loadPyodide: (options: { indexURL: string }) => Promise<PyodideApi> };

  const pyodide = await loadPyodide({ indexURL: PYODIDE_CDN_BASE });

  // `write`, not `batched`. Pyodide's `batched` handler hands over fragments with the
  // newlines stripped, which makes it impossible to tell "suma:" + " 1.0" (one line,
  // two writes) from two separate lines. `write` gives the raw bytes exactly as Python
  // emitted them, newlines included, so the output panel can reconstruct lines faithfully.
  pyodide.setStdout({
    write: (buffer) => {
      stdout.push(decoder.decode(buffer));
      return buffer.length;
    },
  });
  pyodide.setStderr({
    write: (buffer) => {
      stderr.push(decoder.decode(buffer));
      return buffer.length;
    },
  });

  post({ type: "loading", stage: "preamble", pct: LOAD_PCT.preamble });
  pyodide.registerJsModule("_pycell", {
    emit_plot: (xs: number[], ys: number[], label: string | null) =>
      post({
        type: "plot",
        id: currentRunId,
        xs: Array.from(xs),
        ys: Array.from(ys),
        ...(label ? { label } : {}),
      }),
  });
  await pyodide.runPythonAsync(PYTHON_PREAMBLE);

  await ensurePackages(pyodide, packages);
  return pyodide;
}

async function ensurePackages(pyodide: PyodideApi, packages: string[]): Promise<void> {
  const missing = packages.filter((name) => !loadedPackages.has(name));
  if (missing.length === 0) return;

  post({ type: "loading", stage: "packages", pct: LOAD_PCT.packages, detail: missing.join(", ") });
  await pyodide.loadPackage(missing, {
    messageCallback: (detail) =>
      post({ type: "loading", stage: "packages", pct: LOAD_PCT.packages, detail }),
  });
  for (const name of missing) loadedPackages.add(name);
}

function ensureRuntime(packages: string[]): Promise<PyodideApi> {
  if (!runtime) {
    runtime = bootstrap(packages).catch((err) => {
      // Let a failed bootstrap be retried rather than poisoning the worker forever.
      runtime = null;
      throw err;
    });
    return runtime;
  }
  return runtime.then(async (pyodide) => {
    await ensurePackages(pyodide, packages);
    return pyodide;
  });
}

/* ── Message loop ──────────────────────────────────────────────────────── */

async function handleRun(request: RunRequest): Promise<void> {
  currentRunId = request.id;
  let pyodide: PyodideApi | null = null;
  try {
    pyodide = await ensureRuntime(request.packages);
    // "ready" is the signal the main thread uses to switch from the download budget
    // to the (much shorter) execution budget. It must be posted immediately before
    // execution starts, never earlier.
    post({ type: "ready" });
    await pyodide.runPythonAsync(request.code);
    drainOutput(pyodide);
    post({ type: "result", id: request.id, ok: true });
  } catch (err) {
    drainOutput(pyodide);
    // Pyodide puts the full Python traceback in `message`. Keep it verbatim — a
    // student needs the line number, not a tidied-up summary.
    post({ type: "result", id: request.id, ok: false, error: toTraceback(err) });
  }
}

/**
 * Push anything still held on the Python side, then anything still held on ours, so
 * the last line of a run is never swallowed. Order matters: Python first.
 */
function drainOutput(pyodide: PyodideApi | null): void {
  try {
    pyodide?.runPython("_pycell_flush()");
  } catch {
    // A run that broke the interpreter shouldn't also lose the output it produced.
  }
  stdout.flush();
  stderr.flush();
}

function toTraceback(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  const text = String(err);
  return text === "[object Object]" ? "Error desconocido durante la ejecución" : text;
}

ctx.onmessage = (event) => {
  const request = event.data as InitRequest | RunRequest;
  if (request.type === "init") {
    // Fire-and-forget: start downloading now so the `run` that follows finds the
    // runtime already in flight. Errors surface on the run's own promise.
    void ensureRuntime(request.packages).catch(() => undefined);
    return;
  }
  if (request.type === "run") {
    void handleRun(request);
  }
};

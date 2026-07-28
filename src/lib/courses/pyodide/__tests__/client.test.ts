/*
 * COURSE-P2-03 — Tests for the safety-critical half of the code cells.
 *
 * The worker itself cannot be tested here (it needs a browser, a real WASM runtime
 * and a 15 MB download), but everything that decides whether a runaway loop takes the
 * tab down with it lives on the main thread and IS testable: the timeout, the
 * terminate, the generation guard that drops messages from a worker we just killed,
 * and the lazy restart afterwards.
 *
 * The unit project runs in Node — there is no `Worker` and no jsdom — which is
 * exactly why `PyodideClient` takes its worker factory by injection.
 */

import { PyodideClient, type RunResult, type WorkerLike } from "../client";
import type { WorkerMessage } from "../protocol";

/** A worker that records what it was sent and lets the test play messages back. */
class FakeWorker implements WorkerLike {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;

  readonly sent: unknown[] = [];
  terminated = 0;

  postMessage(message: unknown): void {
    this.sent.push(message);
  }

  terminate(): void {
    this.terminated += 1;
  }

  /** Deliver a message as the real worker would. */
  emit(message: WorkerMessage): void {
    this.onmessage?.({ data: message });
  }

  fail(error: unknown): void {
    this.onerror?.(error);
  }

  runRequests(): { type: string; id: number; code: string }[] {
    return this.sent.filter(
      (message): message is { type: string; id: number; code: string } =>
        (message as { type?: string }).type === "run",
    );
  }

  lastRunId(): number {
    const runs = this.runRequests();
    return runs[runs.length - 1].id;
  }
}

/** Let queued microtasks (the run queue is a promise chain) settle. */
async function flush(): Promise<void> {
  for (let i = 0; i < 4; i += 1) await Promise.resolve();
}

function setup(options: { runTimeoutMs?: number; loadTimeoutMs?: number } = {}) {
  const workers: FakeWorker[] = [];
  const client = new PyodideClient(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker;
  }, options);
  return { client, workers };
}

/** Drive one run to a successful finish, resolving the returned promise. */
async function completeRun(worker: FakeWorker, ok = true, error?: string): Promise<void> {
  const id = worker.lastRunId();
  worker.emit({ type: "ready" });
  worker.emit({ type: "result", id, ok, ...(error ? { error } : {}) });
  await flush();
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("PyodideClient", () => {
  describe("happy path", () => {
    it("spawns one worker, posts init then run, and resolves ok", async () => {
      const { client, workers } = setup();

      const promise = client.run("print(1)", ["numpy"]);
      await flush();

      expect(workers).toHaveLength(1);
      const worker = workers[0];
      expect(worker.sent[0]).toEqual({ type: "init", packages: ["numpy"] });
      expect(worker.sent[1]).toEqual({
        type: "run",
        id: expect.any(Number),
        code: "print(1)",
        packages: ["numpy"],
      });

      await completeRun(worker);
      await expect(promise).resolves.toEqual({ ok: true });
    });

    it("reuses the worker across runs and posts init only once", async () => {
      const { client, workers } = setup();

      const first = client.run("a = 1", []);
      await flush();
      await completeRun(workers[0]);
      await first;

      const second = client.run("print(a)", []);
      await flush();
      await completeRun(workers[0]);
      await second;

      expect(workers).toHaveLength(1);
      expect(workers[0].sent.filter((m) => (m as { type: string }).type === "init")).toHaveLength(1);
      expect(workers[0].runRequests()).toHaveLength(2);
    });

    it("streams stdout and stderr to the handler in order", async () => {
      const { client, workers } = setup();
      const seen: string[] = [];

      const promise = client.run("print(1)", [], {
        onOutput: (stream, text) => seen.push(`${stream}:${text}`),
      });
      await flush();

      const worker = workers[0];
      const id = worker.lastRunId();
      worker.emit({ type: "ready" });
      worker.emit({ type: "stdout", id, text: "epoch 0" });
      worker.emit({ type: "stdout", id, text: "epoch 1" });
      worker.emit({ type: "stderr", id, text: "warning" });
      worker.emit({ type: "result", id, ok: true });
      await promise;

      expect(seen).toEqual(["stdout:epoch 0", "stdout:epoch 1", "stderr:warning"]);
    });

    it("forwards loading stages and plots", async () => {
      const { client, workers } = setup();
      const stages: string[] = [];
      const plots: { xs: number[]; ys: number[] }[] = [];

      const promise = client.run("plot([1],[2])", ["numpy"], {
        onLoading: (stage) => stages.push(stage),
        onPlot: (plot) => plots.push({ xs: plot.xs, ys: plot.ys }),
      });
      await flush();

      const worker = workers[0];
      const id = worker.lastRunId();
      worker.emit({ type: "loading", stage: "runtime", pct: 15 });
      worker.emit({ type: "loading", stage: "packages", pct: 60, detail: "numpy" });
      worker.emit({ type: "ready" });
      worker.emit({ type: "plot", id, xs: [1], ys: [2], label: "curva" });
      worker.emit({ type: "result", id, ok: true });
      await promise;

      expect(stages).toEqual(["runtime", "packages", "ready"]);
      expect(plots).toEqual([{ xs: [1], ys: [2] }]);
    });

    it("reports a Python exception with its traceback, not a bare failure", async () => {
      const { client, workers } = setup();

      const promise = client.run("1/0", []);
      await flush();
      await completeRun(workers[0], false, "ZeroDivisionError: division by zero");

      await expect(promise).resolves.toEqual({
        ok: false,
        kind: "python",
        error: "ZeroDivisionError: division by zero",
      });
      // A raising cell is not a dead interpreter — the worker stays up.
      expect(workers[0].terminated).toBe(0);
    });
  });

  describe("timeout and termination", () => {
    it("terminates the worker exactly once when the run budget expires", async () => {
      const { client, workers } = setup({ runTimeoutMs: 10_000 });

      const promise = client.run("while True: pass", []);
      await flush();
      workers[0].emit({ type: "ready" }); // switches to the run budget

      jest.advanceTimersByTime(10_000);
      await expect(promise).resolves.toEqual({
        ok: false,
        kind: "timeout",
        phase: "run",
        ms: 10_000,
      });
      expect(workers[0].terminated).toBe(1);

      // No second terminate from a stale timer.
      jest.advanceTimersByTime(60_000);
      expect(workers[0].terminated).toBe(1);
    });

    it("charges the download against the load budget, not the run budget", async () => {
      const { client, workers } = setup({ runTimeoutMs: 10_000, loadTimeoutMs: 120_000 });

      const promise = client.run("print(1)", ["numpy"]);
      await flush();

      // Still downloading: well past the RUN budget, but nothing is killed.
      jest.advanceTimersByTime(60_000);
      await flush();
      expect(workers[0].terminated).toBe(0);

      await completeRun(workers[0]);
      await expect(promise).resolves.toEqual({ ok: true });
    });

    it("reports a load-phase timeout distinctly", async () => {
      const { client, workers } = setup({ loadTimeoutMs: 120_000 });

      const promise = client.run("print(1)", ["numpy"]);
      await flush();
      jest.advanceTimersByTime(120_000);

      await expect(promise).resolves.toEqual({
        ok: false,
        kind: "timeout",
        phase: "load",
        ms: 120_000,
      });
      expect(workers[0].terminated).toBe(1);
    });

    it("ignores messages that arrive from a worker it already killed", async () => {
      const { client, workers } = setup({ runTimeoutMs: 10_000 });
      const seen: string[] = [];

      const promise = client.run("while True: pass", [], {
        onOutput: (_stream, text) => seen.push(text),
      });
      await flush();
      const worker = workers[0];
      const id = worker.lastRunId();
      worker.emit({ type: "ready" });

      jest.advanceTimersByTime(10_000);
      const result = await promise;
      expect(result).toMatchObject({ kind: "timeout" });

      // Whatever was in flight when we pulled the plug must not be observed.
      worker.emit({ type: "stdout", id, text: "late output" });
      worker.emit({ type: "result", id, ok: true });
      await flush();

      expect(seen).toEqual([]);
      await expect(promise).resolves.toMatchObject({ kind: "timeout" });
    });

    it("restarts lazily: a new worker only on the NEXT run, and it succeeds", async () => {
      const { client, workers } = setup({ runTimeoutMs: 10_000 });

      const first = client.run("while True: pass", []);
      await flush();
      workers[0].emit({ type: "ready" });
      jest.advanceTimersByTime(10_000);
      await first;

      // Killed, and deliberately NOT respawned — no eager 15 MB re-download.
      expect(workers).toHaveLength(1);
      expect(client.isStarted).toBe(false);

      const second = client.run("print(2)", ["numpy"]);
      await flush();
      expect(workers).toHaveLength(2);
      expect(workers[1].sent[0]).toEqual({ type: "init", packages: ["numpy"] });

      await completeRun(workers[1]);
      await expect(second).resolves.toEqual({ ok: true });
    });

    it("resolves the in-flight run as stopped when reset() is called", async () => {
      const { client, workers } = setup();

      const promise = client.run("while True: pass", []);
      await flush();
      workers[0].emit({ type: "ready" });

      client.reset();
      await expect(promise).resolves.toEqual({ ok: false, kind: "stopped" });
      expect(workers[0].terminated).toBe(1);
    });

    it("reports a worker crash instead of hanging", async () => {
      const { client, workers } = setup();

      const promise = client.run("print(1)", []);
      await flush();
      workers[0].fail(new Error("out of memory"));

      await expect(promise).resolves.toEqual({
        ok: false,
        kind: "crashed",
        error: "out of memory",
      });
      expect(workers[0].terminated).toBe(1);
    });
  });

  describe("serialisation", () => {
    it("does not post a second run until the first has resolved", async () => {
      const { client, workers } = setup();

      const first = client.run("a = 1", []);
      const second = client.run("print(a)", []);
      await flush();

      const worker = workers[0];
      expect(worker.runRequests()).toHaveLength(1);
      expect(worker.runRequests()[0].code).toBe("a = 1");

      await completeRun(worker);
      await first;
      await flush();

      // Only now does the second cell reach the interpreter.
      expect(worker.runRequests()).toHaveLength(2);
      expect(worker.runRequests()[1].code).toBe("print(a)");

      await completeRun(worker);
      await expect(second).resolves.toEqual({ ok: true });
    });

    it("lets the queue continue after a run times out", async () => {
      const { client, workers } = setup({ runTimeoutMs: 10_000 });

      const first = client.run("while True: pass", []);
      const second = client.run("print(2)", []);
      await flush();
      workers[0].emit({ type: "ready" });

      jest.advanceTimersByTime(10_000);
      await expect(first).resolves.toMatchObject({ kind: "timeout" });
      await flush();

      // The second cell gets a fresh interpreter rather than being stuck behind a
      // worker that no longer exists.
      expect(workers).toHaveLength(2);
      await completeRun(workers[1]);
      await expect(second).resolves.toEqual({ ok: true });
    });
  });

  describe("dispose", () => {
    it("terminates the worker and refuses further runs", async () => {
      const { client, workers } = setup();

      const promise = client.run("print(1)", []);
      await flush();
      await completeRun(workers[0]);
      await promise;

      client.dispose();
      expect(workers[0].terminated).toBe(1);

      const after: RunResult = await client.run("print(2)", []);
      expect(after).toEqual({ ok: false, kind: "stopped" });
      expect(workers).toHaveLength(1);
    });
  });
});

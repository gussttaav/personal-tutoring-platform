/*
 * COURSE-P2-03 — The main-thread ⇄ worker contract for in-browser Python.
 *
 * Pure module: types, constants and one Python string. It imports nothing, so BOTH
 * sides of the boundary (`client.ts` on the main thread, `worker.ts` inside the
 * worker) and the unit tests can depend on it without either side dragging the
 * other's module graph along.
 *
 * Why a worker at all: Pyodide is single-threaded and has no cooperative interrupt.
 * A student's `while True:` is stoppable ONLY by killing the thread it runs on. On
 * the main thread that is a frozen tab; in a worker it is `worker.terminate()`.
 *
 * VERSION PIN — do not replace with `latest`. An unpinned URL will break the course
 * silently one day on a page nobody is watching. v0.29.3 is the last release of the
 * pre-CPython-aligned line (Python 3.13.2, numpy 2.2.5); the current line (v314.x)
 * was days old when this landed. Bump deliberately, and re-verify numpy's presence
 * in that release's pyodide-lock.json first.
 *
 * SELF-HOSTING escape hatch: the CDN buys us ~20 MB out of the repo, off the Hobby
 * bandwidth budget, and cached across lessons and visits. The cost is a third-party
 * origin in the CSP and a dependency on jsDelivr's uptime. To reverse that trade,
 * drop the release under `public/pyodide/` and point PYODIDE_CDN_BASE at it — then
 * remove `https://cdn.jsdelivr.net` from script-src/connect-src/worker-src in
 * next.config.mjs (BOTH the dev and prod arrays).
 */

/** Pinned Pyodide release. See the version-pin note above before changing. */
export const PYODIDE_VERSION = "0.29.3";

/** Trailing slash matters — Pyodide resolves `indexURL + "pyodide.asm.wasm"`. */
export const PYODIDE_CDN_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

/**
 * Hard wall-clock budget for ONE run, enforced on the main thread.
 *
 * A from-scratch MLP training loop on toy data fits in this comfortably. It is not a
 * hint: on expiry the worker is terminated outright, because there is no other way
 * to stop running Python.
 */
export const RUN_TIMEOUT_MS = 10_000;

/**
 * Separate, far more generous budget for getting the interpreter up (~15 MB on a
 * cold cache). It must NOT share the run budget: a phone on mobile data would
 * otherwise "time out" while downloading, which is a different failure with
 * different advice.
 */
export const LOAD_TIMEOUT_MS = 120_000;

/* ── main → worker ─────────────────────────────────────────────────────── */

export interface InitRequest {
  type: "init";
  /** Package names to `loadPackage` — only what the cells on this lesson declare. */
  packages: string[];
}

export interface RunRequest {
  type: "run";
  id: number;
  code: string;
  /** Packages this particular cell needs; loaded on demand if not already present. */
  packages: string[];
}

export type WorkerRequest = InitRequest | RunRequest;

/* ── worker → main ─────────────────────────────────────────────────────── */

/** Named stages, because a spinner with no progress reads as broken. */
export type LoadStage = "runtime" | "packages" | "preamble" | "ready";

export interface LoadingMessage {
  type: "loading";
  stage: LoadStage;
  /** Coarse 0–100. Pyodide exposes no byte-level progress; these are stage marks. */
  pct: number;
  /** Package name while `stage === "packages"`, when Pyodide tells us one. */
  detail?: string;
}

export interface ReadyMessage {
  type: "ready";
}

export interface OutputMessage {
  type: "stdout" | "stderr";
  id: number;
  text: string;
}

export interface PlotMessage {
  type: "plot";
  id: number;
  xs: number[];
  ys: number[];
  label?: string;
}

export interface ResultMessage {
  type: "result";
  id: number;
  ok: boolean;
  /** Full Python traceback when `ok` is false. */
  error?: string;
}

export type WorkerMessage =
  | LoadingMessage
  | ReadyMessage
  | OutputMessage
  | PlotMessage
  | ResultMessage;

/* ── Stage → pct, so the worker and any UI agree on the same marks ─────── */

export const LOAD_PCT: Record<LoadStage, number> = {
  runtime: 15,
  packages: 60,
  preamble: 85,
  ready: 100,
};

/* ── Python preamble ───────────────────────────────────────────────────── */

/**
 * Run once per interpreter, right after the runtime loads (so `plot` exists even
 * before numpy does).
 *
 * `matplotlib` is deliberately absent — its wheel is ~15 MB. Instead a cell returns
 * arrays and `plot()` hands them to the lesson's own SVG plotting primitive, which
 * looks better, matches the rest of the design, and costs a fraction of the size.
 * `_pycell` is registered from the worker via `registerJsModule`.
 *
 * IT ALSO MAKES OUTPUT UNBUFFERED, which is not optional. Python LINE-buffers
 * `sys.stdout`, so a perfectly ordinary teaching snippet —
 *
 *     for num in range(10):
 *         print(num, end=" ")
 *
 * — writes no newline at all and therefore produced ABSOLUTELY NOTHING: the text sat
 * in Python's buffer until the interpreter exited, which never happens here. Neither
 * Pyodide's `isatty` option nor `reconfigure(write_through=True)` fixes it (both
 * verified); the buffering lives in the binary layer underneath. Reopening both
 * streams on their own file descriptors with an unbuffered `FileIO` does, and as a
 * bonus gives genuinely per-write streaming rather than per-line.
 */
export const PYTHON_PREAMBLE = `
import sys as _sys
import io as _io

_sys.stdout = _io.TextIOWrapper(
    _io.FileIO(_sys.stdout.fileno(), "w", closefd=False),
    encoding="utf-8", write_through=True, line_buffering=False,
)
_sys.stderr = _io.TextIOWrapper(
    _io.FileIO(_sys.stderr.fileno(), "w", closefd=False),
    encoding="utf-8", write_through=True, line_buffering=False,
)


def _pycell_flush():
    """Belt and braces: student code may have swapped sys.stdout for a buffered one."""
    try:
        _sys.stdout.flush()
        _sys.stderr.flush()
    except Exception:
        pass


from _pycell import emit_plot as _emit_plot


def plot(xs, ys=None, label=None):
    """Dibuja una curva 2D en la lección (matplotlib no está disponible aquí).

    plot(ys)          -> ys contra su índice
    plot(xs, ys)      -> ys contra xs
    plot(xs, ys, "L") -> con etiqueta
    """
    if ys is None:
        ys = list(xs)
        xs = list(range(len(ys)))
    xs = [float(x) for x in xs]
    ys = [float(y) for y in ys]
    if len(xs) != len(ys):
        raise ValueError("plot(): xs e ys deben tener la misma longitud")
    if not xs:
        raise ValueError("plot(): no hay datos que dibujar")
    _emit_plot(xs, ys, None if label is None else str(label))
`;

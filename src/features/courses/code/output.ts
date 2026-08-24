/*
 * COURSE-P2-03 — Pure output-buffer maths for a code cell.
 *
 * The worker streams stdout as it is written, so a training loop prints its loss per
 * epoch live — watching the loss fall IS the lesson. The cost is that a careless
 * `for i in range(10**6): print(i)` would otherwise grow the DOM without bound and
 * take the tab down anyway, which is exactly the failure the worker exists to prevent.
 *
 * So the buffer is capped, and it says so: when lines are dropped the panel shows an
 * explicit notice rather than silently losing the beginning of the output. Keeping
 * the last N (not the first N) is deliberate — the end of a run is where the answer,
 * or the traceback, lives.
 */

/**
 * Max lines a cell retains. Lives here rather than in the pyodide protocol module on
 * purpose: this file is part of the lesson's eager bundle, and importing a VALUE from
 * anything under `lib/courses/pyodide/` would pull that module — and its CDN URL —
 * into the first-load chunk, which `scripts/check-bundle.ts` forbids.
 */
export const MAX_OUTPUT_LINES = 500;

export interface OutputLine {
  stream: "stdout" | "stderr";
  text: string;
}

export interface OutputBufferState {
  lines: OutputLine[];
  /** How many lines were dropped off the front to stay within the cap. */
  dropped: number;
  /** True when the last line has no terminating newline yet — see `appendChunk`. */
  open: boolean;
}

export const EMPTY_OUTPUT: OutputBufferState = { lines: [], dropped: 0, open: false };

/**
 * Append one streamed chunk and trim to `cap`. Returns a new state — never mutates,
 * so it is safe to call from a React updater.
 *
 * Chunks are write-sized, not line-sized: the worker forwards the bytes Python
 * emitted, and `print("suma:", x)` is several writes for ONE line. So a chunk that
 * does not end in a newline leaves the last line OPEN, and the next chunk continues
 * it. Getting this wrong doesn't crash anything — it just quietly renders every
 * `print` with more than one argument as several broken lines.
 */
export function appendChunk(
  state: OutputBufferState,
  stream: "stdout" | "stderr",
  text: string,
  cap: number = MAX_OUTPUT_LINES,
): OutputBufferState {
  if (text === "") return state;

  const endsWithNewline = text.endsWith("\n");
  const segments = text.split("\n");
  if (endsWithNewline) segments.pop(); // trailing "" is the terminator, not a line

  const lines = state.lines.slice();
  const last = lines[lines.length - 1];

  // Continue the open line, but only within the same stream — an interleaved stderr
  // write starts its own line rather than corrupting the stdout one.
  if (state.open && last && last.stream === stream) {
    lines[lines.length - 1] = { stream, text: last.text + segments[0] };
  } else {
    lines.push({ stream, text: segments[0] });
  }
  for (let i = 1; i < segments.length; i += 1) {
    lines.push({ stream, text: segments[i] });
  }

  const open = !endsWithNewline;

  if (lines.length <= cap) {
    return { lines, dropped: state.dropped, open };
  }

  const overflow = lines.length - cap;
  return { lines: lines.slice(overflow), dropped: state.dropped + overflow, open };
}

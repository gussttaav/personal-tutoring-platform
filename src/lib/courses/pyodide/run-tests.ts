/*
 * COURSE-P3-02 — Wrapping a student's code in its hidden tests, and reading the
 * results back out.
 *
 * ONE Pyodide run grades the whole suite. Not one run per test: the P2-03 client
 * gives a run a single wall-clock budget and a single terminate path, and splitting
 * a challenge across N runs would multiply both — while also losing the student's
 * definitions the first time a run timed out. So the whole suite becomes one Python
 * program that reports per-test results as it goes.
 *
 * The two rules that shape everything here:
 *
 * 1. A FAILING TEST MUST NOT ABORT THE RUN. Every test is exec'd inside its own
 *    try/except that emits a structured line instead of propagating. Test 1 failing
 *    tells the student nothing about tests 2–4, which is exactly what they need.
 *
 * 2. STUDENT CODE MUST NOT REACH THE HARNESS. Their code is exec'd into its own
 *    namespace dict, and every name this wrapper owns is `_`-prefixed and lives in
 *    the wrapper's own globals. A student who writes `json = 3` breaks nothing; a
 *    student who defines `_emit` shadows a copy, not ours.
 *
 * Pure module: strings in, strings out, no import of the worker, the client or the
 * CDN URL. That is what makes the protocol unit-testable with no Pyodide (see
 * __tests__/run-tests.test.ts) — and note that the UI still `await import()`s this
 * file behind the Run click alongside `spawn.ts`, because `scripts/check-bundle.ts`
 * forbids the substring "pyodide" (this directory's name) in EVERY route's
 * first-load JS.
 */

import type { ChallengeTest, TestResult } from "@/domain/types";

/**
 * Prefix that marks a line as a harness result rather than student output.
 *
 * The U+001F unit separators are deliberate: a student's `print()` can plausibly
 * emit any word, but not an ASCII control character, so a collision that would let
 * student output forge a test result is effectively impossible.
 */
export const RESULT_MARKER = "\u001f<pychallenge>\u001f";

/** Everything one graded run produced. */
export interface ChallengeOutcome {
  /** One entry per DECLARED test, in author order — never a partial list. */
  tests: TestResult[];
  /** Traceback when the student's own code failed to run; tests never started. */
  studentError: string | null;
  /** The student's own stdout, with the harness's marker lines removed. */
  stdout: string;
  /** Did the suite reach its end? False when the run was killed mid-way. */
  complete: boolean;
}

/** JSON is a subset of Python's string-literal syntax (`\n`, `\"`, `\\`, `\uXXXX`
 *  all mean the same thing, and every control character is escaped), so this is a
 *  safe embedding for arbitrary student code without inventing an escaper. */
function pythonLiteral(text: string): string {
  return JSON.stringify(text);
}

/**
 * Build the Python program that runs `code` against `tests`.
 *
 * Everything variable is carried in ONE JSON payload that Python parses itself,
 * rather than interpolated at half a dozen sites — there is exactly one place where
 * untrusted text crosses into the source, and it is a string literal.
 */
export function buildTestProgram(code: string, tests: ChallengeTest[]): string {
  const payload = JSON.stringify({
    marker: RESULT_MARKER,
    code,
    tests: tests.map((test) => ({ name: test.name, code: test.code })),
  });

  return `import json as _json
import traceback as _traceback

_payload = _json.loads(${pythonLiteral(payload)})
_marker = _payload["marker"]


def _emit(_obj):
    # The leading newline guarantees the marker starts a line even when the student
    # left stdout mid-line (\`print(x, end="")\`), so the parser can never see a
    # marker glued to their output.
    print("\\n" + _marker + _json.dumps(_obj), flush=True)


def _frames(_err):
    # Drop the harness frame: tb_next is the first frame INSIDE the student's code,
    # so the traceback they read is entirely their own. A SyntaxError carries its
    # file/line/caret on the exception itself, so it survives the trim.
    _tb = _err.__traceback__
    return "".join(
        _traceback.format_exception(type(_err), _err, _tb.tb_next if _tb is not None else None)
    )


# Student definitions land HERE, never in this module's globals.
_ns = {"__name__": "_desafio_"}

try:
    exec(compile(_payload["code"], "<tu código>", "exec"), _ns)
except BaseException as _err:
    _emit({"event": "student-error", "traceback": _frames(_err)})
else:
    for _index, _test in enumerate(_payload["tests"]):
        # A COPY per test: one test's leftovers must not decide the next one.
        _scope = dict(_ns)
        try:
            exec(compile(_test["code"], "<" + _test["name"] + ">", "exec"), _scope)
        except AssertionError as _err:
            _emit({
                "event": "test",
                "index": _index,
                "status": "fail",
                "message": str(_err),
                "traceback": _frames(_err),
            })
        except BaseException as _err:
            # NOT a wrong answer: a NameError or a TypeError is a different problem
            # and the UI says so. The distinction is made here, at the source.
            _emit({
                "event": "test",
                "index": _index,
                "status": "error",
                "message": type(_err).__name__ + ": " + str(_err),
                "traceback": _frames(_err),
            })
        else:
            _emit({"event": "test", "index": _index, "status": "pass"})

_emit({"event": "done"})
`;
}

interface HarnessEvent {
  event?: unknown;
  index?: unknown;
  status?: unknown;
  message?: unknown;
  traceback?: unknown;
}

/**
 * Split accumulated stdout into harness events and student output, then project the
 * events onto the DECLARED test list.
 *
 * Always returns one `TestResult` per declared test. A run killed by the timeout
 * mid-suite therefore comes back as "these two passed, these two never ran" rather
 * than a short list the UI would have to reconcile against the author's tests.
 */
export function parseTestOutput(stdout: string, tests: ChallengeTest[]): ChallengeOutcome {
  const results: TestResult[] = tests.map((test) => ({ name: test.name, status: "not-run" }));
  const plain: string[] = [];
  let studentError: string | null = null;
  let complete = false;

  for (const line of stdout.split("\n")) {
    const at = line.indexOf(RESULT_MARKER);
    if (at === -1) {
      plain.push(line);
      continue;
    }

    // Anything printed before the marker on this line is still the student's.
    if (at > 0) plain.push(line.slice(0, at));

    let event: HarnessEvent;
    try {
      event = JSON.parse(line.slice(at + RESULT_MARKER.length)) as HarnessEvent;
    } catch {
      // Truncated JSON means the run was killed mid-`print`. The affected test just
      // stays "not-run"; nothing else about the outcome is in doubt.
      continue;
    }

    if (event.event === "done") {
      complete = true;
    } else if (event.event === "student-error") {
      studentError = typeof event.traceback === "string" ? event.traceback : "";
    } else if (event.event === "test" && typeof event.index === "number") {
      const target = results[event.index];
      if (!target) continue;
      target.status =
        event.status === "pass" || event.status === "fail" || event.status === "error"
          ? event.status
          : "not-run";
      if (typeof event.message === "string" && event.message.length > 0) {
        target.message = event.message;
      }
      if (typeof event.traceback === "string" && event.traceback.length > 0) {
        target.traceback = event.traceback;
      }
    }
  }

  return {
    tests: results,
    studentError,
    // `_emit` prepends a newline to each marker line, so removing those lines leaves
    // one blank line behind per event; trailing blanks are trimmed, not the interior
    // ones, which may be the student's own spacing.
    stdout: plain.join("\n").replace(/\n+$/, ""),
    complete,
  };
}

/* Deliberately NOT here: "did the student pass?" — that derivation lives in
 * `features/courses/code/challenge-state.ts`, which the card imports statically. A
 * value exported from this directory and consumed by that file would put the whole
 * harness in the lesson's first-load JS. This module is the protocol; grading the
 * protocol's output is the state machine's job. */

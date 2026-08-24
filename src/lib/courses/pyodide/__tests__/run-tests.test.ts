/*
 * COURSE-P3-02 — The challenge harness protocol, tested without Pyodide.
 *
 * Both halves are pure string work by design (see run-tests.ts), so the generated
 * program and the parser can be pinned here against worker output captured from a
 * real run: a passing suite, a single failure, an error that is NOT a failure, a
 * syntax error in the student's own code, and a run killed mid-suite.
 *
 * What this CANNOT check is that Python behaves as the wrapper assumes. That was
 * verified live against the real interpreter; see docs/courses/STATUS.md.
 */

import type { ChallengeTest } from "@/domain/types";

import { buildTestProgram, parseTestOutput, RESULT_MARKER } from "../run-tests";

const tests: ChallengeTest[] = [
  { name: "suma 1", code: "assert np.isclose(softmax(np.array([1., 2., 3.])).sum(), 1.0)" },
  { name: "estable con valores grandes", code: "assert not np.isnan(softmax(np.array([1000., 1001.])).sum())" },
];

/** One harness line exactly as `_emit` writes it: leading newline, then the marker. */
function emitted(event: Record<string, unknown>): string {
  return `\n${RESULT_MARKER}${JSON.stringify(event)}\n`;
}

describe("buildTestProgram", () => {
  it("carries the student's code through JSON, not through string splicing", () => {
    // Triple quotes, a backslash and a newline: everything a naive escaper breaks on.
    const code = 'def f():\n    return """a\\b"""\n';
    const program = buildTestProgram(code, tests);

    const literal = program.match(/_json\.loads\((".*")\)/)?.[1];
    expect(literal).toBeDefined();
    const payload = JSON.parse(JSON.parse(literal as string)) as {
      code: string;
      marker: string;
      tests: ChallengeTest[];
    };

    expect(payload.code).toBe(code);
    expect(payload.marker).toBe(RESULT_MARKER);
    expect(payload.tests).toEqual(tests);
    // The payload literal is one line, so the student's newlines cannot break out of it.
    expect(literal).not.toContain("\n");
  });

  it("execs the student's code into its own namespace, never the harness globals", () => {
    const program = buildTestProgram("x = 1", tests);
    expect(program).toContain('exec(compile(_payload["code"], "<tu código>", "exec"), _ns)');
    // Each test gets a COPY, so one test cannot decide the next.
    expect(program).toContain("_scope = dict(_ns)");
  });

  it("separates an AssertionError from every other exception", () => {
    const program = buildTestProgram("x = 1", tests);
    expect(program).toContain("except AssertionError as _err:");
    expect(program).toContain('"status": "fail"');
    expect(program).toContain('"status": "error"');
  });
});

describe("parseTestOutput", () => {
  it("reports a fully passing suite", () => {
    const stdout =
      emitted({ event: "test", index: 0, status: "pass" }) +
      emitted({ event: "test", index: 1, status: "pass" }) +
      emitted({ event: "done" });

    const outcome = parseTestOutput(stdout, tests);

    expect(outcome.tests).toEqual([
      { name: "suma 1", status: "pass" },
      { name: "estable con valores grandes", status: "pass" },
    ]);
    expect(outcome.studentError).toBeNull();
    expect(outcome.complete).toBe(true);
  });

  it("keeps running after a failure — test 2 still reports", () => {
    const stdout =
      emitted({
        event:     "test",
        index:     0,
        status:    "fail",
        message:   "",
        traceback: 'Traceback (most recent call last):\n  File "<suma 1>", line 1\nAssertionError\n',
      }) +
      emitted({ event: "test", index: 1, status: "pass" }) +
      emitted({ event: "done" });

    const outcome = parseTestOutput(stdout, tests);

    expect(outcome.tests[0].status).toBe("fail");
    expect(outcome.tests[0].traceback).toContain("AssertionError");
    // An empty assertion message is dropped rather than rendered as a blank line.
    expect(outcome.tests[0].message).toBeUndefined();
    expect(outcome.tests[1].status).toBe("pass");
  });

  it("keeps an assertion message when the author wrote one", () => {
    const stdout = emitted({
      event:   "test",
      index:   0,
      status:  "fail",
      message: "las probabilidades deben sumar 1",
    });

    expect(parseTestOutput(stdout, tests).tests[0].message).toBe(
      "las probabilidades deben sumar 1",
    );
  });

  it("marks a NameError as an error, not as a wrong answer", () => {
    const stdout =
      emitted({
        event:     "test",
        index:     0,
        status:    "error",
        message:   "NameError: name 'softmax' is not defined",
        traceback: "Traceback (most recent call last):\nNameError: name 'softmax' is not defined\n",
      }) + emitted({ event: "done" });

    const outcome = parseTestOutput(stdout, tests);

    expect(outcome.tests[0].status).toBe("error");
    expect(outcome.tests[0].message).toBe("NameError: name 'softmax' is not defined");
    expect(outcome.studentError).toBeNull();
  });

  it("reports a syntax error in the student's code, with no test run at all", () => {
    const traceback =
      '  File "<tu código>", line 2\n    def softmax(x:\n                 ^\nSyntaxError: invalid syntax\n';
    const stdout = emitted({ event: "student-error", traceback }) + emitted({ event: "done" });

    const outcome = parseTestOutput(stdout, tests);

    expect(outcome.studentError).toBe(traceback);
    expect(outcome.tests.every((test) => test.status === "not-run")).toBe(true);
  });

  it("leaves the tests a killed run never reached as not-run", () => {
    // The timeout terminates the worker mid-suite: test 1 reported, test 2 never did,
    // and there is no `done`.
    const stdout = emitted({ event: "test", index: 0, status: "pass" });

    const outcome = parseTestOutput(stdout, tests);

    expect(outcome.tests[0].status).toBe("pass");
    expect(outcome.tests[1].status).toBe("not-run");
    expect(outcome.complete).toBe(false);
  });

  it("survives a marker line truncated mid-JSON", () => {
    const stdout = `${emitted({ event: "test", index: 0, status: "pass" })}\n${RESULT_MARKER}{"event":"te`;

    const outcome = parseTestOutput(stdout, tests);

    expect(outcome.tests[0].status).toBe("pass");
    expect(outcome.tests[1].status).toBe("not-run");
    expect(outcome.complete).toBe(false);
  });

  it("preserves the student's own output and strips every marker line", () => {
    const stdout =
      "depurando: 0.5\n" +
      emitted({ event: "test", index: 0, status: "pass" }) +
      "segunda línea\n" +
      emitted({ event: "test", index: 1, status: "pass" }) +
      emitted({ event: "done" });

    const outcome = parseTestOutput(stdout, tests);

    expect(outcome.stdout).not.toContain(RESULT_MARKER);
    expect(outcome.stdout.split("\n").filter(Boolean)).toEqual([
      "depurando: 0.5",
      "segunda línea",
    ]);
  });

  it("does not lose output the student left mid-line before a marker", () => {
    // `print("parcial", end="")` — the harness's leading newline is what makes this
    // recoverable, but the parser splits on the marker anyway.
    const stdout = `parcial${RESULT_MARKER}${JSON.stringify({ event: "test", index: 0, status: "pass" })}\n`;

    const outcome = parseTestOutput(stdout, tests);

    expect(outcome.stdout).toBe("parcial");
    expect(outcome.tests[0].status).toBe("pass");
  });

  it("ignores an event naming a test that does not exist", () => {
    const stdout = emitted({ event: "test", index: 7, status: "pass" }) + emitted({ event: "done" });

    const outcome = parseTestOutput(stdout, tests);

    expect(outcome.tests.every((test) => test.status === "not-run")).toBe(true);
    expect(outcome.complete).toBe(true);
  });
});

/*
 * COURSE-P3-02 — The challenge state machine.
 *
 * These assert what a render test would, in a project that has no jsdom: the reveal
 * gate opens exactly when it should, a stopped run never reaches the reducer, and
 * every graded run produces its own result object so `onAnswered` fires once per
 * attempt (see the header of ../challenge-state.ts).
 */

import type { TestResult } from "@/domain/types";
import type { ChallengeOutcome } from "@/lib/courses/pyodide/run-tests";

import {
  allPassed,
  canRevealSolution,
  createChallengeReducer,
  failuresUntilReveal,
  initialChallengeState,
  passedCount,
  REVEAL_AFTER_FAILURES,
  type ChallengeState,
} from "../challenge-state";

const reduce = createChallengeReducer("ch-softmax");

function outcome(statuses: TestResult["status"][], studentError: string | null = null): ChallengeOutcome {
  return {
    tests:        statuses.map((status, i) => ({ name: `t${i}`, status })),
    studentError,
    stdout:       "",
    complete:     studentError === null,
  };
}

const pass = outcome(["pass", "pass"]);
const fail = outcome(["pass", "fail"]);

/** Apply a list of actions from the initial state. */
function run(...outcomes: ChallengeOutcome[]): ChallengeState {
  return outcomes.reduce(
    (state, o) => reduce(state, { kind: "graded", outcome: o }),
    initialChallengeState(),
  );
}

describe("allPassed / passedCount", () => {
  it("counts only passes", () => {
    expect(passedCount(outcome(["pass", "fail", "error", "not-run"]))).toBe(1);
    expect(passedCount(pass)).toBe(2);
  });

  it("is all-or-nothing across the declared tests", () => {
    expect(allPassed(pass)).toBe(true);
    expect(allPassed(fail)).toBe(false);
    // A run killed mid-suite leaves the rest "not-run" — that is not a pass.
    expect(allPassed(outcome(["pass", "not-run"]))).toBe(false);
  });

  it("is false when the student's own code failed, whatever the tests say", () => {
    expect(allPassed(outcome(["pass", "pass"], "SyntaxError: invalid syntax"))).toBe(false);
  });

  it("is false for a challenge with no tests at all — nothing was proved", () => {
    expect(allPassed(outcome([]))).toBe(false);
  });
});

describe("createChallengeReducer — grading", () => {
  it("counts an all-pass run as solved and correct", () => {
    const state = run(pass);

    expect(state.solved).toBe(true);
    expect(state.attempts).toBe(1);
    expect(state.failures).toBe(0);
    expect(state.result).toEqual({
      challengeId:      "ch-softmax",
      type:             "code-challenge",
      correct:          true,
      passed:           2,
      total:            2,
      attempt:          1,
      solutionRevealed: false,
    });
  });

  it("counts a partial pass as a failure and reports the numerator", () => {
    const state = run(fail);

    expect(state.solved).toBe(false);
    expect(state.failures).toBe(1);
    expect(state.result).toMatchObject({ correct: false, passed: 1, total: 2, attempt: 1 });
  });

  it("treats an error in the student's own code as a failed attempt with nothing passing", () => {
    const state = run(outcome(["not-run", "not-run"], "SyntaxError: invalid syntax"));

    expect(state.failures).toBe(1);
    expect(state.result).toMatchObject({ correct: false, passed: 0, total: 2 });
  });

  it("produces a NEW result object per attempt, even for an identical outcome", () => {
    const first = run(fail);
    const second = reduce(first, { kind: "graded", outcome: fail });

    expect(second.result).not.toBe(first.result);
    expect(second.result?.attempt).toBe(2);
  });

  it("keeps `solved` once earned, even if a later run breaks the code again", () => {
    const state = reduce(run(pass), { kind: "graded", outcome: fail });

    expect(state.solved).toBe(true);
    expect(state.attempts).toBe(2);
    expect(state.result?.correct).toBe(false);
  });
});

describe("solution reveal gate", () => {
  it("is closed before the first attempt", () => {
    const state = initialChallengeState();

    expect(canRevealSolution(state)).toBe(false);
    expect(failuresUntilReveal(state)).toBe(REVEAL_AFTER_FAILURES);
    expect(reduce(state, { kind: "revealSolution" }).solutionRevealed).toBe(false);
  });

  it("stays closed at two failures and opens at the third", () => {
    const two = run(fail, fail);
    expect(canRevealSolution(two)).toBe(false);
    expect(failuresUntilReveal(two)).toBe(1);
    expect(reduce(two, { kind: "revealSolution" }).solutionRevealed).toBe(false);

    const three = reduce(two, { kind: "graded", outcome: fail });
    expect(canRevealSolution(three)).toBe(true);
    expect(failuresUntilReveal(three)).toBe(0);
    expect(reduce(three, { kind: "revealSolution" }).solutionRevealed).toBe(true);
  });

  it("opens immediately on success, without any failure", () => {
    const state = run(pass);

    expect(canRevealSolution(state)).toBe(true);
    expect(reduce(state, { kind: "revealSolution" }).solutionRevealed).toBe(true);
  });

  it("records on every later result that the solution had been seen", () => {
    const revealed = reduce(run(fail, fail, fail), { kind: "revealSolution" });
    const after = reduce(revealed, { kind: "graded", outcome: pass });

    expect(after.result?.solutionRevealed).toBe(true);
  });
});

describe("reset", () => {
  it("clears the last outcome but keeps attempts, failures and the reveal", () => {
    const revealed = reduce(run(fail, fail, fail), { kind: "revealSolution" });
    const state = reduce(revealed, { kind: "reset" });

    expect(state.outcome).toBeNull();
    expect(state.result).toBeNull();
    expect(state.attempts).toBe(3);
    expect(state.failures).toBe(3);
    expect(state.solutionRevealed).toBe(true);
  });

  it("does not re-lock a solution the student already earned", () => {
    const state = reduce(run(pass), { kind: "reset" });

    expect(state.solved).toBe(true);
    expect(canRevealSolution(state)).toBe(true);
  });
});

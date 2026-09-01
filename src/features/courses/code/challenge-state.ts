/*
 * COURSE-P3-02 — The code challenge as a pure state machine.
 *
 * Same reasoning as `quiz/state.ts`: this repo tests behaviour in the node
 * environment (no jsdom, no RTL — see the P2-02 note in docs/courses/STATUS.md), so
 * anything worth asserting has to be reachable without rendering. The card owns the
 * editor text, the run status and the streamed output; everything about the
 * ASSESSMENT — attempts, failures, solved, when the solution unlocks — lives here.
 *
 * Rules encoded here:
 *   - Only a GRADED run counts. A run the student stopped by hand costs nothing, so
 *     the card deliberately dispatches nothing on stop. A run killed by the timeout
 *     does count: its partial output is still parsed and graded, because "tests 1
 *     and 2 passed, then it hung" is real information.
 *   - The solution unlocks on all-pass OR after REVEAL_AFTER_FAILURES failures — not
 *     before, because the struggle is where the learning is, and not never, because
 *     a stuck student who cannot move on just leaves.
 *   - Revealing is sticky, like the quiz hint: every later result says the solution
 *     had been seen.
 *   - Reset restores the starter code but NOT the attempt count — attempt 3 is
 *     attempt 3 (mirrors quiz Retry).
 *   - Each graded run produces a NEW result object, which is what lets the card fire
 *     `onAnswered` exactly once per attempt (P4-02 persists one row per attempt).
 *
 * COURSE-P4-04 adds `hydrate`, which replays a previous session's runs from
 * `quiz_attempts`. It restores the COUNTERS and the reveal gate and never sets
 * `outcome`/`result` — there is nothing else to restore (P4-02 persists the outcome,
 * never the student's code), and leaving `result` null is also what keeps hydration
 * from re-reporting an attempt that was already recorded.
 *
 * Restoring `solved`/`failures` is the point: without it, a reference solution the
 * student had already earned locks itself again on their next visit.
 */

/*
 * IMPORT DISCIPLINE: the only thing this module may take from `lib/courses/pyodide/`
 * is a TYPE. The card imports this file statically, so a VALUE import from there
 * would pull the test harness — and the directory the bundle guard watches — into
 * the lesson's first-load JS, which is exactly what the `await import()` in
 * `CodeChallengeCard.handleRun` exists to prevent. The two derivations below live
 * here rather than next to the parser for the same reason, and because deciding what
 * counts as "correct" is this module's job, not the protocol's.
 */

import type { ChallengeResult, ExerciseAttemptHistory } from "@/domain/types";
import type { ChallengeOutcome } from "@/lib/courses/pyodide/run-tests";

/** Failed attempts after which the reference solution becomes available. */
export const REVEAL_AFTER_FAILURES = 3;

/** How many tests passed — the numerator the card shows ("2 de 3"). */
export function passedCount(outcome: ChallengeOutcome): number {
  return outcome.tests.filter((test) => test.status === "pass").length;
}

/** All declared tests passed AND the student's own code ran. */
export function allPassed(outcome: ChallengeOutcome): boolean {
  return (
    outcome.studentError === null &&
    outcome.tests.length > 0 &&
    outcome.tests.every((test) => test.status === "pass")
  );
}

export interface ChallengeState {
  /** The last graded run; `null` before the first and again after Reset. */
  outcome: ChallengeOutcome | null;
  /** Graded runs so far; 0 before the first. */
  attempts: number;
  /** Graded runs that did not pass everything. Drives the reveal gate. */
  failures: number;
  /** Sticky once every test has passed at least once. */
  solved: boolean;
  /** Sticky once the student has asked for the solution. */
  solutionRevealed: boolean;
  /** `null` until the first graded run; a fresh object on every one. */
  result: ChallengeResult | null;
  /** COURSE-P4-04: the last run of a PREVIOUS session, for the badge. `null` when
   *  there is no history, and never set by a run in this session (the live `outcome`
   *  says more than a summary ever could). */
  restored: RestoredRun | null;
}

/** COURSE-P4-04: what a stored challenge attempt can say. Deliberately less than
 *  `ChallengeOutcome` — the per-test detail was never persisted. */
export interface RestoredRun {
  passed:  number;
  total:   number;
  attempt: number;
  at:      string;
}

export type ChallengeAction =
  | { kind: "graded"; outcome: ChallengeOutcome }
  | { kind: "revealSolution" }
  | { kind: "reset" }
  | { kind: "hydrate"; history: ExerciseAttemptHistory };

export function initialChallengeState(): ChallengeState {
  return {
    outcome:          null,
    attempts:         0,
    failures:         0,
    solved:           false,
    solutionRevealed: false,
    result:           null,
    restored:         null,
  };
}

/** The payload `CourseProgressProvider` writes for a challenge attempt (P4-02).
 *  `unknown` in, validated shape out — the JSONB may predate any of these fields. */
function readStoredRun(payload: unknown): { passed: number; total: number; attempt: number; solutionRevealed: boolean } | null {
  if (typeof payload !== "object" || payload === null) return null;
  const record = payload as Record<string, unknown>;
  if (record.kind !== "challenge") return null;

  const passed  = record.passed;
  const total   = record.total;
  const attempt = record.attempt;
  if (typeof passed !== "number" || typeof total !== "number") return null;

  return {
    passed,
    total,
    attempt:          typeof attempt === "number" ? attempt : 0,
    solutionRevealed: record.solutionRevealed === true,
  };
}

/** Has the solution been earned — by success or by persistence? */
export function canRevealSolution(state: ChallengeState): boolean {
  return state.solved || state.failures >= REVEAL_AFTER_FAILURES;
}

/** How many more failures until the solution unlocks; 0 once it has. */
export function failuresUntilReveal(state: ChallengeState): number {
  if (canRevealSolution(state)) return 0;
  return REVEAL_AFTER_FAILURES - state.failures;
}

/**
 * Bound to one challenge id so the reducer stays a plain `(state, action)` — the
 * challenge is fixed for the life of the card, exactly as in `createQuizReducer`.
 */
export function createChallengeReducer(challengeId: string) {
  return function challengeReducer(state: ChallengeState, action: ChallengeAction): ChallengeState {
    switch (action.kind) {
      case "graded": {
        const correct = allPassed(action.outcome);
        const attempt = state.attempts + 1;
        return {
          ...state,
          outcome:  action.outcome,
          attempts: attempt,
          failures: correct ? state.failures : state.failures + 1,
          solved:   state.solved || correct,
          // A live run says more than a summary of an old one; the badge steps aside.
          restored: null,
          result:   {
            challengeId,
            type:             "code-challenge",
            correct,
            passed:           passedCount(action.outcome),
            total:            action.outcome.tests.length,
            attempt,
            solutionRevealed: state.solutionRevealed,
          },
        };
      }

      case "revealSolution":
        // Guarded here, not only in the UI: the gate is the rule, and a rule that
        // lives in a disabled attribute is one `disabled={false}` from gone.
        if (state.solutionRevealed || !canRevealSolution(state)) return state;
        return { ...state, solutionRevealed: true };

      case "reset":
        // `attempts`, `failures`, `solved` and `solutionRevealed` deliberately survive.
        return { ...state, outcome: null, result: null };

      case "hydrate": {
        // Never overwrite live work: once the student has run something this session,
        // a fetch landing late is stale by definition.
        if (state.attempts > 0) return state;

        const { history } = action;
        if (history.attempts <= 0) return state;

        const stored = readStoredRun(history.lastAnswer);

        return {
          ...state,
          attempts: history.attempts,
          // The rows do not say WHICH attempts failed, only how many there were and
          // whether any passed. Everything after a solve is treated as a failure for
          // gate purposes, which can only ever UNLOCK the solution earlier — never
          // later — for a student who has already put the work in.
          failures: history.solved ? history.attempts - 1 : history.attempts,
          solved:   history.solved,
          // Sticky across sessions: a solution already seen cannot be un-seen, and
          // every later result must keep saying so.
          solutionRevealed: state.solutionRevealed || stored?.solutionRevealed === true,
          restored: stored
            ? {
                passed:  stored.passed,
                total:   stored.total,
                attempt: stored.attempt || history.attempts,
                at:      history.lastAttemptedAt,
              }
            : null,
        };
      }
    }
  };
}

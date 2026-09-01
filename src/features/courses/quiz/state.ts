/*
 * COURSE-P3-01 — The quiz interaction as a pure state machine.
 *
 * Everything the quiz card *does* — select, toggle, reveal the hint, submit, retry —
 * lives here rather than in the component, for the same reason `code/editing.ts` and
 * `landing/SyllabusAccordion`'s grouper do: this repo tests behaviour in the node
 * environment (no jsdom, no RTL — see the P2-02 note in docs/courses/STATUS.md), so
 * logic worth asserting must be reachable without rendering.
 *
 * Rules encoded here:
 *   - Input is locked once an answer is submitted; Retry unlocks it.
 *   - Retry clears the input but NOT the attempt count — attempt 2 is attempt 2.
 *   - Revealing the hint is sticky across retries: a student who has seen it has
 *     seen it, and every subsequent result says so.
 *   - Each submission produces a NEW result object, which is what lets the component
 *     fire `onAnswered` exactly once per attempt (P4-02 persists one row per attempt).
 *
 * COURSE-P4-04 adds `hydrate`, which replays a PREVIOUS session's attempt from
 * `quiz_attempts`. Two rules make that safe:
 *   - It is ignored once the student has touched the question in this session, so a
 *     late-arriving fetch can never overwrite live work.
 *   - The result it produces is marked `restored`, and the component does NOT report
 *     a restored result. Without that flag every page load would write a fresh
 *     attempt row — corrupting the very history it just read.
 */

import type { ExerciseAttemptHistory, QuizAnswer, QuizQuestion, QuizResult } from "@/domain/types";
import { gradeQuestion } from "@/lib/courses/quiz/grade";
import { restoreQuizAnswer } from "@/lib/courses/quiz/restore";

export interface QuizState {
  /** The current input. `null` for "nothing chosen"; `multi` uses an id array. */
  selection: QuizAnswer;
  /** `null` until submitted, and again after Retry. */
  result: QuizResult | null;
  /** Sticky once true. */
  hintUsed: boolean;
  /** Submissions made so far; 0 before the first. */
  attempts: number;
  /** COURSE-P4-04: the current `result` came from history, not from this session.
   *  The component must not report it. Cleared by Retry and by a new submission. */
  restored: boolean;
  /** COURSE-P4-04: answered correctly at some point, per the stored history. Set even
   *  when the answer itself could not be restored — that is the badge-only case. */
  previouslySolved: boolean;
  /** COURSE-P4-04: when the last stored attempt was made, ISO. `null` if none. */
  lastAttemptedAt: string | null;
}

export type QuizAction =
  | { kind: "select"; value: QuizAnswer }
  | { kind: "toggle"; optionId: string }
  | { kind: "revealHint" }
  | { kind: "submit" }
  | { kind: "retry" }
  | { kind: "hydrate"; history: ExerciseAttemptHistory };

/** `multi` collects ids, so it starts as an empty array rather than `null`. */
function emptySelection(question: QuizQuestion): QuizAnswer {
  return question.type === "multi" ? [] : null;
}

export function initialQuizState(question: QuizQuestion): QuizState {
  return {
    selection:        emptySelection(question),
    result:           null,
    hintUsed:         false,
    attempts:         0,
    restored:         false,
    previouslySolved: false,
    lastAttemptedAt:  null,
  };
}

/** Is there enough input to grade? Guards the submit button so a student cannot
 *  burn an attempt on an empty answer. */
export function canSubmit(state: QuizState): boolean {
  if (state.result !== null) return false;
  const { selection } = state;
  if (selection === null) return false;
  if (Array.isArray(selection)) return selection.length > 0;
  if (typeof selection === "string") return selection.trim().length > 0;
  return true; // a boolean or a number is always a real answer, `false`/`0` included
}

/**
 * Bound to one question so the reducer itself stays a plain `(state, action)` —
 * the question is fixed for the life of the card, so it is closed over rather than
 * carried in state or repeated in every action.
 */
export function createQuizReducer(question: QuizQuestion) {
  return function quizReducer(state: QuizState, action: QuizAction): QuizState {
    switch (action.kind) {
      case "select":
        // Locked after submitting: the displayed verdict must keep matching the
        // displayed input until the student explicitly retries.
        if (state.result !== null) return state;
        return { ...state, selection: action.value };

      case "toggle": {
        if (state.result !== null) return state;
        const current = Array.isArray(state.selection) ? state.selection : [];
        const next = current.includes(action.optionId)
          ? current.filter((id) => id !== action.optionId)
          : [...current, action.optionId];
        return { ...state, selection: next };
      }

      case "revealHint":
        return state.hintUsed ? state : { ...state, hintUsed: true };

      case "submit": {
        if (!canSubmit(state)) return state;
        const attempts = state.attempts + 1;
        const result = gradeQuestion(question, state.selection, {
          hintUsed: state.hintUsed,
          attempt:  attempts,
        });
        return {
          ...state,
          attempts,
          result,
          // This one IS the student's, so it must be reported and persisted.
          restored:         false,
          previouslySolved: state.previouslySolved || result.correct,
        };
      }

      case "retry":
        if (state.result === null) return state;
        // `attempts`, `hintUsed` and the history flags deliberately survive.
        return { ...state, selection: emptySelection(question), result: null, restored: false };

      case "hydrate": {
        // Never overwrite live work: if the student has already submitted (or is
        // mid-restore), the fetch that just landed is stale by definition.
        if (state.attempts > 0 || state.result !== null) return state;

        const { history } = action;
        if (history.attempts <= 0) return state;

        const base: QuizState = {
          ...state,
          attempts:         history.attempts,
          previouslySolved: history.solved,
          lastAttemptedAt:  history.lastAttemptedAt,
        };

        const restored = restoreQuizAnswer(question, history.lastAnswer);
        // Badge-only: we know they answered, we cannot faithfully show what.
        if (!restored) return base;

        return {
          ...base,
          selection: restored.value,
          hintUsed:  restored.hintUsed,
          restored:  true,
          // Re-graded HERE rather than trusting the stored `correct`, so a question
          // whose answer key was corrected since shows the honest verdict.
          result: gradeQuestion(question, restored.value, {
            hintUsed: restored.hintUsed,
            attempt:  history.attempts,
          }),
        };
      }
    }
  };
}

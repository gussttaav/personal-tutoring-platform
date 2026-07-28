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
 */

import type { QuizAnswer, QuizQuestion, QuizResult } from "@/domain/types";
import { gradeQuestion } from "@/lib/courses/quiz/grade";

export interface QuizState {
  /** The current input. `null` for "nothing chosen"; `multi` uses an id array. */
  selection: QuizAnswer;
  /** `null` until submitted, and again after Retry. */
  result: QuizResult | null;
  /** Sticky once true. */
  hintUsed: boolean;
  /** Submissions made so far; 0 before the first. */
  attempts: number;
}

export type QuizAction =
  | { kind: "select"; value: QuizAnswer }
  | { kind: "toggle"; optionId: string }
  | { kind: "revealHint" }
  | { kind: "submit" }
  | { kind: "retry" };

/** `multi` collects ids, so it starts as an empty array rather than `null`. */
function emptySelection(question: QuizQuestion): QuizAnswer {
  return question.type === "multi" ? [] : null;
}

export function initialQuizState(question: QuizQuestion): QuizState {
  return { selection: emptySelection(question), result: null, hintUsed: false, attempts: 0 };
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
        return {
          ...state,
          attempts,
          result: gradeQuestion(question, state.selection, {
            hintUsed: state.hintUsed,
            attempt:  attempts,
          }),
        };
      }

      case "retry":
        if (state.result === null) return state;
        // `attempts` and `hintUsed` deliberately survive.
        return { ...state, selection: emptySelection(question), result: null };
    }
  };
}

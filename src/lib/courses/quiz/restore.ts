/*
 * COURSE-P4-04 — Turning a stored attempt back into a usable answer. Pure: no React,
 * no DOM, no I/O — the mirror of `grade.ts`, and tested the same way.
 *
 * `quiz_attempts.answer` is JSONB written by whatever build of the client the student
 * happened to be running, against whatever version of the question was published that
 * day. By the time it comes back the option may have been renamed, the question may
 * have changed type, the payload may predate a shape change — or the row may have no
 * answer at all. So it arrives here as `unknown` and leaves as either a value that is
 * VALID FOR THE CURRENT QUESTION or `null`.
 *
 * `null` is not a failure. It means "we know they answered, we cannot faithfully show
 * what they answered", and the card degrades to a badge with live inputs. The one
 * thing this module must never do is hand the reducer a value that renders a verdict
 * against an answer the student cannot see — a confidently wrong restore is worse than
 * an honest blank one (the same argument P5-00 made for the on-this-page rail).
 */

import type { QuizAnswer, QuizQuestion } from "@/domain/types";

/** What `CourseProgressProvider` writes for a quiz attempt (P4-02). */
interface StoredQuizAnswer {
  kind:         "quiz";
  questionType: string;
  value:        unknown;
  hintUsed:     unknown;
  attempt:      unknown;
}

export interface RestoredAnswer {
  value:    QuizAnswer;
  hintUsed: boolean;
}

function isStoredQuizAnswer(payload: unknown): payload is StoredQuizAnswer {
  return (
    typeof payload === "object" &&
    payload !== null &&
    (payload as { kind?: unknown }).kind === "quiz"
  );
}

/** Does this value still make sense as an answer to THIS question? */
function restoreValue(question: QuizQuestion, value: unknown): QuizAnswer | null {
  switch (question.type) {
    case "single":
      // A renamed or deleted option must not come back as a phantom selection.
      return typeof value === "string" && question.options.some((o) => o.id === value)
        ? value
        : null;

    case "multi": {
      if (!Array.isArray(value) || value.some((id) => typeof id !== "string")) return null;
      const ids = value as string[];
      // All-or-nothing grading means a partially restorable selection would grade
      // differently from what the student actually submitted. Restore all or none.
      if (!ids.every((id) => question.options.some((o) => o.id === id))) return null;
      return ids;
    }

    case "boolean":
      return typeof value === "boolean" ? value : null;

    case "numeric":
      // `Number.isFinite` rejects the NaN/Infinity that JSON.stringify turns to null
      // as well as a numeric string from an older payload.
      return typeof value === "number" && Number.isFinite(value) ? value : null;

    case "predict-output":
      return typeof value === "string" && value.length > 0 ? value : null;
  }
}

/**
 * Restore one stored attempt for one question, or `null` if it cannot be trusted.
 *
 * The `questionType` check is the load-bearing one: an author who changes a question
 * from `single` to `multi` keeps the id, so without it a string answer would arrive
 * at a question that now expects an array.
 */
export function restoreQuizAnswer(question: QuizQuestion, payload: unknown): RestoredAnswer | null {
  if (!isStoredQuizAnswer(payload)) return null;
  if (payload.questionType !== question.type) return null;

  const value = restoreValue(question, payload.value);
  if (value === null) return null;
  // An empty multi-selection grades incorrect and shows nothing selected — the same
  // as not restoring at all, but with a verdict attached. Prefer the honest badge.
  if (Array.isArray(value) && value.length === 0) return null;

  return { value, hintUsed: payload.hintUsed === true };
}

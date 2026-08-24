/*
 * COURSE-P3-01 — Quiz grading. Pure: no React, no DOM, no I/O.
 *
 * Grading runs on the CLIENT for instant feedback, which means the answer key ships
 * in the lesson bundle. That is the deliberate choice for a free self-assessment
 * course — hiding the key behind a fetch would cost a function invocation per
 * question and buy nothing — so please do not "fix" it later. See the note in
 * docs/courses/phase-3-assessment/01-quiz-engine.md.
 *
 * Everything interesting lives here rather than in the component precisely so it can
 * be unit-tested without a DOM: the component only collects input and calls this.
 *
 * No grader ever throws. A malformed or missing answer is simply incorrect — a
 * student mid-typing must never break the page.
 */

import type { QuizAnswer, QuizQuestion, QuizResult } from "@/domain/types";

/** Attempt metadata the component owns; the grader itself is stateless. */
export interface GradeMeta {
  hintUsed?: boolean;
  /** 1-based. Retries are allowed and each attempt is graded on its own. */
  attempt?: number;
}

/**
 * Normalise stdout for `predict-output` comparison: CRLF → LF, trailing whitespace
 * off every line, and leading/trailing blank lines dropped. Deliberately NOT
 * case-insensitive and NOT collapsing interior whitespace — Python's output is
 * case-sensitive and `[1 2 3]` differs from `[1  2  3]`.
 */
export function normaliseOutput(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .join("\n")
    .replace(/^\n+|\n+$/g, "");
}

/** Order-insensitive, duplicate-insensitive set equality. */
function sameSet(a: readonly string[], b: readonly string[]): boolean {
  const left = new Set(a);
  const right = new Set(b);
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}

/** The submitted ids, deduped and sorted, so the persisted answer (P4-02) is stable
 *  regardless of the order the student happened to click the boxes in. */
function normaliseIds(answer: QuizAnswer): string[] {
  if (!Array.isArray(answer)) return [];
  return [...new Set(answer)].sort();
}

/**
 * Grade one answer against one question.
 *
 * The `meta` argument is optional so the documented two-argument call still reads
 * naturally; the component passes it so hint use and the attempt number travel with
 * the result all the way to `quiz_attempts` without needing a second shape.
 */
export function gradeQuestion(
  question: QuizQuestion,
  answer: QuizAnswer,
  meta: GradeMeta = {},
): QuizResult {
  let correct = false;
  let normalised: QuizAnswer = answer;

  switch (question.type) {
    case "single":
      correct = typeof answer === "string" && answer === question.answer;
      normalised = typeof answer === "string" ? answer : null;
      break;

    case "multi": {
      // ALL-OR-NOTHING on purpose: a subset is not "nearly right", it is a different
      // claim about the material. The UI states this before the student submits.
      const selected = normaliseIds(answer);
      correct = selected.length > 0 && sameSet(selected, question.answer);
      normalised = selected;
      break;
    }

    case "boolean":
      correct = typeof answer === "boolean" && answer === question.answer;
      normalised = typeof answer === "boolean" ? answer : null;
      break;

    case "numeric": {
      // Always tolerance-based, never `===`: authors write `0.3`, and a student who
      // computed `0.1 + 0.2` (0.30000000000000004) is right.
      const value = typeof answer === "number" ? answer : Number.NaN;
      correct = Number.isFinite(value) && Math.abs(value - question.answer) <= question.tolerance;
      normalised = Number.isFinite(value) ? value : null;
      break;
    }

    case "predict-output": {
      const typed = typeof answer === "string" ? normaliseOutput(answer) : "";
      correct = typed.length > 0 && typed === normaliseOutput(question.answer);
      normalised = typeof answer === "string" ? typed : null;
      break;
    }
  }

  return {
    quizId:   question.id,
    type:     question.type,
    correct,
    answer:   normalised,
    hintUsed: meta.hintUsed ?? false,
    attempt:  meta.attempt ?? 1,
  };
}

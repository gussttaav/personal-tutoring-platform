/*
 * COURSE-P4-04 — which exercises a lesson actually PLACES, in reading order.
 *
 * The denominator for "N de M ejercicios resueltos". It comes from the body, not from
 * the frontmatter: a lesson may declare a question or a challenge and never place it
 * (the lint permits that — it only forbids the reverse), and counting a question the
 * reader can never see would make the target unreachable.
 *
 * Reuses the extractors the content lint already runs, so the reader counts exactly
 * what `pnpm lint:content` validates — one regex for `<Quiz>`, one for
 * `<CodeChallenge>`, and no second definition of "placed" to drift out of step.
 */

import { findQuizRefs } from "./validate-quizzes";
import { findChallengeRefs } from "./validate-challenges";

/** Ids of every `<Quiz>` and `<CodeChallenge>` placed in an MDX body, in source
 *  order. Tags without an id are skipped — the lint fails the build on those. */
export function placedExerciseIds(source: string): string[] {
  return [
    ...findQuizRefs(source).map((ref) => ref.id),
    ...findChallengeRefs(source).map((ref) => ref.id),
  ].filter((id): id is string => typeof id === "string" && id.length > 0);
}

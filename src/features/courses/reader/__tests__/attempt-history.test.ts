/*
 * COURSE-P4-04 — the solved counter next to mark-complete.
 *
 * Pure, per the no-jsdom discipline: what a render test would assert about
 * "2 de 3 ejercicios resueltos" is asserted on the function that produces the 2.
 */

import type { ExerciseAttemptHistory } from "@/domain/types";
import { countSolved } from "../attempt-history";

const entry = (quizId: string, solved: boolean): ExerciseAttemptHistory => ({
  quizId,
  attempts:        1,
  solved,
  lastCorrect:     solved,
  lastAnswer:      null,
  lastAttemptedAt: "2026-07-28T10:00:00.000Z",
});

const historyOf = (...entries: ExerciseAttemptHistory[]) =>
  new Map(entries.map((e) => [e.quizId, e]));

describe("countSolved", () => {
  it("counts only the solved ones", () => {
    const ids = ["q1", "q2", "q3"];
    expect(countSolved(ids, historyOf(entry("q1", true), entry("q2", false)))).toBe(1);
  });

  it("is zero with no history at all (loading, or signed out)", () => {
    expect(countSolved(["q1", "q2"], new Map())).toBe(0);
  });

  it("counts an attempted-but-unsolved exercise as unsolved", () => {
    expect(countSolved(["q1"], historyOf(entry("q1", false)))).toBe(0);
  });

  it("ignores history for exercises the lesson no longer places", () => {
    // A question deleted from the body must not push the count above the total.
    const stale = historyOf(entry("q1", true), entry("deleted", true));
    expect(countSolved(["q1"], stale)).toBe(1);
  });

  it("is zero for a lesson with no exercises", () => {
    expect(countSolved([], historyOf(entry("q1", true)))).toBe(0);
  });
});

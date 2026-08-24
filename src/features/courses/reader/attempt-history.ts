"use client";

/*
 * COURSE-P4-04 — the READ-side twin of `QuizAttemptContext` / `ChallengeAttemptContext`.
 *
 * P3-01 and P3-02 put the write-side contexts in the card files with no-op defaults so
 * P4-02 could attach persistence without reopening them. This is the same shape in the
 * other direction: the provider fills it, the cards read it, and a card rendered
 * outside a reader (or on a statically served page before hydration) sees `loading`
 * and renders exactly what it renders today.
 *
 * It lives in its own module rather than in `CourseProgressProvider` because the
 * provider already imports both card files for the write-side contexts; putting the
 * read-side context there too would make that import cycle back on itself.
 *
 * `status` is load-bearing. History arrives after hydration, so a card that only
 * checked `byId.get(id)` would paint "no previous attempt", then jump when the fetch
 * lands. `loading` means "do not claim anything yet".
 */

import { createContext, useContext } from "react";
import type { ExerciseAttemptHistory } from "@/domain/types";

export interface AttemptHistory {
  status: "loading" | "untracked" | "ready";
  byId:   ReadonlyMap<string, ExerciseAttemptHistory>;
}

const NONE: AttemptHistory = { status: "loading", byId: new Map() };

export const AttemptHistoryContext = createContext<AttemptHistory>(NONE);

/**
 * How many of a lesson's exercises have been solved. Pure, so it is unit-tested
 * without a renderer (the P2-02 no-jsdom discipline).
 *
 * Driven off `ids` — the exercises actually placed in the body — rather than off the
 * history map, so a stored attempt against a question that has since been removed
 * cannot push the count above the total.
 */
export function countSolved(
  ids: readonly string[],
  byId: ReadonlyMap<string, ExerciseAttemptHistory>,
): number {
  return ids.filter((id) => byId.get(id)?.solved === true).length;
}

/** One exercise's history: `undefined` while loading, when untracked, or when the
 *  reader has simply never attempted this one. */
export function useExerciseHistory(id: string): {
  status:  AttemptHistory["status"];
  history: ExerciseAttemptHistory | undefined;
} {
  const { status, byId } = useContext(AttemptHistoryContext);
  return { status, history: byId.get(id) };
}

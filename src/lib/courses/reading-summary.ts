/*
 * COURSE-P8-01 — the closed-state summary line for "Para profundizar".
 *
 * The block ships COLLAPSED, so this line is the entire advertisement: closed, it is
 * all the student sees of the reading list. "Para profundizar ›" on its own says
 * nothing and gets ignored; "5 fuentes · 3 papers, 1 libro, 1 interactivo" says both
 * that something is there and what shape it has.
 *
 * Pure and dependency-light on purpose — the repo has no jsdom/RTL (see the P2-02 and
 * P3-01 notes in STATUS.md), so the testable part of a component is extracted here and
 * asserted directly, rather than by rendering.
 */

import type { ReadingItem } from "@/domain/types";
import { READING_KINDS } from "@/lib/schemas";

export interface KindTally {
  kind:  ReadingItem["kind"];
  count: number;
}

/**
 * How many entries of each kind, in `READING_KINDS` order, skipping kinds with none.
 *
 * The fixed order matters: tallying in encounter order would make two lessons with the
 * same mix render different summaries, which reads as a bug to anyone who notices.
 */
export function tallyKinds(items: ReadingItem[]): KindTally[] {
  return READING_KINDS.map((kind) => ({
    kind,
    count: items.filter((item) => item.kind === kind).length,
  })).filter((tally) => tally.count > 0);
}

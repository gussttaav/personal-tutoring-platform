/*
 * COURSE-BUILD-01 — How finished is this course?
 *
 * A course is written in public, one block at a time, over months. Before this module every
 * surface reported only what EXISTED: the catalog card counted the blocks that happened to have
 * a published lesson ("1 módulo" for a five-block course) and the landing syllabus dropped the
 * rest entirely. A reader could not tell a 40-lesson course with 1 lesson written from a
 * finished 1-lesson course, and had no way to see what was coming.
 *
 * The missing fact is the PLAN, and a plan cannot be derived — the manifest's block list is
 * complete from day one and says nothing about how big each block will be. So each block
 * declares `lessons` (its planned count, see CourseBlockSchema) and everything else follows:
 *
 *   upcoming  — nothing published yet. Title + summary + size, no lesson rows.
 *   partial   — some of the plan is published.
 *   complete  — published ≥ planned, or no plan declared and at least one lesson published.
 *
 * and the COURSE is complete when no block is either of the first two. "No plan declared"
 * resolving to complete is what keeps dl-nlp — finished long before this key existed — reading
 * exactly as it did: its manifests are untouched and its card and landing are unchanged.
 *
 * The reference is always the CANONICAL locale: "is the course finished?" is a question about
 * the Spanish original, not about how far the English translation has got. That second axis is
 * separate and already derived (`getEnglishTranslationCoverage` in ./catalog-view.ts); the two
 * are reported side by side and never conflated.
 *
 * PURE — domain types only, no fs, no i18n, no registry. It takes the manifest blocks and the
 * published spine and returns a view model, so the catalog page, the landing syllabus and the
 * unit tests all compute the same thing from the same code. It replaces `groupLessonsByBlock`
 * (formerly in SyllabusAccordion), whose one behavioural difference — dropping empty blocks —
 * is precisely what this exists to stop doing.
 */

import type { CourseBlock, Lesson } from "@/domain/types";

/** Where a block stands against its plan. See the file header for the three cases. */
export type BlockState = "complete" | "partial" | "upcoming";

/** One manifest block with its published lessons and its progress against the plan. */
export interface BlockBuild {
  block:        CourseBlock;
  /** Published lessons, in the order they were passed in. Empty when `upcoming`. */
  lessons:      Lesson[];
  /** Reading-time total of `lessons`, for the syllabus's per-block duration. */
  totalMinutes: number;
  published:    number;
  /** `block.lessons` when declared, else `published` — i.e. "as planned" by definition. */
  planned:      number;
  state:        BlockState;
}

/** A course's authoring progress: every block, plus the roll-up the card and notices read. */
export interface CourseBuildStatus {
  /** EVERY manifest block, in manifest order — never filtered. */
  blocks:           BlockBuild[];
  /** Blocks with at least one published lesson. */
  publishedBlocks:  number;
  totalBlocks:      number;
  publishedLessons: number;
  /** Total planned lessons, or null unless EVERY block declares a plan (a partial sum would
   *  be a smaller number than the truth, which is worse than admitting we don't know). */
  plannedLessons:   number | null;
  /** True when no block is `upcoming` or `partial`. */
  complete:         boolean;
}

/** Group the published spine under the manifest blocks and measure it against the plan.
 *  `lessons` is expected pre-sorted by `(block, order)`, as `listLessons` returns it. */
export function courseBuildStatus(blocks: CourseBlock[], lessons: Lesson[]): CourseBuildStatus {
  const builds: BlockBuild[] = blocks.map((block) => {
    const blockLessons = lessons.filter((l) => l.block === block.id);
    const published    = blockLessons.length;
    const planned      = block.lessons ?? published;
    const state: BlockState =
      published === 0        ? "upcoming" :
      published < planned    ? "partial"  :
      "complete";
    return {
      block,
      lessons:      blockLessons,
      totalMinutes: blockLessons.reduce((sum, l) => sum + l.minutes, 0),
      published,
      planned,
      state,
    };
  });

  return {
    blocks:           builds,
    publishedBlocks:  builds.filter((b) => b.published > 0).length,
    totalBlocks:      builds.length,
    publishedLessons: builds.reduce((sum, b) => sum + b.published, 0),
    plannedLessons:   blocks.every((b) => b.lessons !== undefined)
      ? blocks.reduce((sum, b) => sum + (b.lessons ?? 0), 0)
      : null,
    complete:         builds.every((b) => b.state === "complete"),
  };
}

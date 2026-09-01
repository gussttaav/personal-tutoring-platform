/*
 * COURSE-P9-01 — Cross-lesson search: the index wire format.
 *
 * This file is imported by BOTH the build-time index builder (which touches `node:fs`
 * through the registry) and the client dialog. It must therefore stay types-plus-
 * constants forever: the moment anything here re-exports a value from `./build-index`,
 * `node:fs` lands in the browser bundle and the build dies with a cryptic module error.
 * There is deliberately no `index.ts` barrel in this directory for the same reason —
 * client files import the pure modules by their exact path.
 *
 * SHAPE NOTE. Field names are long and descriptive, and that is not carelessness: it was
 * measured. Against the real 43-lesson corpus, short keys (`{l,h,t,x}`) produce a LARGER
 * brotli payload than long ones (118.3 KB vs 115.7 KB) — brotli's context modelling
 * compresses the long repeated key strings better than short keys interleaved with prose.
 * Array-of-tuples wins by 0.4%, which is not worth an unreadable index. Readability is
 * also the smaller option here; don't "optimise" it.
 */

/** Bump when the shape changes. The client refuses an index it does not understand. */
export const SEARCH_INDEX_VERSION = 1;

/** One lesson's metadata. Prose lives in the chunks, not here. */
export interface SearchLessonEntry {
  slug:    string;
  title:   string;
  summary: string;
  /** Manifest block ID (NOT its position) — the same ordinal `LessonSidebar` shows. */
  block:   number;
  order:   number;
  /**
   * Locale the prose actually came from. Differs from `SearchIndex.locale` on a lesson
   * that has not been translated yet (COURSE-P6-03b per-lesson fallback).
   */
  contentLocale: string;
}

/** One h2/h3 section of one lesson — the unit that is searched and deep-linked. */
export interface SearchChunkEntry {
  /** Index into `SearchIndex.lessons`. A repeated slug would cost ~4 KB brotli for nothing. */
  lesson:      number;
  /** `rehype-slug` id, so `#headingId` lands on the rendered heading. "" for the lesson head. */
  headingId:   string;
  /** "" for the lesson head — the prose before the first h2. */
  headingText: string;
  /** Plain prose, whitespace-collapsed. What snippets are cut from. */
  text:        string;
}

/** One course in one locale. Served statically from the search-index route handler. */
export interface SearchIndex {
  version: typeof SEARCH_INDEX_VERSION;
  /** Course slug — locale-invariant. */
  course:  string;
  /** The REQUEST locale this index was built for, which drives result URLs. */
  locale:  string;
  /** 8-char content hash, echoed back by the client's `?v=` cache buster. */
  hash:    string;
  lessons: SearchLessonEntry[];
  chunks:  SearchChunkEntry[];
}

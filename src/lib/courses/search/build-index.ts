/*
 * COURSE-P9-01 — Building one course's search index from the MDX on disk.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ BUILD-TIME ONLY. Never import this from a `"use client"` file.              │
 * │ It reaches the filesystem through the registry, so a client import drags    │
 * │ `node:fs` into the browser bundle and the build dies with a cryptic module  │
 * │ resolution error. The pure modules beside it (normalize/query/match/rank/   │
 * │ snippet/types) are the ones the dialog imports, BY EXACT PATH — which is    │
 * │ why this directory deliberately has no `index.ts` barrel.                   │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * LOCALE. The spine comes from `listLessonViews(courseSlug, locale)` and the prose from
 * `view.contentLocale` — i.e. the exact bytes the reader renders at that URL. Today
 * `content/courses/dl-nlp/en/` does not exist, so the English index holds Spanish prose
 * under `/en` URLs. That is the only correct choice: indexing anything else would return
 * results linking to pages that do not contain the match. `contentLocale` rides along on
 * every lesson so the dialog can say so out loud instead of quietly lying.
 *
 * `readSource` is injectable purely for tests: `getLessonSource` resolves against its own
 * `process.cwd()`-derived root and does not honour the registry's `__setContentRoot`, so a
 * fixture-tree test cannot redirect it any other way.
 */

import { createHash } from "node:crypto";
import matter from "gray-matter";

import { getCourse } from "../registry";
import { listLessonViews } from "../catalog-view";
import { getLessonSource } from "../lesson-source";
import { splitSections } from "./searchable-text";
import { SEARCH_INDEX_VERSION, type SearchChunkEntry, type SearchIndex, type SearchLessonEntry } from "./types";

export interface BuildIndexDeps {
  readSource: (courseSlug: string, lessonSlug: string, locale: string) => string | null;
}

const defaultDeps: BuildIndexDeps = { readSource: getLessonSource };

/** An index with no lessons. A course/locale with no content is normal, never an error. */
function emptyIndex(courseSlug: string, locale: string): SearchIndex {
  return {
    version: SEARCH_INDEX_VERSION,
    course:  courseSlug,
    locale,
    hash:    "00000000",
    lessons: [],
    chunks:  [],
  };
}

/**
 * Build the index for one course in one locale. Pure with respect to its deps; never
 * throws for a course, locale or lesson that does not exist.
 */
export function buildSearchIndex(
  courseSlug: string,
  locale: string,
  deps: BuildIndexDeps = defaultDeps,
): SearchIndex {
  if (!getCourse(courseSlug, locale)) return emptyIndex(courseSlug, locale);

  // Published-only selectors underneath, so the `draft: true` rendering fixture — which
  // embeds every widget and every question type — is already excluded.
  const views = listLessonViews(courseSlug, locale);
  if (views.length === 0) return emptyIndex(courseSlug, locale);

  const lessons: SearchLessonEntry[] = [];
  const chunks: SearchChunkEntry[] = [];

  for (const view of views) {
    const source = deps.readSource(courseSlug, view.lesson.slug, view.contentLocale);
    if (!source) continue;

    const sections = splitSections(matter(source).content);
    if (sections.length === 0) continue;

    const lessonIndex = lessons.length;
    lessons.push({
      slug:          view.lesson.slug,
      title:         view.lesson.title,
      summary:       view.lesson.summary,
      block:         view.lesson.block,
      order:         view.lesson.order,
      contentLocale: view.contentLocale,
    });

    for (const section of sections) {
      chunks.push({
        lesson:      lessonIndex,
        headingId:   section.headingId,
        headingText: section.headingText,
        text:        section.text,
      });
    }
  }

  return {
    version: SEARCH_INDEX_VERSION,
    course:  courseSlug,
    locale,
    // Content hash, not the deploy SHA: a release that does not touch `content/` then
    // leaves the client's cached copy valid instead of re-sending ~116 KB.
    hash:    createHash("sha256").update(JSON.stringify({ lessons, chunks })).digest("hex").slice(0, 8),
    lessons,
    chunks,
  };
}

// Memoized exactly like registry.ts: the route handler and both page routes would
// otherwise re-read and re-strip the whole course per build worker.
const cache = new Map<string, SearchIndex>();

/** The index for one course/locale, built at most once per process. */
export function getSearchIndex(courseSlug: string, locale: string): SearchIndex {
  const key = `${courseSlug}:${locale}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = buildSearchIndex(courseSlug, locale);
    cache.set(key, hit);
  }
  return hit;
}

/** The `?v=` cache buster the page routes hand to the client. */
export function searchIndexVersion(courseSlug: string, locale: string): string {
  return getSearchIndex(courseSlug, locale).hash;
}

/** Test hook — the memo would otherwise leak between fixture trees. */
export function __resetSearchIndexCache(): void {
  cache.clear();
}

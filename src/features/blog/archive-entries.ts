/*
 * BLOG-05 — the post list behind the blog archive pane.
 * BLOG-13 — + the index's projection, and both carry `areas`/`tags` for the filters.
 *
 * Pure, for the same reason as `on-this-page-tree.ts` beside it: the repo has no jsdom,
 * so the pane's markup is not tested and the logic that decides what it shows is.
 *
 *   toArchiveEntries — `Post[]` → the fields the pane needs, newest first. `summary`,
 *                      `reading` (up to ten sourced entries per post) and `cover` never
 *                      reach the RSC payload.
 *   toIndexEntries   — `Post[]` → what an index card shows, newest first. Every post's,
 *                      because the index filters and pages on the client; `reading`
 *                      never reaches it.
 *
 * Dates stay the `YYYY-MM-DD` strings the registry hands out: a lexicographic compare
 * IS a chronological one, so no `Date` is built and no timezone can shift a post a day.
 *
 * `listPosts` already sorts newest-first, but these sort again rather than trusting it:
 * "newest at the top" is each list's own contract. The filters (`blog-filter.ts`) keep
 * the order they are given.
 */

import type { BlogArea, BlogTopic, Post } from "@/domain/types";

export interface ArchiveEntry {
  slug:    string;
  title:   string;
  /** `YYYY-MM-DD`. */
  date:    string;
  minutes: number;
  areas:   BlogArea[];
  tags:    BlogTopic[];
}

export interface IndexEntry extends ArchiveEntry {
  summary: string;
  cover?:  string;
}

const newestFirst = (a: { date: string }, b: { date: string }) => b.date.localeCompare(a.date);

/**
 * Only what the pane renders and filters on — never the summary, the reading list or
 * the cover — with the newest post first. The sort is stable, so posts sharing a date
 * keep the caller's order (the registry breaks such ties by slug).
 */
export function toArchiveEntries(posts: readonly Post[]): ArchiveEntry[] {
  return posts
    .map(({ slug, title, date, minutes, areas, tags }) => ({ slug, title, date, minutes, areas, tags }))
    .sort(newestFirst);
}

/** What an index card shows, newest first. `cover` is omitted, not `undefined`, when
 *  the post has none, so the RSC payload carries no empty key. */
export function toIndexEntries(posts: readonly Post[]): IndexEntry[] {
  return posts
    .map(({ slug, title, date, minutes, areas, tags, summary, cover }) => ({
      slug, title, date, minutes, areas, tags, summary,
      ...(cover ? { cover } : null),
    }))
    .sort(newestFirst);
}

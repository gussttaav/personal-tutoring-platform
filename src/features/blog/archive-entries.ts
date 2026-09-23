/*
 * BLOG-05 — the post list behind the blog archive pane.
 *
 * Pure, for the same reason as `on-this-page-tree.ts` beside it: the repo has no jsdom,
 * so the pane's markup is not tested and the logic that decides what it shows is.
 *
 *   toArchiveEntries — `Post[]` → the four fields the client island needs, newest
 *                      first. `summary`, `reading` (up to ten sourced entries per post)
 *                      and `tags` never reach the RSC payload.
 *
 * The pane lists every post in one flat column, so this is all the shaping there is.
 * Dates stay the `YYYY-MM-DD` strings the registry hands out: a lexicographic compare
 * IS a chronological one, so no `Date` is built and no timezone can shift a post a day.
 *
 * `listPosts` already sorts newest-first, but this sorts again rather than trusting it:
 * "newest at the top" is the pane's own contract, and later filters (by tag, by search)
 * will pass their own arrays through here.
 */

import type { Post } from "@/domain/types";

export interface ArchiveEntry {
  slug:    string;
  title:   string;
  /** `YYYY-MM-DD`. */
  date:    string;
  minutes: number;
}

/**
 * Only what the pane renders — never the summary, the reading list or the tags — with
 * the newest post first. The sort is stable, so posts sharing a date keep the caller's
 * order (the registry breaks such ties by slug).
 */
export function toArchiveEntries(posts: readonly Post[]): ArchiveEntry[] {
  return posts
    .map(({ slug, title, date, minutes }) => ({ slug, title, date, minutes }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

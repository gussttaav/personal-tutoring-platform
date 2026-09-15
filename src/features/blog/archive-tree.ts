/*
 * BLOG-05 — shape the flat post list into the year → month archive pane.
 *
 * Pure, for the same reason as `on-this-page-tree.ts` beside it: the repo has no jsdom,
 * so the accordion's markup is not tested and the logic that decides what it shows is.
 *
 *   toArchiveEntries  — server-side projection of `Post` to the four fields the client
 *                       island needs. `summary`, `reading` (up to ten sourced entries
 *                       per post) and `tags` never reach the RSC payload.
 *   groupArchive      — entries → years → months, newest first at every level.
 *   activeArchivePath — the year + month holding the post being read.
 *   defaultOpenPath   — what the accordion opens with: that path, else the newest.
 *   capitaliseFirst   — "septiembre" → "Septiembre" for the month rows.
 *
 * Dates stay the `YYYY-MM-DD` strings the registry hands out: the year is `slice(0, 4)`,
 * the month key `slice(0, 7)`, and a lexicographic compare IS a chronological one — no
 * `Date`, so no timezone can shift a post into the previous month.
 *
 * Later filters (by tag, by search) will pre-filter the entries before `groupArchive`,
 * which is why it sorts for itself instead of trusting the registry's order.
 */

import type { Post } from "@/domain/types";

export interface ArchiveEntry {
  slug:    string;
  title:   string;
  /** `YYYY-MM-DD`. */
  date:    string;
  minutes: number;
}

export interface ArchiveMonth {
  /** `YYYY-MM`. */
  key:     string;
  /** Newest first. */
  entries: ArchiveEntry[];
}

export interface ArchiveYear {
  /** `YYYY`. */
  key:    string;
  /** Newest first. */
  months: ArchiveMonth[];
}

export interface ArchivePath {
  year:  string;
  month: string;
}

/** Only what the pane renders — never the summary, the reading list or the tags. */
export function toArchiveEntries(posts: readonly Post[]): ArchiveEntry[] {
  return posts.map(({ slug, title, date, minutes }) => ({ slug, title, date, minutes }));
}

/**
 * Fold the entries into years → months, newest first at every level. The sort is
 * stable, so entries sharing a date keep the caller's order (the registry breaks such
 * ties by slug), and a caller that passes entries in any order still gets a correct
 * tree. One pass after sorting is enough: same-month entries are contiguous.
 */
export function groupArchive(entries: readonly ArchiveEntry[]): ArchiveYear[] {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const years: ArchiveYear[] = [];

  for (const entry of sorted) {
    const yearKey = entry.date.slice(0, 4);
    const monthKey = entry.date.slice(0, 7);

    let year = years[years.length - 1];
    if (!year || year.key !== yearKey) {
      year = { key: yearKey, months: [] };
      years.push(year);
    }

    let month = year.months[year.months.length - 1];
    if (!month || month.key !== monthKey) {
      month = { key: monthKey, entries: [] };
      year.months.push(month);
    }

    month.entries.push(entry);
  }

  return years;
}

/** The year + month holding `currentSlug`, or `null` when it is not in the tree. */
export function activeArchivePath(
  years: readonly ArchiveYear[],
  currentSlug: string,
): ArchivePath | null {
  for (const year of years) {
    for (const month of year.months) {
      if (month.entries.some((entry) => entry.slug === currentSlug)) {
        return { year: year.key, month: month.key };
      }
    }
  }
  return null;
}

/**
 * The groups the accordion opens with: the ones holding the post being read. Should
 * that post be missing from the tree (it cannot be today — the page only renders for a
 * published post, and the tree lists every published post), fall back to the newest
 * year and month rather than opening nothing. `null` only for an empty tree.
 */
export function defaultOpenPath(
  years: readonly ArchiveYear[],
  currentSlug: string,
): ArchivePath | null {
  const active = activeArchivePath(years, currentSlug);
  if (active) return active;

  const newestYear = years[0];
  const newestMonth = newestYear?.months[0];
  if (!newestYear || !newestMonth) return null;
  return { year: newestYear.key, month: newestMonth.key };
}

/**
 * Upper-case the first character, locale-aware. `Intl` gives Spanish month names in
 * lower case ("septiembre"); a row label wants "Septiembre". Done here rather than with
 * CSS `text-transform: capitalize` so the DOM text itself is right (copy/paste, screen
 * readers) and the rule is testable.
 */
export function capitaliseFirst(label: string, locale: string): string {
  if (label.length === 0) return label;
  return label.charAt(0).toLocaleUpperCase(locale) + label.slice(1);
}

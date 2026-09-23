"use client";

/*
 * BLOG-05 — the blog archive: every published post in one column, newest first.
 *
 * Rendered in two places by the post page: the desktop left pane (`variant="sidebar"`,
 * ≥1024px) and inside PostArchiveMobile's drawer (`variant="drawer"`, below that). The
 * drawer only mounts while open and post.css hides the pane below 1024px, so exactly
 * one copy is ever in the accessibility tree. `variant` changes nothing but padding.
 *
 * A flat list, deliberately: with the posts of a few years in view the reader scans one
 * column instead of opening groups to find out what is inside them. Nothing collapses,
 * so every title is in the prerendered HTML and reachable by Tab and find-in-page.
 *
 * Data comes pre-projected and sorted (`ArchiveEntry`: slug, title, date, minutes —
 * `archive-entries.ts`, tested). Later filters by tag or search will pre-filter
 * `entries` before it reaches this component.
 *
 * The meta line under a title carries the full date INCLUDING the year — nothing else
 * in the list says which year a post belongs to — and the reading time. It goes through
 * next-intl's client formatter pinned to UTC, since `date` is a calendar day and `new
 * Date()` reads it as UTC midnight (the same trap `PostCard` and the post header avoid).
 *
 * Styling is all in post.css (`.post-archive-*`): hover, the current-post rail, focus
 * rings, the 2-line title clamp and the reduced-motion block all need CSS.
 */

import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { ArchiveEntry } from "./archive-entries";

interface PostArchiveProps {
  entries:     ArchiveEntry[];
  currentSlug: string;
  variant:     "sidebar" | "drawer";
}

export default function PostArchive({ entries, currentSlug, variant }: PostArchiveProps) {
  const t = useTranslations("blog.archive");
  const format = useFormatter();

  const dayLabel = (date: string) =>
    format.dateTime(new Date(`${date}T00:00:00Z`), {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });

  return (
    <nav aria-label={t("label")} className={`post-archive-nav post-archive-nav--${variant}`}>
      {/* Names its destination, like the lesson sidebar's back link: on desktop this
          is the way back to the index (post.css hides the in-content link there). */}
      <Link href="/blog" className="post-archive-back">
        <span className="material-symbols-outlined" style={{ fontSize: "1.125rem" }} aria-hidden="true">
          arrow_back
        </span>
        {t("allArticles")}
      </Link>

      <ul className="post-archive-entries">
        {entries.map((entry) => (
          <li key={entry.slug}>
            {/* prefetch off: the pane lists EVERY post on every post, and viewport
                prefetch would fetch them all. */}
            <Link
              href={`/blog/${entry.slug}`}
              className="post-archive-link"
              prefetch={false}
              aria-current={entry.slug === currentSlug ? "page" : undefined}
            >
              <span className="post-archive-title">{entry.title}</span>
              <span className="post-archive-meta">
                <time dateTime={entry.date}>{dayLabel(entry.date)}</time>
                {" · "}
                {t("minutes", { minutes: entry.minutes })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

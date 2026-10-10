"use client";

/*
 * BLOG-05 — the blog archive: every published post in one column, newest first.
 * BLOG-13 — + an area filter, a folded topic filter, and pages.
 *
 * Rendered in two places by the post page: the desktop left pane (`variant="sidebar"`,
 * ≥1024px) and inside PostArchiveMobile's drawer (`variant="drawer"`, below that). The
 * drawer only mounts while open and post.css hides the pane below 1024px, so exactly
 * one copy is ever in the accessibility tree. `variant` changes only styling (taller
 * touch rows in the drawer, and where the pinned pager sits).
 *
 * BLOG-13. The list became too long to scan as one column, so it pages
 * (`BLOG_ARCHIVE_PAGE_SIZE`) and filters, with the same areas and topics as the index:
 *   - The FILTER is the reader's, not the post's: it lives in `blog-filter-store`
 *     (sessionStorage), written here and by the index, so it survives the remount on
 *     every post (this component is keyed by slug) and a reader who narrowed the index
 *     to one area keeps reading inside it.
 *   - The PAGE is local and starts at `null`, meaning "the page holding the post being
 *     read" (`archivePage`); a filter change returns it to that.
 *   - Topics fold behind a toggle (the pane is narrow and sticky); the active topic is
 *     named on the toggle so a closed fold never hides a filter that is on.
 * A filter or page change is local state only: no navigation, no URL change.
 *
 * Data comes pre-projected and sorted (`ArchiveEntry`: slug, title, date, minutes,
 * areas, tags — `archive-entries.ts`, tested), and the filter/page decisions are in
 * `blog-filter.ts` (tested).
 *
 * The meta line under a title carries the full date INCLUDING the year — nothing else
 * in the list says which year a post belongs to — and the reading time. It goes through
 * next-intl's client formatter pinned to UTC, since `date` is a calendar day and `new
 * Date()` reads it as UTC midnight (the same trap `PostCard` and the post header avoid).
 *
 * Styling is all in post.css (`.post-archive-*`): hover, the current-post rail, focus
 * rings, the 2-line title clamp and the reduced-motion block all need CSS.
 */

import { useId, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BLOG_ARCHIVE_PAGE_SIZE, BLOG_AREA_ICONS } from "@/constants/blog";
import type { BlogTopic } from "@/domain/types";
import {
  archivePage,
  areaCounts,
  filterEntries,
  normalizeFilter,
  shownArea,
  topicCounts,
  type AreaFilter,
} from "./blog-filter";
import { setStoredBlogFilter, useStoredBlogFilter } from "./blog-filter-store";
import type { ArchiveEntry } from "./archive-entries";

interface PostArchiveProps {
  entries:     ArchiveEntry[];
  currentSlug: string;
  variant:     "sidebar" | "drawer";
}

/** Page dots only while they stay a glance; past this, the "Página n de m" text alone. */
const MAX_DOTS = 8;

export default function PostArchive({ entries, currentSlug, variant }: PostArchiveProps) {
  const t = useTranslations("blog");
  const format = useFormatter();
  const topicsId = useId();

  const filter = normalizeFilter(entries, useStoredBlogFilter());
  const [page, setPage] = useState<number | null>(null);
  const [topicsOpen, setTopicsOpen] = useState(false);

  const topicLabel = (topic: BlogTopic) => t(`topics.${topic}`);
  const list = filterEntries(entries, filter);
  const view = archivePage(list, currentSlug, page, BLOG_ARCHIVE_PAGE_SIZE);
  const topics = topicCounts(entries, filter.area, topicLabel);

  const pickArea = (area: AreaFilter) => {
    setStoredBlogFilter({ area, topic: null });
    setPage(null);
  };
  const pickTopic = (topic: BlogTopic) => {
    setStoredBlogFilter({ area: filter.area, topic: filter.topic === topic ? null : topic });
    setPage(null);
  };

  const dayLabel = (date: string) =>
    format.dateTime(new Date(`${date}T00:00:00Z`), {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });

  const listLabel =
    (filter.area === "all" ? t("archive.list") : t(`areas.${filter.area}`)) +
    (filter.topic ? ` · #${topicLabel(filter.topic)}` : "");

  return (
    <nav aria-label={t("archive.label")} className={`post-archive-nav post-archive-nav--${variant}`}>
      {/* Names its destination, like the lesson sidebar's back link: on desktop this
          is the way back to the index (post.css hides the in-content link there). */}
      <Link href="/blog" className="post-archive-back">
        <span className="material-symbols-outlined" style={{ fontSize: "1.125rem" }} aria-hidden="true">
          arrow_back
        </span>
        {t("archive.allArticles")}
      </Link>

      <div className="post-archive-section">
        <p className="post-archive-kicker" aria-hidden="true">{t("filters.areas")}</p>
        <ul className="post-archive-areas" aria-label={t("filters.areas")}>
          <li>
            <button
              type="button"
              className="post-archive-area"
              aria-pressed={filter.area === "all"}
              onClick={() => pickArea("all")}
            >
              <span className="material-symbols-outlined blog-area-icon" aria-hidden="true">grid_view</span>
              <span className="post-archive-area__label">{t("filters.all")}</span>
              <span className="post-archive-area__count">{entries.length}</span>
            </button>
          </li>
          {areaCounts(entries).map(({ area, count }) => {
            const icon = BLOG_AREA_ICONS[area];
            return (
              <li key={area}>
                <button
                  type="button"
                  className="post-archive-area"
                  aria-pressed={filter.area === area}
                  onClick={() => pickArea(area)}
                >
                  <span className="material-symbols-outlined blog-area-icon" data-area={area} aria-hidden="true">
                    {icon}
                  </span>
                  <span className="post-archive-area__label">{t(`areas.${area}`)}</span>
                  <span className="post-archive-area__count">{count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {topics.length > 0 ? (
        <div className="post-archive-section">
          <button
            type="button"
            className="post-archive-topics-toggle"
            aria-expanded={topicsOpen}
            aria-controls={topicsOpen ? topicsId : undefined}
            onClick={() => setTopicsOpen((open) => !open)}
          >
            <span className="post-archive-topics-toggle__label">{t("filters.topics")}</span>
            {filter.topic ? (
              <span className="post-archive-topics-toggle__current">#{topicLabel(filter.topic)}</span>
            ) : null}
            <span className="material-symbols-outlined post-archive-topics-toggle__chevron" aria-hidden="true">
              expand_more
            </span>
          </button>
          {topicsOpen ? (
            <div id={topicsId} className="post-archive-chips" role="group" aria-label={t("filters.topics")}>
              {topics.map(({ topic, count }) => (
                <button
                  key={topic}
                  type="button"
                  className="post-archive-chip"
                  aria-pressed={filter.topic === topic}
                  onClick={() => pickTopic(topic)}
                >
                  <span className="post-archive-chip__hash" aria-hidden="true">#</span>
                  {topicLabel(topic)}
                  <span className="post-archive-chip__count">{count}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="post-archive-listhead">
        <span>{listLabel}</span>
        <span className="post-archive-listhead__count">{list.length}</span>
      </div>

      <ul className="post-archive-entries">
        {view.items.map((entry) => (
          <li key={entry.slug}>
            {/* prefetch off: the pane lists a page of posts on every post, and viewport
                prefetch would fetch them all. */}
            <Link
              href={`/blog/${entry.slug}`}
              className="post-archive-link"
              prefetch={false}
              aria-current={entry.slug === currentSlug ? "page" : undefined}
            >
              <span className="post-archive-title">{entry.title}</span>
              <span className="post-archive-meta">
                <span className="post-archive-dot" data-area={shownArea(entry, filter)} aria-hidden="true" />
                <time dateTime={entry.date}>{dayLabel(entry.date)}</time>
                {" · "}
                {t("archive.minutes", { minutes: entry.minutes })}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {view.pageCount > 1 ? (
        <div className="post-archive-pager" role="group" aria-label={t("archive.pagination")}>
          <button
            type="button"
            className="post-archive-pager__step"
            aria-label={t("archive.prevPage")}
            disabled={view.page <= 1}
            onClick={() => setPage(view.page - 1)}
          >
            <span className="material-symbols-outlined" aria-hidden="true">chevron_left</span>
          </button>
          <div className="post-archive-pager__where">
            <span aria-live="polite">{t("archive.pageOf", { page: view.page, pages: view.pageCount })}</span>
            {view.pageCount <= MAX_DOTS ? (
              <span className="post-archive-pager__dots">
                {Array.from({ length: view.pageCount }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="post-archive-pager__dot"
                    aria-label={t("archive.goToPage", { page: n })}
                    aria-current={n === view.page ? "page" : undefined}
                    onClick={() => setPage(n)}
                  />
                ))}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            className="post-archive-pager__step"
            aria-label={t("archive.nextPage")}
            disabled={view.page >= view.pageCount}
            onClick={() => setPage(view.page + 1)}
          >
            <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
          </button>
        </div>
      ) : null}
    </nav>
  );
}

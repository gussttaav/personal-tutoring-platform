"use client";

/*
 * BLOG-05 — the blog archive: every published post, newest first, year → month.
 *
 * Rendered in two places by the post page: the desktop left pane (`variant="sidebar"`,
 * ≥1024px) and inside PostArchiveMobile's drawer (`variant="drawer"`, below that). The
 * drawer only mounts while open and post.css hides the pane below 1024px, so exactly
 * one copy is ever in the accessibility tree. `variant` changes nothing but padding.
 *
 * ACCORDION: a year row and a month row are `<button aria-expanded>`s; the accordion
 * opens with only the year and month of the post being read (`defaultOpenPath`) and is
 * NON-exclusive — the reader can hold several groups open. Open/close is the same
 * `grid-template-rows` transition the blog's OnThisPage rail uses, dropped under
 * `prefers-reduced-motion`; collapsed content is `inert`, so Tab and find-in-page skip
 * it. The seed derives only from props, never from `window`, so the server-rendered
 * `aria-expanded` / `inert` match on hydration.
 *
 * Data comes pre-projected (`ArchiveEntry`: slug, title, date, minutes) and the
 * year/month shaping is pure (`archive-tree.ts`, tested). Later filters by tag or
 * search will pre-filter `entries` before it reaches `groupArchive`.
 *
 * Labels: the month row is `Intl`'s long month name, capitalised in JS (Spanish months
 * come lower-case); the meta line under a title is the day + short month, and the
 * reading time. Both go through next-intl's client formatter pinned to UTC, since
 * `date` is a calendar day and `new Date()` reads it as UTC midnight (the same trap
 * `PostCard` and the post header avoid).
 *
 * Styling lives in post.css (`.post-archive-*`): hover, the current-post rail, focus
 * rings, the 2-line title clamp and the reduced-motion block need CSS. Only the two
 * transitions the reduced-motion hook controls are inline, as in OnThisPage.
 */

import { useId, useMemo, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  groupArchive,
  defaultOpenPath,
  capitaliseFirst,
  type ArchiveEntry,
  type ArchiveMonth,
} from "./archive-tree";

interface PostArchiveProps {
  entries:     ArchiveEntry[];
  currentSlug: string;
  variant:     "sidebar" | "drawer";
}

function Chevron({ open, reducedMotion }: { open: boolean; reducedMotion: boolean }) {
  return (
    <svg
      className="post-archive-chevron"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{
        transformOrigin: "center",
        transform: open ? "none" : "rotate(-90deg)",
        transition: reducedMotion ? "none" : "transform 180ms ease",
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/** The collapsible body under a year or month row (OnThisPage's grid-rows slide). */
function Collapsible({
  id,
  open,
  reducedMotion,
  children,
}: {
  id: string;
  open: boolean;
  reducedMotion: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      style={{
        display: "grid",
        gridTemplateRows: open ? "1fr" : "0fr",
        transition: reducedMotion ? "none" : "grid-template-rows 200ms ease",
      }}
    >
      {/* overflow:hidden both clips the closed state and lets the grid row shrink
          to 0 (min-height:auto resolves to 0 when overflow != visible). */}
      <div style={{ overflow: "hidden" }} inert={!open}>
        {children}
      </div>
    </div>
  );
}

export default function PostArchive({ entries, currentSlug, variant }: PostArchiveProps) {
  const t = useTranslations("blog.archive");
  const locale = useLocale();
  const format = useFormatter();
  const reducedMotion = useReducedMotion();
  const baseId = useId();

  const years = useMemo(() => groupArchive(entries), [entries]);

  // One set for both levels: a year key ("2026") and a month key ("2026-09") can never
  // collide. Collapsing a year leaves its months' keys in place, so re-opening it
  // restores whatever the reader had open inside.
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => {
    const path = defaultOpenPath(years, currentSlug);
    return new Set(path ? [path.year, path.month] : []);
  });

  const toggle = (key: string) =>
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const dayLabel = (date: string) =>
    format.dateTime(new Date(`${date}T00:00:00Z`), {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });

  const monthLabel = (month: ArchiveMonth) =>
    capitaliseFirst(
      format.dateTime(new Date(`${month.key}-01T00:00:00Z`), { month: "long", timeZone: "UTC" }),
      locale,
    );

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

      <ul className="post-archive-years">
        {years.map((year) => {
          const yearOpen = openKeys.has(year.key);
          const yearId = `${baseId}-${year.key}`;
          const yearTotal = year.months.reduce((n, m) => n + m.entries.length, 0);

          return (
            <li key={year.key}>
              <button
                type="button"
                className="post-archive-year"
                aria-expanded={yearOpen}
                aria-controls={yearId}
                onClick={() => toggle(year.key)}
              >
                <span>{year.key}</span>
                {/* The digit is decorative for AT; the count is spoken in words. */}
                <span className="post-archive-count" aria-hidden="true">{yearTotal}</span>
                <span className="sr-only">{t("count", { count: yearTotal })}</span>
                <Chevron open={yearOpen} reducedMotion={reducedMotion} />
              </button>

              <Collapsible id={yearId} open={yearOpen} reducedMotion={reducedMotion}>
                <ul className="post-archive-months">
                  {year.months.map((month) => {
                    const monthOpen = openKeys.has(month.key);
                    const monthId = `${baseId}-${month.key}`;

                    return (
                      <li key={month.key}>
                        <button
                          type="button"
                          className="post-archive-month"
                          aria-expanded={monthOpen}
                          aria-controls={monthId}
                          onClick={() => toggle(month.key)}
                        >
                          <span>{monthLabel(month)}</span>
                          <span className="post-archive-count" aria-hidden="true">
                            {month.entries.length}
                          </span>
                          <span className="sr-only">{t("count", { count: month.entries.length })}</span>
                          <Chevron open={monthOpen} reducedMotion={reducedMotion} />
                        </button>

                        <Collapsible id={monthId} open={monthOpen} reducedMotion={reducedMotion}>
                          <ul className="post-archive-entries">
                            {month.entries.map((entry) => (
                              <li key={entry.slug}>
                                {/* prefetch off: the pane lists EVERY post on every
                                    post, and viewport prefetch would fetch them all. */}
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
                        </Collapsible>
                      </li>
                    );
                  })}
                </ul>
              </Collapsible>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

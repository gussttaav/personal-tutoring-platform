/*
 * BLOG-02 — "Para profundizar", the per-post further-reading block.
 *
 * The blog's counterpart to `LessonReading` (COURSE-P8-01), and written fresh rather
 * than imported for the reason BLOG-01 gave for duplicating the MDX plugin chains:
 * that module lives in the course tree, reads the `courses.reading` namespace and is
 * styled by `lesson.css`, which this route does not load. What is shared is what should
 * be — `ReadingItemSchema`, the `ReadingItem` type and `tallyKinds`, none of which pull
 * a component tree behind them.
 *
 * A Server Component on a native <details>: zero client JS, and the entries stay in the
 * prerendered HTML while the block is closed, so they are indexable and reachable by
 * find-in-page.
 *
 * Placement (the post route): after the MDX body, before the prev/next nav. The
 * article's last paragraph stays the last thing the reader reads.
 *
 * Renders NOTHING when the post declares `reading: []`.
 */

import { getTranslations } from "next-intl/server";

import type { ReadingItem } from "@/domain/types";
import { tallyKinds } from "@/lib/courses/reading-summary";

interface PostReadingProps {
  reading: ReadingItem[];
  locale:  string;
}

export default async function PostReading({ reading, locale }: PostReadingProps) {
  if (reading.length === 0) return null;

  const t = await getTranslations({ locale, namespace: "blog.reading" });

  // "8 fuentes · 5 papers, 2 artículos, 1 interactivo"
  const breakdown = tallyKinds(reading)
    .map((tally) => t(`kindCount.${tally.kind}`, { count: tally.count }))
    .join(", ");

  return (
    <details className="post-reading">
      <summary className="post-reading-summary">
        <svg
          className="post-reading-chevron"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        <span className="post-reading-kicker">{t("title")}</span>
        {/* The count is what tells a reader there is anything behind the fold, so it
            survives every viewport; the per-kind breakdown is dropped on narrow
            screens rather than wrapping the summary to three lines. */}
        <span className="post-reading-count">
          {t("count", { count: reading.length })}
          <span className="post-reading-breakdown"> · {breakdown}</span>
        </span>
      </summary>

      <div className="post-reading-body">
        <p className="post-reading-lede">{t("lede")}</p>

        <ul className="post-reading-items">
          {reading.map((item) => (
            <li key={item.url} className="post-reading-item">
              <a
                className="post-reading-title"
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {item.title}
              </a>

              <div className="post-reading-meta">
                <span className="post-reading-kind" data-kind={item.kind}>
                  {t(`kind.${item.kind}`)}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {item.authors}
                  {item.year ? `, ${item.year}` : ""}
                </span>
                <span aria-hidden="true">·</span>
                <span>{item.venue}</span>
                <span className="post-reading-lang" title={t(`lang.${item.lang}`)}>
                  {item.lang.toUpperCase()}
                </span>
              </div>

              <p className="post-reading-note">{item.note}</p>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

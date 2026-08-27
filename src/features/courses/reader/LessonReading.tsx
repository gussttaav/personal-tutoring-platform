/*
 * COURSE-P8-01 — "Para profundizar", the per-lesson further-reading block.
 *
 * A Server Component on a native <details>, the same idiom as `Details` in
 * mdx-components.tsx and the sidebar's block accordion: it ships ZERO client JS, and
 * the entries stay in the prerendered HTML while the block is closed — indexable, and
 * reachable by find-in-page in browsers that open a closed <details> for a match.
 *
 * Placement (LessonLayout): after the MDX body, BEFORE `LessonComplete`. The lesson's
 * last prose is the bridge (AUTHORING.md §1), and it stays that way — this block joins
 * the footer chrome that mark-complete and prev/next already form, rather than putting
 * a section between the bridge and the end of the lesson.
 *
 * Collapsed by default, which is a real trade and not a free one: what the fold hides
 * is the `note`, the one line that makes this a reading list rather than a link dump.
 * Two things pay for it — the summary carries a count and a per-kind breakdown so the
 * closed state still advertises what is inside, and the cap of five (READING_MAX)
 * keeps the open state short enough to be worth the click.
 *
 * Renders NOTHING when the lesson declares `reading: []`. A lesson with no natural
 * primary source — lesson 1 is the obvious one — should not grow an empty box, and an
 * invented citation there would be worse than silence.
 */

import { getTranslations } from "next-intl/server";

import type { ReadingItem } from "@/domain/types";
import { tallyKinds } from "@/lib/courses/reading-summary";

interface LessonReadingProps {
  reading: ReadingItem[];
  locale:  string;
}

export default async function LessonReading({ reading, locale }: LessonReadingProps) {
  if (reading.length === 0) return null;

  const t = await getTranslations({ locale, namespace: "courses.reading" });

  // "5 fuentes · 3 papers, 1 libro, 1 interactivo"
  const breakdown = tallyKinds(reading)
    .map((tally) => t(`kindCount.${tally.kind}`, { count: tally.count }))
    .join(", ");

  return (
    <details className="lesson-reading">
      <summary className="lesson-reading-summary">
        <svg
          className="lesson-reading-chevron"
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
        <span className="lesson-reading-kicker">{t("title")}</span>
        {/* The count is the part that must survive every viewport — it is what tells a
            student there is anything behind the fold. The per-kind breakdown is the
            nice-to-have, and CSS drops it on a narrow screen rather than letting the
            summary wrap to three lines. */}
        <span className="lesson-reading-count">
          {t("count", { count: reading.length })}
          <span className="lesson-reading-breakdown"> · {breakdown}</span>
        </span>
      </summary>

      <div className="lesson-reading-body">
        <p className="lesson-reading-lede">{t("lede")}</p>

        <ul className="lesson-reading-items" style={{ listStyle: "none" }}>
          {reading.map((item) => (
            <li key={item.url} className="lesson-reading-item">
              <a
                className="lesson-reading-title"
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {item.title}
              </a>

              <div className="lesson-reading-meta">
                <span className="lesson-reading-kind" data-kind={item.kind}>
                  {t(`kind.${item.kind}`)}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {item.authors}
                  {item.year ? `, ${item.year}` : ""}
                </span>
                <span aria-hidden="true">·</span>
                <span>{item.venue}</span>
                {/* The chip is two letters; the title attribute is what says which
                    language it actually means, for a reader who needs it spelled out. */}
                <span className="lesson-reading-lang" title={t(`lang.${item.lang}`)}>
                  {item.lang.toUpperCase()}
                </span>
              </div>

              <p className="lesson-reading-note">{item.note}</p>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

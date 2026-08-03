/*
 * COURSE-P1-04 — Prev/next lesson footer.
 *
 * Server Component. Fed by `lessonNeighbours` (src/lib/courses/registry.ts), which
 * walks the PUBLISHED, (block, order)-sorted list — so drafts are skipped and each
 * side is correctly `null` at the ends of the course.
 *
 * COURSE-P5-01 — restyled, and the presentation moved to lesson.css (`.lesson-nav*`).
 * Three things changed, all driven by how long the titles in this course actually are
 * ("Tokenización: palabras, caracteres, subpalabras"):
 *
 *   - The arrow has its own column instead of sitting inside the label, so the title
 *     gets the card's full text width and the card reads as a control.
 *   - A lone neighbour now fills the row. It used to render an empty spacer opposite,
 *     which pinned the card to half the column — the width where these titles wrap —
 *     and left a hole beside it at the two ends of the course. Direction is carried by
 *     the arrow and the alignment, which is what a reader looks at anyway.
 *   - Hover/focus states, which inline styles cannot express: the border and arrow take
 *     the accent colour and the arrow nudges the way it points.
 *
 * The title stays clamped to two lines rather than ellipsed on one — the destination is
 * the whole point of the card — and `overflow-wrap: anywhere` covers a title made of one
 * unbreakable word.
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { LessonRef } from "@/domain/types";

interface LessonNavProps {
  courseSlug: string;
  prev:       LessonRef | null;
  next:       LessonRef | null;
  locale:     string;
}

export default async function LessonNav({ courseSlug, prev, next, locale }: LessonNavProps) {
  const t = await getTranslations({ locale, namespace: "courses.reader" });

  // Nothing to render at all would only happen in a one-lesson course, but an empty
  // <nav> with a label is noise for a screen reader either way.
  if (!prev && !next) return null;

  return (
    <nav aria-label={t("lessonNav")} className="lesson-nav">
      {prev ? (
        <Link
          href={`/cursos/${courseSlug}/${prev.slug}`}
          rel="prev"
          className="lesson-nav-card"
          data-dir="prev"
        >
          <span className="lesson-nav-arrow" aria-hidden="true">←</span>
          <span className="lesson-nav-text">
            <span className="lesson-nav-label">{t("previous")}</span>
            <span className="lesson-nav-title">{prev.title}</span>
          </span>
        </Link>
      ) : null}

      {next ? (
        <Link
          href={`/cursos/${courseSlug}/${next.slug}`}
          rel="next"
          className="lesson-nav-card"
          data-dir="next"
        >
          <span className="lesson-nav-text">
            <span className="lesson-nav-label">{t("next")}</span>
            <span className="lesson-nav-title">{next.title}</span>
          </span>
          <span className="lesson-nav-arrow" aria-hidden="true">→</span>
        </Link>
      ) : null}
    </nav>
  );
}

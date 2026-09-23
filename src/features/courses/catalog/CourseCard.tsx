/*
 * COURSE-P1-03 / landing-refinements — Catalog card.
 *
 * Server Component (its static content ships as HTML). Shows a course's headline metadata —
 * level, title, tagline, lesson/block counts — in the same editorial voice as the landing hero:
 * the display serif with the after-the-colon tail in accent italic (see CourseHero), a corner
 * `HeroMotif`, and the shared card surface. The visual language + hover live in `catalog.css`.
 *
 * Two navigations coexist (per review feedback):
 *   - "Ver curso" → the landing page. It is the whole-card cover link (`.card-cover`), so a click
 *     anywhere on the card opens the landing — the affordance the old single-<Link> card had.
 *   - "Continuar donde lo dejaste" → the reader's last lesson, skipping the landing. Per-user and
 *     client-resolved, so it is rendered by the `CourseCardActions` island, which shows nothing for
 *     new/anonymous readers. That is why this card is a <div>, not one big <Link>.
 *
 * COURSE-ACCENT-01: `accent` is the manifest's per-course hue. The card sets it as custom
 * properties on its own root and `catalog.css` paints the level badge, the title tail, the CTA,
 * the resume bar, the hover bloom and the corner motif from them — so one manifest key repaints
 * every chromatic channel at once. A course without `accent` sets nothing and the stylesheet
 * falls back to `--green`, i.e. exactly what shipped before. See `../course-accent.ts`.
 *
 * COURSE-P6-03: `contentLocale` is the locale the LESSONS resolved in, which can differ from the
 * page locale while a course is translated only at the manifest level. When it does, the card says
 * so (the content-language badge), and it is threaded into the "Continuar" lesson href.
 *
 * Counts are computed by the caller from the PUBLISHED-only registry selectors, so drafts never
 * inflate them. The card's strings live under `courses.catalog.card.*`.
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Course } from "@/domain/types";
import HeroMotif from "@/features/courses/HeroMotif";
import { courseAccentVars } from "@/features/courses/course-accent";
import CourseCardActions from "./CourseCardActions";

interface CourseCardProps {
  course: Course;
  lessonCount: number;
  blockCount: number;
  locale: string;
  /** Locale the lessons resolved in. Omit when it always equals `locale`. */
  contentLocale?: string;
}

export default async function CourseCard({
  course,
  lessonCount,
  blockCount,
  locale,
  contentLocale,
}: CourseCardProps) {
  const t = await getTranslations({ locale, namespace: "courses.catalog.card" });
  const translated = contentLocale === undefined || contentLocale === locale;

  // Editorial accent: everything after the first ": " is set in the accent hue, italic (hero-like).
  const [titleHead, ...titleRest] = course.title.split(": ");
  const titleTail = titleRest.join(": ");

  return (
    <div className="course-card" style={courseAccentVars(course.accent)}>
      {course.heroMotif ? (
        <span className="course-card__motif" aria-hidden="true">
          <HeroMotif kind={course.heroMotif} size={232} />
        </span>
      ) : null}

      {/* Level + (when the lessons are in another language) the content-language badge */}
      <div className="course-card__pills">
        <span className="course-card__badge course-card__badge--level">{course.level}</span>
        {!translated && (
          <span className="course-card__badge course-card__badge--lang">{t("contentLanguage")}</span>
        )}
      </div>

      <div className="course-card__body">
        <h3 className="course-card__title lp-serif">
          {titleHead}
          {titleTail ? <span className="accent">{`: ${titleTail}`}</span> : null}
        </h3>
        <p className="course-card__tagline">{course.tagline}</p>
      </div>

      <div className="course-card__meta">
        <span>{t("lessons", { count: lessonCount })}</span>
        <span className="course-card__dot" aria-hidden="true" />
        <span>{t("blocks", { count: blockCount })}</span>
      </div>

      {/* Progress-aware "Continuar" (client, per-user). Renders nothing without progress. */}
      <CourseCardActions
        courseSlug={course.slug}
        courseTitle={course.title}
        contentLocale={translated ? undefined : contentLocale}
      />

      {/* Standing CTA + whole-card cover link → the course landing page. */}
      <Link
        href={`/cursos/${course.slug}`}
        className="course-card__cta card-cover"
        aria-label={`${t("cta")} — ${course.title}`}
      >
        {t("cta")}
        <span className="material-symbols-outlined arrow" style={{ fontSize: "1.125rem" }} aria-hidden="true">
          arrow_forward
        </span>
      </Link>
    </div>
  );
}

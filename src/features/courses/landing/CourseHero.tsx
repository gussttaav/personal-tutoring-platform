/*
 * COURSE-P1-03 — Course landing hero.
 *
 * Server Component. Leads with the course title/tagline and, above all, WHAT YOU
 * WILL HAVE BUILT by the end — the single strongest conversion signal. `firstLessonSlug`
 * is null until P5 publishes a lesson; the primary CTA degrades to a disabled "soon"
 * state rather than linking nowhere.
 *
 * COURSE-P6-03: `contentLocale` is the locale the LESSONS live in, which differs from the
 * page locale while a course is translated only at the manifest level. It is passed straight
 * to next-intl's <Link locale=…>, which emits the EXPLICIT prefix (`/es/cursos/...`) even
 * though `as-needed` makes the Spanish URL unprefixed. That prefix is load-bearing, not
 * noise: locale detection is pathname → NEXT_LOCALE cookie → default (see src/middleware.ts),
 * so an unprefixed `/cursos/...` clicked by a reader whose cookie says `en` would be sent to
 * `/en/cursos/...` and 404. The prefixed URL flips the cookie to `es` and redirects to the
 * canonical unprefixed one — which is also correct, because following this link means the
 * reader is now reading the Spanish site.
 *
 * Layout note: the meta row is deliberately its own block so a progress bar can
 * slot in beneath it without a redesign. COURSE-P4-02 fills that slot with `CourseProgressResume`
 * — a client leaf, because this page is static and readable signed-out, so progress is
 * fetched after hydration. It renders nothing for a visitor with nothing to resume.
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Course } from "@/domain/types";
import CourseProgressResume from "./CourseProgressResume";

interface CourseHeroProps {
  course: Course;
  lessonCount: number;
  firstLessonSlug: string | null;
  locale: string;
  /** Locale the lessons live in. Omit when it always equals `locale`. */
  contentLocale?: string;
}

export default async function CourseHero({
  course,
  lessonCount,
  firstLessonSlug,
  locale,
  contentLocale,
}: CourseHeroProps) {
  const t = await getTranslations({ locale, namespace: "courses.landing.hero" });

  return (
    <section style={{ paddingTop: "48px", paddingBottom: "8px" }}>
      <h1
        style={{
          fontFamily: "var(--font-headline, Manrope), sans-serif",
          fontSize: "clamp(2rem, 5vw, 3.25rem)",
          fontWeight: 800,
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
          color: "var(--text)",
          margin: 0,
        }}
      >
        {course.title}
      </h1>

      <p
        style={{
          marginTop: "16px",
          maxWidth: "680px",
          fontSize: "clamp(1rem, 2.2vw, 1.25rem)",
          lineHeight: 1.6,
          color: "var(--text-muted)",
        }}
      >
        {course.tagline}
      </p>

      {/* What you'll build — the conversion lever */}
      <div
        style={{
          marginTop: "28px",
          maxWidth: "680px",
          padding: "20px 24px",
          background: "var(--green-dim)",
          border: "1px solid var(--green-mid)",
          borderRadius: "var(--radius)",
        }}
      >
        <p
          style={{
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--green)",
            margin: "0 0 8px",
          }}
        >
          {t("outcomeLabel")}
        </p>
        <p style={{ fontSize: "1.0625rem", lineHeight: 1.55, color: "var(--text)", margin: 0 }}>
          {t("outcome")}
        </p>
      </div>

      {/* Meta row — the progress bar slots in directly below it. */}
      <div
        style={{
          marginTop: "24px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "12px",
          fontSize: "0.875rem",
          color: "var(--text-dim)",
        }}
      >
        <span>
          {t("levelLabel")}: <strong style={{ color: "var(--text-muted)" }}>{course.level}</strong>
        </span>
        <span aria-hidden="true">·</span>
        <span>{t("hours", { hours: course.estimatedHours })}</span>
        {lessonCount > 0 ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{t("lessons", { count: lessonCount })}</span>
          </>
        ) : null}
      </div>

      <CourseProgressResume courseSlug={course.slug} contentLocale={contentLocale} />

      <div style={{ marginTop: "28px" }}>
        {firstLessonSlug ? (
          <Link
            href={`/cursos/${course.slug}/${firstLessonSlug}`}
            locale={contentLocale}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "14px 28px",
              background: "linear-gradient(135deg, #4edea3, #10b981)",
              color: "#003824",
              borderRadius: "10px",
              fontFamily: "var(--font-headline, Manrope), sans-serif",
              fontWeight: 700,
              fontSize: "0.95rem",
              textDecoration: "none",
              boxShadow: "0 8px 32px rgba(78,222,163,0.25)",
            }}
          >
            {t("start")}
            <span className="material-symbols-outlined" style={{ fontSize: "1.25rem" }} aria-hidden="true">
              arrow_forward
            </span>
          </Link>
        ) : (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "14px 28px",
              borderRadius: "10px",
              border: "1px solid var(--border-variant)",
              color: "var(--text-dim)",
              fontFamily: "var(--font-headline, Manrope), sans-serif",
              fontWeight: 700,
              fontSize: "0.95rem",
            }}
          >
            {t("soon")}
          </span>
        )}
      </div>
    </section>
  );
}

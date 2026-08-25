/*
 * COURSE-P1-03 — Catalog card.
 *
 * Server Component (zero client JS). Shows a course's headline metadata: title,
 * tagline, level, hours, lesson count and block count. Counts are computed by the
 * caller from the PUBLISHED-only registry selectors, so drafts never inflate them.
 * Hover styling is CSS-only (`.course-card` rules live in the catalog page's <style>).
 *
 * COURSE-P6-03: `contentLocale` is the locale the LESSONS resolved in, which can differ from
 * the page locale while a course is translated only at the manifest level. When it does, the
 * card says so — an English visitor should learn the lessons are in Spanish here, not after
 * clicking through.
 *
 * Namespace fix: the card's four strings live under `courses.catalog.card.*`, but this
 * resolved them against `courses.catalog`, so every one of them threw MISSING_MESSAGE.
 * It stayed invisible while no course had a published lesson (the catalog rendered its
 * empty state and this component never ran) and surfaced as soon as one did.
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Course } from "@/domain/types";

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

  return (
    <Link
      href={`/cursos/${course.slug}`}
      className="course-card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        padding: "28px",
        background: "var(--surface-container)",
        border: "1px solid var(--border-variant)",
        borderRadius: "16px",
        textDecoration: "none",
        transition: "border-color 0.2s, transform 0.2s",
      }}
    >
      {/* Level + (when the lessons are in another language) the content-language badge */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--green)",
            background: "var(--green-dim)",
            border: "1px solid var(--green-mid)",
            borderRadius: "100px",
            padding: "4px 12px",
          }}
        >
          {course.level}
        </span>
        {!translated && (
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-dim)",
              border: "1px solid var(--border-variant)",
              borderRadius: "100px",
              padding: "4px 12px",
            }}
          >
            {t("contentLanguage")}
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <h3
          style={{
            fontFamily: "var(--font-headline, Manrope), sans-serif",
            fontSize: "1.375rem",
            fontWeight: 700,
            lineHeight: 1.25,
            color: "var(--text)",
            margin: 0,
          }}
        >
          {course.title}
        </h3>
        <p
          style={{
            fontSize: "0.9375rem",
            lineHeight: 1.6,
            color: "var(--text-muted)",
            margin: 0,
          }}
        >
          {course.tagline}
        </p>
      </div>

      {/* Meta row */}
      <div
        style={{
          marginTop: "auto",
          paddingTop: "16px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          flexWrap: "wrap",
          gap: "16px",
          fontSize: "0.8125rem",
          color: "var(--text-dim)",
        }}
      >
        <span>{t("hours", { hours: course.estimatedHours })}</span>
        <span>{t("lessons", { count: lessonCount })}</span>
        <span>{t("blocks", { count: blockCount })}</span>
      </div>

      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "0.875rem",
          fontWeight: 600,
          color: "var(--green)",
        }}
      >
        {t("cta")}
        <span className="material-symbols-outlined" style={{ fontSize: "1.125rem" }} aria-hidden="true">
          arrow_forward
        </span>
      </span>
    </Link>
  );
}

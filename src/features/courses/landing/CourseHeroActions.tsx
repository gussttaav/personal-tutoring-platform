"use client";

/*
 * landing-refinements — the hero's call-to-action, made progress-aware.
 *
 * Replaces the old split of "a static start button + a separate resume card". The rule the
 * redesign settled on is REPLACE, not coexist: a returning reader with progress should not
 * be told to "start" a course they are midway through. So this one client leaf owns the
 * primary action and shows exactly one of:
 *   - the RESUME card (progress bar + "continue where you left off") when progress exists;
 *   - the START button otherwise (or a disabled "soon" pill until the first lesson ships).
 * The secondary "view syllabus" link is always present.
 *
 * Client-side for the same reason `CourseProgressResume` was (P4-02): the landing page is
 * statically generated and readable signed-out, so progress is unknown until after hydration.
 * Until it resolves, `tracking` is false and the START state renders — a returning reader sees
 * it for a beat before it swaps to RESUME, the same trade-off the old resume card already made.
 *
 * COURSE-P6-03: `contentLocale` is the locale the LESSONS live in — passed to <Link locale=…>
 * so a lesson href crosses locales on purpose rather than 404ing under /en. See CourseHero.
 */

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useCourseProgress } from "@/hooks/useCourseProgress";

interface CourseHeroActionsProps {
  courseSlug: string;
  firstLessonSlug: string | null;
  /** Locale the lessons live in. Omit when it equals the page's. */
  contentLocale?: string;
}

const primaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  padding: "15px 28px",
  background: "linear-gradient(135deg, #4edea3, #10b981)",
  color: "var(--green-on)",
  borderRadius: "11px",
  fontFamily: "var(--font-headline, Manrope), sans-serif",
  fontWeight: 700,
  fontSize: "0.95rem",
  textDecoration: "none",
  boxShadow: "0 10px 34px rgba(78,222,163,0.26)",
};

const secondaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "15px 24px",
  borderRadius: "11px",
  border: "1px solid var(--border-variant)",
  color: "var(--text)",
  fontFamily: "var(--font-headline, Manrope), sans-serif",
  fontWeight: 600,
  fontSize: "0.95rem",
  textDecoration: "none",
};

export default function CourseHeroActions({
  courseSlug,
  firstLessonSlug,
  contentLocale,
}: CourseHeroActionsProps) {
  const t = useTranslations("courses.landing.hero");
  const tp = useTranslations("courses.progress");
  // No `lessonSlug`: viewing the landing page is not viewing a lesson — this only reads.
  const progress = useCourseProgress({ courseSlug });

  const resuming = progress.tracking && progress.lastSeenLessonSlug !== null;

  return (
    <div className="lp-hero-actions" style={{ marginTop: "34px" }}>
      {resuming ? (
        <div
          className="lp-hero-actions__primary"
          style={{
            padding: "18px 22px",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
            background: "var(--surface-high)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
              {tp("lessonsDone", {
                done: progress.completedLessons,
                total: progress.totalLessons,
              })}
            </span>
            <Link
              href={`/cursos/${courseSlug}/${progress.lastSeenLessonSlug}`}
              locale={contentLocale}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontFamily: "var(--font-headline, Manrope), sans-serif",
                fontWeight: 700,
                fontSize: "0.875rem",
                color: "var(--green)",
                textDecoration: "none",
              }}
            >
              {tp("resume")}
              <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: "1.1rem" }}>
                arrow_forward
              </span>
            </Link>
          </div>
          <div
            aria-hidden="true"
            style={{
              height: "6px",
              marginTop: "12px",
              borderRadius: "999px",
              background: "var(--surface)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress.percentComplete}%`,
                background: "var(--green)",
                borderRadius: "999px",
                transition: "width 200ms ease",
              }}
            />
          </div>
        </div>
      ) : firstLessonSlug ? (
        <Link
          href={`/cursos/${courseSlug}/${firstLessonSlug}`}
          locale={contentLocale}
          style={primaryButtonStyle}
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
            justifyContent: "center",
            padding: "15px 28px",
            borderRadius: "11px",
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

      <a href="#temario" className="lp-hero-actions__secondary" style={secondaryButtonStyle}>
        {t("viewSyllabus")}
      </a>
    </div>
  );
}

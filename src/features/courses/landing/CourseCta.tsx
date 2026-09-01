"use client";

/*
 * COURSE-P1-03 / landing-refinements — Closing CTA, made progress-aware.
 *
 * Mirrors the hero's two-state rule (see CourseHeroActions): a reader with progress is invited
 * to CONTINUE, not to start over. So this renders one of two voices:
 *   - RETURNING: a generic "pick up where you left off" heading/body + a progress read-out +
 *     a "continue the course" button pointing at the last-seen lesson. This copy is course-
 *     agnostic, so it lives in messages (courses.landing.cta.*), not the manifest.
 *   - FIRST VISIT: the manifest's own `course.cta` heading/body — per-course prose ("no account
 *     needed to read" is dl-nlp's pitch) — + the "start the course" button (or "soon").
 *
 * Client-side because progress is only known after hydration (P4-02); the first-visit state is
 * what server-renders, so its copy is in the initial HTML and a returning reader sees it swap.
 *
 * COURSE-P6-03: `contentLocale` is the lesson locale, passed to <Link locale=…> so the href
 * crosses locales deliberately. See CourseHero for the full rationale.
 */

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Course } from "@/domain/types";
import { useCourseProgress } from "@/hooks/useCourseProgress";

interface CourseCtaProps {
  courseSlug: string;
  // `Course["cta"]` rather than the `CourseCta` domain type — that name is this component.
  cta: Course["cta"];
  firstLessonSlug: string | null;
  /** Locale the lessons live in. Omit when it equals the page's. */
  contentLocale?: string;
}

const buttonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "16px 34px",
  background: "linear-gradient(135deg, #4edea3, #10b981)",
  color: "var(--green-on)",
  borderRadius: "11px",
  fontFamily: "var(--font-headline, Manrope), sans-serif",
  fontWeight: 700,
  fontSize: "0.95rem",
  textDecoration: "none",
  boxShadow: "0 12px 36px rgba(78,222,163,0.28)",
};

export default function CourseCta({
  courseSlug,
  cta,
  firstLessonSlug,
  contentLocale,
}: CourseCtaProps) {
  const t = useTranslations("courses.landing.cta");
  const tp = useTranslations("courses.progress");
  const progress = useCourseProgress({ courseSlug });

  const resuming = progress.tracking && progress.lastSeenLessonSlug !== null;

  const overline = resuming ? t("resumeOverline") : t("overline");
  const heading = resuming ? t("resumeHeading") : cta.heading;
  const body = resuming ? t("resumeBody") : cta.body;

  return (
    <section style={{ paddingTop: "48px", paddingBottom: "64px" }}>
      <div
        style={{
          position: "relative",
          padding: "48px 40px",
          textAlign: "center",
          borderRadius: "24px",
          border: "1px solid var(--green-mid)",
          background: "linear-gradient(135deg, rgba(78,222,163,0.08) 0%, rgba(16,185,129,0.04) 100%)",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: "-160px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "640px",
            height: "320px",
            background: "radial-gradient(circle at 50% 100%, rgba(78,222,163,0.12) 0%, rgba(19,19,21,0) 68%)",
            pointerEvents: "none",
          }}
        />

        <p className="lp-kicker" style={{ position: "relative", margin: 0 }}>
          {overline}
        </p>

        <h2
          className="lp-serif"
          style={{
            position: "relative",
            fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
            fontWeight: 500,
            letterSpacing: "-0.01em",
            lineHeight: 1.1,
            color: "var(--text)",
            margin: "14px auto 0",
            maxWidth: "620px",
          }}
        >
          {heading}
        </h2>

        <p
          style={{
            position: "relative",
            maxWidth: "500px",
            margin: "14px auto 0",
            fontSize: "1rem",
            lineHeight: 1.6,
            color: "var(--text-muted)",
          }}
        >
          {body}
        </p>

        {resuming ? (
          <div style={{ position: "relative", maxWidth: "340px", margin: "22px auto 0" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontFamily: "var(--font-headline, Manrope), sans-serif",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--text-dim)",
              }}
            >
              <span>
                {tp("lessonsDone", { done: progress.completedLessons, total: progress.totalLessons })}
              </span>
              <span>{progress.percentComplete}%</span>
            </div>
            <div
              aria-hidden="true"
              style={{
                height: "6px",
                marginTop: "8px",
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
        ) : null}

        <div style={{ position: "relative", marginTop: "26px", display: "flex", justifyContent: "center" }}>
          {resuming ? (
            <Link
              href={`/cursos/${courseSlug}/${progress.lastSeenLessonSlug}`}
              locale={contentLocale}
              style={buttonStyle}
            >
              {t("resume")}
              <span className="material-symbols-outlined" style={{ fontSize: "1.25rem" }} aria-hidden="true">
                arrow_forward
              </span>
            </Link>
          ) : firstLessonSlug ? (
            <Link href={`/cursos/${courseSlug}/${firstLessonSlug}`} locale={contentLocale} style={buttonStyle}>
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
                padding: "16px 34px",
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
        </div>
      </div>
    </section>
  );
}

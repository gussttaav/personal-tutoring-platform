"use client";

/*
 * COURSE-P4-02 — "continuar donde lo dejaste" in the landing hero.
 *
 * Drops into the slot P1-03 reserved under the hero's meta row. Client-side for the
 * same reason as everything else in this task: the landing page is statically
 * generated and readable signed-out, so the reader's identity is not known until
 * after hydration.
 *
 * Renders nothing unless progress is tracked AND there is somewhere to resume — a
 * signed-in visitor who has never opened a lesson sees the untouched hero and its
 * "start the course" CTA, which is the right call to action for them.
 */

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useCourseProgress } from "@/hooks/useCourseProgress";

interface CourseProgressResumeProps {
  courseSlug: string;
  /** COURSE-P6-03: locale the lessons live in — see CourseHero. Omit when it equals the page's. */
  contentLocale?: string;
}

export default function CourseProgressResume({
  courseSlug,
  contentLocale,
}: CourseProgressResumeProps) {
  const t = useTranslations("courses.progress");
  // No `lessonSlug`: viewing the landing page is not viewing a lesson, so this
  // records nothing — it only reads.
  const progress = useCourseProgress({ courseSlug });

  if (!progress.tracking || !progress.lastSeenLessonSlug) return null;

  const { completedLessons, totalLessons, percentComplete, lastSeenLessonSlug } = progress;

  return (
    <div
      style={{
        marginTop: "24px",
        maxWidth: "680px",
        padding: "16px 20px",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        background: "var(--surface-high)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-muted)" }}>
          {t("lessonsDone", { done: completedLessons, total: totalLessons })}
        </p>
        <Link
          href={`/cursos/${courseSlug}/${lastSeenLessonSlug}`}
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
          {t("resume")}
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
            width: `${percentComplete}%`,
            background: "var(--green)",
            borderRadius: "999px",
            transition: "width 200ms ease",
          }}
        />
      </div>
    </div>
  );
}

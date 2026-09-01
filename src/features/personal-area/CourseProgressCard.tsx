"use client";

/*
 * COURSE-P4-03 — one enrolled course inside the "Mis cursos" tab.
 *
 * Presentational: everything it needs is already merged server-side into
 * `EnrolledCourseView`. Styling now lives in area-personal.css alongside the rest
 * of the dashboard instead of in inline style objects.
 *
 * Two link targets, both deliberate:
 *   - "continuar" goes to `resumeLessonSlug`, which the API already resolved to
 *     lastSeen → first published lesson → null; `null` means the course has no
 *     published lesson to open, so the landing page is the honest destination.
 *   - a COMPLETED course offers a 1:1 session instead. Someone who finished the
 *     course is the best-qualified lead the site produces, and there is nothing
 *     left to continue.
 *
 * `locale={view.contentLocale}` on the course links: the content may only exist in
 * Spanish, and sending an English reader to a lesson that has no English tree is a
 * 404. The booking link keeps the reader's own locale — the home page has both.
 */

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { EnrolledCourseView } from "@/domain/types";
import type { CourseProgressCardProps } from "./types";

/** Exported for unit tests — this repo has no jsdom, so the logic is tested here. */
export function resumeHref(view: EnrolledCourseView): string {
  return view.resumeLessonSlug
    ? `/cursos/${view.courseSlug}/${view.resumeLessonSlug}`
    : `/cursos/${view.courseSlug}`;
}

export default function CourseProgressCard({ view }: CourseProgressCardProps) {
  const t = useTranslations("areaPersonal.courses");
  const isCompleted = view.completedAt !== null;

  return (
    <div className={`pa-course${isCompleted ? " pa-course--done" : ""}`}>
      <div className="pa-course__top">
        <div className="pa-course__ic">
          <span
            className="material-symbols-outlined"
            aria-hidden="true"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            school
          </span>
        </div>
        <div style={{ minWidth: 0 }}>
          <h4>{view.title}</h4>
          {isCompleted && (
            <span className="pa-badge pa-badge--done" style={{ marginTop: 6 }}>
              <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
              {t("completedBadge")}
            </span>
          )}
        </div>
      </div>

      <div className="pa-course__prog">
        <span>{t("lessonsDone", { done: view.completedLessons, total: view.totalLessons })}</span>
        <b>{t("percent", { percent: view.percentComplete })}</b>
      </div>
      <div
        className="pa-course__track"
        role="progressbar"
        aria-valuenow={view.percentComplete}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={view.title}
      >
        <div className="pa-course__fill" style={{ width: `${view.percentComplete}%` }} />
      </div>

      {isCompleted ? (
        <>
          <p className="pa-course__note">{t("completedNote")}</p>
          <Link href="/?book=session1h" className="pa-btn pa-btn--primary pa-course__cta">
            <span
              className="material-symbols-outlined"
              aria-hidden="true"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              calendar_add_on
            </span>
            {t("bookSessionCta")}
          </Link>
        </>
      ) : (
        <Link
          href={resumeHref(view)}
          locale={view.contentLocale as "es" | "en"}
          className="pa-btn pa-btn--ghost pa-btn--block pa-course__cta"
        >
          <span className="material-symbols-outlined" aria-hidden="true">play_arrow</span>
          {view.completedLessons === 0 ? t("startCta") : t("continueCta")}
        </Link>
      )}
    </div>
  );
}

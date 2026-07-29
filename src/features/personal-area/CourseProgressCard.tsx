"use client";

/*
 * COURSE-P4-03 — one enrolled course inside the "Mis cursos" panel.
 *
 * Presentational: everything it needs is already merged server-side into
 * `EnrolledCourseView`. Styling mirrors PackStatusCard so the panel reads as part of
 * the personal area rather than as a courses component pasted into it.
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

const linkStyle = {
  display:       "inline-flex",
  alignItems:    "center",
  gap:           6,
  padding:       "9px 18px",
  borderRadius:  8,
  fontSize:      11,
  fontWeight:    700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontFamily:    "inherit",
  textDecoration: "none",
  transition:    "opacity 0.15s",
} as const;

export default function CourseProgressCard({ view }: CourseProgressCardProps) {
  const t = useTranslations("areaPersonal.courses");
  const isCompleted = view.completedAt !== null;

  return (
    <div
      style={{
        background:   "#1c1b1d",
        borderRadius: 16,
        padding:      "20px 24px",
        border:       isCompleted
          ? "1px solid rgba(78,222,163,0.15)"
          : "1px solid rgba(255,255,255,0.06)",
        display:       "flex",
        flexDirection: "column",
        gap:           16,
      }}
    >
      {/* ── Title row ── */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div
          style={{
            width:          40,
            height:         40,
            borderRadius:   12,
            background:     "rgba(78,222,163,0.10)",
            border:         "1px solid rgba(78,222,163,0.2)",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            flexShrink:     0,
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 20, color: "#4edea3", fontVariationSettings: "'FILL' 1" }}
          >
            school
          </span>
        </div>
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              fontFamily: "var(--font-headline, Manrope), sans-serif",
              fontSize:   14,
              fontWeight: 700,
              color:      "#e5e1e4",
              margin:     0,
            }}
          >
            {view.title}
          </p>
          {isCompleted && (
            <span
              style={{
                display:       "inline-flex",
                alignItems:    "center",
                gap:           4,
                marginTop:     6,
                fontSize:      9,
                fontWeight:    700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                background:    "rgba(78,222,163,0.10)",
                color:         "#4edea3",
                border:        "1px solid rgba(78,222,163,0.2)",
                borderRadius:  9999,
                padding:       "2px 8px",
              }}
            >
              <span
                className="material-symbols-outlined"
                aria-hidden="true"
                style={{ fontSize: 12, fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
              {t("completedBadge")}
            </span>
          )}
        </div>
      </div>

      {/* ── Progress ── */}
      <div>
        <div
          style={{
            display:        "flex",
            alignItems:     "baseline",
            justifyContent: "space-between",
            gap:            12,
            marginBottom:   6,
          }}
        >
          <p style={{ fontSize: 11, color: "#86948a", margin: 0 }}>
            {t("lessonsDone", { done: view.completedLessons, total: view.totalLessons })}
          </p>
          <p
            style={{
              fontFamily: "var(--font-headline, Manrope), sans-serif",
              fontSize:   13,
              fontWeight: 800,
              color:      "#4edea3",
              margin:     0,
            }}
          >
            {t("percent", { percent: view.percentComplete })}
          </p>
        </div>
        <div
          aria-hidden="true"
          style={{
            height:       6,
            borderRadius: 9999,
            background:   "rgba(78,222,163,0.10)",
            overflow:     "hidden",
          }}
        >
          <div
            style={{
              width:        `${view.percentComplete}%`,
              height:       "100%",
              borderRadius: 9999,
              background:   "linear-gradient(90deg, #4edea3, #10b981)",
              transition:   "width 0.6s cubic-bezier(.4,0,.2,1)",
            }}
          />
        </div>
      </div>

      {/* ── CTA ── */}
      {isCompleted ? (
        <div>
          <p style={{ fontSize: 13, color: "#86948a", margin: "0 0 12px" }}>
            {t("completedNote")}
          </p>
          <Link
            href="/?book=session1h"
            style={{ ...linkStyle, background: "#4edea3", border: "none", color: "#003824" }}
          >
            <span
              className="material-symbols-outlined"
              aria-hidden="true"
              style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}
            >
              calendar_add_on
            </span>
            {t("bookSessionCta")}
          </Link>
        </div>
      ) : (
        <Link
          href={resumeHref(view)}
          locale={view.contentLocale as "es" | "en"}
          style={{
            ...linkStyle,
            alignSelf:  "flex-start",
            background: "transparent",
            border:     "1px solid rgba(78,222,163,0.3)",
            color:      "#4edea3",
          }}
        >
          {view.completedLessons === 0 ? t("startCta") : t("continueCta")}
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 14 }}>
            arrow_forward
          </span>
        </Link>
      )}
    </div>
  );
}

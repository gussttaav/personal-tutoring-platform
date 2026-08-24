"use client";

/*
 * COURSE-P4-02 — the sidebar's per-block lesson list.
 *
 * Split out of `LessonSidebar` (P1-04) because every visual decision here depends on
 * progress, which only exists client-side: the continuous left-border rail (green
 * through completed and current rows, dim for what is ahead), the reserved check slot
 * that keeps ticked and unticked rows aligned, and the list gap, which collapses to 0
 * while tracking so the row borders join into one rail. All styling is P1-04's,
 * carried over unchanged — only the source of `isDone` moved.
 *
 * `data-lesson-slug` is kept as a stable hook for end-to-end selectors.
 */

import { Link } from "@/i18n/navigation";
import { useReaderProgress } from "./CourseProgressProvider";

export interface SidebarLessonItem {
  slug:  string;
  title: string;
}

interface SidebarLessonListProps {
  courseSlug:  string;
  currentSlug: string;
  lessons:     SidebarLessonItem[];
}

export default function SidebarLessonList({
  courseSlug,
  currentSlug,
  lessons,
}: SidebarLessonListProps) {
  const progress = useReaderProgress();
  const tracking = progress?.tracking ?? false;

  return (
    <ol
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: tracking ? "0" : "2px",
      }}
    >
      {lessons.map((lesson, index) => {
        const isCurrent = lesson.slug === currentSlug;
        const isDone = tracking && progress!.completed.has(lesson.slug);
        // COURSE-P5-00 — lesson ordinal WITHIN its block, so prose that says
        // "la lección 3" points at something the reader can actually find. Derived
        // from position, not from the `order` frontmatter: `order` is a sort key that
        // may have gaps, and what a reader counts is rows on the screen.
        const ordinal = index + 1;
        return (
          <li key={lesson.slug}>
            <Link
              href={`/cursos/${courseSlug}/${lesson.slug}`}
              data-lesson-slug={lesson.slug}
              data-lesson-done={tracking ? String(isDone) : undefined}
              aria-current={isCurrent ? "page" : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "7px 12px",
                // Continuous vertical progress rail (left border): green through
                // completed + current, dim for what's ahead. No fill / pill /
                // accent text — "you are here" is carried by brighter, heavier
                // text on the current row, not by a button-like box.
                borderLeft: `2px solid ${
                  isCurrent || isDone
                    ? "var(--green)"
                    : tracking
                      ? "var(--border-variant)"
                      : "transparent"
                }`,
                background: "transparent",
                color: isCurrent ? "var(--text)" : "var(--text-muted)",
                fontWeight: isCurrent ? 600 : 400,
                textDecoration: "none",
                lineHeight: 1.4,
              }}
            >
              {/* Completion slot — reserved only when progress is tracked, so
                  checked and unchecked rows align. */}
              {tracking ? (
                <span
                  className="material-symbols-outlined"
                  aria-hidden="true"
                  style={{
                    flexShrink: 0,
                    width: "18px",
                    fontSize: "1.05rem",
                    color: "var(--green)",
                    visibility: isDone ? "visible" : "hidden",
                  }}
                >
                  check
                </span>
              ) : null}
              {/* Ordinal sits in its own fixed-width, tabular-figures slot so titles
                  align down the column regardless of the number's width. */}
              <span
                style={{
                  flexShrink: 0,
                  minWidth: "1.1rem",
                  fontVariantNumeric: "tabular-nums",
                  fontSize: "0.8125rem",
                  color: isCurrent ? "var(--text-muted)" : "var(--text-dim)",
                }}
              >
                {ordinal}.
              </span>
              <span style={{ minWidth: 0 }}>{lesson.title}</span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

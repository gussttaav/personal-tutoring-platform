"use client";

/*
 * COURSE-P4-02 — the sidebar's "done / total" counter and bar.
 *
 * P1-04 built this block server-side behind a `completedSlugs` prop that could never
 * be filled: the lesson page is statically generated, so the reader's identity is not
 * known at render time. It is a client leaf now, reading the same context every other
 * progress affordance reads, and rendering nothing at all when progress is untracked
 * (signed out) — which is exactly what a signed-out reader saw before.
 *
 * The negative top margin restores P1-04's tighter 12px gap under the back link when
 * the bar is present; the link itself now carries a constant 24px, since the server
 * cannot know whether this block will appear.
 */

import { useTranslations } from "next-intl";
import { useReaderProgress } from "./CourseProgressProvider";

export default function SidebarProgressBar() {
  const t = useTranslations("courses.reader");
  const progress = useReaderProgress();

  if (!progress?.tracking) return null;

  const { completedLessons, totalLessons, percentComplete } = progress;

  return (
    <div style={{ margin: "-12px 0 24px" }}>
      <p
        aria-label={t("progressLabel", { done: completedLessons, total: totalLessons })}
        style={{
          margin: 0,
          fontFamily: "var(--font-headline, Manrope), sans-serif",
          fontSize: "1.05rem",
          fontWeight: 700,
          letterSpacing: "0.02em",
        }}
      >
        <span style={{ color: "var(--green)" }}>{completedLessons}</span>
        <span style={{ color: "var(--text-dim)", fontWeight: 600 }}> / {totalLessons}</span>
      </p>
      <div
        aria-hidden="true"
        style={{
          height: "4px",
          marginTop: "8px",
          borderRadius: "999px",
          background: "var(--surface-high)",
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

"use client";

/*
 * COURSE-P4-02 — fills the progress slot P1-04 reserved in the sticky mobile bar.
 *
 * Deliberately tiny: the bar is 52px tall and already carries the drawer toggle and
 * an ellipsised lesson title, so this is a compact "x / n" with a short bar under it,
 * not a repeat of the sidebar block. Renders nothing when progress is untracked, so
 * the signed-out bar is exactly what P1-04 shipped.
 */

import { useTranslations } from "next-intl";
import { useReaderProgress } from "./CourseProgressProvider";

export default function MobileProgressIndicator() {
  const t = useTranslations("courses.reader");
  const progress = useReaderProgress();

  if (!progress?.tracking) return null;

  const { completedLessons, totalLessons, percentComplete } = progress;

  return (
    <div
      aria-label={t("progressLabel", { done: completedLessons, total: totalLessons })}
      style={{ width: "56px", flexShrink: 0 }}
    >
      <p
        style={{
          margin: 0,
          textAlign: "right",
          fontSize: "0.75rem",
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          color: "var(--text-muted)",
        }}
      >
        <span style={{ color: "var(--green)" }}>{completedLessons}</span>
        {` / ${totalLessons}`}
      </p>
      <div
        aria-hidden="true"
        style={{
          height: "3px",
          marginTop: "4px",
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

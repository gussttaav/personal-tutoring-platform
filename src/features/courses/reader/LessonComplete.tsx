"use client";

/*
 * COURSE-P4-02 — the mark-complete control, at the foot of the lesson body.
 *
 * Explicit, not a scroll-depth heuristic. Students working through a rigorous course
 * re-read constantly; auto-completing on scroll would be both wrong and patronising.
 *
 * Renders NOTHING when progress is untracked. A signed-out reader gets no control and
 * no sign-in nag — reading is the product and it needs no account. There is also no
 * "un-complete": finishing a lesson is one-way in the schema, and offering to undo it
 * would invite a click that the backend cannot honour.
 */

import { useTranslations } from "next-intl";
import { useReaderProgress } from "./CourseProgressProvider";
import { countSolved } from "./attempt-history";

interface LessonCompleteProps {
  lessonSlug: string;
  /** COURSE-P4-04: quiz + challenge ids placed in this lesson, from the build. */
  exerciseIds: string[];
}

export default function LessonComplete({ lessonSlug, exerciseIds }: LessonCompleteProps) {
  const t = useTranslations("courses.progress");
  const progress = useReaderProgress();

  if (!progress?.tracking) return null;

  const done = progress.completed.has(lessonSlug);
  // COURSE-P4-04: exercises are OPTIONAL — this reports, it never gates. A reader who
  // skipped every quiz still marks the lesson complete with the same one click.
  const solved = countSolved(exerciseIds, progress.exercises);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        flexWrap: "wrap",
        margin: "40px 0 0",
        padding: "20px 24px",
        borderRadius: "var(--radius)",
        border: `1px solid ${done ? "var(--green-mid)" : "var(--border)"}`,
        background: done ? "var(--green-dim)" : "var(--surface-high)",
      }}
    >
      {done ? (
        <p
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            margin: 0,
            fontWeight: 600,
            color: "var(--green)",
          }}
        >
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: "1.25rem" }}>
            check_circle
          </span>
          {t("completed")}
        </p>
      ) : (
        <>
          <p style={{ flex: 1, minWidth: "200px", margin: 0, color: "var(--text-muted)" }}>
            {t("prompt")}
          </p>
          <button
            type="button"
            onClick={() => progress.markCompleted(lessonSlug)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 20px",
              borderRadius: "10px",
              border: "1px solid var(--green-mid)",
              background: "var(--green-dim)",
              color: "var(--green)",
              fontFamily: "var(--font-headline, Manrope), sans-serif",
              fontWeight: 700,
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: "1.2rem" }}>
              check
            </span>
            {t("markComplete")}
          </button>
        </>
      )}

      {/* Its own line (the row wraps), so it reads as a note about the lesson rather
          than as a condition attached to the button next to it. */}
      {exerciseIds.length > 0 ? (
        <p
          style={{
            flexBasis: "100%",
            margin: 0,
            fontSize: "0.8rem",
            color: "var(--text-dim)",
          }}
        >
          {t("exercisesDone", { done: solved, total: exerciseIds.length })}
        </p>
      ) : null}
    </div>
  );
}

/*
 * COURSE-BUILD-01 — "this course is still being written".
 *
 * Rendered on the landing page whenever the canonical course has not published every lesson its
 * manifest plans for (see `courseBuildStatus` in src/lib/courses/course-build.ts). A reader who
 * lands on block 1 of five has no way to know whether they are looking at a finished short course
 * or the opening of a long one that is still growing; the syllabus below now lists the unwritten
 * blocks, and this says out loud what that list means and that more is coming.
 *
 * Deliberately NOT a warning. The course is genuinely readable — the published lessons are
 * finished lessons, and the reader loses nothing by starting now.
 *
 * `withNotify` carries the "tell me when there is more" opt-in. The page passes false when
 * `ContentLanguageNotice` is also rendering, because `CourseNotifyCard` hard-codes
 * `id="notificaciones"` and two of them on one page would be a duplicate DOM id (and a
 * strict-mode violation for any locator built on it).
 *
 * Disappears on its own the day the last planned lesson ships — no code change.
 */

import { getTranslations } from "next-intl/server";
import type { CourseBuildStatus } from "@/lib/courses/course-build";
import CourseNotifyCard from "../CourseNotifyCard";

interface CourseBuildNoticeProps {
  build: CourseBuildStatus;
  locale: string;
  /** Show the notify opt-in. False when another notice on the page already carries one. */
  withNotify?: boolean;
}

export default async function CourseBuildNotice({
  build,
  locale,
  withNotify = true,
}: CourseBuildNoticeProps) {
  const t = await getTranslations({ locale, namespace: "courses.landing.buildNotice" });

  // The planned total is only quoted when EVERY block declares one — a partial sum would
  // understate the course, which is worse than not naming a number at all.
  const body =
    build.plannedLessons === null
      ? t("body", {
          lessons:         build.publishedLessons,
          publishedBlocks: build.publishedBlocks,
          totalBlocks:     build.totalBlocks,
        })
      : t("bodyPlanned", {
          published:       build.publishedLessons,
          planned:         build.plannedLessons,
          publishedBlocks: build.publishedBlocks,
          totalBlocks:     build.totalBlocks,
        });

  return (
    <aside
      style={{
        marginTop:    "32px",
        padding:      "24px 28px",
        background:   "var(--surface-container)",
        border:       "1px solid var(--border-variant)",
        borderLeft:   "3px solid var(--green)",
        borderRadius: "14px",
      }}
    >
      <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
        <span
          className="material-symbols-outlined"
          style={{ fontSize: "20px", color: "var(--green)", flexShrink: 0, lineHeight: 1.4 }}
          aria-hidden="true"
        >
          construction
        </span>
        <div style={{ minWidth: 0 }}>
          <h2
            style={{
              fontFamily: "var(--font-headline, Manrope), sans-serif",
              fontSize:   "1rem",
              fontWeight: 700,
              color:      "var(--text)",
              margin:     "0 0 6px",
            }}
          >
            {t("title")}
          </h2>
          <p style={{ margin: 0, fontSize: "0.9375rem", lineHeight: 1.65, color: "var(--text-muted)" }}>
            {body}
          </p>
        </div>
      </div>

      {withNotify ? <CourseNotifyCard compact /> : null}
    </aside>
  );
}

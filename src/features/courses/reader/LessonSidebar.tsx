/*
 * COURSE-P1-04 — Lesson reader sidebar (blocks + lessons nav).
 *
 * Server Component (zero client JS). Rendered TWICE by LessonLayout: once in the
 * desktop `<aside>` and once inside the mobile drawer — CSS hides whichever the
 * viewport doesn't use, so only one is ever in the accessibility tree. Reuses the
 * pure `groupLessonsByBlock` from the landing syllabus, so blocks whose lessons are
 * all drafts are OMITTED — drafts are absent, never greyed-out placeholders.
 *
 * A course sidebar tracks progress; a docs sidebar just lists pages. COURSE-P4-02:
 * the completion layer (per-lesson check + the "done / total" counter) that P1-04
 * left dormant behind a `completedSlugs` prop is now live — but it could never be a
 * prop, because this page is statically generated and the reader's identity is not
 * known at render time. Progress is client-fetched after hydration instead, so the
 * two progress-dependent regions are client leaves (`SidebarProgressBar`,
 * `SidebarLessonList`) reading `CourseProgressProvider`'s context. This component
 * stays a Server Component and keeps the parts that need build-time data:
 * translations and the block grouping.
 *
 * `variant` only changes the outer padding so the same nav reads correctly in the
 * roomy desktop rail and the compact drawer.
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Course, Lesson } from "@/domain/types";
import { groupLessonsByBlock } from "@/features/courses/landing/SyllabusAccordion";
import SidebarProgressBar from "./SidebarProgressBar";
import SidebarLessonList from "./SidebarLessonList";

interface LessonSidebarProps {
  course:      Course;
  lessons:     Lesson[];
  courseSlug:  string;
  currentSlug: string;
  locale:      string;
  variant?:    "desktop" | "drawer";
}

export default async function LessonSidebar({
  course,
  lessons,
  courseSlug,
  currentSlug,
  locale,
  variant = "desktop",
}: LessonSidebarProps) {
  const t = await getTranslations({ locale, namespace: "courses.reader" });
  const groups = groupLessonsByBlock(course, lessons);

  return (
    <nav
      aria-label={t("contentsLabel")}
      style={{
        padding: variant === "drawer" ? "0" : "8px 4px 32px",
        fontSize: "0.9375rem",
      }}
    >
      {/* Back link NAMES its destination (the course) — no separate "contents" header,
          which would just repeat "course". */}
      <Link
        href={`/cursos/${courseSlug}`}
        aria-label={t("backToCourseAria", { course: course.title })}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "6px",
          // Constant: the server cannot know whether the progress bar below will
          // render. `SidebarProgressBar` pulls itself up by 12px when it does.
          marginBottom: "24px",
          fontSize: "0.875rem",
          lineHeight: 1.35,
          color: "var(--text-muted)",
          textDecoration: "none",
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: "1.1rem", flexShrink: 0, marginTop: "1px" }}
          aria-hidden="true"
        >
          arrow_back
        </span>
        <span>{course.title}</span>
      </Link>

      {/* Progress counter + horizontal bar — renders nothing when untracked. */}
      <SidebarProgressBar />

      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "20px" }}>
        {groups.map((group) => {
          // COURSE-P5-00 — the block's own id, NOT its position. These agreed only by
          // accident once blocks were renumbered 1..5, and the prose, the manifest and
          // every planning doc all name blocks by id: a sidebar that numbers by
          // position would silently disagree again the moment a block is added,
          // removed or reordered.
          const ordinal = group.block.id;
          const containsCurrent = group.lessons.some((l) => l.slug === currentSlug);
          return (
            <li key={group.block.id}>
              {/* Collapsible block via native <details> (zero client JS). Open by
                  default only for the block holding the current lesson. */}
              <details className="lesson-block" open={containsCurrent}>
                <summary
                  className="lesson-block-summary"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                    cursor: "pointer",
                    margin: "0 0 10px",
                    fontFamily: "var(--font-headline, Manrope), sans-serif",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--text-dim)",
                  }}
                >
                  <span>
                    <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--text-muted)" }}>
                      {String(ordinal).padStart(2, "0")}
                    </span>
                    {"  "}
                    {group.block.title}
                  </span>
                  <span
                    className="material-symbols-outlined lesson-block-chevron"
                    aria-hidden="true"
                    style={{ fontSize: "1.1rem", color: "var(--text-dim)", flexShrink: 0 }}
                  >
                    expand_more
                  </span>
                </summary>
                <SidebarLessonList
                  courseSlug={courseSlug}
                  currentSlug={currentSlug}
                  lessons={group.lessons.map((l) => ({ slug: l.slug, title: l.title }))}
                />
              </details>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

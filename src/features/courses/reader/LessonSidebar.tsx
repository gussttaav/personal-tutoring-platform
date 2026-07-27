/*
 * COURSE-P1-04 — Lesson reader sidebar (blocks + lessons nav).
 *
 * Server Component (zero client JS). Rendered TWICE by LessonLayout: once in the
 * desktop `<aside>` and once inside the mobile drawer — CSS hides whichever the
 * viewport doesn't use, so only one is ever in the accessibility tree. Reuses the
 * pure `groupLessonsByBlock` from the landing syllabus, so blocks whose lessons are
 * all drafts are OMITTED — drafts are absent, never greyed-out placeholders.
 *
 * A course sidebar tracks progress; a docs sidebar just lists pages. The completion
 * layer here (per-lesson check + the "done / total" counter) is driven by the
 * optional `completedSlugs` prop and is DORMANT in P1-04 — nothing passes it yet, so
 * a signed-out reader sees a clean list with the current lesson highlighted. P4-02
 * ("Progress API + reader wiring") supplies it: progress is client-fetched after
 * hydration (the page stays static; reading needs no sign-in), so P4-02 either passes
 * this prop from a small client wrapper or targets the `data-lesson-slug` hooks below.
 *
 * `variant` only changes the outer padding so the same nav reads correctly in the
 * roomy desktop rail and the compact drawer.
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Course, Lesson } from "@/domain/types";
import { groupLessonsByBlock } from "@/features/courses/landing/SyllabusAccordion";

interface LessonSidebarProps {
  course:      Course;
  lessons:     Lesson[];
  courseSlug:  string;
  currentSlug: string;
  locale:      string;
  variant?:    "desktop" | "drawer";
  /** P4-02: set of completed lesson slugs. Undefined = progress not tracked (today). */
  completedSlugs?: ReadonlySet<string>;
}

export default async function LessonSidebar({
  course,
  lessons,
  courseSlug,
  currentSlug,
  locale,
  variant = "desktop",
  completedSlugs,
}: LessonSidebarProps) {
  const t = await getTranslations({ locale, namespace: "courses.reader" });
  const groups = groupLessonsByBlock(course, lessons);

  const trackProgress = completedSlugs !== undefined;
  const doneCount = trackProgress ? lessons.filter((l) => completedSlugs!.has(l.slug)).length : 0;
  const pct = lessons.length > 0 ? Math.round((doneCount / lessons.length) * 100) : 0;

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
          marginBottom: trackProgress ? "12px" : "24px",
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

      {/* Progress counter + horizontal bar — P4-02 (dormant until `completedSlugs`). */}
      {trackProgress ? (
        <div style={{ margin: "0 0 24px" }}>
          <p
            aria-label={t("progressLabel", { done: doneCount, total: lessons.length })}
            style={{
              margin: 0,
              fontFamily: "var(--font-headline, Manrope), sans-serif",
              fontSize: "1.05rem",
              fontWeight: 700,
              letterSpacing: "0.02em",
            }}
          >
            <span style={{ color: "var(--green)" }}>{doneCount}</span>
            <span style={{ color: "var(--text-dim)", fontWeight: 600 }}> / {lessons.length}</span>
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
            <div style={{ height: "100%", width: `${pct}%`, background: "var(--green)", borderRadius: "999px" }} />
          </div>
        </div>
      ) : null}

      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "20px" }}>
        {groups.map((group) => {
          const ordinal = course.blocks.findIndex((b) => b.id === group.block.id) + 1;
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
                {/* gap 0 when tracking so each row's left border joins into one
                    continuous vertical progress rail. */}
                <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: trackProgress ? "0" : "2px" }}>
                {group.lessons.map((lesson) => {
                  const isCurrent = lesson.slug === currentSlug;
                  const isDone = trackProgress && completedSlugs!.has(lesson.slug);
                  return (
                    <li key={lesson.slug}>
                      <Link
                        href={`/cursos/${courseSlug}/${lesson.slug}`}
                        data-lesson-slug={lesson.slug}
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
                              : trackProgress
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
                            checked and unchecked rows align. P4-02 fills it. */}
                        {trackProgress ? (
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
                        <span style={{ minWidth: 0 }}>{lesson.title}</span>
                      </Link>
                    </li>
                  );
                })}
                </ol>
              </details>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

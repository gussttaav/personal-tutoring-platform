/*
 * COURSE-P1-03 — Syllabus accordion.
 *
 * Server Component built on the native <details>/<summary> element (same pattern as
 * `Details` in src/lib/courses/mdx-components.tsx): it ships ZERO client JS and the full
 * syllabus is present in the server-rendered HTML even while collapsed — so crawlers, and
 * visitors with JS disabled, still see every lesson.
 *
 * Each lesson row links into the reader (`/cursos/<courseSlug>/<lessonSlug>`), so the whole
 * lesson set is crawlable from the landing page. The href carries no explicit locale: on the
 * /en landing it resolves to /en/... — always a generated page (`generateStaticParams` in the
 * lesson route builds one per spine lesson per locale), the real translation when it exists
 * and a noindex fallback serving the canonical prose until then. Never a 404.
 *
 * `groupLessonsByBlock` is a PURE function (exported for unit testing). It walks the
 * manifest blocks in order and attaches the PUBLISHED lessons the caller passes in — so a
 * block whose lessons are all drafts (already filtered out by `listLessons`) has zero
 * lessons and is OMITTED, never rendered empty-but-present.
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Course, CourseBlock, Lesson } from "@/domain/types";

export interface SyllabusBlock {
  block: CourseBlock;
  lessons: Lesson[];
  totalMinutes: number;
}

/** Split a block's reading-time total for display. Under an hour it stays in minutes
 *  ("48 min"); once it reaches 60 it reads better as "2h 48m" than "168 min". The
 *  presentation layer picks the matching i18n key from `kind` / `minutes === 0`. */
export function formatBlockDuration(
  totalMinutes: number,
):
  | { kind: "minutes"; minutes: number }
  | { kind: "hours"; hours: number; minutes: number } {
  if (totalMinutes < 60) return { kind: "minutes", minutes: totalMinutes };
  return { kind: "hours", hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

/** Group published lessons under their manifest block, in manifest order, dropping
 *  blocks with no published lessons. `lessons` is expected pre-sorted by (block, order),
 *  as `listLessons` returns it. */
export function groupLessonsByBlock(course: Course, lessons: Lesson[]): SyllabusBlock[] {
  return course.blocks
    .map((block) => {
      const blockLessons = lessons.filter((l) => l.block === block.id);
      const totalMinutes = blockLessons.reduce((sum, l) => sum + l.minutes, 0);
      return { block, lessons: blockLessons, totalMinutes };
    })
    .filter((group) => group.lessons.length > 0);
}

interface SyllabusAccordionProps {
  course: Course;
  lessons: Lesson[];
  locale: string;
}

export default async function SyllabusAccordion({ course, lessons, locale }: SyllabusAccordionProps) {
  const t = await getTranslations({ locale, namespace: "courses.landing.syllabus" });
  const groups = groupLessonsByBlock(course, lessons);

  const blockDuration = (totalMinutes: number): string => {
    const d = formatBlockDuration(totalMinutes);
    if (d.kind === "minutes") return t("minutes", { minutes: d.minutes });
    if (d.minutes === 0) return t("durationHoursExact", { hours: d.hours });
    return t("durationHours", { hours: d.hours, minutes: d.minutes });
  };

  return (
    <section style={{ paddingTop: "48px" }}>
      <h2
        style={{
          fontFamily: "var(--font-headline, Manrope), sans-serif",
          fontSize: "clamp(1.5rem, 3vw, 2rem)",
          fontWeight: 800,
          letterSpacing: "-0.01em",
          color: "var(--text)",
          margin: "0 0 24px",
        }}
      >
        {t("heading")}
      </h2>

      {groups.length === 0 ? (
        <p style={{ fontSize: "0.9375rem", color: "var(--text-dim)", margin: 0 }}>{t("empty")}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {groups.map((group, index) => (
            <details
              key={group.block.id}
              open={index === 0}
              style={{
                border: "1px solid var(--border-variant)",
                borderRadius: "var(--radius)",
                background: "var(--surface-container)",
                padding: "16px 20px",
              }}
            >
              <summary style={{ cursor: "pointer", listStyle: "none" }}>
                <span
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: "16px",
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-headline, Manrope), sans-serif",
                      fontSize: "1.0625rem",
                      fontWeight: 700,
                      color: "var(--text)",
                    }}
                  >
                    {group.block.title}
                  </span>
                  <span style={{ fontSize: "0.8125rem", color: "var(--text-dim)", whiteSpace: "nowrap" }}>
                    {t("blockMeta", { lessons: group.lessons.length, duration: blockDuration(group.totalMinutes) })}
                  </span>
                </span>
              </summary>

              <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                {group.block.summary ? (
                  <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", margin: 0 }}>
                    {group.block.summary}
                  </p>
                ) : null}
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                  {group.lessons.map((lesson) => (
                    <li
                      key={lesson.slug}
                      style={{
                        paddingTop: "8px",
                        borderTop: "1px solid var(--border)",
                        fontSize: "0.9375rem",
                      }}
                    >
                      <Link
                        href={`/cursos/${course.slug}/${lesson.slug}`}
                        className="syllabus-lesson"
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "16px",
                          // Negative inline margin + matching padding: the hover fill bleeds
                          // 8px past the text on each side while the text stays aligned with
                          // the block summary above.
                          margin: "0 -8px",
                          padding: "4px 8px",
                          color: "inherit",
                          textDecoration: "none",
                        }}
                      >
                        <span style={{ color: "var(--text)" }}>{lesson.title}</span>
                        <span style={{ color: "var(--text-dim)", whiteSpace: "nowrap" }}>
                          {t("minutes", { minutes: lesson.minutes })}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

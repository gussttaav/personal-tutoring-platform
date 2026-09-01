/*
 * COURSE-P1-03 / landing-refinements — Syllabus accordion.
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
 *
 * The section carries `id="temario"` so the hero's "view syllabus" link scrolls here.
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

  // Totals for the section summary ("N bloques · N lecciones · ~Xh de lectura"). `hours` floors
  // deliberately: an "≈18 h" reading estimate never wants to round a partial hour up.
  const totalLessons = groups.reduce((sum, g) => sum + g.lessons.length, 0);
  const totalMinutes = groups.reduce((sum, g) => sum + g.totalMinutes, 0);
  const totalHours = Math.floor(totalMinutes / 60);

  const blockDuration = (totalMinutes: number): string => {
    const d = formatBlockDuration(totalMinutes);
    if (d.kind === "minutes") return t("minutes", { minutes: d.minutes });
    if (d.minutes === 0) return t("durationHoursExact", { hours: d.hours });
    return t("durationHours", { hours: d.hours, minutes: d.minutes });
  };

  return (
    <section id="temario" style={{ paddingTop: "72px", scrollMarginTop: "88px" }}>
      <div className="lp-section-head">
        <span className="lp-kicker">02 — {t("kicker")}</span>
        <span className="lp-rule" />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
          margin: "0 0 28px",
        }}
      >
        <h2
          className="lp-serif"
          style={{
            fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
            fontWeight: 500,
            letterSpacing: "-0.01em",
            color: "var(--text)",
            margin: 0,
          }}
        >
          {t("heading")}
        </h2>
        {groups.length > 0 ? (
          <span
            style={{
              fontFamily: "var(--font-headline, Manrope), sans-serif",
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "var(--text-dim)",
            }}
          >
            {t("summary", { blocks: groups.length, lessons: totalLessons, hours: totalHours })}
          </span>
        ) : null}
      </div>

      {groups.length === 0 ? (
        <p style={{ fontSize: "0.9375rem", color: "var(--text-dim)", margin: 0 }}>{t("empty")}</p>
      ) : (
        <div style={{ borderBottom: "1px solid var(--border-variant)" }}>
          {groups.map((group, index) => (
            <details key={group.block.id} open={index === 0} style={{ borderTop: "1px solid var(--border-variant)" }}>
              <summary style={{ cursor: "pointer", listStyle: "none", padding: "22px 4px" }}>
                <span
                  style={{
                    display: "grid",
                    gridTemplateColumns: "52px 1fr auto",
                    gap: "18px",
                    alignItems: "baseline",
                  }}
                >
                  <span
                    className="lp-serif"
                    style={{
                      fontSize: "1.875rem",
                      fontWeight: 500,
                      color: index === 0 ? "var(--green)" : "var(--border-variant)",
                    }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <span
                      style={{
                        display: "block",
                        fontFamily: "var(--font-headline, Manrope), sans-serif",
                        fontSize: "1.125rem",
                        fontWeight: 700,
                        color: "var(--text)",
                      }}
                    >
                      {group.block.title}
                    </span>
                    {group.block.summary ? (
                      <span style={{ display: "block", fontSize: "0.875rem", color: "var(--text-dim)", marginTop: "4px" }}>
                        {group.block.summary}
                      </span>
                    ) : null}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-headline, Manrope), sans-serif",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t("blockMeta", { lessons: group.lessons.length, duration: blockDuration(group.totalMinutes) })}
                  </span>
                </span>
              </summary>

              <ul
                style={{
                  listStyle: "none",
                  margin: "0 0 20px",
                  padding: "0 4px 0 70px",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {group.lessons.map((lesson) => (
                  <li key={lesson.slug} style={{ borderTop: "1px solid var(--border)", fontSize: "0.9375rem" }}>
                    <Link
                      href={`/cursos/${course.slug}/${lesson.slug}`}
                      className="syllabus-lesson"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "16px",
                        margin: "0 -8px",
                        padding: "10px 8px",
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
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

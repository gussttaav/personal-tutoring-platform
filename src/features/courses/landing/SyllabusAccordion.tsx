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
 * COURSE-BUILD-01: EVERY manifest block is rendered, including the ones nobody has written yet.
 * This reverses the original rule ("a block with no published lessons is OMITTED, never rendered
 * empty-but-present"), which was right while a course only ever went public finished and wrong
 * the moment one was written in the open: a five-block course with one published lesson showed a
 * single block, so the reader could not tell it from a one-block course and had no idea what was
 * coming — while the titles, the summaries and the planned sizes were sitting in the manifest
 * unused. An unwritten block is now a plain row (not a <details>: there is nothing to expand)
 * carrying its title, its summary and «N lecciones · próximamente», and a half-written one says
 * «3 de 9 lecciones». A finished course has no such rows and looks exactly as it did.
 *
 * The grouping itself moved to `@/lib/courses/course-build` (pure, unit-tested, shared with the
 * catalog card) — `groupLessonsByBlock` lived here and its one job was the filtering this file
 * no longer wants. `formatBlockDuration` stays: it is presentation.
 *
 * The section carries `id="temario"` so the hero's "view syllabus" link scrolls here.
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Course } from "@/domain/types";
import type { BlockBuild, CourseBuildStatus } from "@/lib/courses/course-build";

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

interface SyllabusAccordionProps {
  course: Course;
  /** COURSE-BUILD-01 — every block with its published lessons and its progress. */
  build: CourseBuildStatus;
  locale: string;
}

export default async function SyllabusAccordion({ course, build, locale }: SyllabusAccordionProps) {
  const t = await getTranslations({ locale, namespace: "courses.landing.syllabus" });

  // Totals for the section summary ("N bloques · N lecciones · ~Xh de lectura"). `hours` floors
  // deliberately: an "≈18 h" reading estimate never wants to round a partial hour up.
  const totalMinutes = build.blocks.reduce((sum, b) => sum + b.totalMinutes, 0);
  const totalHours = Math.floor(totalMinutes / 60);
  // The first block that HAS lessons is the one worth opening — and the one that wears the
  // accent ordinal. On an in-progress course that is not necessarily the first block rendered.
  const firstWithLessons = build.blocks.findIndex((b) => b.lessons.length > 0);

  const blockDuration = (totalMinutes: number): string => {
    const d = formatBlockDuration(totalMinutes);
    if (d.kind === "minutes") return t("minutes", { minutes: d.minutes });
    if (d.minutes === 0) return t("durationHoursExact", { hours: d.hours });
    return t("durationHours", { hours: d.hours, minutes: d.minutes });
  };

  /** The meta cell on the right of a block row: published count, or the planned size. */
  const blockMeta = (group: BlockBuild): string => {
    if (group.state === "upcoming") {
      return group.block.lessons === undefined
        ? t("upcoming")
        : t("upcomingMeta", { lessons: group.block.lessons });
    }
    if (group.state === "partial") {
      return t("blockMetaPartial", {
        published: group.published,
        planned:   group.planned,
        duration:  blockDuration(group.totalMinutes),
      });
    }
    return t("blockMeta", { lessons: group.published, duration: blockDuration(group.totalMinutes) });
  };

  /** The row itself — identical markup inside a <summary> (block with lessons) and inside a
   *  plain <div> (upcoming block), so the two read as one list. */
  const blockRow = (group: BlockBuild, index: number) => (
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
          color: index === firstWithLessons ? "var(--green)" : "var(--border-variant)",
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
            color: group.state === "upcoming" ? "var(--text-muted)" : "var(--text)",
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
          color: group.state === "upcoming" ? "var(--text-dim)" : "var(--text-muted)",
          whiteSpace: "nowrap",
        }}
      >
        {blockMeta(group)}
      </span>
    </span>
  );

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
        {build.publishedLessons > 0 ? (
          <span
            style={{
              fontFamily: "var(--font-headline, Manrope), sans-serif",
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "var(--text-dim)",
            }}
          >
            {build.publishedBlocks < build.totalBlocks
              ? t("summaryInProgress", {
                  publishedBlocks: build.publishedBlocks,
                  totalBlocks:     build.totalBlocks,
                  lessons:         build.publishedLessons,
                })
              : t("summary", {
                  blocks:  build.totalBlocks,
                  lessons: build.publishedLessons,
                  hours:   totalHours,
                })}
          </span>
        ) : null}
      </div>

      {/* Nothing published at all — the «soon» landing. The block list below is still the
          honest answer to "what will this course be", so the old empty-state line leads into
          it instead of replacing it. */}
      {build.publishedLessons === 0 ? (
        <p style={{ fontSize: "0.9375rem", color: "var(--text-dim)", margin: "0 0 20px" }}>{t("empty")}</p>
      ) : null}

      <div style={{ borderBottom: "1px solid var(--border-variant)" }}>
        {build.blocks.map((group, index) =>
          group.state === "upcoming" ? (
            <div
              key={group.block.id}
              style={{ borderTop: "1px solid var(--border-variant)", padding: "22px 4px" }}
            >
              {blockRow(group, index)}
            </div>
          ) : (
            <details
              key={group.block.id}
              open={index === firstWithLessons}
              style={{ borderTop: "1px solid var(--border-variant)" }}
            >
              <summary style={{ cursor: "pointer", listStyle: "none", padding: "22px 4px" }}>
                {blockRow(group, index)}
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
          ),
        )}
      </div>
    </section>
  );
}

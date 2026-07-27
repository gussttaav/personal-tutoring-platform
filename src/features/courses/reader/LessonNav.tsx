/*
 * COURSE-P1-04 — Prev/next lesson footer.
 *
 * Server Component. Fed by `lessonNeighbours` (src/lib/courses/registry.ts), which
 * walks the PUBLISHED, (block, order)-sorted list — so drafts are skipped and each
 * side is correctly `null` at the ends of the course. A null side renders an empty
 * spacer so the present side keeps its edge (prev left, next right).
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { LessonRef } from "@/domain/types";

interface LessonNavProps {
  courseSlug: string;
  prev:       LessonRef | null;
  next:       LessonRef | null;
  locale:     string;
}

export default async function LessonNav({ courseSlug, prev, next, locale }: LessonNavProps) {
  const t = await getTranslations({ locale, namespace: "courses.reader" });

  const cardStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    flex: "1 1 0",
    minWidth: 0,
    padding: "16px 20px",
    border: "1px solid var(--border-variant)",
    borderRadius: "var(--radius)",
    background: "var(--surface-container)",
    textDecoration: "none",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "0.75rem",
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "var(--text-dim)",
  };
  const titleStyle: React.CSSProperties = {
    fontSize: "0.9375rem",
    fontWeight: 600,
    color: "var(--text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };

  return (
    <nav
      aria-label={t("lessonNav")}
      style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "48px" }}
    >
      {prev ? (
        <Link href={`/cursos/${courseSlug}/${prev.slug}`} rel="prev" style={cardStyle}>
          <span style={labelStyle}>← {t("previous")}</span>
          <span style={titleStyle}>{prev.title}</span>
        </Link>
      ) : (
        <span style={{ flex: "1 1 0" }} aria-hidden="true" />
      )}

      {next ? (
        <Link href={`/cursos/${courseSlug}/${next.slug}`} rel="next" style={{ ...cardStyle, textAlign: "right", alignItems: "flex-end" }}>
          <span style={labelStyle}>{t("next")} →</span>
          <span style={titleStyle}>{next.title}</span>
        </Link>
      ) : (
        <span style={{ flex: "1 1 0" }} aria-hidden="true" />
      )}
    </nav>
  );
}

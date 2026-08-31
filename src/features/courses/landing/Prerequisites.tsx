/*
 * COURSE-P1-03 — Prerequisites.
 *
 * Server Component. Explicit and prominent by design: a course that assumes real
 * background must state it up front, or it produces frustrated students and bad word
 * of mouth. Rendered as section 2 (right after the hero) so it lands within the first
 * screenful. Both the framing sentence (`intro`) and the checklist (`items`) come from
 * the manifest (`course.prerequisites`), never hardcoded — the "this course is
 * mathematically rigorous" claim is true of dl-nlp, not of every future course.
 */

import { getTranslations } from "next-intl/server";
import type { CoursePrerequisites } from "@/domain/types";

interface PrerequisitesProps {
  prerequisites: CoursePrerequisites;
  locale: string;
}

export default async function Prerequisites({ prerequisites, locale }: PrerequisitesProps) {
  const t = await getTranslations({ locale, namespace: "courses.landing.prerequisites" });

  if (prerequisites.items.length === 0) return null;

  return (
    <section style={{ paddingTop: "40px", paddingBottom: "8px" }}>
      <div
        style={{
          padding: "28px",
          background: "var(--surface-container)",
          border: "1px solid var(--border-variant)",
          borderRadius: "16px",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-headline, Manrope), sans-serif",
            fontSize: "1.375rem",
            fontWeight: 700,
            color: "var(--text)",
            margin: "0 0 6px",
          }}
        >
          {t("heading")}
        </h2>
        <p style={{ fontSize: "0.9375rem", color: "var(--text-muted)", margin: "0 0 18px" }}>
          {prerequisites.intro}
        </p>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
          {prerequisites.items.map((item) => (
            <li key={item} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "1.25rem", color: "var(--green)", flexShrink: 0, marginTop: "1px" }}
                aria-hidden="true"
              >
                check_circle
              </span>
              <span style={{ fontSize: "0.9375rem", lineHeight: 1.55, color: "var(--text)" }}>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

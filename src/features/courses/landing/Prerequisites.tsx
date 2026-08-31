/*
 * COURSE-P1-03 / landing-refinements — Prerequisites.
 *
 * Server Component. Explicit and prominent by design: a course that assumes real background
 * must state it up front, or it produces frustrated students and bad word of mouth. Rendered
 * as the first section after the hero so it lands within the first screenful. The framing
 * sentence (`intro`) and the checklist (`items`) come from the manifest (`course.prerequisites`),
 * never hardcoded — the "this course is mathematically rigorous" claim is true of dl-nlp, not of
 * every future course. Each item is a `title` + optional `detail` (a bold line + muted subtitle).
 *
 * Two-column editorial layout: kicker + heading + intro on the left, the requirement list on the
 * right, stacked below 640px (see .lp-prereq-grid). The section number reflects the fixed page
 * order in the landing route.
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
    <section style={{ paddingTop: "56px" }}>
      <div className="lp-section-head">
        <span className="lp-kicker">01 — {t("kicker")}</span>
        <span className="lp-rule" />
      </div>

      <div className="lp-prereq-grid">
        <div>
          <h2
            className="lp-serif"
            style={{
              fontSize: "clamp(1.5rem, 3vw, 2.125rem)",
              fontWeight: 500,
              letterSpacing: "-0.01em",
              color: "var(--text)",
              margin: 0,
            }}
          >
            {t("heading")}
          </h2>
          <p style={{ margin: "14px 0 0", fontSize: "1rem", lineHeight: 1.65, color: "var(--text-muted)" }}>
            {prerequisites.intro}
          </p>
        </div>

        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
          {prerequisites.items.map((item, i) => (
            <li
              key={item.title}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "14px",
                padding: "18px 0",
                borderTop: i === 0 ? "none" : "1px solid var(--border)",
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "1.375rem", color: "var(--green)", flexShrink: 0, marginTop: "1px" }}
                aria-hidden="true"
              >
                check
              </span>
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-headline, Manrope), sans-serif",
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: "var(--text)",
                  }}
                >
                  {item.title}
                </div>
                {item.detail ? (
                  <div style={{ fontSize: "0.875rem", color: "var(--text-dim)", marginTop: "3px", lineHeight: 1.5 }}>
                    {item.detail}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

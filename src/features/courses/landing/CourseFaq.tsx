/*
 * COURSE-P1-03 / landing-refinements — Course FAQ.
 *
 * Server Component on native <details> (zero client JS, answers in the HTML while collapsed).
 * The questions/answers come from the manifest (`course.faq`), not the message files: they are
 * per-course prose — cost, time commitment, "what do I install", translation status all differ
 * course to course. Only the section `heading` is shared. An empty list renders nothing at all.
 *
 * Editorial header (section number + hairline rule + serif heading); the number reflects the
 * fixed page order in the landing route.
 */

import { getTranslations } from "next-intl/server";
import type { CourseFaqItem } from "@/domain/types";

interface CourseFaqProps {
  faq: CourseFaqItem[];
  locale: string;
}

export default async function CourseFaq({ faq, locale }: CourseFaqProps) {
  const t = await getTranslations({ locale, namespace: "courses.landing.faq" });

  if (faq.length === 0) return null;

  return (
    <section style={{ paddingTop: "72px" }}>
      <div className="lp-section-head">
        <span className="lp-kicker">04 — {t("kicker")}</span>
        <span className="lp-rule" />
      </div>

      <h2
        className="lp-serif"
        style={{
          fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
          fontWeight: 500,
          letterSpacing: "-0.01em",
          color: "var(--text)",
          margin: "0 0 20px",
        }}
      >
        {t("heading")}
      </h2>

      <div style={{ borderBottom: "1px solid var(--border-variant)" }}>
        {faq.map((item) => (
          <details key={item.q} style={{ borderTop: "1px solid var(--border-variant)" }}>
            <summary
              style={{
                cursor: "pointer",
                listStyle: "none",
                padding: "18px 4px",
                fontFamily: "var(--font-headline, Manrope), sans-serif",
                fontSize: "1rem",
                fontWeight: 600,
                color: "var(--text)",
              }}
            >
              {item.q}
            </summary>
            <p
              style={{
                margin: 0,
                padding: "0 4px 18px",
                fontSize: "0.9375rem",
                lineHeight: 1.65,
                color: "var(--text-muted)",
                maxWidth: "680px",
              }}
            >
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

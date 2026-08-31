/*
 * COURSE-P1-03 — Course FAQ.
 *
 * Server Component on native <details> (zero client JS, answers in the HTML while
 * collapsed). The questions/answers come from the manifest (`course.faq`), not the
 * message files: they are per-course prose — cost, time commitment, "what do I install",
 * translation status all differ course to course. Only the section `heading` is shared.
 * An empty list renders nothing at all.
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

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {faq.map((item) => (
          <details
            key={item.q}
            style={{
              border: "1px solid var(--border-variant)",
              borderRadius: "var(--radius)",
              background: "var(--surface-container)",
              padding: "16px 20px",
            }}
          >
            <summary
              style={{
                cursor: "pointer",
                fontFamily: "var(--font-headline, Manrope), sans-serif",
                fontSize: "1rem",
                fontWeight: 600,
                color: "var(--text)",
              }}
            >
              {item.q}
            </summary>
            <p style={{ marginTop: "12px", marginBottom: 0, fontSize: "0.9375rem", lineHeight: 1.6, color: "var(--text-muted)" }}>
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

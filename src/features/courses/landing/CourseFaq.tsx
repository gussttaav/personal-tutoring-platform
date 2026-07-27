/*
 * COURSE-P1-03 — Course FAQ.
 *
 * Server Component on native <details> (zero client JS, answers in the HTML while
 * collapsed). The questions/answers live in the message files (`courses.landing.faq.items`)
 * rather than hardcoded in JSX, because this copy gets edited often — read as a raw array
 * with `t.raw`.
 */

import { getTranslations } from "next-intl/server";

interface FaqItem {
  q: string;
  a: string;
}

interface CourseFaqProps {
  locale: string;
}

export default async function CourseFaq({ locale }: CourseFaqProps) {
  const t = await getTranslations({ locale, namespace: "courses.landing.faq" });
  const items = t.raw("items") as FaqItem[];

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
        {items.map((item) => (
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

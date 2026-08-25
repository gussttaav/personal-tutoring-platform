/*
 * COURSE-P6-03 — "the lessons are in Spanish".
 *
 * Rendered on the landing page only when the manifest locale and the lesson locale differ
 * (see src/lib/courses/catalog-view.ts). An English visitor gets an English page describing
 * the course and then walks into Spanish prose; saying so before they click is the whole
 * point, and it is the honest place to offer the "tell me when it's translated" opt-in.
 *
 * Disappears on its own the day `content/courses/dl-nlp/en/` exists — no code change.
 */

import { getTranslations } from "next-intl/server";
import CourseNotifyCard from "../CourseNotifyCard";

export default async function ContentLanguageNotice({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "courses.landing.languageNotice" });

  return (
    <aside
      style={{
        marginTop:    "32px",
        padding:      "24px 28px",
        background:   "var(--surface-container)",
        border:       "1px solid var(--border-variant)",
        borderLeft:   "3px solid var(--green)",
        borderRadius: "14px",
      }}
    >
      <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
        <span
          className="material-symbols-outlined"
          style={{ fontSize: "20px", color: "var(--green)", flexShrink: 0, lineHeight: 1.4 }}
          aria-hidden="true"
        >
          translate
        </span>
        <div style={{ minWidth: 0 }}>
          <h2
            style={{
              fontFamily: "var(--font-headline, Manrope), sans-serif",
              fontSize:   "1rem",
              fontWeight: 700,
              color:      "var(--text)",
              margin:     "0 0 6px",
            }}
          >
            {t("title")}
          </h2>
          <p style={{ margin: 0, fontSize: "0.9375rem", lineHeight: 1.65, color: "var(--text-muted)" }}>
            {t("body")}
          </p>
        </div>
      </div>

      <CourseNotifyCard compact />
    </aside>
  );
}

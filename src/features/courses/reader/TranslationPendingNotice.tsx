/*
 * COURSE-P6-03b — "this lesson is not translated yet".
 *
 * Shown at the top of a lesson whose prose falls back to the canonical locale. Without it
 * the page is baffling: the reader switched to English, the chrome obeyed, and the article
 * did not. It also answers the question that immediately follows — whether their progress
 * still counts — because it does: lesson slugs are locale-invariant, so completions carry
 * across languages and the denominator is pinned to the canonical locale (see catalog.ts).
 *
 * Server Component, zero client JS. Disappears on its own once the translation lands.
 */

import { getTranslations } from "next-intl/server";

export default async function TranslationPendingNotice({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "courses.reader.translationPending" });

  return (
    <aside
      style={{
        display:      "flex",
        gap:          "12px",
        alignItems:   "flex-start",
        margin:       "0 0 32px",
        padding:      "16px 20px",
        background:   "var(--surface-container)",
        border:       "1px solid var(--border-variant)",
        borderLeft:   "3px solid var(--green)",
        borderRadius: "12px",
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{ fontSize: "20px", color: "var(--green)", flexShrink: 0, lineHeight: 1.4 }}
        aria-hidden="true"
      >
        translate
      </span>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: "0 0 4px", fontWeight: 600, color: "var(--text)", fontSize: "0.9375rem" }}>
          {t("title")}
        </p>
        <p style={{ margin: 0, fontSize: "0.875rem", lineHeight: 1.6, color: "var(--text-muted)" }}>
          {t("body")}
        </p>
      </div>
    </aside>
  );
}

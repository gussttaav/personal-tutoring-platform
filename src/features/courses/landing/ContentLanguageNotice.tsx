/*
 * COURSE-P6-03 — "the lessons are in Spanish".
 *
 * Rendered on the landing page whenever some lesson does not exist in the page's locale (see
 * src/lib/courses/catalog-view.ts). An English visitor gets an English page describing the
 * course and then walks into Spanish prose; saying so before they click is the whole point,
 * and it is the honest place to offer the "tell me when it's translated" opt-in.
 *
 * COURSE-BUILD-01: the trigger is now `fullyTranslated`, and the copy has a PARTIAL case. It
 * used to be `contentLocale !== locale` — the locale of the FIRST lesson — which told the truth
 * only at the two ends: once dl-nlp's block 1 landed in English the notice vanished from
 * /en/cursos/dl-nlp while 25 of its 43 lessons were still Spanish, so the page quietly claimed
 * to be something it was not. `catalog-view.ts` has computed `fullyTranslated` for exactly this
 * since P6-03b ("Drives the 'in Spanish' badge") and nothing had used it. Per-lesson resolution
 * means the middle of a translation is the NORMAL state, not an edge case, so it gets its own
 * sentence and the counts that make it checkable.
 *
 * Disappears on its own the day the last lesson is translated — no code change.
 */

import { getTranslations } from "next-intl/server";
import CourseNotifyCard from "../CourseNotifyCard";

interface ContentLanguageNoticeProps {
  locale: string;
  /** Lessons that exist in `locale`. Zero means nothing is translated at all. */
  translatedCount: number;
  /** Lessons on the spine — the denominator the partial copy quotes. */
  total: number;
}

export default async function ContentLanguageNotice({
  locale,
  translatedCount,
  total,
}: ContentLanguageNoticeProps) {
  const t = await getTranslations({ locale, namespace: "courses.landing.languageNotice" });
  const partial = translatedCount > 0;

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
            {partial ? t("titlePartial") : t("title")}
          </h2>
          <p style={{ margin: 0, fontSize: "0.9375rem", lineHeight: 1.65, color: "var(--text-muted)" }}>
            {partial ? t("bodyPartial", { translated: translatedCount, total }) : t("body")}
          </p>
        </div>
      </div>

      <CourseNotifyCard compact />
    </aside>
  );
}

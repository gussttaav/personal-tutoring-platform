/*
 * landing-refinements — "Nota del autor".
 *
 * A signed, first-person note on how the course was made (AI-assisted authoring, human-led
 * content) plus a soft invitation to book a session. It is GLOBAL, not per-course: it is true
 * of every course the same author writes, so — unlike the per-course manifest prose (outcome,
 * cta, faq) — its copy lives in messages (courses.landing.authorNote.*), key-for-key in es/en.
 *
 * Styled to the site's own card vocabulary (the ContentLanguageNotice pattern: a surface card
 * with a left emerald rail), so it reads as native chrome rather than a bolted-on section.
 * The "book a session" phrase is a rich-text slot linking to the homepage mentoring anchor.
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function CourseAuthorNote({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "courses.landing.authorNote" });

  return (
    <section style={{ paddingTop: "64px" }}>
      <div className="lp-section-head">
        <span className="lp-kicker">{t("kicker")}</span>
        <span className="lp-rule" />
      </div>

      <div
        style={{
          position: "relative",
          padding: "30px 34px",
          borderRadius: "16px",
          background: "var(--surface-container)",
          border: "1px solid var(--border-variant)",
          borderLeft: "3px solid var(--green)",
          overflow: "hidden",
        }}
      >
        <span
          className="lp-serif"
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "6px",
            right: "24px",
            fontSize: "120px",
            lineHeight: 1,
            color: "var(--green)",
            opacity: 0.09,
          }}
        >
          {"”"}
        </span>
        <p
          className="lp-serif"
          style={{
            position: "relative",
            margin: 0,
            fontSize: "1.1875rem",
            lineHeight: 1.72,
            color: "var(--text)",
          }}
        >
          {t.rich("body", {
            book: (chunks) => (
              <Link
                href="/#sessions"
                style={{
                  color: "var(--green)",
                  textDecoration: "underline",
                  textUnderlineOffset: "3px",
                }}
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    </section>
  );
}

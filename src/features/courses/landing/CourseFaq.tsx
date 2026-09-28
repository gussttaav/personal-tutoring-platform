/*
 * COURSE-P1-03 / landing-refinements — Course FAQ.
 *
 * Server Component on native <details> (zero client JS, answers in the HTML while collapsed).
 * The questions/answers come from the manifest (`course.faq`), not the message files: they are
 * per-course prose — cost, time commitment, "what do I install" all differ course to course.
 * Only the section `heading` and a `dynamic` item's answer are shared. An empty list renders
 * nothing at all.
 *
 * An item with `dynamic: "english-translation-status"` gets its `a` computed here instead of
 * read from the manifest — real lesson-translation coverage, not hand-written prose someone has
 * to keep updated as the English tree fills in. `q` stays manifest-owned either way: whether to
 * ask the question at all, and where, is still an editorial call per course.
 *
 * Editorial header (section number + hairline rule + serif heading); the number reflects the
 * fixed page order in the landing route.
 */

import { getTranslations } from "next-intl/server";
import type { CourseFaqItem } from "@/domain/types";
import { getEnglishTranslationCoverage } from "@/lib/courses/catalog-view";

interface CourseFaqProps {
  faq: CourseFaqItem[];
  locale: string;
  courseSlug: string;
}

export default async function CourseFaq({ faq, locale, courseSlug }: CourseFaqProps) {
  const t = await getTranslations({ locale, namespace: "courses.landing.faq" });

  if (faq.length === 0) return null;

  const resolved = faq.map((item) => {
    if (item.dynamic !== "english-translation-status") {
      return { q: item.q, a: item.a! };
    }
    const { translated, total, fullyTranslated } = getEnglishTranslationCoverage(courseSlug);
    const a =
      fullyTranslated  ? t("englishStatus.complete") :
      translated === 0 ? t("englishStatus.notStarted") :
      t("englishStatus.inProgress", { translated, total, percent: Math.round((translated / total) * 100) });
    return { q: item.q, a };
  });

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
        {resolved.map((item) => (
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

/*
 * COURSE-P1-03 — Closing CTA.
 *
 * Server Component. "Empezar el curso" → the first published lesson. Sign-in is NOT
 * required to read (P4-02). Until P5 publishes a lesson, `firstLessonSlug` is null and the
 * button degrades to a disabled "soon" state instead of linking nowhere.
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

interface CourseCtaProps {
  courseSlug: string;
  firstLessonSlug: string | null;
  locale: string;
}

export default async function CourseCta({ courseSlug, firstLessonSlug, locale }: CourseCtaProps) {
  const t = await getTranslations({ locale, namespace: "courses.landing.cta" });

  return (
    <section style={{ paddingTop: "48px", paddingBottom: "64px" }}>
      <div
        style={{
          padding: "40px",
          textAlign: "center",
          borderRadius: "20px",
          border: "1px solid var(--green-mid)",
          background: "linear-gradient(135deg, rgba(78,222,163,0.08) 0%, rgba(16,185,129,0.04) 100%)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-headline, Manrope), sans-serif",
            fontSize: "clamp(1.5rem, 3.5vw, 2.25rem)",
            fontWeight: 800,
            letterSpacing: "-0.01em",
            color: "var(--text)",
            margin: "0 0 12px",
          }}
        >
          {t("heading")}
        </h2>
        <p style={{ maxWidth: "520px", margin: "0 auto 24px", fontSize: "1rem", lineHeight: 1.6, color: "var(--text-muted)" }}>
          {t("body")}
        </p>

        {firstLessonSlug ? (
          <Link
            href={`/cursos/${courseSlug}/${firstLessonSlug}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "14px 32px",
              background: "linear-gradient(135deg, #4edea3, #10b981)",
              color: "#003824",
              borderRadius: "10px",
              fontFamily: "var(--font-headline, Manrope), sans-serif",
              fontWeight: 700,
              fontSize: "0.95rem",
              textDecoration: "none",
              boxShadow: "0 8px 32px rgba(78,222,163,0.25)",
            }}
          >
            {t("start")}
            <span className="material-symbols-outlined" style={{ fontSize: "1.25rem" }} aria-hidden="true">
              arrow_forward
            </span>
          </Link>
        ) : (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "14px 32px",
              borderRadius: "10px",
              border: "1px solid var(--border-variant)",
              color: "var(--text-dim)",
              fontFamily: "var(--font-headline, Manrope), sans-serif",
              fontWeight: 700,
              fontSize: "0.95rem",
            }}
          >
            {t("soon")}
          </span>
        )}
      </div>
    </section>
  );
}

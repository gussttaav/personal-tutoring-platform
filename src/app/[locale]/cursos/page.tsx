/*
 * COURSE-P1-03 — Course catalog (/cursos).
 *
 * Statically generated. The card list is sourced from `listCourses` (PUBLISHED-only), so
 * with dl-nlp still a draft it is empty today and the honest "próximamente" empty state
 * renders — never a blank page. Per-card counts come from `listLessons` (also published-
 * only), so drafts never inflate them. Navbar/Footer keep the ComingSoonModal; the link
 * swap is P6-03.
 */

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CourseCard from "@/features/courses/catalog/CourseCard";
import { listCourses, listLessons } from "@/lib/courses/registry";
import { routing } from "@/i18n/routing";
import { localizedAlternates } from "@/lib/hreflang";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta.cursos" });
  return {
    title: t("title"),
    description: t("description"),
    robots: { index: true, follow: true },
    alternates: localizedAlternates("/cursos", locale),
  };
}

export default async function CursosPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "courses.catalog" });

  const courses = listCourses(locale);
  const cards = courses.map((course) => {
    const lessons = listLessons(course.slug, locale);
    return {
      course,
      lessonCount: lessons.length,
      blockCount: new Set(lessons.map((l) => l.block)).size,
    };
  });

  return (
    <>
      <Navbar />
      <main style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "48px 20px 80px",
          }}
        >
          {/* Header */}
          <header style={{ marginBottom: "48px" }}>
            <p
              style={{
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--green)",
                margin: "0 0 12px",
              }}
            >
              {t("overline")}
            </p>
            <h1
              style={{
                fontFamily: "var(--font-headline, Manrope), sans-serif",
                fontSize: "clamp(2rem, 5vw, 3rem)",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                color: "var(--text)",
                margin: "0 0 16px",
              }}
            >
              {t("heading")}
            </h1>
            <p style={{ maxWidth: "620px", fontSize: "1.0625rem", lineHeight: 1.6, color: "var(--text-muted)", margin: 0 }}>
              {t("subtitle")}
            </p>
          </header>

          {cards.length === 0 ? (
            <div
              style={{
                padding: "48px 32px",
                textAlign: "center",
                background: "var(--surface-container)",
                border: "1px solid var(--border-variant)",
                borderRadius: "16px",
              }}
            >
              <h2
                style={{
                  fontFamily: "var(--font-headline, Manrope), sans-serif",
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  color: "var(--text)",
                  margin: "0 0 10px",
                }}
              >
                {t("empty.title")}
              </h2>
              <p style={{ maxWidth: "440px", margin: "0 auto", fontSize: "0.9375rem", lineHeight: 1.6, color: "var(--text-muted)" }}>
                {t("empty.body")}
              </p>
            </div>
          ) : (
            <div className="courses-grid">
              {cards.map(({ course, lessonCount, blockCount }) => (
                <CourseCard
                  key={course.slug}
                  course={course}
                  lessonCount={lessonCount}
                  blockCount={blockCount}
                  locale={locale}
                />
              ))}
            </div>
          )}
        </div>

        <style>{`
          .courses-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 24px;
          }
          .course-card:hover {
            border-color: var(--green-mid) !important;
            transform: translateY(-2px);
          }
        `}</style>
      </main>
      <Footer />
    </>
  );
}

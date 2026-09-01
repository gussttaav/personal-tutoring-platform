/*
 * COURSE-P1-03 — Course landing page (/cursos/[courseSlug]).
 *
 * The conversion surface. Statically generated: `generateStaticParams` enumerates courses
 * via `listCourseManifests` (published OR not) so the page is reviewable on a preview deploy
 * BEFORE P5 publishes lessons — while all counts and the syllabus still flow through the
 * published-only `listLessons`, so drafts never appear. `firstLessonSlug` is null until a
 * lesson is published; the hero + closing CTA degrade to a "soon" state.
 *
 * COURSE-P6-03: the page is now bilingual even though the LESSONS are not. `getCatalogEntry`
 * takes the manifest from the request locale and the lessons from whichever locale has them,
 * so /en/cursos/dl-nlp is a real English page — hero, prerequisites, syllabus headings, FAQ —
 * whose lesson links point into the Spanish reader, with `ContentLanguageNotice` saying so
 * plainly. `contentLocale` is threaded into every component that builds a lesson href; each
 * passes it to next-intl's <Link locale=…> so the href crosses locales deliberately rather
 * than 404ing under /en. When `en/` lessons land, all of this stops firing on its own.
 *
 * Reading requires no sign-in (P4-02); no progress UI here (P4). hreflang correction and
 * sitemap/JSON-LD land in P6-01. Only the blog keeps the ComingSoonModal (P6-03).
 */

import "@/features/courses/course-editorial.css";
import "./landing.css";

import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Link } from "@/i18n/navigation";
import CourseHero from "@/features/courses/landing/CourseHero";
import Prerequisites from "@/features/courses/landing/Prerequisites";
import SyllabusAccordion from "@/features/courses/landing/SyllabusAccordion";
import CourseFaq from "@/features/courses/landing/CourseFaq";
import CourseCta from "@/features/courses/landing/CourseCta";
import CourseAuthorNote from "@/features/courses/landing/CourseAuthorNote";
import ContentLanguageNotice from "@/features/courses/landing/ContentLanguageNotice";
import { getCourse, listCourseManifests } from "@/lib/courses/registry";
import { courseLocales, getCatalogEntry } from "@/lib/courses/catalog-view";
import { routing } from "@/i18n/routing";
import { availableLocaleAlternates } from "@/lib/hreflang";
import CourseStructuredData from "@/components/seo/CourseStructuredData";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    listCourseManifests(locale).map((course) => ({ locale, courseSlug: course.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; courseSlug: string }>;
}): Promise<Metadata> {
  const { locale, courseSlug } = await params;
  const course = getCourse(courseSlug, locale);
  const tMeta = await getTranslations({ locale, namespace: "meta.cursos" });
  if (!course) {
    return { title: tMeta("title"), description: tMeta("description") };
  }
  // COURSE-P6-01/P6-03: advertise only the locales the course landing actually renders in.
  // That is a manifest AND lessons resolvable from somewhere — the same predicate the
  // catalog and the sitemap use, so all three agree on which URLs exist.
  const available = courseLocales(course.slug);
  return {
    title: `${course.title} — Gustavo Torres`,
    description: course.tagline,
    robots: { index: true, follow: true },
    alternates: availableLocaleAlternates(`/cursos/${course.slug}`, locale, available),
  };
}

export default async function CourseLandingPage({
  params,
}: {
  params: Promise<{ locale: string; courseSlug: string }>;
}) {
  const { locale, courseSlug } = await params;
  setRequestLocale(locale);

  const course = getCourse(courseSlug, locale);
  if (!course) notFound();

  // A manifest with no lessons in ANY locale still renders — that is P1-03's "soon" degrade,
  // and `generateStaticParams` deliberately enumerates unpublished courses so a landing page
  // is reviewable on a preview deploy. `getCatalogEntry` is null in exactly that case.
  const entry = getCatalogEntry(courseSlug, locale);
  const lessons         = entry?.lessons ?? [];
  const contentLocale   = entry?.contentLocale ?? locale;
  const firstLessonSlug = lessons[0]?.slug ?? null;
  const translated      = contentLocale === locale;

  const tLanding = await getTranslations({ locale, namespace: "courses.landing" });
  const tBio = await getTranslations({ locale, namespace: "landing.bio" });

  return (
    <>
      {/* COURSE-P6-01: Course JSON-LD — server-rendered, ships in the static HTML. */}
      <CourseStructuredData course={course} locale={locale} />
      <Navbar />
      <main style={{ position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 840, margin: "0 auto", padding: "32px 20px 0" }}>
          {/* Back to catalog */}
          <Link
            href="/cursos"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "0.875rem",
              color: "var(--text-dim)",
              textDecoration: "none",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "1.125rem" }} aria-hidden="true">
              arrow_back
            </span>
            {tLanding("backToCatalog")}
          </Link>

          <CourseHero
            course={course}
            lessonCount={lessons.length}
            firstLessonSlug={firstLessonSlug}
            locale={locale}
            contentLocale={contentLocale}
          />

          {!translated && <ContentLanguageNotice locale={locale} />}

          <Prerequisites prerequisites={course.prerequisites} locale={locale} />

          <SyllabusAccordion course={course} lessons={lessons} locale={locale} />

          {/* Instructor — reuses the existing biography assets (landing.bio + /avatar.png). */}
          <section style={{ paddingTop: "72px" }}>
            <div className="lp-section-head">
              <span className="lp-kicker">03 — {tLanding("instructor.kicker")}</span>
              <span className="lp-rule" />
            </div>
            <h2
              className="lp-serif"
              style={{
                fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
                fontWeight: 500,
                letterSpacing: "-0.01em",
                color: "var(--text)",
                margin: "0 0 24px",
              }}
            >
              {tLanding("instructor.heading")}
            </h2>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "28px",
                alignItems: "flex-start",
                padding: "32px",
                background: "var(--surface-low)",
                border: "1px solid var(--border-variant)",
                borderRadius: "20px",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", flexShrink: 0 }}>
                <Image
                  src="/avatar.png"
                  alt="Gustavo Torres Guerrero"
                  width={104}
                  height={104}
                  style={{
                    borderRadius: "16px",
                    objectFit: "cover",
                    border: "1px solid var(--border-variant)",
                  }}
                />
                <div style={{ display: "flex", gap: "10px" }}>
                  <a
                    href="https://github.com/gussttaav"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="GitHub"
                    className="lp-social"
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "9px",
                      border: "1px solid var(--border-variant)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                  </a>
                  <a
                    href="https://www.linkedin.com/in/gustavo-torres-guerrero"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="LinkedIn"
                    className="lp-social"
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "9px",
                      border: "1px solid var(--border-variant)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.761 0 5-2.239 5-5v-14c0-2.761-2.239-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                    </svg>
                  </a>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: "240px" }}>
                <h3
                  className="lp-serif"
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: 500,
                    letterSpacing: "-0.01em",
                    color: "var(--text)",
                    margin: "0 0 6px",
                  }}
                >
                  {tBio("headline")}
                </h3>
                <div
                  style={{
                    fontFamily: "var(--font-headline, Manrope), sans-serif",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    color: "var(--text-dim)",
                    marginBottom: "16px",
                  }}
                >
                  Gustavo Torres Guerrero · {tLanding("instructor.role")}
                </div>
                <p style={{ fontSize: "0.9375rem", lineHeight: 1.75, color: "var(--text-muted)", margin: 0 }}>
                  {tBio("para1")}
                </p>
              </div>
            </div>
          </section>

          <CourseAuthorNote locale={locale} />

          <CourseFaq faq={course.faq} locale={locale} />

          <CourseCta
            courseSlug={course.slug}
            cta={course.cta}
            firstLessonSlug={firstLessonSlug}
            contentLocale={contentLocale}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}

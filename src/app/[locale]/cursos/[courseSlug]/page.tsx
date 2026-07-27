/*
 * COURSE-P1-03 — Course landing page (/cursos/[courseSlug]).
 *
 * The conversion surface. Statically generated: `generateStaticParams` enumerates courses
 * via `listCourseManifests` (published OR not) so the page is reviewable on a preview deploy
 * BEFORE P5 publishes lessons — while all counts and the syllabus still flow through the
 * published-only `listLessons`, so drafts never appear. `firstLessonSlug` is null until a
 * lesson is published; the hero + closing CTA degrade to a "soon" state. English has no
 * manifest yet, so only the Spanish `dl-nlp` page is generated (en → 404, by design).
 *
 * Reading requires no sign-in (P4-02); no progress UI here (P4). hreflang correction and
 * sitemap/JSON-LD land in P6-01. Navbar/Footer keep the ComingSoonModal (P6-03).
 */

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
import { getCourse, listLessons, listCourseManifests } from "@/lib/courses/registry";
import { routing } from "@/i18n/routing";
import { localizedAlternates } from "@/lib/hreflang";

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
  return {
    title: `${course.title} — Gustavo Torres`,
    description: course.tagline,
    robots: { index: true, follow: true },
    alternates: localizedAlternates(`/cursos/${course.slug}`, locale),
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

  const lessons = listLessons(course.slug, locale);
  const firstLessonSlug = lessons[0]?.slug ?? null;

  const tLanding = await getTranslations({ locale, namespace: "courses.landing" });
  const tBio = await getTranslations({ locale, namespace: "landing.bio" });

  return (
    <>
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
          />

          <Prerequisites prerequisites={course.prerequisites} locale={locale} />

          <SyllabusAccordion course={course} lessons={lessons} locale={locale} />

          {/* Instructor — reuses the existing biography assets (landing.bio + /avatar.png). */}
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
              {tLanding("instructor.heading")}
            </h2>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "24px",
                alignItems: "flex-start",
                padding: "28px",
                background: "var(--surface-container)",
                border: "1px solid var(--border-variant)",
                borderRadius: "16px",
              }}
            >
              <Image
                src="/avatar.png"
                alt="Gustavo Torres Guerrero"
                width={96}
                height={96}
                style={{ borderRadius: "14px", objectFit: "cover", flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: "240px" }}>
                <h3
                  style={{
                    fontFamily: "var(--font-headline, Manrope), sans-serif",
                    fontSize: "1.125rem",
                    fontWeight: 700,
                    color: "var(--text)",
                    margin: "0 0 12px",
                  }}
                >
                  {tBio("headline")}
                </h3>
                <p style={{ fontSize: "0.9375rem", lineHeight: 1.7, color: "var(--text-muted)", margin: 0 }}>
                  {tBio("para1")}
                </p>
              </div>
            </div>
          </section>

          <CourseFaq locale={locale} />

          <CourseCta courseSlug={course.slug} firstLessonSlug={firstLessonSlug} locale={locale} />
        </div>
      </main>
      <Footer />
    </>
  );
}

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
 * sitemap/JSON-LD land in P6-01. (The blog kept the ComingSoonModal until BLOG-01
 * replaced it with a real /blog; there is no ComingSoonModal any more.)
 *
 * COURSE-BUILD-01: the page also states how finished the course is. `build` (from
 * `getCourseBuild`, which unlike `getCatalogEntry` survives a course with no lessons at all)
 * drives `CourseBuildNotice` and lets `SyllabusAccordion` list the blocks nobody has written
 * yet — so the lesson-less "soon" landing finally shows the five block titles its manifest has
 * always carried. `ContentLanguageNotice` moved off `contentLocale` (the FIRST lesson's locale)
 * onto `fullyTranslated`: with block 1 translated and blocks 2-5 not, the old test said the
 * course was in English. Two independent axes, never conflated — `build` is about the Spanish
 * original, `translatedCount` about this locale.
 *
 * COURSE-C2-P0-01: the lesson-less "soon" landing is `noindex`. It was `index: true` whenever
 * the manifest resolved — but a page the catalog and the sitemap refuse to list should not
 * invite the crawler either. The predicate is `getCatalogEntry` being null, the same one
 * those two use, so the page flips to `index` by itself with the first published lesson.
 */

import "@/features/courses/course-editorial.css";
import "./landing.css";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Link } from "@/i18n/navigation";
import CourseHero from "@/features/courses/landing/CourseHero";
import Prerequisites from "@/features/courses/landing/Prerequisites";
import SyllabusAccordion from "@/features/courses/landing/SyllabusAccordion";
import CourseFaq from "@/features/courses/landing/CourseFaq";
import CourseBuildNotice from "@/features/courses/landing/CourseBuildNotice";
import CourseCta from "@/features/courses/landing/CourseCta";
import CourseAuthorNote from "@/features/courses/landing/CourseAuthorNote";
import AuthorBio from "@/features/content/AuthorBio";
import ContentLanguageNotice from "@/features/courses/landing/ContentLanguageNotice";
import { getCourse, listCourseManifests } from "@/lib/courses/registry";
import { courseLocales, getCatalogEntry, getCourseBuild } from "@/lib/courses/catalog-view";
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
  // COURSE-C2-P0-01: no published lesson in any locale → the "soon" landing renders but is
  // absent from the catalog and the sitemap, so it must not be indexed either.
  const listed = getCatalogEntry(course.slug, locale) !== null;
  return {
    title: `${course.title} — Gustavo Torres`,
    description: course.tagline,
    robots: { index: listed, follow: true },
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
  // COURSE-BUILD-01: `!` is safe — `getCourseBuild` returns null only for a course with no
  // manifest in this locale, and `getCourse` above already sent that case to notFound().
  const build           = getCourseBuild(courseSlug, locale)!;
  const fullyTranslated = entry?.fullyTranslated ?? true;

  const tLanding = await getTranslations({ locale, namespace: "courses.landing" });

  return (
    <>
      {/* COURSE-P6-01: Course JSON-LD — server-rendered, ships in the static HTML. */}
      <CourseStructuredData course={course} locale={locale} />
      <Navbar />
      <main style={{ position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 840, margin: "0 auto", padding: "96px 20px 0" }}>
          {/* Back to catalog — 96px top padding clears the fixed 70px navbar so this link
              (the container's first element) isn't hidden under its blur, matching /cursos. */}
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

          {/* COURSE-BUILD-01: the course's own progress first, then the translation's. The
              notify opt-in appears once — see CourseBuildNotice's `withNotify`. */}
          {!build.complete && (
            <CourseBuildNotice build={build} locale={locale} withNotify={fullyTranslated} />
          )}

          {!fullyTranslated && (
            <ContentLanguageNotice
              locale={locale}
              translatedCount={entry?.translatedCount ?? 0}
              total={lessons.length}
            />
          )}

          <Prerequisites prerequisites={course.prerequisites} locale={locale} />

          <SyllabusAccordion course={course} build={build} locale={locale} />

          {/* Instructor. CONTENT-AUTHOR-01: the card moved out to the shared
              `AuthorBio` (features/content) so the blog post wears the very same one.
              The section kicker and <h2> stay here: the "03 —" numbering and the serif
              display heading are this page's voice, not the card's. */}
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
            <AuthorBio locale={locale} />
          </section>

          <CourseAuthorNote locale={locale} />

          <CourseFaq faq={course.faq} locale={locale} courseSlug={course.slug} />

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

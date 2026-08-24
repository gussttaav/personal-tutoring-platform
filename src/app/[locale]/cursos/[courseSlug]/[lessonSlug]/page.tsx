/*
 * COURSE-P1-04 — Lesson reader route (/cursos/[courseSlug]/[lessonSlug]).
 *
 * Statically generated, one static HTML file per PUBLISHED lesson. `generateStaticParams`
 * enumerates via the published-only `listLessons`, so draft lessons are absent from the
 * routes AND the sitemap (Phase-1 exit criterion), and `en` — which has no content —
 * generates nothing and 404s cleanly. (To review the reader before P5 publishes content,
 * flip the P1-01 fixture to `draft: false` locally; do not commit.)
 *
 * This is the ONLY course route that renders the MDX prose body: it reads the raw source
 * with `getLessonSource` (the registry stays metadata-only) and compiles it at build time
 * via `renderLesson` — so, like the landing page, the client ships no KaTeX/Shiki/MDX JS.
 * KaTeX CSS + the reader layout CSS are imported HERE (segment-scoped), never in the
 * shared layout. hreflang refinement + JSON-LD land in P6-01.
 */

import "../../_styles/katex.css";
import "./lesson.css";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LessonLayout from "@/features/courses/reader/LessonLayout";
import {
  getCourse,
  listLessons,
  listCourseManifests,
  lessonNeighbours,
} from "@/lib/courses/registry";
import { getLessonSource } from "@/lib/courses/lesson-source";
import { extractHeadings } from "@/lib/courses/headings";
import { placedExerciseIds } from "@/lib/courses/exercise-ids";
import { renderLesson } from "@/lib/courses/mdx";
import { routing } from "@/i18n/routing";
import { availableLocaleAlternates, localeUrl } from "@/lib/hreflang";
import LessonStructuredData from "@/components/seo/LessonStructuredData";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    listCourseManifests(locale).flatMap((course) =>
      // Published-only: no page is generated for a draft lesson.
      listLessons(course.slug, locale).map((lesson) => ({
        locale,
        courseSlug: course.slug,
        lessonSlug: lesson.slug,
      })),
    ),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; courseSlug: string; lessonSlug: string }>;
}): Promise<Metadata> {
  const { locale, courseSlug, lessonSlug } = await params;
  const course = getCourse(courseSlug, locale);
  const lesson = listLessons(courseSlug, locale).find((l) => l.slug === lessonSlug);

  if (!course || !lesson) {
    const tMeta = await getTranslations({ locale, namespace: "meta.cursos" });
    return { title: tMeta("title"), description: tMeta("description") };
  }

  // COURSE-P6-01: advertise only the locales this lesson is published in. `en` has
  // no content for months → no `/en/cursos/...` alternate is emitted while it 404s.
  const route = `/cursos/${courseSlug}/${lessonSlug}`;
  const available = routing.locales.filter((l) =>
    listLessons(courseSlug, l).some((les) => les.slug === lessonSlug),
  );
  // COURSE-P6-01: per-lesson OpenGraph so shares carry the lesson's own title/description
  // instead of inheriting the site-level card from the layout. The og image is still the
  // generic /og.png (a known placeholder — a per-course image is out of scope, docs/seo).
  const ogImage = locale === "en" ? "/og-en.png" : "/og.png";
  return {
    title: `${lesson.title} — ${course.title}`,
    description: lesson.summary,
    robots: { index: true, follow: true },
    alternates: availableLocaleAlternates(route, locale, available),
    openGraph: {
      type: "article",
      siteName: "gustavoai.dev",
      title: `${lesson.title} — ${course.title}`,
      description: lesson.summary,
      url: localeUrl(route, locale),
      locale: locale === "en" ? "en_US" : "es_ES",
      images: [{ url: ogImage, width: 1200, height: 630, alt: lesson.title }],
    },
  };
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ locale: string; courseSlug: string; lessonSlug: string }>;
}) {
  const { locale, courseSlug, lessonSlug } = await params;
  setRequestLocale(locale);

  const course = getCourse(courseSlug, locale);
  if (!course) notFound();

  // Published-only lookup: drafts (and unknown slugs) 404.
  const lessons = listLessons(courseSlug, locale);
  const lesson = lessons.find((l) => l.slug === lessonSlug);
  if (!lesson) notFound();

  const source = getLessonSource(courseSlug, lessonSlug, locale);
  if (!source) notFound();

  // COURSE-P3-01: the frontmatter quiz questions are handed to the compiler so
  // `<Quiz id="…" />` in the prose can resolve against them.
  // COURSE-P3-02: likewise the code challenges, for `<CodeChallenge id="…" />`.
  const { content } = await renderLesson(source, lesson.quiz, lesson.challenges);
  const headings = extractHeadings(source);
  const { prev, next } = lessonNeighbours(courseSlug, lessonSlug, locale);
  // COURSE-P4-04: the denominator for the "N de M ejercicios resueltos" counter.
  // Read at BUILD time from the body, so the page stays static.
  const exerciseIds = placedExerciseIds(source);

  return (
    <>
      {/* COURSE-P6-01: LearningResource JSON-LD — server-rendered, ships in the static HTML. */}
      <LessonStructuredData course={course} lesson={lesson} locale={locale} />
      <Navbar />
      <LessonLayout
        course={course}
        lessons={lessons}
        courseSlug={courseSlug}
        currentSlug={lessonSlug}
        title={lesson.title}
        minutes={lesson.minutes}
        headings={headings}
        exerciseIds={exerciseIds}
        prev={prev}
        next={next}
        locale={locale}
      >
        {content}
      </LessonLayout>
      <Footer />
    </>
  );
}

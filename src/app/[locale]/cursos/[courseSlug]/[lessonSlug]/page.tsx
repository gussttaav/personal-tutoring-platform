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
import { renderLesson } from "@/lib/courses/mdx";
import { routing } from "@/i18n/routing";
import { localizedAlternates } from "@/lib/hreflang";

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

  return {
    title: `${lesson.title} — ${course.title}`,
    description: lesson.summary,
    robots: { index: true, follow: true },
    alternates: localizedAlternates(`/cursos/${courseSlug}/${lessonSlug}`, locale),
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

  const { content } = await renderLesson(source);
  const headings = extractHeadings(source);
  const { prev, next } = lessonNeighbours(courseSlug, lessonSlug, locale);

  return (
    <>
      <Navbar />
      <LessonLayout
        course={course}
        lessons={lessons}
        courseSlug={courseSlug}
        currentSlug={lessonSlug}
        title={lesson.title}
        minutes={lesson.minutes}
        headings={headings}
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

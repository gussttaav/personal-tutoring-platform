/*
 * COURSE-P1-04 — Lesson reader route (/cursos/[courseSlug]/[lessonSlug]).
 *
 * Statically generated, one static HTML file per published lesson PER LOCALE. Draft lessons
 * are absent from the routes and the sitemap (Phase-1 exit criterion).
 *
 * COURSE-P6-03b: a locale with no translation of a lesson still gets a page, serving the
 * canonical prose. It has to: locale detection is pathname → NEXT_LOCALE cookie → default
 * (src/middleware.ts), so an unprefixed `/cursos/...` requested by ANYONE holding an `en`
 * cookie is redirected to `/en/cursos/...`. While that 404'd, every Spanish lesson URL in
 * the sitemap was a dead end for an English-preferring reader arriving from search — and
 * the language switcher on any lesson was a guaranteed 404.
 *
 * Such a page is deliberately NOT indexable: it is Spanish prose under an /en URL, so it
 * sends `noindex` and a canonical pointing at the Spanish original, emits no hreflang
 * alternate and no JSON-LD, and stays out of the sitemap. Google only ever hears about a
 * lesson URL that genuinely serves the language it claims. When the translation lands the
 * page becomes a first-class English page and all of that lifts automatically.
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
import { getCourse, listLessons, listCourseManifests } from "@/lib/courses/registry";
import {
  getLessonView,
  lessonViewNeighbours,
  listLessonViews,
} from "@/lib/courses/catalog-view";
import { getLessonSource } from "@/lib/courses/lesson-source";
import { extractHeadings } from "@/lib/courses/headings";
import { placedExerciseIds } from "@/lib/courses/exercise-ids";
import { renderLesson } from "@/lib/courses/mdx";
import { routing } from "@/i18n/routing";
import { availableLocaleAlternates, localeUrl } from "@/lib/hreflang";
import LessonStructuredData from "@/components/seo/LessonStructuredData";
import TranslationPendingNotice from "@/features/courses/reader/TranslationPendingNotice";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    listCourseManifests(locale).flatMap((course) =>
      // The resolved SPINE, not the per-locale published list: every locale with a manifest
      // gets a page for every lesson, translated or falling back. Drafts are still excluded —
      // the spine is built from published-only selectors.
      listLessonViews(course.slug, locale).map((view) => ({
        locale,
        courseSlug: course.slug,
        lessonSlug: view.lesson.slug,
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
  const view   = getLessonView(courseSlug, lessonSlug, locale);

  if (!course || !view) {
    const tMeta = await getTranslations({ locale, namespace: "meta.cursos" });
    return { title: tMeta("title"), description: tMeta("description") };
  }
  const lesson = view.lesson;
  const route  = `/cursos/${courseSlug}/${lessonSlug}`;

  // COURSE-P6-03b: an untranslated lesson renders, but must never be indexed as this locale.
  //
  // `noindex, follow` and NOTHING ELSE. Deliberately no `rel=canonical` to the Spanish
  // original, even though that is the intuitive thing to add: noindex and canonical are
  // CONTRADICTORY signals — canonical asserts "these two URLs are the same page, index that
  // one", so Google may consolidate the pair and carry the noindex over to the canonical
  // target. That target would be the Spanish lesson, i.e. the site's entire organic-search
  // asset. noindex alone is unambiguous and already does the whole job; the page is also
  // absent from the sitemap and linked from no indexed page.
  //
  // `follow` stays on so any links out of the page still count.
  if (view.contentLocale !== locale) {
    return {
      title: `${lesson.title} — ${course.title}`,
      description: lesson.summary,
      robots: { index: false, follow: true },
      // `canonical: null` EXPLICITLY, not just omitted. Next merges metadata down from the
      // layout, and the layout sets `alternates: localizedAlternates("", locale)` — so an
      // omitted `alternates` here does not mean "none", it means the page inherits the HOME
      // PAGE's canonical and hreflang set. A lesson declaring itself an alternate of "/" is
      // a far worse signal than the canonical this block deliberately does not send.
      alternates: { canonical: null },
    };
  }

  // COURSE-P6-01: advertise only the locales this lesson is genuinely published in.
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

  // Resolved spine: drafts and unknown slugs 404; an untranslated lesson falls back.
  const views   = listLessonViews(courseSlug, locale);
  const view    = views.find((v) => v.lesson.slug === lessonSlug);
  if (!view) notFound();
  const lesson  = view.lesson;
  const lessons = views.map((v) => v.lesson);
  const isFallback = view.contentLocale !== locale;

  const source = getLessonSource(courseSlug, lessonSlug, view.contentLocale);
  if (!source) notFound();

  // COURSE-P3-01: the frontmatter quiz questions are handed to the compiler so
  // `<Quiz id="…" />` in the prose can resolve against them.
  // COURSE-P3-02: likewise the code challenges, for `<CodeChallenge id="…" />`.
  // COURSE-P7-01: and the lesson's own identity, so `<Leccion slug="…">` can tell a
  // backward reference from a forward one. Slugs resolve against `view.contentLocale`
  // — the tree the prose actually came from — while the URL prefix follows `locale`.
  const { content } = await renderLesson(source, lesson.quiz, lesson.challenges, {
    courseSlug,
    locale,
    contentLocale: view.contentLocale,
    current: lesson,
  });
  const headings = extractHeadings(source);
  const { prev, next } = lessonViewNeighbours(courseSlug, lessonSlug, locale);
  // COURSE-P4-04: the denominator for the "N de M ejercicios resueltos" counter.
  // Read at BUILD time from the body, so the page stays static.
  const exerciseIds = placedExerciseIds(source);

  return (
    <>
      {/* COURSE-P6-01: LearningResource JSON-LD — server-rendered, ships in the static HTML.
          Omitted on a fallback page: the page is noindex, and describing Spanish prose as an
          English learning resource would be a straight-up false claim to a crawler. */}
      {!isFallback && <LessonStructuredData course={course} lesson={lesson} locale={locale} />}
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
        {isFallback && <TranslationPendingNotice locale={locale} />}
        {content}
      </LessonLayout>
      <Footer />
    </>
  );
}

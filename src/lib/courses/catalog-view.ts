/*
 * COURSE-P6-03 — catalog/landing resolution across locales.
 *
 * The registry is per-locale and a locale with no content is normal. `listCourses(locale)`
 * is published-only IN THAT LOCALE, so an English visitor would see an empty catalog while
 * a finished Spanish course sits one directory away — and the landing page would 404.
 *
 * One rule, applied everywhere the catalog and landing surfaces are built:
 *   MANIFEST from the requested locale, LESSONS from whichever locale has them
 *   (requested first, canonical as fallback).
 *
 * That is the same request-locale-then-canonical resolution `registryCourseMeta` already
 * uses in ./enrollment-view.ts, and for the same reason: the locale that actually resolved
 * rides along in `contentLocale`, so callers can link the reader at the lessons that exist
 * instead of a 404, and can say plainly which language those lessons are in.
 *
 * Kept OUT of registry.ts on purpose: this module imports `@/i18n/routing`, and the registry
 * is loaded by scripts/lint-content.ts under `tsx`, where pulling in next-intl would be a new
 * dependency for no gain.
 *
 * COURSE-P6-03b: resolution is PER LESSON, not per course. Course-level resolution had a
 * cliff — the first published English lesson flipped the whole English surface onto the
 * English tree, collapsing a 43-lesson syllabus to 1 and stranding the reader at a `next`
 * of null. The Spanish (canonical) list is the SPINE: it fixes the order and the set, and
 * each lesson independently uses the requested locale's version when there is one. A course
 * can therefore be translated one lesson at a time with no broken intermediate state.
 *
 * COURSE-BUILD-01: the entry also carries the course's AUTHORING progress (`build`) and how
 * much of it exists in the request locale (`translatedCount`). Two independent axes, computed
 * in one place so the card, the landing notices, the syllabus and the FAQ can never disagree
 * about them: `build` is a question about the CANONICAL course (is the Spanish original
 * finished?), `translatedCount` about this locale (how far has the translation got?). The
 * planned lesson counts `build` measures against are read from the CANONICAL manifest even
 * when the prose comes from another one — a block's size is locale-invariant, exactly like its
 * `id`, so the `en` manifest must not be able to disagree with the `es` one about it.
 *
 * What is NOT resolved here is which lesson URLs are INDEXABLE. A fallback page is real (it
 * must not 404) but it is Spanish prose under an /en URL, so the route marks it `noindex`
 * with a canonical pointing at the Spanish original, and the sitemap keeps using the
 * published-only per-locale selectors. Never advertise a locale you cannot actually serve.
 */

import type { Course, CourseBlock, Lesson, LessonRef } from "@/domain/types";
import { routing } from "@/i18n/routing";
import { courseBuildStatus, type CourseBuildStatus } from "./course-build";
import { getCourse, listCourseManifests, listLessons } from "./registry";

const CANONICAL_LOCALE = routing.defaultLocale;

/** One lesson, resolved: its metadata plus the locale its MDX actually lives in. */
export interface LessonView {
  lesson:        Lesson;
  /** Locale of the prose. Differs from the request locale for an untranslated lesson. */
  contentLocale: string;
}

export interface CatalogEntry {
  /** Manifest in the REQUESTED locale — never the fallback's. */
  course:        Course;
  /** Locale backing the FIRST lesson — what "start the course" has to link to. */
  contentLocale: string;
  /** The spine, `(block, order)` sorted. Never empty. */
  lessons:       Lesson[];
  /** Per-lesson resolution, same order as `lessons`. */
  views:         LessonView[];
  /** True when every lesson exists in the requested locale. Drives the "in Spanish" badge. */
  fullyTranslated: boolean;
  /** COURSE-BUILD-01 — lessons that exist in the REQUESTED locale; `lessons.length` when
   *  `fullyTranslated`, 0 when nothing is translated. The partial case is the interesting one:
   *  it is what lets a notice say "18 of 43" instead of claiming one thing or the other. */
  translatedCount: number;
  /** COURSE-BUILD-01 — authoring progress of the canonical course, block by block. */
  build:           CourseBuildStatus;
}

/**
 * The lesson spine for `courseSlug` in `locale`, resolved per lesson.
 *
 * Order and membership come from the canonical locale; each entry uses the requested
 * locale's version when that lesson has been translated. Empty when the course has no
 * published lessons in any locale.
 */
export function listLessonViews(courseSlug: string, locale: string): LessonView[] {
  const own = listLessons(courseSlug, locale);

  // An English-only course (or the canonical tree not existing) still has to work: with no
  // canonical spine, the requested locale IS the spine.
  const spine = listLessons(courseSlug, CANONICAL_LOCALE);
  if (spine.length === 0) {
    return own.map((lesson) => ({ lesson, contentLocale: locale }));
  }

  const translated = new Map(own.map((l) => [l.slug, l]));
  return spine.map((lesson) => {
    const hit = translated.get(lesson.slug);
    return hit
      ? { lesson: hit,   contentLocale: locale }
      : { lesson,        contentLocale: CANONICAL_LOCALE };
  });
}

/** One resolved lesson, or `null` for a slug that is not published in any locale. */
export function getLessonView(
  courseSlug: string,
  lessonSlug: string,
  locale: string,
): LessonView | null {
  return listLessonViews(courseSlug, locale).find((v) => v.lesson.slug === lessonSlug) ?? null;
}

/** Previous/next along the SPINE, so reader navigation never dead-ends mid-translation. */
export function lessonViewNeighbours(
  courseSlug: string,
  lessonSlug: string,
  locale: string,
): { prev: LessonRef | null; next: LessonRef | null } {
  const views = listLessonViews(courseSlug, locale);
  const idx = views.findIndex((v) => v.lesson.slug === lessonSlug);
  if (idx === -1) return { prev: null, next: null };

  const toRef = (v: LessonView): LessonRef => ({ slug: v.lesson.slug, title: v.lesson.title });
  return {
    prev: idx > 0 ? toRef(views[idx - 1]) : null,
    next: idx < views.length - 1 ? toRef(views[idx + 1]) : null,
  };
}

/** COURSE-BUILD-01 — the requested locale's blocks (translated prose) carrying the CANONICAL
 *  manifest's planned lesson counts. A block's planned size is locale-invariant like its `id`,
 *  so one manifest owns it and a translation cannot drift from it. */
function blocksWithCanonicalPlan(course: Course, locale: string): CourseBlock[] {
  if (locale === CANONICAL_LOCALE) return course.blocks;
  const canonical = getCourse(course.slug, CANONICAL_LOCALE);
  // No canonical manifest at all (an English-only course) — this locale's plan is the plan.
  if (!canonical) return course.blocks;
  const plan = new Map(canonical.blocks.map((b) => [b.id, b.lessons]));
  return course.blocks.map((b) => ({ ...b, lessons: plan.get(b.id) }));
}

/**
 * COURSE-BUILD-01 — the course's authoring progress in `locale`, or `null` for a course with no
 * manifest there.
 *
 * Unlike `getCatalogEntry` this survives a course with NO published lessons: that is the
 * lesson-less «soon» landing, and listing the blocks it will have is most of the point of that
 * page. The block prose is the requested locale's, the plan and the published counts are the
 * canonical course's (`listLessonViews` returns the canonical spine, and `block` is
 * locale-invariant, so counting off it needs no second scan).
 */
export function getCourseBuild(courseSlug: string, locale: string): CourseBuildStatus | null {
  const course = getCourse(courseSlug, locale);
  if (!course) return null;
  const views = listLessonViews(courseSlug, locale);
  return courseBuildStatus(
    blocksWithCanonicalPlan(course, locale),
    views.map((v) => v.lesson),
  );
}

/** The catalog/landing entry for one course in one locale, or `null` when the course has no
 *  manifest in that locale or no published lessons in any locale. */
export function getCatalogEntry(courseSlug: string, locale: string): CatalogEntry | null {
  const course = getCourse(courseSlug, locale);
  if (!course) return null;

  const views = listLessonViews(courseSlug, locale);
  if (views.length === 0) return null;

  const translatedCount = views.filter((v) => v.contentLocale === locale).length;

  return {
    course,
    contentLocale:   views[0].contentLocale,
    lessons:         views.map((v) => v.lesson),
    views,
    fullyTranslated: translatedCount === views.length,
    translatedCount,
    build:           courseBuildStatus(
      blocksWithCanonicalPlan(course, locale),
      views.map((v) => v.lesson),
    ),
  };
}

/** Every course showable on `/cursos` for a locale, in manifest scan order. */
export function listCatalogEntries(locale: string): CatalogEntry[] {
  return listCourseManifests(locale)
    .map((course) => getCatalogEntry(course.slug, locale))
    .filter((entry): entry is CatalogEntry => entry !== null);
}

/** Locales whose catalog has at least one course — the `available` set for hreflang. */
export function catalogLocales(): string[] {
  return routing.locales.filter((l) => listCatalogEntries(l).length > 0);
}

/** Locales where a given course's landing page renders — the `available` set for hreflang. */
export function courseLocales(courseSlug: string): string[] {
  return routing.locales.filter((l) => getCatalogEntry(courseSlug, l) !== null);
}

/** How much of the course exists in English: lessons translated vs. the canonical spine
 *  total, and whether every one of them is. Shared by the admin "announce the English
 *  translation" dry-run and the public landing FAQ so the two can never disagree. */
export function getEnglishTranslationCoverage(
  courseSlug: string,
): { translated: number; total: number; fullyTranslated: boolean } {
  const entry = getCatalogEntry(courseSlug, "en");
  if (!entry) {
    const canonical = getCatalogEntry(courseSlug, CANONICAL_LOCALE);
    return { translated: 0, total: canonical?.lessons.length ?? 0, fullyTranslated: false };
  }
  return {
    translated:      entry.translatedCount,
    total:           entry.views.length,
    fullyTranslated: entry.fullyTranslated,
  };
}

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
 * What is NOT resolved here is which lesson URLs are INDEXABLE. A fallback page is real (it
 * must not 404) but it is Spanish prose under an /en URL, so the route marks it `noindex`
 * with a canonical pointing at the Spanish original, and the sitemap keeps using the
 * published-only per-locale selectors. Never advertise a locale you cannot actually serve.
 */

import type { Course, Lesson, LessonRef } from "@/domain/types";
import { routing } from "@/i18n/routing";
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

/** The catalog/landing entry for one course in one locale, or `null` when the course has no
 *  manifest in that locale or no published lessons in any locale. */
export function getCatalogEntry(courseSlug: string, locale: string): CatalogEntry | null {
  const course = getCourse(courseSlug, locale);
  if (!course) return null;

  const views = listLessonViews(courseSlug, locale);
  if (views.length === 0) return null;

  return {
    course,
    contentLocale:   views[0].contentLocale,
    lessons:         views.map((v) => v.lesson),
    views,
    fullyTranslated: views.every((v) => v.contentLocale === locale),
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

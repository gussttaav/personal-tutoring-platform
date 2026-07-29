/*
 * COURSE-P4-03 — enrolment summaries + registry metadata → panel rows.
 *
 * `CourseProgressSummary` carries no title: titles live in git, not Postgres, and
 * denormalising them into the DB just to make one query self-contained would leave
 * two copies to drift. The merge therefore happens here, server-side, and only the
 * merged view crosses the wire.
 *
 * The lookup is injected rather than imported so the mapping is testable without a
 * filesystem — the same split as `registryCourseCatalog` in ./catalog.ts.
 *
 * Locale: `registryCourseMeta` reads the request locale FIRST and falls back to the
 * canonical one. `content/courses/dl-nlp/` has no `en` tree today, so resolving
 * against the request locale alone would drop every enrolment for every English
 * reader and render the empty state to someone who is halfway through a course.
 * The locale that actually resolved rides along in the view, so the card can send
 * that reader to the Spanish lesson that exists instead of an English 404.
 */

import type { CourseProgressSummary, EnrolledCourseView } from "@/domain/types";
import { routing } from "@/i18n/routing";
import { getCourse, listLessons } from "./registry";

const CANONICAL_LOCALE = routing.defaultLocale;

export interface CourseMeta {
  title:           string;
  /** First published lesson in reading order, or `null` when all are drafts. */
  firstLessonSlug: string | null;
  /** Locale the course actually resolved in. */
  locale:          string;
}

/** `null` for a slug the registry does not know — a stale enrolment for a course
 *  that no longer exists, which the panel skips silently. */
export type CourseMetaResolver = (courseSlug: string) => CourseMeta | null;

function metaForLocale(courseSlug: string, locale: string): CourseMeta | null {
  const course = getCourse(courseSlug, locale);
  if (!course) return null;
  return {
    title:           course.title,
    firstLessonSlug: listLessons(courseSlug, locale)[0]?.slug ?? null,
    locale,
  };
}

/** Registry-backed lookup: request locale first, canonical locale as fallback. */
export function registryCourseMeta(locale: string): CourseMetaResolver {
  return (courseSlug: string) =>
    metaForLocale(courseSlug, locale) ??
    (locale === CANONICAL_LOCALE ? null : metaForLocale(courseSlug, CANONICAL_LOCALE));
}

/** Merges progress with course metadata, dropping summaries the resolver rejects. */
export function toEnrolledCourseViews(
  summaries: readonly CourseProgressSummary[],
  resolve: CourseMetaResolver,
): EnrolledCourseView[] {
  const views: EnrolledCourseView[] = [];

  for (const summary of summaries) {
    const meta = resolve(summary.courseSlug);
    if (!meta) continue;

    views.push({
      courseSlug:       summary.courseSlug,
      title:            meta.title,
      totalLessons:     summary.totalLessons,
      completedLessons: summary.completedLessons,
      percentComplete:  summary.percentComplete,
      resumeLessonSlug: summary.lastSeenLessonSlug ?? meta.firstLessonSlug,
      completedAt:      summary.completedAt,
      contentLocale:    meta.locale,
    });
  }

  return views;
}

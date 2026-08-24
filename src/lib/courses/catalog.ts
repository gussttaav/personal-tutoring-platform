/*
 * COURSE-P4-01 — ICourseCatalog over the build-time registry.
 *
 * The adapter that lets `CourseService` ask "does this course exist / which
 * lessons are published" without importing the filesystem-backed registry.
 *
 * Pinned to the CANONICAL locale, not the request locale, and that is deliberate:
 * `Lesson.slug` is locale-invariant by design (see src/domain/types.ts), so a
 * lesson finished while reading in Spanish is the same lesson in English. The
 * registry, however, is per-locale and a locale with no content is normal —
 * `content/courses/dl-nlp/` has no `en` tree today. Resolving progress against the
 * request locale would report `totalLessons: 0` (and 0%) to every English reader
 * until the translation lands. One canonical denominator avoids that entirely.
 *
 * Publication matters here too: `getLesson()` returns drafts, so lesson existence
 * is checked against `listLessons()` — the published-only selector — instead.
 */
import type { ICourseCatalog } from "@/domain/repositories/ICourseCatalog";
import { routing } from "@/i18n/routing";
import { getCourse, listLessons } from "./registry";

const CANONICAL_LOCALE = routing.defaultLocale;

export const registryCourseCatalog: ICourseCatalog = {
  courseExists(courseSlug: string): boolean {
    return getCourse(courseSlug, CANONICAL_LOCALE) !== null;
  },

  listLessonSlugs(courseSlug: string): string[] {
    return listLessons(courseSlug, CANONICAL_LOCALE).map((lesson) => lesson.slug);
  },
};

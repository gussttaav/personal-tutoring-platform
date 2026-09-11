/*
 * COURSE-P9-02 — What to say about the language of a course's search results.
 *
 * A course under `/en` may be untranslated, partly translated (Phase 11 lands lessons one
 * by one) or fully translated, and each state wants a different honesty: a global "The
 * lessons are in Spanish" is true only in the first, a per-result "· In Spanish" tag (the
 * `<Leccion>` card's `refFallback`, src/lib/courses/Leccion.tsx) is the right grain in the
 * second, and the third needs nothing. Both search surfaces derive their notice and their
 * tags from this one function so they can never disagree.
 */

export type ContentLanguage =
  /** Every lesson's prose is in the requested locale — say nothing. */
  | "native"
  /** Some lessons fell back to the canonical locale — tag those results. */
  | "partial"
  /** No lesson is in the requested locale — one notice for all results. */
  | "fallback";

interface LessonLocale {
  contentLocale: string;
}

export function isFallbackLesson(lesson: LessonLocale, locale: string): boolean {
  return lesson.contentLocale !== locale;
}

export function contentLanguage(index: { locale: string; lessons: readonly LessonLocale[] }): ContentLanguage {
  const fallbacks = index.lessons.filter((l) => isFallbackLesson(l, index.locale)).length;
  if (fallbacks === 0) return "native";
  return fallbacks === index.lessons.length ? "fallback" : "partial";
}

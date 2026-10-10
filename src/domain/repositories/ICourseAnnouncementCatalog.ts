/*
 * COURSE-ANNOUNCE-01 — the published-course port for course announcements.
 *
 * `CourseAnnouncementService` needs three facts about a course: its title, lesson count and
 * first lesson in the language an email is written in, whether the course exists at all, and
 * how much of it is translated into English. All of them come from the build-time course
 * registry (a memoized synchronous filesystem read), so — exactly like `IBlogPostCatalog` and
 * `ICourseCatalog` — it is injected rather than imported, keeping the service free of I/O and
 * letting its tests declare a catalog in a few lines. Sync on purpose, same reasoning.
 */

/** What the announcement template says about a course. */
export interface AnnouncedCourse {
  courseSlug:      string;
  courseTitle:     string;
  lessonCount:     number;
  firstLessonSlug: string | null;
}

/** How much of the course exists in English: lessons translated vs. the canonical total. */
export interface EnglishTranslationCoverage {
  translated:      number;
  total:           number;
  fullyTranslated: boolean;
}

export interface ICourseAnnouncementCatalog {
  /** The course as published in the canonical locale; `null` for an unknown slug or a course
   *  with no published lessons. This is the "does it exist" check. */
  canonical(courseSlug: string): AnnouncedCourse | null;

  /** The same facts in `locale`, falling back to the canonical locale's when the course has
   *  no published version there. `null` only when `canonical` is. */
  forLocale(courseSlug: string, locale: "es" | "en"): AnnouncedCourse | null;

  englishCoverage(courseSlug: string): EnglishTranslationCoverage;
}

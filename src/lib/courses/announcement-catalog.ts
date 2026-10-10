/*
 * COURSE-ANNOUNCE-01 — ICourseAnnouncementCatalog over the build-time course registry.
 *
 * SERVER-ONLY: `getCatalogEntry` reads the filesystem-backed registry. The per-locale lookup
 * falls back to the canonical locale's entry, the rule the announce route used inline
 * (`courseFactsFor`): an English reader of a course with no English manifest still gets the
 * email, with the Spanish title.
 */
import type {
  AnnouncedCourse,
  EnglishTranslationCoverage,
  ICourseAnnouncementCatalog,
} from "@/domain/repositories/ICourseAnnouncementCatalog";
import { routing } from "@/i18n/routing";
import { getCatalogEntry, getEnglishTranslationCoverage } from "./catalog-view";

function factsFor(courseSlug: string, locale: string): AnnouncedCourse | null {
  const entry = getCatalogEntry(courseSlug, locale);
  if (!entry) return null;

  return {
    courseSlug,
    courseTitle:     entry.course.title,
    lessonCount:     entry.lessons.length,
    firstLessonSlug: entry.lessons[0]?.slug ?? null,
  };
}

export const registryCourseAnnouncementCatalog: ICourseAnnouncementCatalog = {
  canonical(courseSlug: string): AnnouncedCourse | null {
    return factsFor(courseSlug, routing.defaultLocale);
  },

  forLocale(courseSlug: string, locale: "es" | "en"): AnnouncedCourse | null {
    return factsFor(courseSlug, locale) ?? factsFor(courseSlug, routing.defaultLocale);
  },

  englishCoverage(courseSlug: string): EnglishTranslationCoverage {
    return getEnglishTranslationCoverage(courseSlug);
  },
};

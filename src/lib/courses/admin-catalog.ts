/*
 * ADMIN-USERS-01 — IAdminCourseCatalog over the build-time course registry.
 *
 * SERVER-ONLY: `getCatalogEntry` reads the filesystem-backed registry. Pinned to the
 * canonical locale, like `registryCourseCatalog`: lesson slugs are locale-invariant, and the
 * Spanish spine is the progress denominator everywhere else, so the admin's figures match
 * the reader's. Titles are the Spanish ones, which is what the (Spanish) admin panel shows.
 */
import type { AdminCatalogCourse, IAdminCourseCatalog } from "@/domain/repositories/IAdminCourseCatalog";
import { routing } from "@/i18n/routing";
import { getCatalogEntry, listCatalogEntries, type CatalogEntry } from "./catalog-view";

const CANONICAL_LOCALE = routing.defaultLocale;

function toAdminCourse(entry: CatalogEntry): AdminCatalogCourse {
  return {
    slug:     entry.course.slug,
    title:    entry.course.title,
    blocks:   entry.course.blocks.map((b) => ({ id: b.id, title: b.title })),
    lessons:  entry.lessons.map((l) => ({ slug: l.slug, title: l.title, block: l.block })),
    complete: entry.build.complete,
  };
}

export const registryAdminCourseCatalog: IAdminCourseCatalog = {
  listCourses(): AdminCatalogCourse[] {
    return listCatalogEntries(CANONICAL_LOCALE).map(toAdminCourse);
  },

  getCourse(courseSlug: string): AdminCatalogCourse | null {
    const entry = getCatalogEntry(courseSlug, CANONICAL_LOCALE);
    return entry ? toAdminCourse(entry) : null;
  },
};

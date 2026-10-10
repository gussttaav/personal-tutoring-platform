/*
 * BLOG-15 — the published-post port for blog announcements.
 *
 * `BlogAnnouncementService` needs a post's title, summary and areas in each locale, and
 * which locales it is published in. The blog registry is a memoized synchronous filesystem
 * read, so — exactly like `IContentCatalog` and `ICourseCatalog` — it is injected rather
 * than imported, keeping the service free of I/O and letting its tests declare a catalog
 * in a few lines. Sync on purpose, same reasoning as those two.
 */
import type { BlogArea } from "../types";

export interface AnnouncedPost {
  slug:    string;
  title:   string;
  summary: string;
  /** Locale-invariant, like the slug: the same in every translation. */
  areas:   BlogArea[];
}

export interface IBlogPostCatalog {
  /** `null` for an unknown slug, a draft, or a locale the post is not published in. */
  get(slug: string, locale: "es" | "en"): AnnouncedPost | null;
  /** The locales the post is published in; empty when it is published nowhere. */
  locales(slug: string): ("es" | "en")[];
}

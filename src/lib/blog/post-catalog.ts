/*
 * BLOG-15 — IBlogPostCatalog over the build-time blog registry.
 *
 * SERVER-ONLY: imports the filesystem-backed registry (via `postLocales`). Publication is
 * checked with `draft`, the same rule as `registryContentCatalog` (src/lib/content/catalog.ts).
 */
import type { AnnouncedPost, IBlogPostCatalog } from "@/domain/repositories/IBlogPostCatalog";
import { getPost } from "./registry";
import { postLocales } from "./locales";

export const registryBlogPostCatalog: IBlogPostCatalog = {
  get(slug: string, locale: "es" | "en"): AnnouncedPost | null {
    const post = getPost(slug, locale);
    if (!post || post.draft) return null;
    return { slug: post.slug, title: post.title, summary: post.summary, areas: post.areas };
  },

  locales(slug: string): ("es" | "en")[] {
    return postLocales(slug).filter((l): l is "es" | "en" => l === "es" || l === "en");
  },
};

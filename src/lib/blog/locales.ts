/*
 * BLOG-01 — which locales a blog route actually exists in.
 *
 * These feed `availableLocaleAlternates` (src/lib/hreflang.ts) and the sitemap, so a
 * URL that 404s is never advertised — the COURSE-P6-01 rule, applied to the blog.
 *
 * They live HERE rather than in `registry.ts` for the reason `catalog-view.ts` gives
 * for the course equivalents: this module imports `@/i18n/routing`, and `registry.ts`
 * is loaded by `scripts/lint-content.ts` under `tsx`, outside the Next runtime.
 */

import { routing } from "@/i18n/routing";
import { listPosts } from "./registry";

/** Locales whose blog index has at least one published post. */
export function blogLocales(): string[] {
  return routing.locales.filter((locale) => listPosts(locale).length > 0);
}

/** Locales a given post is published in. Empty when the slug is unknown everywhere. */
export function postLocales(slug: string): string[] {
  return routing.locales.filter((locale) =>
    listPosts(locale).some((p) => p.slug === slug),
  );
}

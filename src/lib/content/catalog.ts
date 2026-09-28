/*
 * CONTENT-FEEDBACK-01 — IContentCatalog over the two build-time registries.
 *
 * SERVER-ONLY: this imports the filesystem-backed course and blog registries. The
 * widget must never reach it (the blog route's first-load JS is scanned by the
 * bundle guard) — it only needs ./content-key.ts, which is import-free.
 *
 * Publication is checked with the published-only selectors (`listLessons`,
 * `getPost` + `draft`), not `getLesson`, which returns drafts — same rule as
 * src/lib/courses/catalog.ts.
 */
import type { IContentCatalog, ResolvedContent } from "@/domain/repositories/IContentCatalog";
import type { ContentLocale, ContentRef } from "@/domain/types";
import { localeUrl } from "@/lib/hreflang";
import { getPost } from "@/lib/blog/registry";
import { getCourse, listLessons } from "@/lib/courses/registry";
import { contentRoute, parseContentKey } from "./content-key";

export const registryContentCatalog: IContentCatalog = {
  resolve(ref: ContentRef, locale: ContentLocale): ResolvedContent | null {
    const parsed = parseContentKey(ref.contentType, ref.contentKey);
    const route  = contentRoute(ref.contentType, ref.contentKey);
    if (!parsed || !route) return null;

    if (parsed.type === "lesson") {
      if (!getCourse(parsed.courseSlug, locale)) return null;
      const lesson = listLessons(parsed.courseSlug, locale).find((l) => l.slug === parsed.lessonSlug);
      return lesson ? { title: lesson.title, pageUrl: localeUrl(route, locale) } : null;
    }

    const post = getPost(parsed.slug, locale);
    if (!post || post.draft) return null;
    return { title: post.title, pageUrl: localeUrl(route, locale) };
  },
};

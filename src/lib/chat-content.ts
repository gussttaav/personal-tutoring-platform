/*
 * CHAT-CONTENT-01 — what the chat assistant is told about the courses and the blog.
 *
 * SERVER-ONLY: reads the filesystem-backed course and blog registries, which the chat route's
 * lambda already traces (through `@/services`). The facts come from the same selectors the
 * catalog and the blog index render from, so the assistant can never list a lesson or a post
 * the site does not show:
 *   - courses: `listCatalogEntries` (published only; a manifest with no published lesson is the
 *     «soon» landing, left out of the catalog and so out of here too), the build status
 *     (COURSE-BUILD-01) for "is it finished?", `getEnglishTranslationCoverage` for "is it in
 *     English?" — never `contentLocale`, which only describes the first lesson;
 *   - posts: `listPosts` (drafts excluded, newest first) and `postLocales` for the English link.
 *
 * Everything is the Spanish (canonical) metadata: the prompt is written in Spanish and the
 * assistant translates when it answers in English. URLs go through `localeUrl`, the one place
 * that knows the `/en` prefix rule.
 *
 * No cache of its own: both registries are memoised per lambda instance, and the mapping is a
 * few dozen objects.
 */

import type { ChatPromptContent, ChatPromptCourse, ChatPromptPost } from "@/constants/chat-prompt";
import type { Post } from "@/domain/types";
import { routing } from "@/i18n/routing";
import { localeUrl } from "@/lib/hreflang";
import { postLocales } from "@/lib/blog/locales";
import { listPosts } from "@/lib/blog/registry";
import {
  courseLocales,
  getEnglishTranslationCoverage,
  listCatalogEntries,
  type CatalogEntry,
} from "@/lib/courses/catalog-view";

const CANONICAL_LOCALE = routing.defaultLocale;

function toCourse(entry: CatalogEntry): ChatPromptCourse {
  const { course, build } = entry;
  const route = `/cursos/${course.slug}`;
  const english = getEnglishTranslationCoverage(course.slug);

  return {
    title:         course.title,
    tagline:       course.tagline,
    level:         course.level,
    url:           localeUrl(route, CANONICAL_LOCALE),
    urlEn:         courseLocales(course.slug).includes("en") ? localeUrl(route, "en") : null,
    prerequisites: {
      intro: course.prerequisites.intro,
      items: course.prerequisites.items.map((item) =>
        item.detail ? `${item.title}: ${item.detail}` : item.title,
      ),
    },
    // The `dynamic` entry (english-translation-status) has no static answer; `english` covers it.
    faq: course.faq.flatMap((item) => (item.a ? [{ q: item.q, a: item.a }] : [])),
    complete:         build.complete,
    publishedLessons: build.publishedLessons,
    plannedLessons:   build.plannedLessons,
    english:          { translated: english.translated, total: english.total },
    blocks: build.blocks.map((b) => ({
      id:      b.block.id,
      title:   b.block.title,
      summary: b.block.summary,
      planned: b.planned,
      lessons: b.lessons.map((l) => ({ slug: l.slug, title: l.title })),
    })),
  };
}

function toPost(post: Post): ChatPromptPost {
  const route = `/blog/${post.slug}`;
  return {
    title:   post.title,
    date:    post.date,
    summary: post.summary,
    areas:   post.areas,
    tags:    post.tags,
    url:     localeUrl(route, CANONICAL_LOCALE),
    urlEn:   postLocales(post.slug).includes("en") ? localeUrl(route, "en") : null,
  };
}

export function getChatPromptContent(): ChatPromptContent {
  return {
    // `localeUrl` of the home in the default locale is the bare origin (no trailing slash).
    siteUrl: localeUrl("/", CANONICAL_LOCALE),
    courses: listCatalogEntries(CANONICAL_LOCALE).map(toCourse),
    posts:   listPosts(CANONICAL_LOCALE).map(toPost),
  };
}

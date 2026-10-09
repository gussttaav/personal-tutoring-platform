/*
 * BLOG-13 — the blog's taxonomy and paging constants.
 *
 * Two levels, both closed lists validated by `PostFrontmatterSchema`:
 *   - AREAS: the broad subject, mirroring the tutor's specialisations. A post names one
 *     or two (`areas:` in its frontmatter); the index filters by them first.
 *   - TOPICS: the post's `tags`, the finer filter under an area.
 *
 * Adding an area or a topic = its id in the union in `src/domain/types.ts`, here, and a
 * label under `blog.areas.*` / `blog.topics.*` in BOTH `messages/*.json`. An area also
 * needs an icon (below, and in `src/constants/icons.ts`) and a colour (`[data-area]` in
 * `src/features/blog/blog-taxonomy.css`). An area no published post names is hidden.
 */

import type { BlogArea, BlogTopic } from "@/domain/types";
import type { IconName } from "@/constants/icons";

/** Display order of the area filter. */
export const BLOG_AREAS = [
  "ia",
  "bases-de-datos",
  "matematicas",
  "programacion",
] as const satisfies readonly BlogArea[];

export const BLOG_TOPICS = [
  "agentes",
  "deep-learning",
  "embeddings",
  "estructuras-de-datos",
  "grafos",
  "indices",
  "llm",
  "nlp",
  "optimizacion",
  "rag",
  "rendimiento",
  "sql",
  "tokenizacion",
] as const satisfies readonly BlogTopic[];

// Compile-time completeness: a union member missing from its list fails the build.
type Missing<U, L extends readonly unknown[]> = Exclude<U, L[number]>;
const _allAreasListed: Missing<BlogArea, typeof BLOG_AREAS> extends never ? true : never = true;
const _allTopicsListed: Missing<BlogTopic, typeof BLOG_TOPICS> extends never ? true : never = true;
void _allAreasListed;
void _allTopicsListed;

/** Material Symbols glyph per area. Every name must be in `ICON_NAMES`. */
export const BLOG_AREA_ICONS: Record<BlogArea, IconName> = {
  "ia":             "auto_awesome",
  "bases-de-datos": "database",
  "matematicas":    "functions",
  "programacion":   "code",
};

/** Index grid: cards per page, not counting the featured newest post on page 1. */
export const BLOG_INDEX_PAGE_SIZE = 6;

/** Archive pane (post reader): entries per page. */
export const BLOG_ARCHIVE_PAGE_SIZE = 6;

/** Topic chips shown on the index before the "+N temas" toggle. */
export const BLOG_INDEX_TOPIC_LIMIT = 6;

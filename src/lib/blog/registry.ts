/*
 * BLOG-01 — Typed blog registry.
 *
 * A BUILD-TIME scan of `content/blog/` that validates every post's frontmatter
 * (`<locale>/<slug>.mdx`) with `PostFrontmatterSchema` and exposes a strongly-typed
 * list to the index, the post route and the sitemap.
 *
 * The load-bearing rule is the courses one (src/lib/courses/registry.ts): PROSE IS
 * NEVER QUERIED; METADATA ALWAYS IS. This module reads only the frontmatter block off
 * the top of each MDX file (via gray-matter) — never the prose body. `post-source.ts`
 * is the one place that reads a body, and only the reader route calls it.
 *
 * Read at build time ONLY: no DB call, ever. There is no `posts` table.
 *
 * Two differences from the course registry, both deliberate:
 *   - No manifest. A blog has no course-level prose to carry, so the index page's
 *     own copy lives in `messages/*.json` like every other chrome string.
 *   - No `NN-` filename prefix. Ordering comes from the frontmatter `date`, so a
 *     numeric prefix would be a second, contradictable source of truth. The
 *     invariant is simply: filename stem === slug.
 *
 * Failures throw a plain Error naming the offending file, so a typo'd frontmatter key
 * fails `pnpm lint:content` (and `pnpm build`, since the routes consume this) instead
 * of shipping broken.
 *
 * A locale with no posts is NORMAL, not exceptional: every path treats a missing
 * locale dir as "empty" and returns `[]`.
 *
 * BLOG-13: a post's `cover` must be one of its OWN figures (`/blog/<slug>/…`), checked
 * here; that the file is really under `public/` is checked by `validateAllBlogContent`
 * (CI), which knows where `public/` is — a fixture tree in a test has none.
 */

import fs from "node:fs";
import path from "node:path";

import matter from "gray-matter";

import { PostFrontmatterSchema } from "@/lib/schemas";
import type { Post, PostRef } from "@/domain/types";

const DEFAULT_CONTENT_ROOT = path.join(process.cwd(), "content", "blog");
const DEFAULT_PUBLIC_ROOT = path.join(process.cwd(), "public");

/** slug → post, for a single locale. Drafts included; the `list*` selectors filter. */
type LocaleRegistry = Map<string, Post>;

// ─── Publication predicate — ONE place ────────────────────────────────────────
// A post is published when it is not a draft. Nothing downstream re-implements this.
const isPublished = (post: Post): boolean => post.draft === false;

/** Newest first. The blog's only ordering, shared by the index and the sitemap.
 *  `date` is `YYYY-MM-DD`, so a lexicographic compare IS a chronological one; the
 *  slug tiebreak keeps two posts dated the same day in a stable order. */
const byDateDesc = (a: Post, b: Post): number =>
  b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug);

// ─── Filesystem scan → validate → build ───────────────────────────────────────

/**
 * Build the registry for one locale by scanning `contentRoot`. Uncached and pure in
 * its inputs — the public API wraps it with memoization against the real root, and
 * tests call it directly against a temp fixture tree. Throws (naming the file) on any
 * validation failure. A missing `contentRoot` or locale dir yields an empty registry.
 */
export function buildRegistry(contentRoot: string, locale: string): LocaleRegistry {
  const registry: LocaleRegistry = new Map();

  const localeDir = path.join(contentRoot, locale);
  // Missing locale dir is normal (English before the first translation) — no throw.
  if (!fs.existsSync(localeDir)) return registry;

  // `_`-prefixed files are not posts — the same opt-out the course content honours
  // (see src/lib/courses/content-files.ts), so `_template.mdx` and a `_wip.mdx`
  // scratch draft do not have to satisfy the frontmatter schema to keep CI green.
  const files = fs
    .readdirSync(localeDir)
    .filter((f) => f.endsWith(".mdx") && !f.startsWith("_"))
    .sort();

  for (const file of files) {
    const filePath = path.join(localeDir, file);
    const { data } = matter(fs.readFileSync(filePath, "utf8"));

    const parsed = PostFrontmatterSchema.safeParse(data);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue.path.join(".") || "(root)";
      throw new Error(`${filePath}: invalid frontmatter — ${field}: ${issue.message}`);
    }
    const post = parsed.data;

    // Orphan check: the filename stem must equal the slug. Catches a renamed file
    // whose frontmatter slug was never updated — which would 404 the post silently.
    const stem = file.replace(/\.mdx$/, "");
    if (stem !== post.slug) {
      throw new Error(
        `${filePath}: frontmatter slug "${post.slug}" does not match filename stem "${stem}"`,
      );
    }

    // BLOG-13: a cover borrowed from another post would show the wrong article's figure.
    if (post.cover && !post.cover.startsWith(`/blog/${post.slug}/`)) {
      throw new Error(
        `${filePath}: cover "${post.cover}" is not one of this post's figures (/blog/${post.slug}/…)`,
      );
    }

    if (registry.has(post.slug)) {
      throw new Error(`${filePath}: duplicate post slug "${post.slug}" within the locale`);
    }
    registry.set(post.slug, post);
  }

  return registry;
}

/**
 * Validate every locale present under `contentRoot`, throwing on the first failure.
 * Used by `scripts/lint-content.ts` (and CI) as the standalone enforcement point.
 * No-op when there is no content. BLOG-13: also that every `cover` exists under
 * `publicRoot`, since a missing one renders as a broken image on the index.
 */
export function validateAllBlogContent(
  contentRoot: string = DEFAULT_CONTENT_ROOT,
  publicRoot: string = DEFAULT_PUBLIC_ROOT,
): void {
  if (!fs.existsSync(contentRoot)) return;

  for (const dir of fs.readdirSync(contentRoot, { withFileTypes: true })) {
    if (!dir.isDirectory() || dir.name.startsWith("_")) continue;
    const registry = buildRegistry(contentRoot, dir.name); // throws on error
    for (const post of registry.values()) {
      if (post.cover && !fs.existsSync(path.join(publicRoot, post.cover))) {
        throw new Error(
          `${path.join(contentRoot, dir.name, `${post.slug}.mdx`)}: cover "${post.cover}" does not exist under public/`,
        );
      }
    }
  }
}

// ─── Memoized public API ──────────────────────────────────────────────────────
// The registry is read once per locale per build. `contentRoot` is overridable so
// tests can point the whole public API at a temp fixture tree; production always
// uses the default real root.

let contentRoot = DEFAULT_CONTENT_ROOT;
const cache = new Map<string, LocaleRegistry>();

function getLocaleRegistry(locale: string): LocaleRegistry {
  let reg = cache.get(locale);
  if (!reg) {
    reg = buildRegistry(contentRoot, locale);
    cache.set(locale, reg);
  }
  return reg;
}

/** Test-only: point the registry at a fixture tree and clear the memo. */
export function __setBlogContentRoot(root: string): void {
  contentRoot = root;
  cache.clear();
}

/** Test-only: restore the real content root and clear the memo. */
export function __resetBlogRegistry(): void {
  contentRoot = DEFAULT_CONTENT_ROOT;
  cache.clear();
}

/** One post's metadata, draft or not. `null` when the slug/locale has no file. */
export function getPost(slug: string, locale: string): Post | null {
  return getLocaleRegistry(locale).get(slug) ?? null;
}

/** Published posts only, newest first. Missing locale → `[]`. */
export function listPosts(locale: string): Post[] {
  return [...getLocaleRegistry(locale).values()].filter(isPublished).sort(byDateDesc);
}

/** Newer/older published post, for the foot of a reading page. `null` at either end
 *  and for an unknown/draft slug, because it walks the published list. `newer` is the
 *  post above this one in the index; `older` the one below. */
export function postNeighbours(
  slug: string,
  locale: string,
): { newer: PostRef | null; older: PostRef | null } {
  const published = listPosts(locale);
  const idx = published.findIndex((p) => p.slug === slug);
  if (idx === -1) return { newer: null, older: null };

  const toRef = (p: Post): PostRef => ({ slug: p.slug, title: p.title });
  return {
    newer: idx > 0 ? toRef(published[idx - 1]) : null,
    older: idx < published.length - 1 ? toRef(published[idx + 1]) : null,
  };
}

/*
 * COURSE-P7-01 — Content lint for `<Leccion slug="…" ancla="…">` cross-references.
 *
 * A cross-reference is the one id-like thing in a lesson that nothing checked. The five
 * passes before this one validate widget ids, `hasCode`, quiz ids and challenge ids;
 * meanwhile the ~403 references between lessons were prose ("la lección 5 de este
 * bloque"), so a reordered or renamed lesson broke them silently and forever.
 *
 * Two failures, both fatal, both the kind that would otherwise ship:
 *   - a slug that resolves to no lesson — a typo, or a lesson that no longer exists;
 *   - an `ancla` that resolves to no heading — the target was retitled and the link
 *     now lands at the top of the page instead of at the paragraph it promised.
 *
 * Anchor checking is EXACT rather than approximate because `extractHeadings` shares
 * `github-slugger` with `rehype-slug` by design (see ./headings.ts): the ids computed
 * here are the ids in the rendered HTML.
 *
 * A reference to a `draft: true` lesson is NOT an error — the component renders it as
 * plain text on purpose. It is an advisory warning instead (phase 2 of the lint),
 * because the author probably meant it to be a link one day.
 *
 * COURSE-P11-01 — locales stopped being all-or-nothing. `en/` gets written one lesson at
 * a time, so every reference in the first English lesson points at a target that exists
 * only in `es/`. Scope is still one `<course>/<locale>` directory at a time, but a slug
 * now resolves against THAT tree and then the canonical one — the same two-step
 * `listLessonViews` (./catalog-view.ts) already applies, and that function is the
 * authority on what the reader is actually served.
 *
 * The ANCHOR follows the target into whichever tree it resolved in, because an `ancla` is
 * a `github-slugger` id derived from HEADING TEXT and the two languages produce different
 * ids for the same section. One consequence is worth stating out loud: translating lesson
 * X invalidates every anchored reference to X from an already-translated lesson, because
 * X now renders English heading ids where it rendered Spanish ones. The lint turns that
 * into a fatal unresolved anchor the next time it runs — which is the point, and which
 * means a translation PR can fail on a file it never touched.
 *
 * Node-clean like its siblings: no registry import (that would pull in the locale
 * cache), no `next/*`. The pure helpers are unit-tested without touching the disk.
 */

import fs from "node:fs";
import path from "node:path";

import matter from "gray-matter";

import { DEFAULT_CONTENT_ROOT, collectMdxFiles } from "./content-files";
import { extractHeadings } from "./headings";

// Matches a <Leccion …> opening tag and captures its full attribute text. `</Leccion>`
// cannot match: `\b` follows `<Leccion`, and the closing tag has a `/` before the name.
const LECCION_TAG = /<Leccion\b([^>]*?)\/?>/g;
const SLUG_ATTR = /\bslug\s*=\s*["']([^"']*)["']/;
const ANCLA_ATTR = /\bancla\s*=\s*["']([^"']*)["']/;
const FENCE = /^\s*(`{3,}|~{3,})/;

/** The canonical locale's directory name — `routing.defaultLocale`, hardcoded on purpose.
 *  This module is Node-clean (see the file-top comment) and importing `@/i18n/routing`
 *  would drag next-intl into `scripts/lint-content.ts` for one string. Every public entry
 *  point takes it as an overridable parameter. */
const CANONICAL_LOCALE = "es";

export interface LeccionRef {
  /** The slug as written, or `null` when the tag has no `slug` attribute. */
  slug: string | null;
  /** The heading id as written, or `null` when the reference carries no anchor. */
  ancla: string | null;
}

/** What one lesson offers as a reference target. */
export interface CrosslinkTarget {
  draft: boolean;
  headingIds: Set<string>;
}

/** Every lesson in one `<course>/<locale>` tree, by slug. */
export type CrosslinkIndex = Map<string, CrosslinkTarget>;

/** The fence-tracking idiom of headings.ts / budget.ts / validate-structure.ts. */
function withoutFences(body: string): string {
  const lines: string[] = [];
  let fence: string | null = null;
  for (const line of body.split("\n")) {
    const fenceMatch = line.match(FENCE);
    if (fenceMatch) {
      const marker = fenceMatch[1][0].repeat(3);
      if (fence === null) fence = marker;
      else if (marker === fence) fence = null;
      continue;
    }
    if (fence === null) lines.push(line);
  }
  return lines.join("\n");
}

/**
 * Extract every `<Leccion>` reference (in source order) from an MDX file.
 *
 * The WHOLE file, frontmatter included: 72 of the course's references live in quiz and
 * challenge copy, which is frontmatter. Fenced blocks are dropped, so a `<Leccion>` in
 * a ```mdx sample is documentation, not a reference — the same call `budget.ts` makes
 * about a quoted `<PyCell>`.
 */
export function findLecciones(source: string): LeccionRef[] {
  const refs: LeccionRef[] = [];
  for (const match of withoutFences(source).matchAll(LECCION_TAG)) {
    const attrs = match[1] ?? "";
    const slug = attrs.match(SLUG_ATTR);
    const ancla = attrs.match(ANCLA_ATTR);
    refs.push({ slug: slug ? slug[1] : null, ancla: ancla ? ancla[1] : null });
  }
  return refs;
}

/**
 * COURSE-P11-01 — the version of a target the reader will actually be served: the
 * referring lesson's own locale tree when the target is published there, the canonical
 * tree otherwise. `null` when the slug is in neither. A separate function rather than a
 * cleverer index, because `buildCrosslinkIndex` means one directory and should keep
 * meaning exactly that.
 *
 * Drafts are the one case the two trees can disagree about, so it is decided here: a
 * lesson that is `draft: true` in `en/` but published in `es/` renders from the Spanish
 * tree, so the Spanish version is what an anchor has to match. A draft in both resolves
 * to the draft — the reference is plain text either way, and the phase-2 pass says so.
 */
export function resolveCrosslinkTarget(
  slug: string,
  index: CrosslinkIndex,
  canonical?: CrosslinkIndex,
): CrosslinkTarget | null {
  const own = index.get(slug);
  // `canonical === index` is the canonical tree validating itself: one lookup, not two.
  const fallback = canonical === index ? undefined : canonical?.get(slug);

  if (own && !own.draft) return own;
  if (fallback && !fallback.draft) return fallback;
  return own ?? fallback ?? null;
}

/**
 * Return a human-readable problem string for each unresolvable reference. Empty array =
 * every reference resolves. Pure — no filesystem — so it is trivially unit-testable.
 *
 * `canonical` is the fallback tree (COURSE-P11-01); omit it for a tree that IS the
 * canonical one, or for a course that exists in one locale only.
 */
export function crosslinkProblems(
  refs: LeccionRef[],
  index: CrosslinkIndex,
  canonical?: CrosslinkIndex,
): string[] {
  const problems: string[] = [];
  for (const ref of refs) {
    if (ref.slug === null) {
      problems.push("<Leccion> is missing a slug attribute");
      continue;
    }
    const target = resolveCrosslinkTarget(ref.slug, index, canonical);
    if (!target) {
      problems.push(`unknown lesson slug "${ref.slug}"`);
      continue;
    }
    if (ref.ancla && !target.headingIds.has(ref.ancla)) {
      problems.push(`no heading "#${ref.ancla}" in lesson "${ref.slug}"`);
    }
  }
  return problems;
}

/**
 * Advisory: a reference whose target is a draft renders as plain text, which is the
 * designed behaviour but rarely what the author had in mind. A target that is a draft
 * here but published in the canonical tree is NOT one of those — it links.
 */
export function crosslinkWarnings(
  refs: LeccionRef[],
  index: CrosslinkIndex,
  canonical?: CrosslinkIndex,
): string[] {
  const warnings: string[] = [];
  for (const ref of refs) {
    if (ref.slug && resolveCrosslinkTarget(ref.slug, index, canonical)?.draft) {
      warnings.push(
        `crosslinks — "${ref.slug}" is a draft lesson; the reference renders as plain text`,
      );
    }
  }
  return warnings;
}

/** Index one `<course>/<locale>` directory by lesson slug. */
export function buildCrosslinkIndex(filePaths: string[]): CrosslinkIndex {
  const index: CrosslinkIndex = new Map();
  for (const filePath of filePaths) {
    const { data, content } = matter(fs.readFileSync(filePath, "utf8"));
    if (typeof data.slug !== "string") continue; // the registry pass already failed it
    index.set(data.slug, {
      draft: data.draft === true,
      headingIds: new Set(extractHeadings(content).map((h) => h.id)),
    });
  }
  return index;
}

/** Group every lesson under `contentRoot` by its directory — one locale tree each. */
function byDirectory(contentRoot: string): Map<string, string[]> {
  const dirs = new Map<string, string[]>();
  for (const filePath of collectMdxFiles(contentRoot)) {
    const dir = path.dirname(filePath);
    const siblings = dirs.get(dir);
    if (siblings) siblings.push(filePath);
    else dirs.set(dir, [filePath]);
  }
  return dirs;
}

/** Every lesson directory under `contentRoot`, with its files and its built index. */
function indexedDirectories(
  contentRoot: string,
): Map<string, { filePaths: string[]; index: CrosslinkIndex }> {
  const out = new Map<string, { filePaths: string[]; index: CrosslinkIndex }>();
  for (const [dir, filePaths] of byDirectory(contentRoot)) {
    out.set(dir, { filePaths, index: buildCrosslinkIndex(filePaths) });
  }
  return out;
}

/**
 * COURSE-P11-01 — the canonical sibling of `<course>/<locale>` is `<course>/<canonical>`,
 * derived from the path rather than looked up, which keeps this module off the registry.
 * `undefined` for the canonical tree itself and for a course that has no canonical tree.
 */
function canonicalIndexFor(
  dir: string,
  dirs: Map<string, { index: CrosslinkIndex }>,
  canonicalLocale: string,
): CrosslinkIndex | undefined {
  if (path.basename(dir) === canonicalLocale) return undefined;
  return dirs.get(path.join(path.dirname(dir), canonicalLocale))?.index;
}

/**
 * Validate every `<Leccion>` in every lesson under `contentRoot`, throwing on the first
 * offending file (message: `${filePath}: <problem>`). No content → no-op.
 *
 * A slug resolves if the target exists in the lesson's own locale tree OR in
 * `canonicalLocale`'s — which is what a partially translated `en/` needs to pass.
 */
export function validateCrosslinks(
  contentRoot: string = DEFAULT_CONTENT_ROOT,
  canonicalLocale: string = CANONICAL_LOCALE,
): void {
  const dirs = indexedDirectories(contentRoot);
  for (const [dir, { filePaths, index }] of dirs) {
    const canonical = canonicalIndexFor(dir, dirs, canonicalLocale);
    for (const filePath of filePaths) {
      const source = fs.readFileSync(filePath, "utf8");
      const problems = crosslinkProblems(findLecciones(source), index, canonical);
      if (problems.length > 0) {
        throw new Error(`${filePath}: ${problems[0]}`);
      }
    }
  }
}

/**
 * Draft-target warnings for the whole content root, keyed by file path, for phase 2 of
 * `scripts/lint-content.ts` (which walks one file at a time and cannot see the index).
 *
 * A lesson that is ITSELF a draft is skipped: it has no readers, so "this renders as
 * plain text" costs nobody anything — and the permanent pipeline fixture, which is a
 * draft referencing itself on purpose, would otherwise warn on every run forever.
 */
export function collectCrosslinkWarnings(
  contentRoot: string = DEFAULT_CONTENT_ROOT,
  canonicalLocale: string = CANONICAL_LOCALE,
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const dirs = indexedDirectories(contentRoot);
  for (const [dir, { filePaths, index }] of dirs) {
    const canonical = canonicalIndexFor(dir, dirs, canonicalLocale);
    for (const filePath of filePaths) {
      const source = fs.readFileSync(filePath, "utf8");
      if (matter(source).data.draft === true) continue;
      const warnings = crosslinkWarnings(findLecciones(source), index, canonical);
      if (warnings.length > 0) out.set(filePath, warnings);
    }
  }
  return out;
}

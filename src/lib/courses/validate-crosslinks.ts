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
 * Scope is one `<course>/<locale>` directory at a time, which is also the whole story
 * on locales: a reference and its target always live in the same content tree, so a
 * heading id never has to cross languages.
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
 * Return a human-readable problem string for each unresolvable reference. Empty array =
 * every reference resolves. Pure — no filesystem — so it is trivially unit-testable.
 */
export function crosslinkProblems(refs: LeccionRef[], index: CrosslinkIndex): string[] {
  const problems: string[] = [];
  for (const ref of refs) {
    if (ref.slug === null) {
      problems.push("<Leccion> is missing a slug attribute");
      continue;
    }
    const target = index.get(ref.slug);
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
 * designed behaviour but rarely what the author had in mind.
 */
export function crosslinkWarnings(refs: LeccionRef[], index: CrosslinkIndex): string[] {
  const warnings: string[] = [];
  for (const ref of refs) {
    if (ref.slug && index.get(ref.slug)?.draft) {
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

/**
 * Validate every `<Leccion>` in every lesson under `contentRoot`, throwing on the first
 * offending file (message: `${filePath}: <problem>`). No content → no-op.
 */
export function validateCrosslinks(contentRoot: string = DEFAULT_CONTENT_ROOT): void {
  for (const filePaths of byDirectory(contentRoot).values()) {
    const index = buildCrosslinkIndex(filePaths);
    for (const filePath of filePaths) {
      const source = fs.readFileSync(filePath, "utf8");
      const problems = crosslinkProblems(findLecciones(source), index);
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
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const filePaths of byDirectory(contentRoot).values()) {
    const index = buildCrosslinkIndex(filePaths);
    for (const filePath of filePaths) {
      const source = fs.readFileSync(filePath, "utf8");
      if (matter(source).data.draft === true) continue;
      const warnings = crosslinkWarnings(findLecciones(source), index);
      if (warnings.length > 0) out.set(filePath, warnings);
    }
  }
  return out;
}

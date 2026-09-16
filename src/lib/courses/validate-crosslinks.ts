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
 * COURSE-C2-P0-02 — `<Leccion curso="…" slug="…">` resolves in ANOTHER course. The
 * checking pass keeps its per-directory scope — one `<course>/<locale>` at a time — but
 * the lookup widens: every directory under the content root is indexed once and re-keyed
 * `course → locale → index`, so a `curso=` reference resolves against that course's
 * `<locale>` tree and then its canonical one, the same two-step as within a course, and
 * its `ancla` follows the target into whichever tree answered. Two new fatal cases, one
 * advisory: a `curso` naming no course, a slug that does not resolve in the named course,
 * and — advisory — a `curso` naming the course the reference is written in, which the
 * component treats as no `curso` at all («drop the attribute»).
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
const CURSO_ATTR = /\bcurso\s*=\s*["']([^"']*)["']/;
const SLUG_ATTR = /\bslug\s*=\s*["']([^"']*)["']/;
const ANCLA_ATTR = /\bancla\s*=\s*["']([^"']*)["']/;
const FENCE = /^\s*(`{3,}|~{3,})/;

/** The canonical locale's directory name — `routing.defaultLocale`, hardcoded on purpose.
 *  This module is Node-clean (see the file-top comment) and importing `@/i18n/routing`
 *  would drag next-intl into `scripts/lint-content.ts` for one string. Every public entry
 *  point takes it as an overridable parameter. */
const CANONICAL_LOCALE = "es";

export interface LeccionRef {
  /** COURSE-C2-P0-02 — the course named by `curso`, or `null` for a reference within the course. */
  curso: string | null;
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

/** COURSE-C2-P0-02 — every course's indexes by locale: `course → locale → index`. */
export type CourseIndexes = Map<string, Map<string, CrosslinkIndex>>;

/**
 * COURSE-C2-P0-02 — where a reference is WRITTEN, which is what a `curso=` needs to be
 * resolved (in the named course's trees) or refused (a `curso` naming this very course).
 * Optional on every pure entry point: without it a `curso=` reference has nothing to
 * resolve against and is reported as an unknown course.
 */
export interface CrosslinkScope {
  /** The referring lesson's course. A `curso` naming it is a warning, not a lookup. */
  course: string;
  /** The referring lesson's locale directory — the first tree a `curso=` target is tried in. */
  locale: string;
  /** The canonical locale's directory name — the second. */
  canonicalLocale: string;
  /** Every course's index by locale. */
  courses: CourseIndexes;
}

const EMPTY_INDEX: CrosslinkIndex = new Map();

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
    const curso = attrs.match(CURSO_ATTR);
    const slug = attrs.match(SLUG_ATTR);
    const ancla = attrs.match(ANCLA_ATTR);
    refs.push({
      curso: curso ? curso[1] : null,
      slug: slug ? slug[1] : null,
      ancla: ancla ? ancla[1] : null,
    });
  }
  return refs;
}

/** `"slug"`, or `"slug" in course "curso"` when the reference names one — for messages. */
function refName(ref: LeccionRef): string {
  return ref.curso === null ? `"${ref.slug}"` : `"${ref.slug}" in course "${ref.curso}"`;
}

/**
 * COURSE-C2-P0-02 — the `(own, canonical)` pair ONE reference resolves against. The
 * referring lesson's own pair unless `curso` names another course; then that course's
 * `<locale>` and canonical trees, so `resolveCrosslinkTarget` runs the same two-step in
 * the other course. `null` when `curso` names a course that does not exist — or when
 * there is no scope to look it up in.
 *
 * A course present in the canonical locale only (every course before its first
 * translation) has no `<locale>` tree from an `en/` lesson: an empty own index, and the
 * canonical one answers — exactly what an untranslated target within a course gets.
 */
function treesFor(
  ref: LeccionRef,
  index: CrosslinkIndex,
  canonical: CrosslinkIndex | undefined,
  scope: CrosslinkScope | undefined,
): { index: CrosslinkIndex; canonical?: CrosslinkIndex } | null {
  if (ref.curso === null || ref.curso === scope?.course) return { index, canonical };
  const byLocale = scope?.courses.get(ref.curso);
  if (!scope || !byLocale) return null;
  return {
    index: byLocale.get(scope.locale) ?? EMPTY_INDEX,
    canonical:
      scope.locale === scope.canonicalLocale ? undefined : byLocale.get(scope.canonicalLocale),
  };
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
 * canonical one, or for a course that exists in one locale only. `scope` is what a
 * `curso=` reference resolves through (COURSE-C2-P0-02); without it every `curso` is an
 * unknown course.
 */
export function crosslinkProblems(
  refs: LeccionRef[],
  index: CrosslinkIndex,
  canonical?: CrosslinkIndex,
  scope?: CrosslinkScope,
): string[] {
  const problems: string[] = [];
  for (const ref of refs) {
    if (ref.slug === null) {
      problems.push("<Leccion> is missing a slug attribute");
      continue;
    }
    const trees = treesFor(ref, index, canonical, scope);
    if (!trees) {
      problems.push(`unknown course "${ref.curso}" in <Leccion curso="${ref.curso}" slug="${ref.slug}">`);
      continue;
    }
    const target = resolveCrosslinkTarget(ref.slug, trees.index, trees.canonical);
    if (!target) {
      problems.push(`unknown lesson slug ${refName(ref)}`);
      continue;
    }
    if (ref.ancla && !target.headingIds.has(ref.ancla)) {
      problems.push(`no heading "#${ref.ancla}" in lesson ${refName(ref)}`);
    }
  }
  return problems;
}

/**
 * Advisory: a reference whose target is a draft renders as plain text, which is the
 * designed behaviour but rarely what the author had in mind. A target that is a draft
 * here but published in the canonical tree is NOT one of those — it links.
 *
 * COURSE-C2-P0-02 — and a `curso` naming the course the reference is written in: the
 * component treats it as no `curso`, so the attribute is noise the next author reads as
 * a cross-course reference.
 */
export function crosslinkWarnings(
  refs: LeccionRef[],
  index: CrosslinkIndex,
  canonical?: CrosslinkIndex,
  scope?: CrosslinkScope,
): string[] {
  const warnings: string[] = [];
  for (const ref of refs) {
    if (ref.curso !== null && ref.curso === scope?.course) {
      warnings.push(
        `crosslinks — curso="${ref.curso}" names this very course; drop the attribute`,
      );
    }
    if (ref.slug === null) continue;
    const trees = treesFor(ref, index, canonical, scope);
    if (trees && resolveCrosslinkTarget(ref.slug, trees.index, trees.canonical)?.draft) {
      warnings.push(
        `crosslinks — ${refName(ref)} is a draft lesson; the reference renders as plain text`,
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

/** One lesson directory: its files, its built index, and its place under the content root. */
interface IndexedDirectory {
  filePaths: string[];
  index: CrosslinkIndex;
  /**
   * COURSE-C2-P0-02 — `(course, locale)` when the directory is `<contentRoot>/<course>/<locale>`,
   * the shape `readLessons` (registry.ts) reads lessons from; `null` for anything deeper,
   * which keeps its per-directory check but is neither a `curso=` target nor a scope.
   */
  place: { course: string; locale: string } | null;
}

/** Every lesson directory under `contentRoot`, with its files and its built index. */
function indexedDirectories(contentRoot: string): Map<string, IndexedDirectory> {
  const out = new Map<string, IndexedDirectory>();
  for (const [dir, filePaths] of byDirectory(contentRoot)) {
    const segments = path.relative(contentRoot, dir).split(path.sep);
    const place = segments.length === 2 ? { course: segments[0], locale: segments[1] } : null;
    out.set(dir, { filePaths, index: buildCrosslinkIndex(filePaths), place });
  }
  return out;
}

/** COURSE-C2-P0-02 — the same directories re-keyed `course → locale`, for `curso=` lookups. */
function courseIndexes(dirs: Map<string, IndexedDirectory>): CourseIndexes {
  const out: CourseIndexes = new Map();
  for (const { place, index } of dirs.values()) {
    if (!place) continue;
    let byLocale = out.get(place.course);
    if (!byLocale) {
      byLocale = new Map();
      out.set(place.course, byLocale);
    }
    byLocale.set(place.locale, index);
  }
  return out;
}

/** COURSE-C2-P0-02 — the scope of one directory's references; `undefined` off the `<course>/<locale>` shape. */
function scopeFor(
  { place }: IndexedDirectory,
  courses: CourseIndexes,
  canonicalLocale: string,
): CrosslinkScope | undefined {
  return place ? { ...place, canonicalLocale, courses } : undefined;
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
 * `canonicalLocale`'s — which is what a partially translated `en/` needs to pass. A
 * `curso=` slug resolves the same way in the named course (COURSE-C2-P0-02).
 */
export function validateCrosslinks(
  contentRoot: string = DEFAULT_CONTENT_ROOT,
  canonicalLocale: string = CANONICAL_LOCALE,
): void {
  const dirs = indexedDirectories(contentRoot);
  const courses = courseIndexes(dirs);
  for (const [dir, entry] of dirs) {
    const canonical = canonicalIndexFor(dir, dirs, canonicalLocale);
    const scope = scopeFor(entry, courses, canonicalLocale);
    for (const filePath of entry.filePaths) {
      const source = fs.readFileSync(filePath, "utf8");
      const problems = crosslinkProblems(findLecciones(source), entry.index, canonical, scope);
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
  const courses = courseIndexes(dirs);
  for (const [dir, entry] of dirs) {
    const canonical = canonicalIndexFor(dir, dirs, canonicalLocale);
    const scope = scopeFor(entry, courses, canonicalLocale);
    for (const filePath of entry.filePaths) {
      const source = fs.readFileSync(filePath, "utf8");
      if (matter(source).data.draft === true) continue;
      const warnings = crosslinkWarnings(findLecciones(source), entry.index, canonical, scope);
      if (warnings.length > 0) out.set(filePath, warnings);
    }
  }
  return out;
}

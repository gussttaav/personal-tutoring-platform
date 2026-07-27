/*
 * COURSE-P1-02 — Typed content registry.
 *
 * A BUILD-TIME scan of `content/courses/` that validates every course manifest
 * (`course.<locale>.yml`) and lesson frontmatter (`<locale>/NN-<slug>.mdx`) with
 * the Zod schemas in `@/lib/schemas`, then exposes a strongly-typed structure to
 * the sidebar, syllabus, sitemap and a future mobile API.
 *
 * The load-bearing rule (see PLAN.md): PROSE IS NEVER QUERIED; METADATA ALWAYS IS.
 * This module reads only the YAML manifest and the frontmatter block off the top
 * of each MDX file (via gray-matter) — never the prose body. That separation is
 * what keeps a future mobile `GET /api/courses` additive rather than a rewrite.
 *
 * Read at build time ONLY: no DB call, ever. `course_slug`/`lesson_slug` are plain
 * text everywhere — there is no `courses` table.
 *
 * Failures throw a plain Error naming the offending file, so a bad manifest or a
 * typo'd frontmatter key fails the build (via `pnpm lint:content`, and once a route
 * consumes the registry in P1-03, `pnpm build`) instead of shipping broken.
 *
 * A locale with no content is NORMAL, not exceptional: English has no files for
 * months. Every path treats a missing manifest/dir as "empty", returning `[]`.
 */

import fs from "node:fs";
import path from "node:path";

import matter from "gray-matter";
import { load as loadYaml } from "js-yaml";

import {
  CourseManifestSchema,
  LessonFrontmatterSchema,
} from "@/lib/schemas";
import type { Course, Lesson, LessonRef } from "@/domain/types";

const DEFAULT_CONTENT_ROOT = path.join(process.cwd(), "content", "courses");

/** One course in one locale: manifest + all its lessons (drafts included, sorted
 *  by `(block, order)`). Draft filtering happens in the `list*` selectors, not here. */
interface CourseEntry {
  course:  Course;
  lessons: Lesson[];
}

/** courseSlug → entry, for a single locale. */
type LocaleRegistry = Map<string, CourseEntry>;

// ─── Publication predicate — ONE place ────────────────────────────────────────
// A lesson is published when it is not a draft. The global publication gate
// (P6-03) plugs in HERE later; nothing downstream re-implements this test.
const isPublished = (lesson: Lesson): boolean => lesson.draft === false;

// ─── Filesystem scan → validate → build ───────────────────────────────────────

function parseManifest(manifestPath: string): Course {
  const raw = fs.readFileSync(manifestPath, "utf8");

  let doc: unknown;
  try {
    doc = loadYaml(raw);
  } catch (err) {
    throw new Error(`${manifestPath}: invalid YAML — ${(err as Error).message}`);
  }

  const parsed = CourseManifestSchema.safeParse(doc);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue.path.join(".") || "(root)";
    throw new Error(`${manifestPath}: invalid manifest — ${field}: ${issue.message}`);
  }
  return parsed.data;
}

function readLessons(
  courseDir: string,
  locale: string,
  blockIds: Set<number>,
): Lesson[] {
  const localeDir = path.join(courseDir, locale);
  // Missing locale dir is normal (the `en` state for months) — no lessons, no throw.
  if (!fs.existsSync(localeDir)) return [];

  const files = fs
    .readdirSync(localeDir)
    .filter((f) => f.endsWith(".mdx"))
    .sort();

  const lessons: Lesson[] = [];
  const seenSlugs = new Set<string>();

  for (const file of files) {
    const filePath = path.join(localeDir, file);
    const { data } = matter(fs.readFileSync(filePath, "utf8"));

    const parsed = LessonFrontmatterSchema.safeParse(data);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue.path.join(".") || "(root)";
      throw new Error(`${filePath}: invalid frontmatter — ${field}: ${issue.message}`);
    }
    const fm = parsed.data;

    // Orphan check: the filename stem, minus its `NN-` order prefix, must equal the
    // slug. Catches a renamed file whose frontmatter slug was never updated.
    const stem = file.replace(/\.mdx$/, "");
    const slugFromName = stem.replace(/^\d+-/, "");
    if (slugFromName !== fm.slug) {
      throw new Error(
        `${filePath}: frontmatter slug "${fm.slug}" does not match filename stem "${slugFromName}"`,
      );
    }

    if (seenSlugs.has(fm.slug)) {
      throw new Error(`${filePath}: duplicate lesson slug "${fm.slug}" within the course`);
    }
    seenSlugs.add(fm.slug);

    if (!blockIds.has(fm.block)) {
      throw new Error(
        `${filePath}: block ${fm.block} is not declared in the course manifest`,
      );
    }

    lessons.push(fm);
  }

  lessons.sort((a, b) => a.block - b.block || a.order - b.order);
  return lessons;
}

/**
 * Build the registry for one locale by scanning `contentRoot`. Uncached and pure
 * in its inputs — the public API wraps it with memoization against the real root,
 * and tests call it directly against a temp fixture tree. Throws (naming the file)
 * on any validation failure. A missing `contentRoot` yields an empty registry.
 */
export function buildRegistry(contentRoot: string, locale: string): LocaleRegistry {
  const registry: LocaleRegistry = new Map();
  if (!fs.existsSync(contentRoot)) return registry;

  const courseDirs = fs
    .readdirSync(contentRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  for (const dir of courseDirs) {
    const courseDir = path.join(contentRoot, dir.name);
    const manifestPath = path.join(courseDir, `course.${locale}.yml`);
    // No manifest for this locale → the course simply isn't translated yet.
    if (!fs.existsSync(manifestPath)) continue;

    const course = parseManifest(manifestPath);
    if (course.slug !== dir.name) {
      throw new Error(
        `${manifestPath}: manifest slug "${course.slug}" does not match directory "${dir.name}"`,
      );
    }

    const blockIds = new Set(course.blocks.map((b) => b.id));
    const lessons = readLessons(courseDir, locale, blockIds);
    registry.set(course.slug, { course, lessons });
  }

  return registry;
}

/**
 * Validate every course × locale present under `contentRoot`, throwing on the
 * first failure. Used by `scripts/lint-content.ts` (and CI) as the standalone
 * enforcement point. No-op when there is no content.
 */
export function validateAllContent(contentRoot: string = DEFAULT_CONTENT_ROOT): void {
  if (!fs.existsSync(contentRoot)) return;

  const locales = new Set<string>();
  for (const dir of fs.readdirSync(contentRoot, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    for (const f of fs.readdirSync(path.join(contentRoot, dir.name))) {
      const m = f.match(/^course\.([a-z]{2})\.yml$/);
      if (m) locales.add(m[1]);
    }
  }

  for (const locale of locales) buildRegistry(contentRoot, locale); // throws on error
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
export function __setContentRoot(root: string): void {
  contentRoot = root;
  cache.clear();
}

/** Test-only: restore the real content root and clear the memo. */
export function __resetRegistry(): void {
  contentRoot = DEFAULT_CONTENT_ROOT;
  cache.clear();
}

export function getCourse(slug: string, locale: string): Course | null {
  return getLocaleRegistry(locale).get(slug)?.course ?? null;
}

export function getLesson(
  courseSlug: string,
  lessonSlug: string,
  locale: string,
): Lesson | null {
  const entry = getLocaleRegistry(locale).get(courseSlug);
  return entry?.lessons.find((l) => l.slug === lessonSlug) ?? null;
}

/** Published courses only — a course is published once it has ≥1 published lesson. */
export function listCourses(locale: string): Course[] {
  return [...getLocaleRegistry(locale).values()]
    .filter((e) => e.lessons.some(isPublished))
    .map((e) => e.course);
}

// ─── COURSE-P1-03 — ungated enumerator for static-param generation ────────────
// The landing route (/cursos/[courseSlug]) is built and reviewed on a preview deploy
// BEFORE any lesson is published (P5). `listCourses` is published-only, so today — with
// dl-nlp holding only a draft — it would generate zero landing pages. This returns every
// course present in the manifest regardless of publication, and is used ONLY by the
// landing route's `generateStaticParams` so the page renders for review. Counts and the
// syllabus still go through the published-only `listCourses`/`listLessons`, so drafts
// never appear in either. The catalog stays on `listCourses` (empty state until P5).
/** Every course present in the manifest for a locale, published or not. */
export function listCourseManifests(locale: string): Course[] {
  return [...getLocaleRegistry(locale).values()].map((e) => e.course);
}

/** Published lessons only, `(block, order)` sorted. Missing course/locale → `[]`. */
export function listLessons(courseSlug: string, locale: string): Lesson[] {
  return getLocaleRegistry(locale).get(courseSlug)?.lessons.filter(isPublished) ?? [];
}

/** Previous/next published lesson for reader navigation. `null` at either end and
 *  for an unknown/draft lesson; drafts are skipped because it walks the published list. */
export function lessonNeighbours(
  courseSlug: string,
  lessonSlug: string,
  locale: string,
): { prev: LessonRef | null; next: LessonRef | null } {
  const published = listLessons(courseSlug, locale);
  const idx = published.findIndex((l) => l.slug === lessonSlug);
  if (idx === -1) return { prev: null, next: null };

  const toRef = (l: Lesson): LessonRef => ({ slug: l.slug, title: l.title });
  return {
    prev: idx > 0 ? toRef(published[idx - 1]) : null,
    next: idx < published.length - 1 ? toRef(published[idx + 1]) : null,
  };
}

/*
 * COURSE-P3-01 — Content lint tying `<Quiz id="…" />` in the prose to the questions
 * declared in the lesson's frontmatter.
 *
 * Quiz definitions deliberately live in frontmatter, not inline in the prose, so they
 * can be validated, counted and later re-graded. The cost of that split is a
 * reference that TypeScript cannot check: a typo'd id compiles fine and renders
 * nothing (or, in dev, a marker). This pass closes it.
 *
 * Three errors, all of them silent failures otherwise:
 *   - a `<Quiz id>` naming a question that isn't in the frontmatter (or no id at all)
 *   - the same question placed twice in one lesson — the reference is then ambiguous,
 *     and two cards would report attempts under one quiz id (P4-02 stores one row per
 *     attempt, keyed by that id)
 *   - `hasQuiz` disagreeing with the body, in BOTH directions. Same reasoning as
 *     `validate-pycells.ts`: a field that documents an invariant without enforcing it
 *     drifts, and something downstream trusts it.
 *
 * Deliberately Node-clean and dependency-light, mirroring `validate-explorables.ts`
 * and `validate-pycells.ts`: the pure helpers below are unit-tested without touching
 * the filesystem, and `scripts/lint-content.ts` (`pnpm lint:content`) runs the fs pass
 * in CI. Frontmatter SHAPE is not re-checked here — `validateAllContent` already does
 * that with the Zod schema, and running first means this pass can trust it.
 */

import fs from "node:fs";

import matter from "gray-matter";

import { DEFAULT_CONTENT_ROOT, collectMdxFiles } from "./content-files";

// Matches a <Quiz …> opening tag and captures its full attribute text.
const QUIZ_TAG = /<Quiz\b([^>]*?)\/?>/g;
// Captures the id="…" (or id='…') value out of the attribute text.
const ID_ATTR = /\bid\s*=\s*["']([^"']*)["']/;

export interface QuizRef {
  /** The id as written, or `null` when the `<Quiz>` tag has no id attribute. */
  id: string | null;
}

/** Extract every `<Quiz>` reference (in source order) from an MDX string. */
export function findQuizRefs(source: string): QuizRef[] {
  const refs: QuizRef[] = [];
  for (const match of source.matchAll(QUIZ_TAG)) {
    const attrs = match[1] ?? "";
    const idMatch = attrs.match(ID_ATTR);
    refs.push({ id: idMatch ? idMatch[1] : null });
  }
  return refs;
}

/**
 * The question ids declared in the frontmatter, in order. Entries without a string
 * `id` are skipped rather than reported: the Zod schema already rejects those, and
 * duplicating the error would only make the first failure less clear.
 */
export function frontmatterQuizIds(source: string): string[] {
  const { data } = matter(source);
  const quiz = data.quiz;
  if (!Array.isArray(quiz)) return [];
  return quiz
    .map((q) => (q && typeof q === "object" ? (q as { id?: unknown }).id : undefined))
    .filter((id): id is string => typeof id === "string");
}

/**
 * Human-readable problems for one lesson source. Empty array = consistent.
 * Pure — no filesystem — so it is trivially unit-testable.
 */
export function quizProblems(source: string): string[] {
  const problems: string[] = [];
  const declared = frontmatterQuizIds(source);
  const refs = findQuizRefs(source);

  const seen = new Set<string>();
  for (const ref of refs) {
    if (ref.id === null) {
      problems.push("<Quiz> is missing an id attribute");
      continue;
    }
    if (!declared.includes(ref.id)) {
      problems.push(
        declared.length > 0
          ? `<Quiz id="${ref.id}"> has no matching question in the frontmatter — declared ids: ${declared.join(", ")}`
          : `<Quiz id="${ref.id}"> but this lesson declares no quiz questions in its frontmatter`,
      );
      continue;
    }
    if (seen.has(ref.id)) {
      problems.push(`<Quiz id="${ref.id}"> appears more than once in this lesson`);
    }
    seen.add(ref.id);
  }

  // `hasQuiz` is absent only when the frontmatter is already invalid, which
  // `validateAllContent` reports; stay quiet rather than duplicate it.
  const hasQuiz = source.match(/^hasQuiz:\s*(true|false)\s*$/m);
  if (hasQuiz) {
    const declaredFlag = hasQuiz[1] === "true";
    if (refs.length > 0 && !declaredFlag) {
      problems.push("lesson uses <Quiz> but declares `hasQuiz: false` — set it to true");
    }
    if (refs.length === 0 && declaredFlag) {
      problems.push("lesson declares `hasQuiz: true` but contains no <Quiz> — set it to false");
    }
  }

  return problems;
}

/**
 * Validate every `<Quiz>` reference across every lesson under `contentRoot`,
 * throwing on the first offending file (`${filePath}: <problem>`).
 */
export function validateQuizRefs(contentRoot: string = DEFAULT_CONTENT_ROOT): void {
  for (const filePath of collectMdxFiles(contentRoot)) {
    const source = fs.readFileSync(filePath, "utf8");
    const problems = quizProblems(source);
    if (problems.length > 0) {
      throw new Error(`${filePath}: ${problems[0]}`);
    }
  }
}

/*
 * COURSE-P3-02 — Content lint tying `<CodeChallenge id="…" />` in the prose to the
 * challenges declared in the lesson's frontmatter.
 *
 * Exactly the split `validate-quizzes.ts` exists for, and exactly the same cost: the
 * definition lives in frontmatter so it can be schema-validated and counted, which
 * leaves a reference TypeScript cannot check. A typo'd id renders nothing in
 * production — the student simply never sees the exercise.
 *
 * Two errors here (the `hasCode` flag is handled by `validate-pycells.ts`, which owns
 * that field for BOTH kinds of Python cell):
 *   - a `<CodeChallenge id>` naming a challenge that isn't in the frontmatter, or a
 *     tag with no id at all
 *   - the same challenge placed twice in one lesson: the reference is then ambiguous,
 *     and two cards would report attempts under one challenge id (P4-02 stores one
 *     row per attempt, keyed by that id)
 *
 * Node-clean and dependency-light like its three siblings: the pure helpers are
 * unit-tested without touching the filesystem, and `scripts/lint-content.ts` runs the
 * fs pass in CI. Frontmatter SHAPE is not re-checked here — `validateAllContent` runs
 * first and already did it with the Zod schema.
 */

import fs from "node:fs";
import path from "node:path";

import matter from "gray-matter";

const DEFAULT_CONTENT_ROOT = path.join(process.cwd(), "content", "courses");

// Matches a <CodeChallenge …> opening tag and captures its full attribute text.
const CHALLENGE_TAG = /<CodeChallenge\b([^>]*?)\/?>/g;
// Captures the id="…" (or id='…') value out of the attribute text.
const ID_ATTR = /\bid\s*=\s*["']([^"']*)["']/;

export interface ChallengeRef {
  /** The id as written, or `null` when the tag has no id attribute. */
  id: string | null;
}

/** Extract every `<CodeChallenge>` reference (in source order) from an MDX string. */
export function findChallengeRefs(source: string): ChallengeRef[] {
  const refs: ChallengeRef[] = [];
  for (const match of source.matchAll(CHALLENGE_TAG)) {
    const attrs = match[1] ?? "";
    const idMatch = attrs.match(ID_ATTR);
    refs.push({ id: idMatch ? idMatch[1] : null });
  }
  return refs;
}

/**
 * The challenge ids declared in the frontmatter, in order. Entries without a string
 * `id` are skipped rather than reported: the Zod schema already rejects those.
 */
export function frontmatterChallengeIds(source: string): string[] {
  const { data } = matter(source);
  const challenges = data.challenges;
  if (!Array.isArray(challenges)) return [];
  return challenges
    .map((c) => (c && typeof c === "object" ? (c as { id?: unknown }).id : undefined))
    .filter((id): id is string => typeof id === "string");
}

/**
 * Human-readable problems for one lesson source. Empty array = consistent.
 * Pure — no filesystem — so it is trivially unit-testable.
 */
export function challengeProblems(source: string): string[] {
  const problems: string[] = [];
  const declared = frontmatterChallengeIds(source);
  const refs = findChallengeRefs(source);

  const seen = new Set<string>();
  for (const ref of refs) {
    if (ref.id === null) {
      problems.push("<CodeChallenge> is missing an id attribute");
      continue;
    }
    if (!declared.includes(ref.id)) {
      problems.push(
        declared.length > 0
          ? `<CodeChallenge id="${ref.id}"> has no matching challenge in the frontmatter — declared ids: ${declared.join(", ")}`
          : `<CodeChallenge id="${ref.id}"> but this lesson declares no challenges in its frontmatter`,
      );
      continue;
    }
    if (seen.has(ref.id)) {
      problems.push(`<CodeChallenge id="${ref.id}"> appears more than once in this lesson`);
    }
    seen.add(ref.id);
  }

  return problems;
}

/** Recursively collect every `.mdx` file path under `dir`. */
function collectMdxFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectMdxFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".mdx")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Validate every `<CodeChallenge>` reference across every lesson under `contentRoot`,
 * throwing on the first offending file (`${filePath}: <problem>`).
 */
export function validateChallengeRefs(contentRoot: string = DEFAULT_CONTENT_ROOT): void {
  for (const filePath of collectMdxFiles(contentRoot)) {
    const source = fs.readFileSync(filePath, "utf8");
    const problems = challengeProblems(source);
    if (problems.length > 0) {
      throw new Error(`${filePath}: ${problems[0]}`);
    }
  }
}

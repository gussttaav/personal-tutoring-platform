/*
 * COURSE-P2-03 — Content lint tying `<PyCell>` to the `hasCode` frontmatter flag.
 * COURSE-P3-02 — `<CodeChallenge>` counts too.
 *
 * `hasCode` was added in P1-02 precisely so the reader knows, before parsing the MDX
 * body, whether a lesson needs the Python runtime prepared at all. Until this lint
 * existed, nothing checked the two agreed — a field that documents an invariant but
 * doesn't enforce it drifts, quietly, and then something downstream trusts it.
 *
 * `hasCode` means "this lesson runs Python", not "this lesson contains a `<PyCell>`".
 * A code challenge runs the student's Python through the very same worker, so it
 * satisfies the flag exactly as a cell does — and a challenge-only lesson would
 * otherwise be unable to satisfy this lint in either direction.
 *
 * Both directions are errors:
 *   - a `<PyCell>` or `<CodeChallenge>` in a lesson with `hasCode: false` (the flag
 *     under-reports)
 *   - `hasCode: true` on a lesson with neither (the flag over-reports)
 *
 * Deliberately Node-clean and dependency-light, mirroring `validate-explorables.ts`:
 * the pure helpers below are unit-tested without touching the filesystem, and
 * `scripts/lint-content.ts` (`pnpm lint:content`) runs the fs pass in CI.
 */

import fs from "node:fs";

import { DEFAULT_CONTENT_ROOT, collectMdxFiles } from "./content-files";

// Opening tag only; `\b` stops `<PyCellClient>`-style names from matching.
const PYCELL_TAG = /<PyCell\b/;
// COURSE-P3-02: the other component that runs Python in a lesson.
const CHALLENGE_TAG = /<CodeChallenge\b/;
// `hasCode:` in the YAML frontmatter block at the top of the file.
const HAS_CODE = /^hasCode:\s*(true|false)\s*$/m;

/** Does this lesson body run Python — through a `<PyCell>` or a `<CodeChallenge>`? */
export function hasPyCell(source: string): boolean {
  return PYCELL_TAG.test(source) || CHALLENGE_TAG.test(source);
}

/**
 * Read the `hasCode` frontmatter flag. Returns `null` when the field is absent —
 * which the P1-02 Zod schema already rejects, so this lint stays quiet about it
 * rather than duplicating that error.
 */
export function readHasCode(source: string): boolean | null {
  const match = source.match(HAS_CODE);
  return match ? match[1] === "true" : null;
}

/**
 * Human-readable problems for one lesson source. Empty array = consistent.
 * Pure — no filesystem — so it is trivially unit-testable.
 */
export function pyCellProblems(source: string): string[] {
  const declared = readHasCode(source);
  if (declared === null) return [];

  const present = hasPyCell(source);
  if (present && !declared) {
    return ["lesson runs Python (<PyCell> or <CodeChallenge>) but declares `hasCode: false` — set it to true"];
  }
  if (!present && declared) {
    return [
      "lesson declares `hasCode: true` but contains no <PyCell> or <CodeChallenge> — set it to false",
    ];
  }
  return [];
}

/**
 * Validate the `<PyCell>` ⇄ `hasCode` agreement across every lesson under
 * `contentRoot`, throwing on the first offending file (`${filePath}: <problem>`).
 */
export function validatePyCellFlags(contentRoot: string = DEFAULT_CONTENT_ROOT): void {
  for (const filePath of collectMdxFiles(contentRoot)) {
    const source = fs.readFileSync(filePath, "utf8");
    const problems = pyCellProblems(source);
    if (problems.length > 0) {
      throw new Error(`${filePath}: ${problems[0]}`);
    }
  }
}

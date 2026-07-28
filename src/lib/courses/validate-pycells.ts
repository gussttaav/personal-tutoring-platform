/*
 * COURSE-P2-03 — Content lint tying `<PyCell>` to the `hasCode` frontmatter flag.
 *
 * `hasCode` was added in P1-02 precisely so the reader knows, before parsing the MDX
 * body, whether a lesson needs the Python runtime prepared at all. Until this lint
 * existed, nothing checked the two agreed — a field that documents an invariant but
 * doesn't enforce it drifts, quietly, and then something downstream trusts it.
 *
 * Both directions are errors:
 *   - a `<PyCell>` in a lesson with `hasCode: false` (the flag under-reports)
 *   - `hasCode: true` on a lesson with no cell (the flag over-reports)
 *
 * Deliberately Node-clean and dependency-light, mirroring `validate-explorables.ts`:
 * the pure helpers below are unit-tested without touching the filesystem, and
 * `scripts/lint-content.ts` (`pnpm lint:content`) runs the fs pass in CI.
 */

import fs from "node:fs";
import path from "node:path";

const DEFAULT_CONTENT_ROOT = path.join(process.cwd(), "content", "courses");

// Opening tag only; `\b` stops `<PyCellClient>`-style names from matching.
const PYCELL_TAG = /<PyCell\b/;
// `hasCode:` in the YAML frontmatter block at the top of the file.
const HAS_CODE = /^hasCode:\s*(true|false)\s*$/m;

/** Does this lesson body contain at least one `<PyCell>`? */
export function hasPyCell(source: string): boolean {
  return PYCELL_TAG.test(source);
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
    return ["lesson uses <PyCell> but declares `hasCode: false` — set it to true"];
  }
  if (!present && declared) {
    return ["lesson declares `hasCode: true` but contains no <PyCell> — set it to false"];
  }
  return [];
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

/*
 * COURSE-P5-00 — The one filesystem walk every content pass shares.
 *
 * `collectMdxFiles` was copy-pasted verbatim into four validators (explorables,
 * pycells, quizzes, challenges). This task adds a fifth and sixth caller (the budget
 * and notation reports) AND a rule that has to hold identically in all of them, so it
 * lives in one place now:
 *
 *   FILES AND DIRECTORIES WHOSE NAME STARTS WITH `_` ARE NOT LESSONS.
 *
 * That rule exists because of `content/courses/dl-nlp/_template.mdx`. The registry
 * ignores it for free — `readLessons` only reads `<courseDir>/<locale>/*.mdx` — but
 * every validator here recurses the whole content root, and a template full of
 * placeholder ids and `TODO` frontmatter would fail the lint it is supposed to help
 * an author pass. Prefixing with `_` is the opt-out, and it also gives authors a
 * `_drafts/` scratch directory that does not break CI.
 *
 * Node-clean and dependency-light like its callers: `node:fs` and `node:path` only.
 */

import fs from "node:fs";
import path from "node:path";

/** The real content root. Every caller defaults to it; tests point at a temp tree. */
export const DEFAULT_CONTENT_ROOT = path.join(process.cwd(), "content", "courses");

/** Templates and scratch files opt out of every content pass with a `_` prefix. */
function isIgnored(name: string): boolean {
  return name.startsWith("_");
}

/**
 * Recursively collect every lesson `.mdx` path under `dir`, skipping `_`-prefixed
 * files and directories. A missing `dir` yields `[]` rather than throwing: a locale
 * with no content is normal, not exceptional.
 */
export function collectMdxFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (isIgnored(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectMdxFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".mdx")) {
      out.push(full);
    }
  }
  return out;
}

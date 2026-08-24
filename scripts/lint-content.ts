/*
 * COURSE-P1-02 — Standalone content lint.
 * COURSE-P2-01 — + validate every `<Explorable id>` in lesson bodies resolves.
 * COURSE-P2-03 — + validate `<PyCell>` agrees with the `hasCode` frontmatter flag.
 * COURSE-P3-01 — + validate every `<Quiz id>` resolves to a frontmatter question.
 * COURSE-P3-02 — + the same for every `<CodeChallenge id>`.
 * COURSE-P5-00 — + a second, NON-FATAL phase: per-lesson counts, budget and notation.
 * COURSE-P5-00 — + the voice pass (banned-word families) and the bridge's `---`.
 * COURSE-P5-00 — + display maths that ends a sentence without punctuating it.
 *
 * Validates every course manifest + lesson frontmatter under `content/courses/`
 * against the Zod schemas, via the registry's `validateAllContent`, then scans the
 * lesson bodies so an unknown `<Explorable id>`, `<Quiz id>` or `<CodeChallenge id>`
 * — or a `hasCode` / `hasQuiz` flag that contradicts the body — fails too. Runs in CI
 * (`pnpm lint:content`) so a bad manifest, a typo'd frontmatter key, or an
 * unregistered widget id fails a PR. Exits non-zero, naming the offending file, on
 * the first failure.
 *
 * Order matters: `validateAllContent` runs first, so the later passes can assume the
 * frontmatter is schema-valid and report only what the schema cannot see.
 *
 * TWO PHASES, AND THE SPLIT IS THE POINT (COURSE-P5-00):
 *   1. Correctness — the five passes above. Throw on the first problem, exit 1.
 *      Every one of them is a thing that renders wrong or silently renders nothing.
 *   2. Budget and notation — report counts, print warnings, EXIT 0 REGARDLESS.
 *      These are judgement calls about a lesson in progress. A hard failure here
 *      would stop an author mid-draft over a lesson that is 2,100 words on its way to
 *      1,800, and Phase 5 is ~40 lessons: friction per lesson is the thing that kills
 *      it. See docs/courses/AUTHORING.md for the budget, docs/courses/NOTATION.md for
 *      the notation contract.
 *
 * Uses `console` deliberately: `src/lib/logger.ts` is coupled to Sentry + the Next
 * request context and is unsuitable for a plain CLI. Run with `tsx` (see package.json).
 */

import fs from "node:fs";
import path from "node:path";

import {
  budgetWarnings,
  formatCounts,
  isBudgetExempt,
  lessonCounts,
} from "@/lib/courses/budget";
import { DEFAULT_CONTENT_ROOT, collectMdxFiles } from "@/lib/courses/content-files";
import { validateAllContent } from "@/lib/courses/registry";
import { validateChallengeRefs } from "@/lib/courses/validate-challenges";
import { validateExplorableIds } from "@/lib/courses/validate-explorables";
import { mathPunctuationWarnings } from "@/lib/courses/validate-math-punctuation";
import { notationWarnings } from "@/lib/courses/validate-notation";
import { validatePyCellFlags } from "@/lib/courses/validate-pycells";
import { validateQuizRefs } from "@/lib/courses/validate-quizzes";
import { structureWarnings } from "@/lib/courses/validate-structure";
import { voiceWarnings } from "@/lib/courses/validate-voice";

// ─── Phase 1 — correctness. Fatal. ────────────────────────────────────────────

try {
  validateAllContent();
  validateExplorableIds();
  validatePyCellFlags();
  validateQuizRefs();
  validateChallengeRefs();
  console.log("✓ content lint passed");
} catch (err) {
  console.error(`✗ content lint failed: ${(err as Error).message}`);
  process.exit(1);
}

// ─── Phase 2 — budget + notation. Advisory only; never changes the exit code. ──

const files = collectMdxFiles(DEFAULT_CONTENT_ROOT);
let warned = 0;
let exempt = 0;

if (files.length > 0) {
  console.log(`\ncontent report — ${files.length} lesson${files.length === 1 ? "" : "s"}`);
}

for (const filePath of files) {
  const source = fs.readFileSync(filePath, "utf8");
  const counts = lessonCounts(source);
  const skipBudget = isBudgetExempt(source);
  if (skipBudget) exempt += 1;

  // Notation, structure, punctuation and voice apply to every file, exempt or not. The
  // notation contract is what keeps Block 2 and Block 5 legible as one course; the structure
  // rule keeps the authoring scaffolding from reaching the reader; the punctuation rule keeps
  // a display equation part of its sentence; the voice rules keep 40 lessons sounding like one
  // person. None has a "work in progress" excuse, and all are
  // cheap to honour from the first draft. Only the BUDGET is skippable, because it is the
  // only one that measures a lesson's size rather than its contract.
  const warnings = [
    ...(skipBudget ? [] : budgetWarnings(counts)),
    ...structureWarnings(source),
    ...notationWarnings(source),
    ...mathPunctuationWarnings(source),
    ...voiceWarnings(source),
  ];
  if (warnings.length > 0) warned += 1;

  const rel = path.relative(process.cwd(), filePath);
  console.log(`\n  ${rel}${skipBudget ? "  (budget exempt)" : ""}`);
  console.log(`    ${formatCounts(counts)}`);
  for (const warning of warnings) console.log(`    ⚠ ${warning}`);
}

if (files.length > 0) {
  const parts = [
    warned === 0 ? "no warnings" : `${warned} lesson${warned === 1 ? "" : "s"} with warnings`,
  ];
  if (exempt > 0) parts.push(`${exempt} budget-exempt`);
  console.log(`\n${warned === 0 ? "✓" : "⚠"} content report — ${parts.join(", ")}`);
}

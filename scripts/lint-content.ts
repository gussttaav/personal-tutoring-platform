/*
 * COURSE-P1-02 — Standalone content lint.
 * COURSE-P2-01 — + validate every `<Explorable id>` in lesson bodies resolves.
 * COURSE-P2-03 — + validate `<PyCell>` agrees with the `hasCode` frontmatter flag.
 * COURSE-P3-01 — + validate every `<Quiz id>` resolves to a frontmatter question.
 *
 * Validates every course manifest + lesson frontmatter under `content/courses/`
 * against the Zod schemas, via the registry's `validateAllContent`, then scans the
 * lesson bodies so an unknown `<Explorable id>` or `<Quiz id>` — or a `hasCode` /
 * `hasQuiz` flag that contradicts the body — fails too. Runs in CI
 * (`pnpm lint:content`) so a bad manifest, a typo'd frontmatter key, or an
 * unregistered widget id fails a PR. Exits non-zero, naming the offending file, on
 * the first failure.
 *
 * Order matters: `validateAllContent` runs first, so the later passes can assume the
 * frontmatter is schema-valid and report only what the schema cannot see.
 *
 * Uses `console` deliberately: `src/lib/logger.ts` is coupled to Sentry + the Next
 * request context and is unsuitable for a plain CLI. Run with `tsx` (see package.json).
 */

import { validateAllContent } from "@/lib/courses/registry";
import { validateExplorableIds } from "@/lib/courses/validate-explorables";
import { validatePyCellFlags } from "@/lib/courses/validate-pycells";
import { validateQuizRefs } from "@/lib/courses/validate-quizzes";

try {
  validateAllContent();
  validateExplorableIds();
  validatePyCellFlags();
  validateQuizRefs();
  console.log("✓ content lint passed");
} catch (err) {
  console.error(`✗ content lint failed: ${(err as Error).message}`);
  process.exit(1);
}

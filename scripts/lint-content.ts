/*
 * COURSE-P1-02 — Standalone content lint.
 *
 * Validates every course manifest + lesson frontmatter under `content/courses/`
 * against the Zod schemas, via the registry's `validateAllContent`. Runs in CI
 * (`pnpm lint:content`) so a bad manifest or a typo'd frontmatter key fails a PR
 * even before any route consumes the registry (that build-time enforcement lands
 * with P1-03). Exits non-zero, naming the offending file, on the first failure.
 *
 * Uses `console` deliberately: `src/lib/logger.ts` is coupled to Sentry + the Next
 * request context and is unsuitable for a plain CLI. Run with `tsx` (see package.json).
 */

import { validateAllContent } from "@/lib/courses/registry";

try {
  validateAllContent();
  console.log("✓ content lint passed");
} catch (err) {
  console.error(`✗ content lint failed: ${(err as Error).message}`);
  process.exit(1);
}

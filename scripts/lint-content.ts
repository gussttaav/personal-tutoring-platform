/*
 * COURSE-P1-02 — Standalone content lint.
 * COURSE-P2-01 — + validate every `<Explorable id>` in lesson bodies resolves.
 *
 * Validates every course manifest + lesson frontmatter under `content/courses/`
 * against the Zod schemas, via the registry's `validateAllContent`, then scans the
 * lesson bodies so an unknown `<Explorable id>` fails too. Runs in CI
 * (`pnpm lint:content`) so a bad manifest, a typo'd frontmatter key, or an
 * unregistered widget id fails a PR. Exits non-zero, naming the offending file, on
 * the first failure.
 *
 * Uses `console` deliberately: `src/lib/logger.ts` is coupled to Sentry + the Next
 * request context and is unsuitable for a plain CLI. Run with `tsx` (see package.json).
 */

import { validateAllContent } from "@/lib/courses/registry";
import { validateExplorableIds } from "@/lib/courses/validate-explorables";

try {
  validateAllContent();
  validateExplorableIds();
  console.log("✓ content lint passed");
} catch (err) {
  console.error(`✗ content lint failed: ${(err as Error).message}`);
  process.exit(1);
}

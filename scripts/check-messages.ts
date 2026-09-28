/*
 * REDESIGN-P3-01 — Message-key parity check.
 *
 * `messages/es.json` and `messages/en.json` must stay key-for-key in sync: a key present
 * in only one file fails silently at runtime for that locale (see CLAUDE.md, "i18n").
 * This script fails the build when they drift. Runs in CI (`pnpm check:messages`) right
 * after `pnpm lint:content`.
 *
 * The diffing logic lives in `src/lib/messages/check-messages.ts` so it can be unit
 * tested without touching the filesystem; this script only reads the two files (via
 * `fs`, not `import`, so it doesn't depend on `resolveJsonModule` settings that differ
 * between `tsx` and Jest) and reports the result.
 *
 * Uses `console` deliberately, same as `lint-content.ts` / `check-bundle.ts`: this is a
 * plain CLI, not app code, so `src/lib/logger.ts` (coupled to Sentry + request context)
 * does not apply.
 */

import fs from "node:fs";
import path from "node:path";

import { diffMessages, hasErrors } from "@/lib/messages/check-messages";

const ES_PATH = path.join(process.cwd(), "messages", "es.json");
const EN_PATH = path.join(process.cwd(), "messages", "en.json");

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

const es = readJson(ES_PATH);
const en = readJson(EN_PATH);
const diff = diffMessages(es, en);

for (const path_ of diff.onlyInEs) {
  console.error(`✗ only in es.json: ${path_}`);
}
for (const path_ of diff.onlyInEn) {
  console.error(`✗ only in en.json: ${path_}`);
}
for (const { path: keyPath, esType, enType } of diff.typeMismatches) {
  console.error(`✗ type mismatch at ${keyPath}: es is ${esType}, en is ${enType}`);
}
for (const { path: keyPath, es: onlyEs, en: onlyEn } of diff.placeholderWarnings) {
  const parts: string[] = [];
  if (onlyEs.length > 0) parts.push(`es only: ${onlyEs.join(", ")}`);
  if (onlyEn.length > 0) parts.push(`en only: ${onlyEn.join(", ")}`);
  console.warn(`⚠ placeholder mismatch at ${keyPath}: ${parts.join("; ")}`);
}

if (hasErrors(diff)) {
  console.error(
    `\n✗ check:messages failed: ${diff.onlyInEs.length + diff.onlyInEn.length + diff.typeMismatches.length} issue(s)`,
  );
  process.exit(1);
}

console.log("✓ check:messages passed");

/*
 * COURSE-P2-01 — Content lint for `<Explorable id="…">` occurrences.
 *
 * TypeScript can't see inside MDX prose, so an author's typo'd or non-existent
 * widget id would otherwise slip through to runtime. This pass scans every lesson
 * body under `content/courses/` and throws — naming the file and the id — when an
 * `<Explorable>` references an id that isn't in the widget registry (or omits `id`).
 *
 * Deliberately Node-clean: it imports ONLY the pure `widget-ids` list, never the
 * client `registry.ts` (which pulls in `next/dynamic`). Run from
 * `scripts/lint-content.ts` (`pnpm lint:content`) so a bad id fails CI. The pure
 * helpers below are unit-tested without touching the filesystem.
 */

import fs from "node:fs";

import { WIDGET_IDS, isWidgetId } from "@/features/courses/widgets/widget-ids";
import { DEFAULT_CONTENT_ROOT, collectMdxFiles } from "./content-files";

// Matches an <Explorable …> opening tag and captures its full attribute text.
const EXPLORABLE_TAG = /<Explorable\b([^>]*?)\/?>/g;
// Captures the id="…" (or id='…') value out of the attribute text.
const ID_ATTR = /\bid\s*=\s*["']([^"']*)["']/;

export interface ExplorableRef {
  /** The id as written, or `null` when the `<Explorable>` tag has no id attribute. */
  id: string | null;
}

/** Extract every `<Explorable>` reference (in source order) from an MDX string. */
export function findExplorables(source: string): ExplorableRef[] {
  const refs: ExplorableRef[] = [];
  for (const match of source.matchAll(EXPLORABLE_TAG)) {
    const attrs = match[1] ?? "";
    const idMatch = attrs.match(ID_ATTR);
    refs.push({ id: idMatch ? idMatch[1] : null });
  }
  return refs;
}

/**
 * Return a human-readable problem string for each invalid `<Explorable>` in the
 * source (missing id, or an id not in the registry). Empty array = all valid.
 * Pure — no filesystem — so it is trivially unit-testable.
 */
export function explorableProblems(source: string): string[] {
  const problems: string[] = [];
  for (const ref of findExplorables(source)) {
    if (ref.id === null) {
      problems.push("<Explorable> is missing an id attribute");
    } else if (!isWidgetId(ref.id)) {
      problems.push(
        `unknown Explorable id "${ref.id}" — valid ids: ${WIDGET_IDS.join(", ")}`,
      );
    }
  }
  return problems;
}

/**
 * Validate every `<Explorable id>` in every lesson under `contentRoot`, throwing on
 * the first offending file (message: `${filePath}: <problem>`). No content → no-op.
 */
export function validateExplorableIds(contentRoot: string = DEFAULT_CONTENT_ROOT): void {
  for (const filePath of collectMdxFiles(contentRoot)) {
    const source = fs.readFileSync(filePath, "utf8");
    const problems = explorableProblems(source);
    if (problems.length > 0) {
      throw new Error(`${filePath}: ${problems[0]}`);
    }
  }
}

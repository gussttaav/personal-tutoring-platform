/*
 * COURSE-P2-03 — MDX-facing entry point for a runnable Python cell.
 *
 * Authors write, in a lesson with `hasCode: true`:
 *
 *   <PyCell packages={["numpy"]} code={`
 *   import numpy as np
 *   print(np.arange(5) ** 2)
 *   `} />
 *
 * `code` is a prop rather than children because MDX would otherwise parse the body
 * as markdown and mangle the indentation — which in Python is syntax.
 *
 * This is a SERVER component. It highlights the author's code with Shiki at BUILD
 * time, using the same theme as every other code block in the course
 * (`src/constants/shiki-theme.ts`), and hands the markup to the client half. So the
 * highlighted cell is in the static HTML — no layout shift, no client-side
 * highlighter, and a reader who never clicks Run pays nothing for the cell beyond
 * the small `PyCellClient` chunk.
 *
 * Pyodide itself is NOT here and must never be: it is reached only through the
 * `await import()` in `PyCellClient.handleRun`. `scripts/check-bundle.ts` fails the
 * build if it appears in any route's first-load JS, the lesson route included.
 *
 * NOTE: this lives under `features/courses/code/`, not `features/courses/widgets/`.
 * That is load-bearing — the bundle guard forbids `courses/widgets` off the lesson
 * route, and these two directories have different lazy-loading rules.
 */

import { SHIKI_THEME } from "@/constants/shiki-theme";

import { PyCellClient } from "./PyCellClient";

export interface PyCellProps {
  code: string;
  /** Pyodide packages to load before running. Only NumPy is expected in Blocks 1–4. */
  packages?: string[];
}

export async function PyCell({ code, packages = [] }: PyCellProps) {
  // A template literal in MDX keeps the leading newline and the author's indentation.
  const source = dedent(code);

  // Lazily imported for the same reason `mdx.ts` lazily imports `compileMDX`: shiki
  // is ESM-only, and a top-level import here would make this module — and therefore
  // the whole MDX component map — unloadable in the Jest unit project.
  const { codeToHtml } = await import("shiki");

  const highlightedHtml = await codeToHtml(source, {
    lang: "python",
    theme: SHIKI_THEME,
    // Shiki wraps in its own <pre>; the client renders it inside a box that already
    // has the padding/border, so strip the wrapper's background and spacing.
    structure: "inline",
  });

  return <PyCellClient code={source} highlightedHtml={highlightedHtml} packages={packages} />;
}

/**
 * Strip the blank first/last line and the common indentation a template literal
 * inherits from its position in the MDX file. Without this every cell would start
 * with four stray spaces, which in Python is an IndentationError.
 */
function dedent(source: string): string {
  const lines = source.replace(/\t/g, "    ").split("\n");
  while (lines.length > 0 && lines[0].trim() === "") lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();

  const indents = lines
    .filter((line) => line.trim() !== "")
    .map((line) => line.length - line.trimStart().length);
  const common = indents.length > 0 ? Math.min(...indents) : 0;

  return lines.map((line) => line.slice(common)).join("\n");
}

export default PyCell;

/*
 * BLOG-27 — content lint for `<PostFigure id="…">` in blog posts.
 *
 * The blog's counterpart to the courses' `validate-explorables.ts`: TypeScript can't see
 * inside MDX, so a typo'd figure id would render nothing in production. This pass scans every
 * post under `content/blog/` and throws, naming the file and the id, on a `<PostFigure>`
 * without an id or with one that is not in `POST_FIGURE_IDS`. It imports only the pure id
 * list, never the client registry. Run from `scripts/lint-content.ts`.
 */

import fs from "node:fs";
import path from "node:path";

import { POST_FIGURE_IDS, isPostFigureId } from "@/features/blog/figures/figure-ids";
import { collectMdxFiles } from "@/lib/courses/content-files";

const DEFAULT_BLOG_ROOT = path.join(process.cwd(), "content", "blog");

const FIGURE_TAG = /<PostFigure\b([^>]*?)\/?>/g;
const ID_ATTR = /\bid\s*=\s*["']([^"']*)["']/;

/** Problems with every `<PostFigure>` in one post's source. Empty = all valid. Pure. */
export function postFigureProblems(source: string): string[] {
  const problems: string[] = [];
  for (const match of source.matchAll(FIGURE_TAG)) {
    const id = (match[1] ?? "").match(ID_ATTR)?.[1];
    if (id === undefined) {
      problems.push("<PostFigure> is missing an id attribute");
    } else if (!isPostFigureId(id)) {
      problems.push(`unknown PostFigure id "${id}" — valid ids: ${POST_FIGURE_IDS.join(", ")}`);
    }
  }
  return problems;
}

export function validatePostFigureIds(contentRoot: string = DEFAULT_BLOG_ROOT): void {
  for (const filePath of collectMdxFiles(contentRoot)) {
    const problems = postFigureProblems(fs.readFileSync(filePath, "utf8"));
    if (problems.length > 0) {
      throw new Error(`${filePath}: ${problems[0]}`);
    }
  }
}

/*
 * BLOG-27 — the ids a post may name in `<PostFigure id="…">`.
 *
 * Pure (no React, no `next/dynamic`), so `scripts/lint-content.ts` can import it to fail a
 * post that names an unknown figure, the same split as the courses' `widget-ids.ts` /
 * `registry.ts`. The `Record<PostFigureId, …>` in `registry.ts` keeps the two in step.
 */

export const POST_FIGURE_IDS = ["latency-budget"] as const;

export type PostFigureId = (typeof POST_FIGURE_IDS)[number];

export function isPostFigureId(id: string): id is PostFigureId {
  return (POST_FIGURE_IDS as readonly string[]).includes(id);
}

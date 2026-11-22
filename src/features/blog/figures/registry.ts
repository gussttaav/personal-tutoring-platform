/*
 * BLOG-27 — interactive post figures: id → lazily-loaded component.
 *
 * Each figure is `next/dynamic` with `ssr: false`, so its code is its own chunk, fetched only
 * by a post that renders it, after hydration. A post without one ships only `PostFigure` and
 * this map of loaders. Nothing here may import from `courses/widgets`: `check:bundle` forbids
 * that marker on every route but the lesson reader, and the blog's figures are their own tree
 * for that reason. `ssr: false` is legal because this module only enters the client graph
 * (it is imported by the "use client" `PostFigure`).
 */

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

import type { PostFigureId } from "./figure-ids";

export const POST_FIGURES: Record<PostFigureId, ComponentType> = {
  // BLOG-27 — latencia-en-asistentes-de-voz.
  "latency-budget": dynamic(() => import("./latency-budget/LatencyBudget"), { ssr: false }),
};

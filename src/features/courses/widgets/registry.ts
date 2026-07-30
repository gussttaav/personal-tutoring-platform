/*
 * COURSE-P2-01 — Widget registry: id → lazily-loaded React component.
 *
 * Invoked from MDX as `<Explorable id="sigmoid-explorer" />` (see `Explorable.tsx`).
 * Every widget is `next/dynamic` with `ssr: false` so its code (and d3) splits into
 * its own chunk that loads ONLY after the lesson hydrates — never in the shared
 * layout. `scripts/check-bundle.ts` enforces that `courses/widgets` stays off every
 * non-lesson first-load bundle.
 *
 * The `Record<WidgetId, …>` type is load-bearing: it forces this map to cover exactly
 * the ids in `widget-ids.ts` — a missing entry or an unknown key is a type error.
 * `ssr: false` is legal here because this module only ever enters the client graph
 * (it is imported by the "use client" `Explorable`).
 */

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

import type { WidgetId } from "./widget-ids";

// Props are widget-specific; MDX can't be type-checked, so `Explorable` forwards
// author-supplied props through and each widget validates/defaults its own.
export type WidgetComponent = ComponentType<Record<string, unknown>>;

export const WIDGETS: Record<WidgetId, WidgetComponent> = {
  "sigmoid-explorer": dynamic(() => import("./activations/SigmoidExplorer"), { ssr: false }),
  // COURSE-P2-02 — Block 1 (NLP) + Block 2 (MLP) explorables.
  "tokenizer-playground": dynamic(() => import("./nlp/TokenizerPlayground"), { ssr: false }),
  "onehot-vs-embedding": dynamic(() => import("./nlp/OneHotVsEmbedding"), { ssr: false }),
  "embedding-projection": dynamic(() => import("./nlp/EmbeddingProjection"), { ssr: false }),
  "activation-explorer": dynamic(() => import("./nn/ActivationExplorer"), { ssr: false }),
  "perceptron-boundary": dynamic(() => import("./nn/PerceptronBoundary"), { ssr: false }),
  "gradient-descent-2d": dynamic(() => import("./nn/GradientDescent2D"), { ssr: false }),
  "backprop-trace": dynamic(() => import("./nn/BackpropTrace"), { ssr: false }),
  "loss-landscape": dynamic(() => import("./nn/LossLandscape"), { ssr: false }),
};

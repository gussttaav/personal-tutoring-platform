/*
 * COURSE-P1-01 — MDX + KaTeX + Shiki content pipeline (config).
 *
 * SPIKE OUTCOME (primary path taken): `next-mdx-remote/rsc` `compileMDX` works
 * under Next 16 + React 19 RSC with remark-math / rehype-katex / rehype-pretty-code.
 * A build-time render of a fixture confirmed KaTeX HTML+MathML, Shiki inline-styled
 * highlighting (no client highlighter), and frontmatter stripping — all with NO
 * `next.config.mjs` change. Fallback A (@next/mdx) / Fallback B (precompile) were
 * therefore NOT needed. Every later Phase-1 task assumes this path.
 *
 * All three of MDX compilation, math typesetting, and highlighting happen at BUILD
 * time, so a lesson page ships zero JS attributable to any of them.
 *
 * This module is a PURE config export: the remark/rehype plugin chains plus a thin
 * `renderLesson()` helper. `compileMDX` is imported lazily inside that helper so this
 * module can be unit-tested for plugin ORDER without loading the ESM-only compiler.
 *
 * Frontmatter is only STRIPPED here (via `parseFrontmatter`); typed validation of
 * those fields belongs to P1-02 — do not duplicate it here.
 */

import type { ReactElement } from "react";
// Type-only import (erased at runtime, so the lazy compileMDX import below still
// holds). Derived from the direct dep rather than unified/@mdx-js, which pnpm
// keeps as non-hoisted transitives that TS can't resolve from here.
import type { MDXRemoteProps } from "next-mdx-remote/rsc";

import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypePrettyCode from "rehype-pretty-code";

import { SHIKI_THEME } from "@/constants/shiki-theme";
import { mdxComponents } from "./mdx-components";

/** unified `PluggableList`, reached through next-mdx-remote's options type. */
type PluginList = NonNullable<
  NonNullable<NonNullable<MDXRemoteProps["options"]>["mdxOptions"]>["remarkPlugins"]
>;

/**
 * Remark chain, in order: GFM (tables/strikethrough/…) → math ($…$, $$…$$).
 * `remark-math` only tokenises math; `rehype-katex` (below) renders it.
 */
export const remarkPlugins: PluginList = [remarkGfm, remarkMath];

/**
 * Rehype chain, in order: KaTeX → pretty-code (Shiki).
 *
 * - `rehype-katex` renders math to HTML at build time, emitting MathML alongside
 *   for screen readers. Its default throw-on-malformed behaviour is KEPT on
 *   purpose — a typo in a derivation should fail the build, not ship a red error
 *   to a student.
 * - `rehype-pretty-code` wraps Shiki for per-line highlighting. `keepBackground`
 *   is off so code blocks inherit the lesson surface rather than the theme's own.
 */
export const rehypePlugins: PluginList = [
  rehypeKatex,
  [rehypePrettyCode, { theme: SHIKI_THEME, keepBackground: false }],
];

/** Frontmatter is validated in P1-02; here it is only parsed off the top. */
type LessonFrontmatter = Record<string, unknown>;

/** Result of compiling one lesson: rendered RSC element + raw frontmatter. */
export interface RenderedLesson {
  content: ReactElement;
  frontmatter: LessonFrontmatter;
}

/**
 * Compile one MDX lesson source to a server-rendered React element using the
 * pipeline above and the custom component map. Runs at build time on static
 * routes. `compileMDX` is imported lazily so this file stays importable in unit
 * tests without pulling the ESM-only compiler.
 */
export async function renderLesson(source: string): Promise<RenderedLesson> {
  const { compileMDX } = await import("next-mdx-remote/rsc");

  return compileMDX<LessonFrontmatter>({
    source,
    components: mdxComponents,
    options: {
      parseFrontmatter: true,
      mdxOptions: { remarkPlugins, rehypePlugins },
    },
  });
}

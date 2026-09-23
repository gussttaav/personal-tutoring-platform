/*
 * BLOG-01 — MDX + KaTeX + Shiki content pipeline for blog posts (config).
 *
 * The same proven path the course lessons take (see src/lib/courses/mdx.ts for the
 * spike outcome): `next-mdx-remote/rsc` `compileMDX` under Next 16 + React 19 RSC,
 * with NO `next.config.mjs` change. Compilation, math typesetting and highlighting all
 * happen at BUILD time, so a post page ships zero JS attributable to any of them.
 *
 * The plugin chains are DECLARED HERE rather than imported from `courses/mdx.ts`, even
 * though the arrays are identical today. That module imports `lessonMdxComponents`,
 * which pulls the whole course component tree (Quiz, CodeChallenge, PyCell, the
 * explorables) into anything that touches it — a large client bundle for a blog post
 * that renders none of them. Six lines of duplication is the cheaper side of that trade.
 *
 * A post is still mostly prose, styled by `post.css` on the reader route — but BLOG-06
 * overrides `a`, so every in-body link can be checked against the post's `reading`
 * bibliography and get a hover card when it matches. That is the one component this
 * module needs; it is deliberately NOT `lessonMdxComponents`, for the reason above.
 *
 * Frontmatter is only STRIPPED here (via `parseFrontmatter`); typed validation belongs
 * to the registry — do not duplicate it.
 */

import type { ReactElement } from "react";
// Type-only import (erased at runtime, so the lazy compileMDX import below still holds).
import type { MDXRemoteProps } from "next-mdx-remote/rsc";

import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeSlug from "rehype-slug";
import rehypeKatex from "rehype-katex";
import rehypePrettyCode from "rehype-pretty-code";

import { SHIKI_THEME } from "@/constants/shiki-theme";
import { makePostLink, type PostRefCtx } from "./PostRef";

/** unified `PluggableList`, reached through next-mdx-remote's options type. */
type PluginList = NonNullable<
  NonNullable<NonNullable<MDXRemoteProps["options"]>["mdxOptions"]>["remarkPlugins"]
>;

/** Remark chain, in order: GFM (tables/strikethrough/…) → math ($…$, $$…$$).
 *  `remark-math` only tokenises math; `rehype-katex` (below) renders it. */
export const remarkPlugins: PluginList = [remarkGfm, remarkMath];

/**
 * Rehype chain, in order: slug → KaTeX → pretty-code (Shiki). The order is
 * load-bearing for the reasons documented at src/lib/courses/mdx.ts:51-70 — `rehype-slug`
 * must run before KaTeX rewrites heading contents so heading ids derive from the
 * heading TEXT, and `rehype-katex` keeps its throw-on-malformed default so a typo in
 * a formula fails the build rather than shipping a red error.
 */
export const rehypePlugins: PluginList = [
  rehypeSlug,
  rehypeKatex,
  [rehypePrettyCode, { theme: SHIKI_THEME, keepBackground: false }],
];

/** Frontmatter is validated by the registry; here it is only parsed off the top. */
type PostFrontmatter = Record<string, unknown>;

/** Result of compiling one post: rendered RSC element + raw frontmatter. */
export interface RenderedPost {
  content: ReactElement;
  frontmatter: PostFrontmatter;
}

/**
 * Compile one MDX post source to a server-rendered React element. Runs at build time
 * on static routes. `compileMDX` is imported lazily so this file stays importable in
 * unit tests without pulling the ESM-only compiler.
 *
 * BLOG-06: `ctx` is the post's own `reading` list plus the request locale, so the `a`
 * override can tell a bibliography link from any other and render its card in the
 * reader's language. Omitted (e.g. a future caller with no bibliography to check
 * against), links render exactly as `compileMDX` would with no components at all.
 */
export async function renderPost(source: string, ctx?: PostRefCtx): Promise<RenderedPost> {
  const { compileMDX } = await import("next-mdx-remote/rsc");

  return compileMDX<PostFrontmatter>({
    source,
    components: ctx ? { a: makePostLink(ctx) } : undefined,
    options: {
      parseFrontmatter: true,
      // next-mdx-remote v6 defaults `blockJS` to TRUE, which silently strips every JSX
      // expression attribute from the source (see the long note in courses/mdx.ts).
      // Posts are first-party files in this repo, compiled at build time and reviewed
      // in the same PR as the code around them. `blockDangerousJS` stays at its default
      // (true), so dangerous call expressions are still stripped — do not change that one.
      blockJS: false,
      mdxOptions: { remarkPlugins, rehypePlugins },
    },
  });
}

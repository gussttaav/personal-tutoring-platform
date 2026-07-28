/*
 * COURSE-P3-01 — Build-time rendering of quiz text (LaTeX, markdown, code).
 *
 * This is a maths course, so quiz prompts, options and explanations WILL contain
 * LaTeX. They live in YAML frontmatter, not in the MDX body, so `rehype-katex`
 * never sees them — they arrive here as plain strings.
 *
 * Rather than invent a second math path, each string goes through `compileMDX` with
 * the very same `remarkPlugins`/`rehypePlugins` the prose uses (see ./../mdx.ts).
 * Consequences, all wanted:
 *   - identical KaTeX output, including the MathML that screen readers read;
 *   - it happens at BUILD time on the server, so the lesson still ships no KaTeX JS;
 *   - authors get GFM markdown (bold, inline code, links) in quiz text for free;
 *   - a `predict-output` snippet in a fenced block gets Shiki highlighting for free.
 *
 * The cost is one small MDX compile per string. That is build-time only and the
 * compiler is already warm from the lesson body.
 *
 * As in ./../mdx.ts, `compileMDX` is imported lazily so this module stays importable
 * in Jest without pulling in the ESM-only compiler.
 */

import type { ReactElement, ReactNode } from "react";
import type { MDXRemoteProps } from "next-mdx-remote/rsc";

import { remarkPlugins, rehypePlugins } from "../mdx";

type MDXComponents = NonNullable<MDXRemoteProps["components"]>;

/**
 * Inline context (an option label, a hint) drops the paragraph wrapper: option text
 * renders inside a `<label>`, and `<p>` inside `<label>` is invalid HTML — browsers
 * break the label out of the control, which costs the click-to-select behaviour.
 */
const INLINE_COMPONENTS: MDXComponents = {
  p: ({ children }: { children?: ReactNode }) => <>{children}</>,
};

async function compile(text: string, components?: MDXComponents): Promise<ReactElement> {
  const { compileMDX } = await import("next-mdx-remote/rsc");

  const { content } = await compileMDX({
    source: text,
    components,
    options: {
      // These strings are frontmatter VALUES; there is no frontmatter of their own to
      // strip, and a leading `---` in an author's text must stay literal.
      parseFrontmatter: false,
      // Same reasoning as the lesson body (COURSE-P2-03): this is first-party content
      // reviewed in the repo, and the default would silently strip attributes.
      blockJS: false,
      mdxOptions: { remarkPlugins, rehypePlugins },
    },
  });

  return content;
}

/** Block context — prompts, explanations, `predict-output` code fences. */
export function renderQuizText(text: string): Promise<ReactElement> {
  return compile(text);
}

/** Inline context — option labels, hints. No paragraph wrapper. */
export function renderQuizInline(text: string): Promise<ReactElement> {
  return compile(text, INLINE_COMPONENTS);
}

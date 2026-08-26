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

import { makeLeccion, type LeccionCtx } from "../Leccion";
import { remarkPlugins, rehypePlugins } from "../mdx";
import { W } from "../word";

type MDXComponents = NonNullable<MDXRemoteProps["components"]>;

/*
 * COURSE-P5-00 — quiz text needs `<W>` for exactly the reason the prose does: a prompt
 * like "numerar el vocabulario — <W>casa</W> → 1 …" is mentioning words, not using
 * them. `W` is the ONLY custom component here. The full `mdxComponents` map is not
 * importable from this module (it imports Quiz, which imports this file), and quiz
 * text has no business hosting a widget or a code cell anyway — an undefined
 * component in frontmatter is a build error, which is the right answer for those.
 */
const CUSTOM_COMPONENTS: MDXComponents = { W };

/*
 * COURSE-P7-01 — `<Leccion>` is the second exception, and it is not a small one: 72 of
 * the course's cross-references live in quiz and challenge frontmatter, across 30
 * lessons. An explanation is also where "go back and check" is worth the most — the
 * student has just got the question wrong. Leaving this map out would mean those 30
 * lessons keep hand-written lesson numbers that nothing validates.
 *
 * Unlike the prose map this one takes no `bridge`: frontmatter copy has no position in
 * the document, so a reference in it is never inside the bridge.
 */
function withLeccion(base: MDXComponents, ctx?: LeccionCtx): MDXComponents {
  return ctx ? { ...base, Leccion: makeLeccion(ctx) } : base;
}

/**
 * Inline context (an option label, a hint) drops the paragraph wrapper: option text
 * renders inside a `<label>`, and `<p>` inside `<label>` is invalid HTML — browsers
 * break the label out of the control, which costs the click-to-select behaviour.
 */
const INLINE_COMPONENTS: MDXComponents = {
  ...CUSTOM_COMPONENTS,
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
export function renderQuizText(text: string, ctx?: LeccionCtx): Promise<ReactElement> {
  return compile(text, withLeccion(CUSTOM_COMPONENTS, ctx));
}

/** Inline context — option labels, hints. No paragraph wrapper. */
export function renderQuizInline(text: string, ctx?: LeccionCtx): Promise<ReactElement> {
  return compile(text, withLeccion(INLINE_COMPONENTS, ctx));
}

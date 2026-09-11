/*
 * BLOG-03 / COURSE-P12 — reading the plain source back out of a highlighted code block.
 *
 * Both readers highlight fenced code at BUILD time with `rehype-pretty-code`
 * (src/lib/blog/mdx.ts, src/lib/courses/mdx.ts): the `<code>` is a tree of coloured
 * `<span>`s, one `[data-line]` per source line. To hand the reader the original text
 * on a "copy" click we reconstruct it from those line spans rather than trusting
 * `pre.textContent`:
 *
 *   - joining `[data-line]` spans with "\n" restores the line breaks EXACTLY once,
 *     independent of whether Shiki emitted "\n" separator text nodes between them, so
 *     the copy never comes out as one mashed line or with doubled blank lines;
 *   - `textContent` on the whole `<pre>` is only the fallback, for the (theoretical)
 *     block that carries no per-line spans.
 *
 * `normalizeCopiedCode` is the one pure, order-independent piece and is unit-tested;
 * `codeTextFromFigure` is DOM glue exercised in the browser.
 */

/**
 * Trim the trailing newline(s) a fenced block leaves behind so a paste does not gain a
 * blank line. Interior blank lines are untouched — only the very end is trimmed.
 */
export function normalizeCopiedCode(raw: string): string {
  return raw.replace(/\n+$/, "");
}

/**
 * Reconstruct a highlighted block's original source from its `[data-line]` spans (or,
 * failing that, the `<pre>`'s text). `figure` is the `[data-rehype-pretty-code-figure]`
 * wrapper both pipelines emit around every fenced block.
 */
export function codeTextFromFigure(figure: Element): string {
  const pre = figure.querySelector("pre");
  if (!pre) return "";

  const lines = pre.querySelectorAll("[data-line]");
  const raw =
    lines.length > 0
      ? Array.from(lines, (line) => line.textContent ?? "").join("\n")
      : (pre.textContent ?? "");

  return normalizeCopiedCode(raw);
}

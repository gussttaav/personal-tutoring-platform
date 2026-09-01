/*
 * COURSE-P1-04 — On-this-page heading outline.
 *
 * A PURE extractor that reads the `##`/`###` headings off an MDX lesson source and
 * assigns each the SAME id `rehype-slug` gives the rendered heading (both use
 * `github-slugger`, which slugs in document order and de-duplicates collisions with
 * `-1`, `-2`, …). That agreement is what lets the on-this-page rail's anchor links
 * (`#<id>`) actually land on the rendered heading. See the rehype chain in
 * `src/lib/courses/mdx.ts` — `rehype-slug` runs there.
 *
 * Only h2/h3 are collected: h1 is the lesson title (rendered by the reader chrome,
 * not the body), and h4+ is too deep for a useful outline.
 *
 * Kept deliberately source-based (not DOM-based) so it runs at build time on the
 * server with no rendered tree, and is unit-testable with no DOM.
 */

import GithubSlugger from "github-slugger";

/** One entry in the on-this-page outline. `depth` is 2 (h2) or 3 (h3). */
export interface HeadingOutline {
  depth: 2 | 3;
  text:  string;
  id:    string;
}

// ATX headings only (`## Foo`), the form authors write. Setext (underline) headings
// are not used in this content and are intentionally ignored.
const HEADING_RE = /^(#{2,3})\s+(.+?)\s*#*\s*$/;

/** Strip the inline markdown that would otherwise leak into the outline label:
 *  `**bold**`, `*em*`, `` `code` ``, and `[text](url)` → `text`. Matches closely
 *  enough what `rehype-slug` sees after MDX renders the heading to text. */
function stripInlineMarkdown(raw: string): string {
  return raw
    .replace(/`([^`]+)`/g, "$1")               // inline code
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")   // links → link text
    .replace(/\*\*([^*]+)\*\*/g, "$1")         // bold
    .replace(/\*([^*]+)\*/g, "$1")             // italics
    .replace(/_([^_]+)_/g, "$1")               // underscore italics
    .trim();
}

/**
 * Extract the h2/h3 outline from an MDX lesson source, in document order, each with
 * the id `rehype-slug` will render. Fenced code blocks (``` and ~~~) are skipped so
 * a `# comment` inside a Python snippet is never mistaken for a heading.
 */
export function extractHeadings(source: string): HeadingOutline[] {
  const slugger = new GithubSlugger();
  const out: HeadingOutline[] = [];

  let fence: string | null = null; // the ``` / ~~~ run that opened the current block

  for (const line of source.split("\n")) {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0].repeat(3); // normalise ```` → ```
      if (fence === null) fence = marker;
      else if (marker === fence) fence = null;
      continue;
    }
    if (fence !== null) continue; // inside a code block — ignore

    const m = line.match(HEADING_RE);
    if (!m) continue;

    const depth = m[1].length as 2 | 3;
    const text = stripInlineMarkdown(m[2]);
    if (!text) continue;

    out.push({ depth, text, id: slugger.slug(text) });
  }

  return out;
}

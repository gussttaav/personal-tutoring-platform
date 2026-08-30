/*
 * COURSE-P9-01 — MDX source → the plain prose the search index is built from.
 *
 * BUILD-TIME shape work, but deliberately fs-free and pure (it takes a source string),
 * so it is unit-testable with no fixture tree — the same discipline as ./headings.ts
 * and ./budget.ts, and for the same reason: there is no MDX AST available here (see the
 * `unified`/`remark-parse` note in budget.ts's header).
 *
 * WHY NOT `budget.prose()`. That function drives the content-budget warnings, and its
 * behaviour must not move — `pnpm lint:content` word counts are a contract with the
 * authors. This is a deliberate near-copy of its strip chain (whose ORDER is load-bearing;
 * read the comment on `prose()` before touching it) with exactly two divergences:
 *
 *   1. `<Leccion>` CHILDREN ARE KEPT. `prose()` deletes them on purpose, so that turning
 *      a cross-reference into a link costs the author nothing against the word budget
 *      (COURSE-P7-01). A searcher has the opposite need: "la lección sobre
 *      retropropagación" is text the student sees on the page and must be able to find.
 *      Only the self-closing `<Leccion … />` form (which renders no label) is dropped.
 *
 *   2. PUNCTUATION IS REPAIRED. `prose()` replaces every tag with a space, so
 *      `<W>perro</W>,` becomes `" perro ,"`. Invisible in a word count; a visible defect
 *      in a rendered snippet. The trailing pass reattaches punctuation and collapses runs.
 *
 * WHAT IS NOT SEARCHABLE, and why: fenced code and `<PyCell code={`…`}>` literals (Python
 * identifiers — `np`, `x`, `for` — are the highest-frequency, lowest-signal tokens in the
 * corpus; searching "softmax" would return every cell containing `def softmax`), and both
 * display and inline math (nobody types `\mathbf{E}` into a search box). Consequence: this
 * is prose-and-headings search, not full-page search, and the dialog's empty state says so.
 */

import { extractHeadings } from "../headings";

/** One section: the prose under an h2/h3, or the head — everything before the first one. */
export interface SearchSection {
  /** `rehype-slug` id. "" for the head. */
  headingId:   string;
  /** "" for the head. */
  headingText: string;
  /** Plain, whitespace-collapsed prose. */
  text:        string;
}

/*
 * Mirrors headings.ts exactly. Both the regex and the inline-markdown strip are
 * replicated (not imported — they are private there) so that the heading LINES this
 * module splits on are precisely the headings `extractHeadings` reports, including the
 * ones it skips for having empty text. `sections.test.ts` asserts that agreement against
 * the real corpus; if it ever fails, these three definitions have drifted.
 */
const HEADING_RE = /^(#{2,3})\s+(.+?)\s*#*\s*$/;
const FENCE_RE   = /^\s*(`{3,}|~{3,})/;

function stripInlineMarkdown(raw: string): string {
  return raw
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .trim();
}

/** Drop fenced code blocks, fence-aware so a fence inside a fence is not an opener. */
function withoutFences(body: string): string {
  const lines: string[] = [];
  let fence: string | null = null;
  for (const line of body.split("\n")) {
    const fenceMatch = line.match(FENCE_RE);
    if (fenceMatch) {
      const marker = fenceMatch[1][0].repeat(3);
      if (fence === null) fence = marker;
      else if (marker === fence) fence = null;
      continue;
    }
    if (fence === null) lines.push(line);
  }
  return lines.join("\n");
}

/**
 * An MDX fragment → the plain prose a student actually reads, ready to index.
 * See the header for the two deliberate divergences from `budget.prose()`.
 */
export function searchableText(fragment: string): string {
  const text = withoutFences(
    fragment
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")   // {/* MDX comments */}
      .replace(/\{`[\s\S]*?`\}/g, " ")         // JSX template-literal props (PyCell code)
      .replace(/\{[^{}]*\}/g, " "),            // other JSX expression props
  );

  return text
    // Divergence 1: only the label-less self-closing form goes. The paired form falls
    // through to the generic tag strip below, which keeps its children.
    .replace(/<Leccion\b[^>]*\/>/g, " ")
    .replace(/^\$\$[\s\S]*?^\$\$/gm, " ")      // display math blocks
    .replace(/\$\$[^\n]*?\$\$/g, " ")          // single-line $$…$$ (inline to remark-math)
    .replace(/\$[^$\n]*?\$/g, " ")             // inline math, one line
    // COURSE-P9-01: inline math WRAPPED ACROSS A SOURCE LINE BREAK. Legal MDX, and common
    // in this hand-wrapped corpus (`36-multi-head.mdx:50` is one). `budget.prose()` cannot
    // match it — its inline pattern forbids `\n` — so the `$` count on that line goes odd
    // and every later pair on it falls out of phase, leaking raw LaTeX into the snippet.
    // Harmless for a word count; a visible defect in a search result.
    //
    // Runs AFTER the single-line pass, so every `$` still standing belongs either to
    // wrapped math or to a literal `$` in prose. The lookahead requires a backslash inside
    // the span, which every real LaTeX fragment has and a stray literal `$` does not — so
    // a lone `$` can never pair with a distant one and swallow the sentence between them.
    .replace(/\$(?=[^$]{0,400}\\)[^$]{0,400}?\$/g, " ")
    .replace(/<\/?[A-Za-z][^>]*>/g, " ")       // JSX / HTML tags (children survive)
    .replace(/`[^`]*`/g, " ")                  // inline code
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // links/images → their text
    .replace(/[|>#*_~]/g, " ")                 // table pipes, quotes, emphasis, headings
    // Divergence 2: make it read as prose rather than as a token stream.
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?)\]»…%])/g, "$1")
    .replace(/([(\[«¿¡])\s+/g, "$1")
    .trim();
}

/**
 * Split an MDX body (frontmatter already removed) into its h2/h3 sections, in document
 * order, each carrying the id `rehype-slug` gives the rendered heading.
 *
 * Ids are CONSUMED from `extractHeadings`, never re-slugged locally: github-slugger
 * de-duplicates collisions with `-1`, `-2`, … in document order, so a second slugger run
 * over a subset would silently disagree and the deep links would land nowhere.
 *
 * Sections whose prose is empty (a section that is nothing but a widget) are dropped —
 * they can never produce a snippet.
 */
export function splitSections(body: string): SearchSection[] {
  const ids = extractHeadings(body);
  let idCursor = 0;

  const sections: SearchSection[] = [];
  let current: { headingId: string; headingText: string; lines: string[] } = {
    headingId: "",
    headingText: "",
    lines: [],
  };

  const flush = () => {
    const text = searchableText(current.lines.join("\n"));
    if (text) sections.push({ headingId: current.headingId, headingText: current.headingText, text });
  };

  let fence: string | null = null;
  for (const line of body.split("\n")) {
    const fenceMatch = line.match(FENCE_RE);
    if (fenceMatch) {
      const marker = fenceMatch[1][0].repeat(3);
      if (fence === null) fence = marker;
      else if (marker === fence) fence = null;
      current.lines.push(line);
      continue;
    }
    // A `# comment` inside a Python fence is not a heading.
    if (fence === null) {
      const m = line.match(HEADING_RE);
      if (m && stripInlineMarkdown(m[2])) {
        flush();
        const heading = ids[idCursor++];
        current = {
          headingId:   heading?.id   ?? "",
          headingText: heading?.text ?? stripInlineMarkdown(m[2]),
          lines:       [],
        };
        continue;
      }
    }
    current.lines.push(line);
  }
  flush();

  return sections;
}

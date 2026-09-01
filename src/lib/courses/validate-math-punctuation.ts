/*
 * COURSE-P5-00 — A display equation is part of the sentence it sits in.
 *
 * `$$…$$` is not a picture dropped between two paragraphs: it is a clause of the
 * sentence around it, and it carries that sentence's punctuation — a period when the
 * sentence ends there, a comma when the next clause would take a pause in prose,
 * nothing when the sentence runs straight through it. The mark is the LAST CHARACTER
 * INSIDE the fence. See docs/courses/AUTHORING.md §5 (typography) and §8 (where the
 * mark goes relative to `\end{cases}` and `\text{…}`).
 *
 * Block 1 shipped five lessons and 39 display blocks with no punctuation at all, so
 * this drifts by default rather than by accident. Four more blocks are coming.
 *
 * WARNS, NEVER FAILS — same contract as ./budget.ts, ./validate-notation.ts and
 * ./validate-structure.ts.
 *
 * DELIBERATELY NARROW. Exactly one case is decidable from the source: the block is
 * unpunctuated AND the next paragraph starts with a capital letter, which in Spanish
 * prose is always a new sentence — so the block ended one and needed a mark. Every
 * other case is left to review, and that is a choice, not an oversight:
 *
 *   - A block followed by a heading, a `<Details>`, a table or a list ALSO usually ends
 *     a sentence, but "usually" is the whole problem. `03-vocabulario-oov.mdx` has a
 *     sentence-ending equation right before a `<Details>` and this pass stays quiet on
 *     it, by design.
 *   - Whether a mid-sentence block wants a comma or nothing needs the grammar of the
 *     next clause, which is not decidable here.
 *
 * The bar is NOTATION.md's: a rule that fires on correct lessons is a rule authors
 * learn to skip past, and that costs more than not having the rule.
 */

import matter from "gray-matter";

/** Marks that legitimately end a display block. A `:` is rare but legal — an equation
 *  can introduce the list that follows it. */
const TERMINAL = /[.,;:]$/;

/** The next paragraph opens with a capital letter (accents included) or with an opening
 *  `¿` / `¡`. Nothing else counts: a line starting with `<`, `#`, `|`, `-`, `` ` ``,
 *  `$` or `*` is a component, heading, table, list, code, maths or a bold lead-in, and
 *  none of those tells us whether the sentence ended. */
const NEW_SENTENCE = /^[\p{Lu}¿¡]/u;

interface BodyLine {
  text: string;
  /** Line number within the FILE, so a warning can be acted on directly. */
  line: number;
}

/**
 * The body's lines with fenced code dropped, each keeping its file line number.
 * Fence-aware because a `$$` inside a snippet is not an equation.
 *
 * Its own copy rather than budget.ts's `withoutFences` (which returns a string and
 * loses the numbering) or validate-structure.ts's `bodyLines` (private to that pass):
 * the walk is four lines, and sharing it would mean moving a helper that two other
 * passes already depend on.
 */
function bodyLines(source: string): BodyLine[] {
  const parsed = matter(source);
  // gray-matter drops the frontmatter but reports no offset; recover it so the line
  // numbers below refer to the file the author has open.
  const fm = source.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  const offset = fm ? fm[0].split("\n").length - 1 : 0;

  const out: BodyLine[] = [];
  let fence: string | null = null;

  const all = parsed.content.split("\n");
  for (let i = 0; i < all.length; i += 1) {
    const text = all[i];
    const fenceMatch = text.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0].repeat(3);
      if (fence === null) fence = marker;
      else if (marker === fence) fence = null;
      continue;
    }
    if (fence !== null) continue; // inside a code block
    out.push({ text, line: i + offset + 1 });
  }

  return out;
}

/** The tail of the equation, for a warning the author can search for. */
function tail(equation: string): string {
  return equation.length <= 34 ? equation : `…${equation.slice(-33)}`;
}

/**
 * Human-readable punctuation warnings for one lesson source. Empty array = no display
 * block ends a sentence without saying so. Pure — no filesystem — so it is trivially
 * unit-testable.
 *
 * Only `$$` fences on their own line are display maths (remark-math's rule, and the one
 * `countDisplayEquations` counts by); a single-line `$$…$$` renders inline and is
 * punctuated by the prose around it.
 */
export function mathPunctuationWarnings(source: string): string[] {
  const lines = bodyLines(source);
  const warnings: string[] = [];

  let open: number | null = null; // index into `lines` of the opening fence
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].text.trim() !== "$$") continue;

    if (open === null) {
      open = i;
      continue;
    }

    const equation = lines
      .slice(open + 1, i)
      .map((l) => l.text.trim())
      .filter((text) => text !== "");
    const last = equation[equation.length - 1] ?? "";
    const next = lines.slice(i + 1).find((l) => l.text.trim() !== "");

    if (last !== "" && !TERMINAL.test(last) && next !== undefined && NEW_SENTENCE.test(next.text.trim())) {
      warnings.push(
        `math punctuation — the display block on line ${lines[open].line} ends «${tail(last)}» and ` +
          `line ${next.line} starts a new sentence; display math carries the sentence's punctuation ` +
          "(AUTHORING §5), so it needs the mark inside the fence",
      );
    }

    open = null;
  }

  return warnings;
}

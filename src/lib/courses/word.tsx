/*
 * COURSE-P5-00 — `<W>`, the object-language mark. See docs/courses/NOTATION.md §6.
 *
 * A linguistics course talks ABOUT strings constantly: "entre casa y gato no hay un
 * punto intermedio". Those words are mentioned, not used — they are data, not part of
 * the sentence's own grammar — and the reader has to see that boundary to parse the
 * sentence at all.
 *
 * Italics cannot carry it. In prose this dense, `*…*` is already doing two other jobs
 * (emphasis, foreign terms), and one signal with three meanings is no signal: after
 * thirty italicised words the reader stops reading italic as anything. Worse, italics
 * has no BOUNDARIES — `*el gato bebe leche*` forces the reader to parse the Spanish to
 * find where the mention ends. Inline code was the other candidate and is rejected in
 * NOTATION.md: from Block 1 lesson 2 on, backticks mean Python.
 *
 * Deliberately NOT monospace and NOT italic — those belong to code and to emphasis
 * respectively. The chip reads as a small object embedded in the prose, which is what
 * a mention is.
 *
 * Lives in its own module rather than in mdx-components.tsx because quiz frontmatter
 * needs it too (src/lib/courses/quiz/render.tsx), and that module is imported BY the
 * Quiz component that mdx-components.tsx imports. Importing the full map there would
 * close the cycle.
 */

import type { ReactNode } from "react";

export function W({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        // `--surface-high` rather than `--surface-container`: the chip has to stay
        // visible inside a <Callout> and a <Details>, and both of those ARE
        // `--surface-container`. This one sits a layer above all three backgrounds.
        background: "var(--surface-high)",
        border: "1px solid var(--border-variant)",
        borderRadius: "4px",
        padding: "0.08em 0.34em",
        // Brighter than the `--text-muted` that Callout/Details set on their bodies,
        // so a mention does not dim when it lands inside one.
        color: "var(--text)",
        // A long mention (a whole sentence being quoted) must be allowed to wrap;
        // `clone` gives each fragment its own padding and border instead of leaving
        // the second line with a raw edge.
        boxDecorationBreak: "clone",
        WebkitBoxDecorationBreak: "clone",
        fontSize: "0.95em",
      }}
    >
      {children}
    </span>
  );
}

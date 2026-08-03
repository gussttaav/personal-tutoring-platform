/*
 * COURSE-P5-00 — The scaffolding must not reach the reader.
 * COURSE-P5-00 — + the bridge's thematic break (see `bridgeWarnings` below).
 *
 * A lesson is built on six steps (motivación, intuición, formalización, implementación,
 * verificación, puente — see docs/courses/AUTHORING.md). That structure is an AUTHORING
 * tool. Shipped as literal headings it becomes a reader interface, and a bad one: a
 * student who reads `## Motivación` / `## Intuición` / `## Formalización` in lesson
 * after lesson is not following an explanation, they are watching a form get filled in.
 * The machinery is for the author. A template is a great authoring tool and a terrible
 * reader interface.
 *
 * So: a heading may never be named after a step. It says what THIS lesson does there —
 * "Construyendo la matriz one-hot en NumPy", not "Implementación". This is the one part
 * of that rule a machine can check, and across ~40 lessons written over months it is
 * exactly the sort of thing that drifts back in, one tired evening at a time.
 *
 * WARNS, NEVER FAILS — same contract as ./budget.ts and ./validate-notation.ts.
 *
 * Reuses `extractHeadings` (./headings.ts), so it sees precisely the headings the
 * on-this-page rail will show: `##`/`###` only, fence-aware, inline markdown stripped.
 */

import matter from "gray-matter";

import { extractHeadings } from "./headings";

/** The six step names, plus the spellings an author reaches for when a step name feels
 *  too bare. Compared accent- and case-insensitively. */
const STEP_HEADINGS = new Set([
  "motivacion",
  "intuicion",
  "formalizacion",
  "implementacion",
  "implementacion a mano",
  "verificacion",
  "puente",
  // English, in case a later cycle drafts in it before translating.
  "motivation",
  "intuition",
  "formalisation",
  "formalization",
  "implementation",
  "verification",
  "bridge",
]);

/** Lowercase, strip accents and trailing punctuation, collapse whitespace. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // combining accents, after NFD
    .replace(/[.:;!?¿¡]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/*
 * ── The bridge's thematic break ───────────────────────────────────────────────
 *
 * Step 6 gets no heading, for the reason above — but unlike motivación and intuición it
 * comes AFTER a section, normally the quiz, and with no mark at all it reads as the tail
 * of that section: "what this lesson leaves unsolved" looks like a remark about the last
 * question. So the bridge is preceded by a `---` and by nothing else, rendered as a short
 * centred rule (see lesson.css).
 *
 * That makes it checkable, and worth checking, because the failure is invisible in the
 * source: a `---` is reserved for this one job, so "exactly one, last thing in the file"
 * is decidable and always right.
 *
 * The blank-line rule is the sharpest of the three. `---` directly under a paragraph is a
 * SETEXT HEADING in markdown — the line above becomes an h2 — and it fails silently in
 * both directions: `extractHeadings` matches `##`-style headings only, so the phantom
 * heading appears in neither the on-this-page rail nor the step-name check above, and the
 * bridge loses its mark. One blank line is the whole fix.
 */

/** `---`, `***` or `___` on its own line: a markdown thematic break. */
const THEMATIC_BREAK = /^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;
const ATX_HEADING = /^ {0,3}#{1,6}\s/;

interface BodyLine {
  text: string;
  /** Line number within the FILE, so a warning can be acted on directly. */
  line: number;
}

/** The body's lines with code fences dropped, each keeping its file line number.
 *  Fence-aware for the same reason `extractHeadings` is: a `---` inside a Python
 *  snippet is not a thematic break. */
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

/** Warnings about the bridge's `---`: that there is exactly one, that markdown will
 *  read it as a break rather than as a heading, and that it closes the lesson. */
export function bridgeWarnings(source: string): string[] {
  const lines = bodyLines(source);
  const breaks = lines
    .map((l, i) => ({ ...l, index: i }))
    .filter((l) => THEMATIC_BREAK.test(l.text));

  if (breaks.length === 0) {
    return [
      "structure — no `---` before the bridge; the closing paragraphs read as part of the section above them",
    ];
  }

  const warnings: string[] = [];

  if (breaks.length > 1) {
    warnings.push(
      `structure — ${breaks.length} thematic breaks (lines ${breaks.map((b) => b.line).join(", ")}); ` +
        "`---` is reserved for the bridge, one per lesson",
    );
  }

  for (const br of breaks) {
    const above = lines[br.index - 1];
    if (above !== undefined && above.text.trim() !== "") {
      warnings.push(
        `structure — the \`---\` on line ${br.line} has no blank line above it; markdown reads line ` +
          `${above.line} as a heading (setext), not the bridge as a break`,
      );
    }
  }

  const last = breaks[breaks.length - 1];
  const after = lines.slice(last.index + 1).filter((l) => l.text.trim() !== "");
  if (after.length === 0) {
    warnings.push(
      `structure — nothing follows the \`---\` on line ${last.line}; the bridge is what it introduces`,
    );
  } else if (after.some((l) => ATX_HEADING.test(l.text))) {
    warnings.push(
      `structure — a heading follows the \`---\` on line ${last.line}; the bridge is the last thing in the lesson`,
    );
  }

  return warnings;
}

/**
 * Human-readable structure warnings for one lesson source. Empty array = no scaffolding
 * on show. Pure — no filesystem — so it is trivially unit-testable.
 */
export function structureWarnings(source: string): string[] {
  const warnings: string[] = [];

  for (const heading of extractHeadings(matter(source).content)) {
    if (STEP_HEADINGS.has(normalise(heading.text))) {
      warnings.push(
        `structure — heading "${heading.text}" is a step name; title it by what this lesson does there`,
      );
    }
  }

  return [...warnings, ...bridgeWarnings(source)];
}

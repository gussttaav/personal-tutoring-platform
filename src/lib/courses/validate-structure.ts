/*
 * COURSE-P5-00 — The scaffolding must not reach the reader.
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

  return warnings;
}

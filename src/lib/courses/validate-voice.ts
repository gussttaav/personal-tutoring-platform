/*
 * COURSE-P5-00 — The machine-checkable part of the voice rules in
 * docs/courses/AUTHORING.md §5.
 *
 * Two families of banned words, banned for two different reasons:
 *
 *   1. CONDESCENSION — «obviamente», «simplemente», «basta con». If it were obvious the
 *      lesson would not exist. These cost the reader who already understood nothing, and
 *      cost the reader who did not the belief that they can. They are also the hardest
 *      thing in this file to catch by review, because they read as perfectly normal
 *      Spanish to the person who just wrote them: you only see them from the outside.
 *
 *   2. PADDING — «cabe destacar», «como podemos ver», «a continuación veremos». The
 *      lesson does not narrate itself. Individually harmless; across ~40 lessons, a
 *      measurable amount of the student's time spent on words that carry nothing.
 *
 * The ban is on the FAMILY, not on a fixed four words, and this module is why that
 * distinction is worth having in code: `sencillamente` sat in Block 1 lesson 1 through
 * a full review precisely because the guide had listed `simplemente` and not it.
 *
 * WARNS, NEVER FAILS — same contract as ./budget.ts, ./validate-notation.ts and
 * ./validate-structure.ts.
 *
 * Scope. Prose only: `prose()` (./budget.ts) removes code fences, `<PyCell>` template
 * literals, LaTeX and JSX before any pattern runs, so a banned word inside Python or
 * inside an equation cannot fire. The raw frontmatter IS scanned — quiz prompts and
 * explanations are student-facing prose and the same rules apply there — with its
 * inline maths stripped first, for the same reason.
 *
 * NOT machine-checked, deliberately: whether an italicised word is an anglicism or a
 * Spanish term, and whether a raya encloses an incise. Both need to know what the
 * sentence means, and NOTATION.md's bar ("five rules that are always right beat twenty
 * that are usually right") rules them out. Those stay review questions.
 */

import fs from "node:fs";

import matter from "gray-matter";

import { prose } from "./budget";
import { DEFAULT_CONTENT_ROOT, collectMdxFiles } from "./content-files";

/** A word boundary that understands accented Spanish — `\b` is built on `[A-Za-z0-9_]`,
 *  so it puts a boundary in the middle of «señalar». */
const OPEN = "(?<![\\p{L}\\p{N}])";
const CLOSE = "(?![\\p{L}\\p{N}])";

interface Family {
  name: string;
  /** Alternation of the banned phrases, without boundaries — added below. */
  source: string;
  advice: string;
}

const FAMILIES: Family[] = [
  {
    name: "condescension",
    source: [
      "obviamente",
      "evidentemente",
      "claramente",
      "simplemente",
      "sencillamente",
      "trivialmente",
      "por supuesto",
      "sin más",
      "bast(?:a|an|aba|aría|arían) con",
      "no (?:es|son) más que",
    ].join("|"),
    advice: "condescension family (AUTHORING §5) — say it plainly, or cut the word",
  },
  {
    name: "padding",
    source: [
      "cabe (?:destacar|señalar|mencionar|notar|recordar)",
      "es importante (?:destacar|señalar|mencionar|notar|recordar)",
      "como (?:podemos|puedes|se puede) (?:ver|observar|apreciar)",
      "a continuación (?:veremos|vamos)",
      "en (?:esta|la presente) (?:sección|lección) (?:vamos|veremos)",
      "en el presente apartado",
    ].join("|"),
    advice: "padding family (AUTHORING §5) — the lesson does not narrate itself",
  },
];

/** Inline and display maths, removed from the raw frontmatter before scanning it.
 *  `prose()` already does this for the body. */
function withoutMath(text: string): string {
  return text.replace(/\$\$[\s\S]*?\$\$/g, " ").replace(/\$[^$\n]*\$/g, " ");
}

/**
 * Human-readable voice warnings for one lesson source, de-duplicated by the offending
 * phrase: the same word used four times is one thing to fix, not four lines of noise.
 * Pure — no filesystem — so it is trivially unit-testable.
 *
 * Reports the phrase rather than a line number, matching the other advisory passes:
 * the phrase is what you search for, and it is the same string in every lesson.
 */
export function voiceWarnings(source: string): string[] {
  const parsed = matter(source);
  // NFC so a decomposed «señalar» (n + combining tilde) matches the composed pattern.
  const text = [prose(parsed.content), withoutMath(parsed.matter ?? "")]
    .join("\n")
    .normalize("NFC");

  const fired = new Map<string, string>();

  for (const family of FAMILIES) {
    const re = new RegExp(`${OPEN}(?:${family.source})${CLOSE}`, "giu");
    for (const match of text.matchAll(re)) {
      const phrase = match[0].toLowerCase().replace(/\s+/g, " ");
      if (fired.has(phrase)) continue;
      fired.set(phrase, `voice — «${phrase}»: ${family.advice}`);
    }
  }

  return [...fired.values()];
}

/** Voice warnings for every lesson under `contentRoot`, keyed by file path. Never
 *  throws: this pass reports, it does not gate. */
export function collectVoiceWarnings(
  contentRoot: string = DEFAULT_CONTENT_ROOT,
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const filePath of collectMdxFiles(contentRoot)) {
    const warnings = voiceWarnings(fs.readFileSync(filePath, "utf8"));
    if (warnings.length > 0) out.set(filePath, warnings);
  }
  return out;
}

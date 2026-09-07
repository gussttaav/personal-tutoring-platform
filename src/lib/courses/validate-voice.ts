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
 *
 * COURSE-P11-01 — the families are now PER LOCALE, because `collectMdxFiles` recurses the
 * whole content root and an English lesson was therefore checked against a Spanish word
 * list, i.e. against nothing. English has the same two families and the same trap: `just`
 * and `merely` are `simplemente` and `sencillamente` wearing different clothes, so the
 * ban is on the family here too. The `\p{L}\p{N}` boundaries need no change for English
 * — `\b` would be adequate for ASCII, but `naïve` and `café` are exactly the words an
 * English lesson about tokenisation quotes.
 *
 * A locale with no families declared is checked against nothing, deliberately: running
 * the Spanish patterns over a third language would produce noise, and noise is what kills
 * an advisory pass. Adding a locale means adding its families.
 */

import fs from "node:fs";
import path from "node:path";

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

/** The canonical locale — `routing.defaultLocale`, hardcoded because this module is
 *  Node-clean and runs under `tsx` in scripts/lint-content.ts. */
const CANONICAL_LOCALE = "es";

const FAMILIES: Record<string, Family[]> = {
  es: [
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
  ],
  /*
   * COURSE-P11-01 — the English half. Same two families, same contract, and the same
   * discipline about morphological siblings: `obviously` without `evidently` and
   * `plainly` would repeat the `simplemente`/`sencillamente` miss exactly.
   *
   * `just` is the deliberately wide one. It is high-frequency and often legitimate
   * (`just as`, `just in case`), but `prose()` has already removed code, `<PyCell>`
   * literals, LaTeX and JSX, which is where most of the innocent ones live — and
   * warn-never-fail is what makes an imperfect rule affordable.
   *
   * The padding phrases are verb-constrained the way their Spanish counterparts are:
   * "it is important to note" is padding, "it is important to normalise first" is the
   * lesson. Unconstrained, the rule would fire on the prose it exists to protect.
   */
  en: [
    {
      name: "condescension",
      source: [
        "obviously",
        "evidently",
        "clearly",
        "plainly",
        "simply",
        "merely",
        "just",
        "trivially",
        "of course",
        "needless to say",
        "all you (?:have|need) to do",
        "it should be (?:clear|obvious|evident)",
        "(?:is|are) nothing more than",
      ].join("|"),
      advice: "condescension family (AUTHORING §5) — say it plainly, or cut the word",
    },
    {
      name: "padding",
      source: [
        "it(?: is|’s|'s) worth (?:noting|mentioning|pointing out|remembering)",
        "it(?: is|’s|'s) important to (?:note|remember|mention|stress|point out)",
        "as (?:we|you) can (?:see|observe|appreciate)",
        "note that",
        "in (?:this|the present) (?:section|lesson) (?:we|you) (?:will|are going to)",
        "let us now",
        "let(?:’|')s now",
        "we (?:will|shall) now",
      ].join("|"),
      advice: "padding family (AUTHORING §5) — the lesson does not narrate itself",
    },
  ],
};

/** Inline and display maths, removed from the raw frontmatter before scanning it.
 *  `prose()` already does this for the body. */
function withoutMath(text: string): string {
  return text.replace(/\$\$[\s\S]*?\$\$/g, " ").replace(/\$[^$\n]*\$/g, " ");
}

/** COURSE-P11-01 — the locale tree a lesson file sits in: `<course>/<locale>/NN-slug.mdx`.
 *  The same derivation `validate-crosslinks.ts` makes from a directory path, and for the
 *  same reason — the registry knows this, but importing it here would not be free. */
export function lessonLocale(filePath: string): string {
  return path.basename(path.dirname(filePath));
}

/**
 * Human-readable voice warnings for one lesson source, de-duplicated by the offending
 * phrase: the same word used four times is one thing to fix, not four lines of noise.
 * Pure — no filesystem — so it is trivially unit-testable.
 *
 * Reports the phrase rather than a line number, matching the other advisory passes:
 * the phrase is what you search for, and it is the same string in every lesson.
 *
 * `locale` selects the families (COURSE-P11-01). It defaults to the canonical locale so
 * every existing caller — and every unit test written before English existed — keeps
 * getting the Spanish rules.
 */
export function voiceWarnings(source: string, locale: string = CANONICAL_LOCALE): string[] {
  const parsed = matter(source);
  // NFC so a decomposed «señalar» (n + combining tilde) matches the composed pattern.
  const text = [prose(parsed.content), withoutMath(parsed.matter ?? "")]
    .join("\n")
    .normalize("NFC");

  const fired = new Map<string, string>();

  for (const family of FAMILIES[locale] ?? []) {
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
    const warnings = voiceWarnings(fs.readFileSync(filePath, "utf8"), lessonLocale(filePath));
    if (warnings.length > 0) out.set(filePath, warnings);
  }
  return out;
}

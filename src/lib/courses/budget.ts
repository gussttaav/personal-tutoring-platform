/*
 * COURSE-P5-00 — Per-lesson budget: counting, and the warnings that come off it.
 *
 * Phase 5 is ~40 lessons. The failure this exists to prevent is not a bad lesson, it
 * is DRIFT: lesson 3 at 1,400 words and lesson 27 at 4,000, so the course reads as a
 * pile of tutorials written on different days. The budget in docs/courses/AUTHORING.md
 * is the contract; this module is what measures against it.
 *
 * WARNINGS, NEVER FAILURES. `budgetWarnings` returns strings; nothing here throws and
 * `scripts/lint-content.ts` does not change its exit code because of them. A hard
 * failure mid-draft is exactly the friction Phase 5 is trying to eliminate — the point
 * is a nudge to consider splitting, not a gate.
 *
 * Word counting EXCLUDES LaTeX, code and JSX. Counting them would mean every
 * maths-heavy lesson reads as over budget on a metric that is supposed to track how
 * much PROSE a student has to get through, and the authors of the maths-heavy lessons
 * would learn to ignore the warning. Same reason the reading-time estimate adds a flat
 * per-widget/per-cell/per-question cost instead: that time is spent, but not reading.
 *
 * Hand-rolled and fence-aware, in the style of ./headings.ts, deliberately: there is no
 * MDX AST available to a plain Node CLI here, and `unified`/`remark-parse` are
 * non-hoisted pnpm transitives this repo cannot import directly (see STATUS.md, P3-01).
 */

import matter from "gray-matter";

import { findExplorables } from "./validate-explorables";

/** Opt-out marker for files that live under `content/` but are not lessons. */
const BUDGET_IGNORE = /\{\/\*\s*content-budget:\s*ignore/;

// Opening tag only; `\b` keeps `<PyCellClient>`-style names from matching.
const PYCELL_TAG = /<PyCell\b/g;

/*
 * A cell's own `code={`…`}` literal. The middle `[\s\S]*?` is lazy, so it stops at
 * the FIRST `code={` after the tag rather than running into the next cell, and the
 * body ends at the first backtick — which is why AUTHORING.md requires backticks
 * inside a cell to be escaped. An escaped one would end the match early and
 * under-count; that is a warning being conservative, not a wrong build.
 */
const PYCELL_CODE = /<PyCell\b[\s\S]*?code=\{`([\s\S]*?)`\}/g;

/*
 * Words per minute — a STUDY rate, not a reading rate: this is prose the student
 * re-reads and works derivations out of, not text they skim. A skim rate (~180 wpm)
 * would put a mid-budget lesson at ~11 minutes, which is not what reading one costs.
 *
 * The estimate is ADVISORY. It feeds the `(≈N)` in the report and the drift check, and
 * nothing else — no warning fires merely because the estimate is low. (It used to,
 * until the reading-time floor was dropped; see the `AXES` comment below.)
 */
const WORDS_PER_MINUTE = 120;
/** Flat minute costs for the things a student does rather than reads. */
const MINUTES_PER_WIDGET = 2;
const MINUTES_PER_CODE_CELL = 3;
const MINUTES_PER_QUESTION = 1;
const MINUTES_PER_CHALLENGE = 6;

/** What one lesson costs a student, on every axis the budget names. */
export interface LessonCounts {
  /** Prose words — LaTeX, code fences and JSX excluded. */
  words: number;
  /** `minutes` as declared in the frontmatter (what the reader UI shows). */
  minutes: number;
  /** `$$…$$` blocks with the fences on their own lines. Single-line `$$…$$` is
   *  inline math to remark-math, so it is not a display equation and is not counted. */
  displayEquations: number;
  /** `<Explorable>` placements — a widget embedded twice costs the student twice. */
  widgets: number;
  /** `<PyCell>` placements. */
  codeCells: number;
  /** Lines in the LONGEST single `<PyCell>` — how tall the biggest wall of code is.
   *  Separate from `codeCells` on purpose: three short cells and one 142-line cell
   *  are both "1–3 cells", and only one of them is a lesson the student can read. */
  longestCodeCell: number;
  /** Questions declared in the frontmatter `quiz` array. */
  quizQuestions: number;
  /** Challenges declared in the frontmatter `challenges` array. */
  challenges: number;
  /** COURSE-P8-01: "Para profundizar" entries in the frontmatter `reading` array.
   *  Report-only — the hard cap of five is enforced by `ReadingItemSchema`, so this
   *  axis exists to show coverage across the course, not to warn. */
  reading: number;
  /** Minutes implied by the counts above — a sanity check on the declared `minutes`. */
  estimatedMinutes: number;
}

/*
 * One budget axis. `warnUnder` is off wherever a low value is a legitimate design
 * choice, because a warning that fires on a deliberate decision is one authors learn
 * to skip past — and they then skip the ones that matter. Two separate reasons for it:
 *
 *   - widgets / code cells / equations / challenges: zero is a real choice. Block 1
 *     lesson 1 has no widget and no code cell ON PURPOSE.
 *   - reading time: the floor was a SECOND measure of "is this lesson substantial
 *     enough", and `words` already measures that, calibrated differently. The two
 *     could not both be satisfied: `estimatedMinutes` for a prose-only lesson is
 *     `words/120 + questions`, so clearing a 20-minute floor needed ≥2,040 words —
 *     past the 2,000-word target. Every widget-free lesson warned on one axis or the
 *     other, forever. The ceiling stays (a 40-minute lesson really should split), and
 *     a `minutes` that contradicts the content is still caught by the drift check at
 *     the bottom of `budgetWarnings`.
 */
interface Axis {
  key: keyof LessonCounts;
  label: string;
  min: number;
  max: number;
  ceiling: number;
  warnUnder: boolean;
  /** What to do about it. Defaults to splitting the lesson, which is right for every
   *  axis that measures the whole lesson — and wrong for the one that measures a
   *  single cell, where the fix is to split that cell. */
  ceilingAdvice?: string;
}

/** The table from docs/courses/AUTHORING.md, in code. Keep the two in sync. */
const AXES: Axis[] = [
  { key: "words",            label: "words",             min: 1200, max: 2000, ceiling: 3000, warnUnder: true  },
  { key: "minutes",          label: "reading time (min)", min: 20,   max: 30,   ceiling: 40,   warnUnder: false },
  { key: "displayEquations", label: "display equations", min: 5,    max: 12,   ceiling: 20,   warnUnder: false },
  { key: "widgets",          label: "widgets",           min: 1,    max: 2,    ceiling: 3,    warnUnder: false },
  { key: "codeCells",        label: "code cells",        min: 1,    max: 3,    ceiling: 5,    warnUnder: false },
  // The editor shows 20 lines before it scrolls (features/courses/code/editor-metrics.ts),
  // so the target is two screenfuls of that box and the ceiling is four. Past the
  // ceiling the student is scrolling a window through a program, which is not reading.
  { key: "longestCodeCell",  label: "longest code cell (lines)", min: 0, max: 45, ceiling: 90, warnUnder: false,
    ceilingAdvice: "split this cell" },
  { key: "quizQuestions",    label: "quiz questions",    min: 3,    max: 5,    ceiling: 8,    warnUnder: true  },
  { key: "challenges",       label: "code challenges",   min: 0,    max: 1,    ceiling: 2,    warnUnder: false },
  // `max`/`ceiling` are READING_MAX: the schema rejects a sixth entry outright, so this
  // axis can never warn. It is here to put the count in the report line, which is what
  // makes "which lessons still have none" visible while P8-02 fills them in.
  { key: "reading",          label: "further reading",   min: 0,    max: 5,    ceiling: 5,    warnUnder: false },
];

/** Does this file opt out of the budget report? Used by the rendering fixture, which
 *  lives under `content/` but is a coverage surface, not a lesson: it embeds all nine
 *  explorables and all five question types on purpose and would warn forever. */
export function isBudgetExempt(source: string): boolean {
  return BUDGET_IGNORE.test(source);
}

/** Drop fenced code blocks, fence-aware so a fence inside a fence is not an opener. */
function withoutFences(body: string): string {
  const lines: string[] = [];
  let fence: string | null = null;
  for (const line of body.split("\n")) {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
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
 * Everything a component-counting rule should see: no fenced code, no inline code.
 * Without this, the sentence "(para eso está `<PyCell>`)" — prose ABOUT a component,
 * inside backticks — counts as a code cell the lesson does not have.
 */
export function withoutCode(body: string): string {
  return withoutFences(body).replace(/`[^`]*`/g, " ");
}

/**
 * Strip everything that is not prose, in an order that matters:
 * MDX comments and JSX expression containers go FIRST, so a `<PyCell code={`…`} />`
 * template literal (Python, often with `$` and backticks in it) can never be mistaken
 * for math or for words. Fenced code goes next, then display math, then inline math,
 * then the remaining tags, then the inline markdown syntax itself.
 *
 * COURSE-P7-01: `<Leccion>` is the one tag whose CHILDREN go too. The generic tag strip
 * below keeps them — "la lección sobre X" reads as prose either way — but that would
 * charge an author words for turning a reference into a link, and the whole point of the
 * component is that linking is free. Self-closing form FIRST: otherwise the paired
 * pattern runs from a `<Leccion … />` to the next `</Leccion>` and eats the sentence
 * between them. `withoutFences` has already run, so this never reaches into a ```mdx
 * sample: the whole fenced block is gone by now, exactly as `countLongestCodeCell` never
 * sees a quoted `<PyCell>`.
 */
export function prose(body: string): string {
  const text = withoutFences(
    body
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")   // {/* MDX comments */}
      .replace(/\{`[\s\S]*?`\}/g, " ")         // JSX template-literal props (PyCell code)
      .replace(/\{[^{}]*\}/g, " "),            // other JSX expression props
  );

  return text
    .replace(/<Leccion\b[^>]*\/>/g, " ")                  // cross-reference, no label
    .replace(/<Leccion\b[^>]*>[\s\S]*?<\/Leccion>/g, " ") // cross-reference + its label
    .replace(/^\$\$[\s\S]*?^\$\$/gm, " ")      // display math blocks
    .replace(/\$\$[^\n]*?\$\$/g, " ")          // single-line $$…$$ (inline to remark-math)
    .replace(/\$[^$\n]*?\$/g, " ")             // inline math
    .replace(/<\/?[A-Za-z][^>]*>/g, " ")       // JSX / HTML tags
    .replace(/`[^`]*`/g, " ")                  // inline code
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // links/images → their text
    .replace(/[|>#*_~]/g, " ");                // table pipes, quotes, emphasis, headings
}

/** Prose words. A token counts only if it contains a letter or a digit, so table
 *  rules (`---`), bullets and stray punctuation do not inflate the number. */
export function countWords(body: string): number {
  return prose(body)
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

/** `$$` fences on their own line, outside code blocks, counted in pairs. */
export function countDisplayEquations(body: string): number {
  let fence: string | null = null;
  let fences = 0;
  for (const line of body.split("\n")) {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0].repeat(3);
      if (fence === null) fence = marker;
      else if (marker === fence) fence = null;
      continue;
    }
    if (fence !== null) continue;
    if (line.trim() === "$$") fences += 1;
  }
  return Math.floor(fences / 2);
}

function countTag(body: string, tag: RegExp): number {
  return body.match(new RegExp(tag.source, "g"))?.length ?? 0;
}

/**
 * Lines in the tallest `<PyCell>` in this body, 0 if there are none. Blank interior
 * lines count: they occupy the box exactly like code does. Fence-aware for the same
 * reason `withoutCode` is — a cell quoted inside an ```mdx fence is documentation
 * ABOUT a cell, not a cell the student has to scroll through.
 */
export function countLongestCodeCell(body: string): number {
  const source = withoutFences(body);
  let longest = 0;
  for (const [, literal] of source.matchAll(PYCELL_CODE)) {
    // Mirrors `dedent()` in PyCell.tsx: the blank leading/trailing lines a template
    // literal inherits from its position in the file are stripped before render, so
    // they are not lines the student ever sees.
    const lines = literal.split("\n");
    while (lines.length > 0 && lines[0].trim() === "") lines.shift();
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
    longest = Math.max(longest, lines.length);
  }
  return longest;
}

/** Measure one lesson source on every budget axis. Pure — no filesystem. */
export function lessonCounts(source: string): LessonCounts {
  const { data, content } = matter(source);

  // Component counts read the code-free body: a component NAMED in prose or in
  // backticks is not a component the student has to work through.
  const placed = withoutCode(content);
  const words = countWords(content);
  const widgets = findExplorables(placed).length;
  const codeCells = countTag(placed, PYCELL_TAG);
  const quizQuestions = Array.isArray(data.quiz) ? data.quiz.length : 0;
  const challenges = Array.isArray(data.challenges) ? data.challenges.length : 0;
  const reading = Array.isArray(data.reading) ? data.reading.length : 0;

  return {
    words,
    minutes: typeof data.minutes === "number" ? data.minutes : 0,
    displayEquations: countDisplayEquations(content),
    widgets,
    codeCells,
    // Off `content`, not `placed`: `withoutCode` strips inline code, and a cell's
    // `code={`…`}` literal routinely contains backticks-free Python that survives it
    // fine — but the fence-stripping this axis needs is done inside the counter.
    longestCodeCell: countLongestCodeCell(content),
    quizQuestions,
    challenges,
    reading,
    // Deliberately NOT in `estimatedMinutes`: the block ships collapsed and nothing in
    // it is required to finish the lesson, so counting it as reading time would inflate
    // every estimate with minutes the student is never asked to spend.
    estimatedMinutes: Math.round(
      words / WORDS_PER_MINUTE +
        widgets * MINUTES_PER_WIDGET +
        codeCells * MINUTES_PER_CODE_CELL +
        quizQuestions * MINUTES_PER_QUESTION +
        challenges * MINUTES_PER_CHALLENGE,
    ),
  };
}

/** The one-line counts summary printed for every lesson, budget-conformant or not. */
export function formatCounts(c: LessonCounts): string {
  return [
    `${c.words} words`,
    `${c.minutes} min (≈${c.estimatedMinutes})`,
    `${c.displayEquations} eq`,
    `${c.widgets} widgets`,
    `${c.codeCells} cells (max ${c.longestCodeCell} lines)`,
    `${c.quizQuestions} quiz`,
    `${c.challenges} challenges`,
    `${c.reading} reading`,
  ].join(" · ");
}

/**
 * Budget warnings for one lesson. Empty array = within budget on every axis.
 * Never throws, and nothing here should ever be wired to an exit code.
 */
export function budgetWarnings(c: LessonCounts): string[] {
  const warnings: string[] = [];

  for (const axis of AXES) {
    const value = c[axis.key];
    const band = `target ${axis.min}–${axis.max}, ceiling ${axis.ceiling}`;
    if (value > axis.ceiling) {
      warnings.push(
        `${axis.label}: ${value} — past the hard ceiling of ${axis.ceiling}; ` +
          `${axis.ceilingAdvice ?? "split this lesson"}`,
      );
    } else if (value > axis.max) {
      warnings.push(`${axis.label}: ${value} — over budget (${band})`);
    } else if (axis.warnUnder && value < axis.min) {
      warnings.push(`${axis.label}: ${value} — under budget (${band})`);
    }
  }

  // `minutes` is hand-written and is what the reader UI promises the student, so a
  // wild divergence from what the lesson actually contains is worth saying out loud.
  const drift = Math.abs(c.minutes - c.estimatedMinutes);
  if (c.minutes > 0 && drift > 5 && drift > c.estimatedMinutes * 0.5) {
    warnings.push(
      `minutes: declared ${c.minutes}, the content implies ≈${c.estimatedMinutes} — check the frontmatter`,
    );
  }

  return warnings;
}

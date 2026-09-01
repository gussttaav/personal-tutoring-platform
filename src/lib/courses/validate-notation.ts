/*
 * COURSE-P5-00 — The machine-checkable part of docs/courses/NOTATION.md.
 *
 * Notation drifting between Block 2 and Block 5 is a real and common failure in deep
 * learning courses, and it is exactly the kind of thing that makes a rigorous course
 * feel unrigorous: the student who learned $\mathbf{W}^{(l)}$ in the MLP block and
 * meets $W^l$ in the Transformer block cannot tell whether the difference means
 * something. Across ~40 lessons written over months, review alone will not hold it.
 *
 * WARNINGS, NEVER FAILURES — same contract as ./budget.ts. Off-contract notation is a
 * thing to fix before merge, not a reason to break an author's flow mid-draft.
 *
 * DELIBERATELY A SMALL RULESET. Only violations that are decidable from the source
 * are here. Whether a bare $x$ is a scalar (correct) or a vector that should be
 * $\mathbf{x}$ (wrong) is not decidable without knowing what the lesson means, and a
 * rule that fires on every correct lesson is a rule authors learn to ignore — which
 * costs more than having no rule. Five rules that are always right beat twenty that
 * are usually right. New rules go in only when they meet that bar.
 *
 * Scans math spans only: `$$…$$` and `$…$` in the body, plus inline math in the
 * frontmatter (quiz prompts, options and explanations are full of it). Code fences and
 * inline code are excluded, so a `$` in a shell snippet is never read as math.
 */

import fs from "node:fs";

import matter from "gray-matter";

import { DEFAULT_CONTENT_ROOT, collectMdxFiles } from "./content-files";

/** One rule: a test over a math span, and what to say when it fires. */
interface Rule {
  name: string;
  /** Run against the span with `\mathbf{…}`-style groups and commands masked out,
   *  rather than the raw span, when the rule is about a BARE symbol. */
  masked?: boolean;
  test: RegExp;
  message: string;
}

const RULES: Rule[] = [
  {
    name: "bold",
    test: /\\(bf\b|textbf\{|boldsymbol\{|vec\{)/,
    message: "use \\mathbf{…} for vectors and matrices — not \\bf, \\textbf, \\boldsymbol or \\vec",
  },
  {
    // Masked: `\mathbf{W}` is correct and must not fire, so the semantic groups are
    // removed before looking for a leftover W. Not preceded by a letter, so a `W`
    // inside a masked-away multi-letter name cannot match.
    name: "matrix-bold",
    masked: true,
    test: /(?<![A-Za-z])W/,
    message: "the weight matrix is \\mathbf{W}, never a plain W",
  },
  {
    name: "layer-index",
    test: /\^\s*\{?\s*l\s*\}?(?![a-z])/,
    message: "layer index goes in parentheses: \\mathbf{W}^{(l)}, not W^l",
  },
  {
    name: "d-model",
    test: /d_\s*\{?\s*model/,
    message: "model dimension is d_{\\text{model}} — `model` is a word, so it needs \\text{}",
  },
  {
    // The `T` must be the WHOLE superscript. `\mathbb{R}^{T \times d}` is a shape —
    // the single most common correct use of a `T` superscript in this course — and an
    // earlier, looser version of this rule fired on it.
    name: "transpose",
    test: /\^\s*(?:\{\s*[Tt]\s*\}|[Tt](?![A-Za-z0-9]))/,
    message: "transpose is ^{\\top}; time is a subscript (h_t), never a superscript",
  },
];

/*
 * Big-operator limits are removed from every span BEFORE any rule runs. Without this,
 * `\sum_{t=1}^{T}` — the correct way to sum over a sequence, written in nearly every
 * lesson from Block 3 on — reads as a `^T` transpose and the rule fires on correct
 * notation. Nothing the other rules look for ever lives in a limit.
 */
const LIMITS =
  /\\(?:sum|prod|coprod|int|iint|oint|bigcup|bigcap|bigoplus|max|min|arg\s*max|arg\s*min|lim)\s*(?:_\s*(?:\{[^{}]*\}|[^\s^{}]))?\s*(?:\^\s*(?:\{[^{}]*\}|[^\s^{}]))?/g;

function stripLimits(span: string): string {
  return span.replace(LIMITS, " ");
}

/** Mask the constructs that make a bare-symbol rule ambiguous: semantic groups
 *  (`\mathbf{W}` — the correct form) and every remaining command name (so the `W` in
 *  a hypothetical `\Wide` is not read as a bare matrix). */
function mask(span: string): string {
  return span
    .replace(/\\(mathbf|mathcal|mathrm|mathbb|text|textit|operatorname)\s*\{[^{}]*\}/g, " ")
    .replace(/\\[a-zA-Z]+/g, " ");
}

/**
 * Every math span in an MDX source, in document order: display blocks and inline math
 * from the body, and inline math from the raw frontmatter. Code fences and inline code
 * are removed first so a `$` in a shell command is never read as math.
 */
export function mathSpans(source: string): string[] {
  const parsed = matter(source);

  const lines: string[] = [];
  let fence: string | null = null;
  for (const line of parsed.content.split("\n")) {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0].repeat(3);
      if (fence === null) fence = marker;
      else if (marker === fence) fence = null;
      continue;
    }
    if (fence === null) lines.push(line);
  }
  const body = lines.join("\n").replace(/`[^`]*`/g, " ");

  const spans: string[] = [];
  for (const text of [body, parsed.matter ?? ""]) {
    // Display blocks first, then whatever inline math is left over.
    let rest = text.replace(/^\$\$([\s\S]*?)^\$\$/gm, (_, inner: string) => {
      spans.push(inner);
      return " ";
    });
    rest = rest.replace(/\$\$([^\n]*?)\$\$/g, (_, inner: string) => {
      spans.push(inner);
      return " ";
    });
    for (const m of rest.matchAll(/\$([^$\n]+?)\$/g)) spans.push(m[1]);
  }
  return spans;
}

/**
 * Human-readable notation warnings for one lesson source, de-duplicated (a rule that
 * fires in twelve equations is one problem, reported once, not twelve lines of noise).
 * Pure — no filesystem — so it is trivially unit-testable.
 */
export function notationWarnings(source: string): string[] {
  const fired = new Map<string, string>();
  for (const raw of mathSpans(source)) {
    const span = stripLimits(raw);
    for (const rule of RULES) {
      if (fired.has(rule.name)) continue;
      if (rule.test.test(rule.masked ? mask(span) : span)) {
        fired.set(rule.name, `notation — ${rule.message}`);
      }
    }
  }
  return [...fired.values()];
}

/** Notation warnings for every lesson under `contentRoot`, keyed by file path. Never
 *  throws: this pass reports, it does not gate. */
export function collectNotationWarnings(
  contentRoot: string = DEFAULT_CONTENT_ROOT,
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const filePath of collectMdxFiles(contentRoot)) {
    const warnings = notationWarnings(fs.readFileSync(filePath, "utf8"));
    if (warnings.length > 0) out.set(filePath, warnings);
  }
  return out;
}

/*
 * CONTENT-DOLLAR-01 — A bare `$` in prose is math, not money.
 *
 * Blog posts and course lessons are compiled with `remark-math` with single-dollar inline
 * math ON (src/lib/blog/mdx.ts, src/lib/courses/mdx.ts). A price written with a dollar
 * sign therefore does not render as a price: a paragraph such as
 *
 *   «cuesta 0,20 $ por millón … 0,0000166667 $»      «$0.20 … $0.50»
 *
 * pairs the two signs and typesets everything BETWEEN them as a formula — garbled KaTeX
 * in the middle of a sentence, and `pnpm build` does not complain. The fix is always the
 * same, so this pass makes it a build-time error instead of a thing noticed in review:
 *
 *   Spanish — write «dólares» («0,20 dólares»)        English — escape it, `\$0.20`.
 *
 * FATAL, like the rest of `lint-content`'s phase 1: this renders wrong.
 *
 * HOW IT DECIDES, AND WHY IT IS NOT A REGEX OVER THE FILE. The rule is "would remark-math
 * pair these two signs, and does the pair look like money?", so the scan reproduces the
 * parts of the markdown/MDX grammar that decide whether a `$` is even live, in the same
 * order micromark does:
 *
 *   - fenced code, `$$` fenced display maths, `{/* … *\/}` comments and JSX tags (so
 *     `alt="…$…"`) are blanked first — a dollar there never reaches the prose parser;
 *   - the rest is cut into the scopes a pair cannot span: a paragraph, a list item, a
 *     heading, a table cell (GFM splits a row into cells BEFORE inline parsing);
 *   - inside a scope the scan runs left to right, so `\$` escapes, inline code spans and
 *     genuine `$x$` / `$$x$$` pairs consume their dollars exactly as they do at render time.
 *
 * What is left is the set of `$…$` pairs the renderer really builds. A pair is flagged
 * only when it is MONEY-shaped at both ends (or has a sentence for a body):
 *
 *   opens like money   a digit (and at most one space) right before the sign — «0,20 $» —
 *                      or a digit right after it — «$0.20»;
 *   closes like money  a digit and a space right before the sign — «0,0000166667 $» — or
 *                      a digit right after it, which is the next amount's own sign —
 *                      «$0.20 … $0.50» — or «20$ … 45$» when the opening is glued too;
 *   or the body is prose  two adjacent words of 3+ letters once TeX commands are gone
 *                      («0,20 $ por millón y luego $x$»), which no formula contains.
 *
 * `$195$ y $177$`, `$64 \cdot 2.16 \approx 138$` and `2 $x$` all start like money and are
 * all genuine maths: they close like maths, and stay silent. A LONE `$` (unpaired, so
 * rendered literally and correctly) is not flagged — it is the pairing that garbles.
 *
 * Frontmatter is not prose and is skipped. Pure and Node-clean (`node:fs` / `node:path`
 * only), like the other validators, so it is unit-testable without a Next context.
 */

import fs from "node:fs";
import path from "node:path";

import { DEFAULT_CONTENT_ROOT, collectMdxFiles } from "@/lib/courses/content-files";

export const DEFAULT_BLOG_ROOT = path.join(process.cwd(), "content", "blog");

/** Stands in for a blanked character: not a digit, not a dollar, not whitespace. */
const MASK = "\u0001";
const SPACES = "   ";

const blank = (text: string): string => text.replace(/[^\n]/g, MASK);

export interface CurrencyDollarFinding {
  /** 1-based line of the opening `$`, in the FILE (frontmatter included). */
  line: number;
  /** The pair as remark-math would read it, shortened for the message. */
  snippet: string;
}

// ─── Step 1 — drop what never reaches the prose parser ───────────────────────

/** Fenced code, `$$` display fences, then MDX comments and JSX tags. Line count preserved. */
function maskNonProse(body: string): string {
  const out: string[] = [];
  let code: { ch: string; len: number } | null = null;
  let mathFence: number | null = null;

  for (const line of body.split("\n")) {
    if (code !== null) {
      const close = line.match(/^\s*(`{3,}|~{3,})\s*$/);
      if (close && close[1][0] === code.ch && close[1].length >= code.len) code = null;
      out.push(blank(line));
      continue;
    }
    if (mathFence !== null) {
      const close = line.match(/^\s*(\${2,})\s*$/);
      if (close && close[1].length >= mathFence) mathFence = null;
      out.push(blank(line));
      continue;
    }

    const open = line.match(/^\s*(`{3,}|~{3,})(.*)$/);
    // A backtick fence's info string cannot contain a backtick (else it is an inline span).
    if (open && !(open[1][0] === "`" && open[2].includes("`"))) {
      code = { ch: open[1][0], len: open[1].length };
      out.push(blank(line));
      continue;
    }
    // Display maths is a fence of 2+ dollars whose own line has no other dollar.
    const math = line.match(/^\s*(\${2,})[^$]*$/);
    if (math) {
      mathFence = math[1].length;
      out.push(blank(line));
      continue;
    }
    out.push(line);
  }

  return out
    .join("\n")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, blank)
    .replace(JSX_TAG, blank);
}

/** `<Tag attr="…" other={…}>` / `</Tag>` / `<Tag />`, quotes and up to three levels of
 *  braces respected. A bare `$` outside a quoted value ends the match, so a `<` in prose
 *  can never swallow the maths that follows it. */
const JSX_TAG =
  /<\/?[A-Za-z][\w.:-]*(?:"[^"]*"|'[^']*'|\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}|[^>"'{$])*>/g;

// ─── Step 2 — the scopes a `$…$` pair cannot span ────────────────────────────

interface Scope {
  text: string;
  /** File line of the scope's first line. */
  startLine: number;
}

const isBlank = (line: string): boolean => /^[\s\u0001]*$/.test(line);
const HEADING = /^\s{0,3}#{1,6}\s/;
const LIST_ITEM = /^(\s*)(?:[-*+]|\d{1,9}[.)])\s+/;

function toScopes(masked: string, firstLine: number): Scope[] {
  const scopes: Scope[] = [];
  let cur: string[] = [];
  let curStart = 0;

  const flush = (): void => {
    if (cur.length > 0) scopes.push({ text: cur.join("\n"), startLine: curStart });
    cur = [];
  };
  const add = (line: string, lineNo: number): void => {
    if (cur.length === 0) curStart = lineNo;
    cur.push(line);
  };

  masked.split("\n").forEach((raw, i) => {
    const lineNo = firstLine + i;
    // Blockquote markers are not content.
    const line = raw.replace(/^\s*(?:>\s?)+/, (m) => " ".repeat(m.length));

    if (isBlank(line)) {
      flush();
    } else if (HEADING.test(line)) {
      flush();
      scopes.push({ text: line, startLine: lineNo });
    } else if (line.trimStart().startsWith("|")) {
      flush();
      for (const cell of line.split(/(?<!\\)\|/)) scopes.push({ text: cell, startLine: lineNo });
    } else if (LIST_ITEM.test(line)) {
      flush();
      add(line.replace(LIST_ITEM, (m) => " ".repeat(m.length)), lineNo);
    } else {
      add(line, lineNo);
    }
  });
  flush();

  return scopes;
}

// ─── Step 3 — the pairs remark-math really builds ────────────────────────────

/** Index of the next run of EXACTLY `n` `ch` at or after `from`, or -1. Runs of another
 *  length are content, the same rule as a code span's backticks. */
function findRun(text: string, ch: string, n: number, from: number): number {
  let i = from;
  while (i < text.length) {
    if (text[i] !== ch) {
      i += 1;
      continue;
    }
    let end = i;
    while (text[end] === ch) end += 1;
    if (end - i === n) return i;
    i = end;
  }
  return -1;
}

interface MathPair {
  /** Index of the opening `$`. */
  open: number;
  body: string;
  /** Index just past the closing `$`. */
  end: number;
  /** Dollars in the fence: 1 for `$x$`, 2 for an inline `$$x$$`. */
  size: number;
}

function mathPairs(text: string): MathPair[] {
  const pairs: MathPair[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "\\") {
      i += 2; // `\$` is a literal dollar; any other escape is irrelevant here
    } else if (c === "`" || c === "$") {
      let runEnd = i;
      while (text[runEnd] === c) runEnd += 1;
      const size = runEnd - i;
      const close = findRun(text, c, size, runEnd);
      if (close === -1) {
        i = runEnd; // unpaired: literal text
      } else {
        if (c === "$") {
          pairs.push({ open: i, body: text.slice(runEnd, close), end: close + size, size });
        }
        i = close + size; // a code span is consumed whole, dollars inside it included
      }
    } else {
      i += 1;
    }
  }
  return pairs;
}

// ─── Step 4 — does a pair look like money? ───────────────────────────────────

/** The body with the TeX that is not English/Spanish words taken out. */
function proseLike(body: string): boolean {
  const words = body
    .replace(/\\(?:text|textit|textbf|textrm|mathrm|mathit|operatorname|mbox)\s*\{[^}]*\}/g, " ")
    .replace(/\\[A-Za-z]+/g, " ")
    .replace(/[_^]\s*\{[^}]*\}/g, " ");
  return /\p{L}{3,}\s+\p{L}{3,}/u.test(words);
}

function looksLikeMoney(before: string, body: string, after: string): boolean {
  const opens = new RegExp(`\\d[${SPACES}]?$`).test(before) || /^\d/.test(body);
  if (!opens) return false;
  // «20$ … 45$»: with the opening glued to its digit, a closing glued to one is money too.
  // Otherwise it needs the space — `3 $x_1$` is a formula that ends in a digit.
  const glued = /\d$/.test(before) && /\d$/.test(body);
  const closes = new RegExp(`\\d[${SPACES}]$`).test(body) || /^\d/.test(after);
  return closes || glued || proseLike(body);
}

const SNIPPET_MAX = 48;

function snippetOf(body: string): string {
  const flat = `$${body}$`.replace(/\s+/g, " ");
  return flat.length <= SNIPPET_MAX ? flat : `${flat.slice(0, SNIPPET_MAX - 1)}…`;
}

/**
 * Every `$…$` pair in one MDX source that remark-math would typeset although it is
 * money-shaped. Empty array = none. Pure; `line` is a file line (frontmatter counted).
 */
export function findCurrencyDollars(source: string): CurrencyDollarFinding[] {
  const frontmatter = source.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  const offset = frontmatter ? frontmatter[0].split("\n").length - 1 : 0;
  const body = frontmatter ? source.slice(frontmatter[0].length) : source;

  const findings: CurrencyDollarFinding[] = [];
  for (const scope of toScopes(maskNonProse(body.replace(/\r\n/g, "\n")), offset + 1)) {
    for (const pair of mathPairs(scope.text)) {
      if (pair.size !== 1) continue;
      const before = scope.text.slice(Math.max(0, pair.open - 3), pair.open);
      const after = scope.text.slice(pair.end, pair.end + 2);
      if (!looksLikeMoney(before, pair.body, after)) continue;
      const newlines = scope.text.slice(0, pair.open).split("\n").length - 1;
      findings.push({ line: scope.startLine + newlines, snippet: snippetOf(pair.body) });
    }
  }
  return findings;
}

/** The fix, in the language of the file. */
function hint(locale: string): string {
  return locale === "en"
    ? "escape the dollar sign as \\$ (e.g. \\$0.20)"
    : "escribe «dólares» («0,20 dólares»), o escapa el signo como \\$";
}

/**
 * One human-readable problem per money-shaped pair, `line N: …`. Pure — no filesystem.
 * `locale` only picks the wording of the suggested fix.
 */
export function currencyDollarProblems(source: string, locale = "es"): string[] {
  return findCurrencyDollars(source).map(
    ({ line, snippet }) =>
      `line ${line}: a «$» used as a currency sign makes remark-math typeset ${snippet} as a ` +
      `formula; ${hint(locale)}`,
  );
}

// ─── Filesystem walk ─────────────────────────────────────────────────────────

/** `<root>/<locale>/<slug>.mdx`, skipping the `_`-prefixed template and scratch files the
 *  blog registry also ignores. */
function collectBlogFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const out: string[] = [];
  for (const dir of fs.readdirSync(root, { withFileTypes: true })) {
    if (!dir.isDirectory() || dir.name.startsWith("_")) continue;
    for (const file of fs.readdirSync(path.join(root, dir.name)).sort()) {
      if (file.endsWith(".mdx") && !file.startsWith("_")) out.push(path.join(root, dir.name, file));
    }
  }
  return out;
}

/**
 * Check every blog post and course lesson, throwing ONE error that lists every offending
 * line as `path:line: …` (an author fixing a post wants the whole list, not the first).
 * The locale is the name of the directory the file sits in, for posts and lessons alike.
 * No content → no-op.
 */
export function validateCurrencyDollars(
  courseRoot: string = DEFAULT_CONTENT_ROOT,
  blogRoot: string = DEFAULT_BLOG_ROOT,
): void {
  const lines: string[] = [];
  for (const filePath of [...collectBlogFiles(blogRoot), ...collectMdxFiles(courseRoot)]) {
    const locale = path.basename(path.dirname(filePath));
    const rel = path.relative(process.cwd(), filePath);
    for (const problem of currencyDollarProblems(fs.readFileSync(filePath, "utf8"), locale)) {
      lines.push(`${rel}:${problem.replace(/^line /, "")}`);
    }
  }
  if (lines.length > 0) {
    throw new Error(`currency «$» parsed as maths in ${lines.length} place(s):\n  ${lines.join("\n  ")}`);
  }
}

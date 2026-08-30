/*
 * COURSE-P9-01 — Cutting the piece of prose a student actually reads in a result row.
 *
 * Pure. Returns OFFSETS, never HTML: the component renders `<mark>` from `splitByMarks`,
 * so this feature has no `dangerouslySetInnerHTML` anywhere and therefore no XSS surface,
 * which matters because the corpus is author-written MDX.
 *
 * The window is chosen by DENSITY, not by the first match: with a two-term query, the
 * useful excerpt is the one where both terms appear together, which is rarely where the
 * first one happens to occur.
 */

import { mergeRanges, type Range } from "./match";

/** Characters of context. Two lines at the dialog's width. */
export const SNIPPET_LENGTH = 180;

export interface Snippet {
  text:             string;
  /** Offsets INTO `text`, ascending and non-overlapping. */
  marks:            Range[];
  leadingEllipsis:  boolean;
  trailingEllipsis: boolean;
}

/** Cut back to the last word boundary at or before `at`. */
function backToBoundary(text: string, at: number): number {
  const ws = text.lastIndexOf(" ", at);
  return ws === -1 ? 0 : ws + 1;
}

/** Advance to the first word boundary at or after `at`. */
function forwardToBoundary(text: string, at: number): number {
  const ws = text.indexOf(" ", at);
  return ws === -1 ? text.length : ws;
}

/**
 * A snippet of `text` centred on the densest cluster of `ranges`.
 * `ranges` must be offsets into `text` — which is what `normalizeAligned` guarantees.
 */
export function buildSnippet(text: string, ranges: Range[], maxLength = SNIPPET_LENGTH): Snippet {
  if (text.length <= maxLength && ranges.length === 0) {
    return { text, marks: [], leadingEllipsis: false, trailingEllipsis: false };
  }

  const merged = mergeRanges(ranges).filter((r) => r.start >= 0 && r.end <= text.length);

  if (merged.length === 0) {
    // No highlight to centre on: the head of the section is the most useful preview.
    const end = forwardToBoundary(text, Math.min(maxLength, text.length));
    return {
      text: text.slice(0, end).trimEnd(),
      marks: [],
      leadingEllipsis: false,
      trailingEllipsis: end < text.length,
    };
  }

  // Densest window: for each i, extend j as far as maxLength allows; keep the widest run.
  let best = { from: 0, to: 0, count: 1 };
  for (let i = 0; i < merged.length; i++) {
    let j = i;
    while (j + 1 < merged.length && merged[j + 1].end - merged[i].start <= maxLength) j++;
    if (j - i + 1 > best.count) best = { from: i, to: j, count: j - i + 1 };
  }

  const first = merged[best.from];
  const last = merged[best.to];
  const centre = (first.start + last.end) / 2;
  let start = Math.max(0, Math.min(Math.round(centre - maxLength / 2), Math.max(0, text.length - maxLength)));
  let end = Math.min(start + maxLength, text.length);

  if (start > 0) start = forwardToBoundary(text, start);
  if (end < text.length) end = backToBoundary(text, end);

  /*
   * Boundary snapping can push `start` past the very match the window exists to show, and
   * a snippet that cuts through its own highlight is the one defect users notice
   * immediately. Pull back to the word boundary at or before the first match.
   */
  if (start > first.start) start = backToBoundary(text, first.start);
  if (end < first.end) end = Math.min(text.length, forwardToBoundary(text, first.end));

  const marks = merged
    .filter((r) => r.start >= start && r.end <= end)
    .map((r) => ({ start: r.start - start, end: r.end - start }));

  return {
    text: text.slice(start, end).trim(),
    // `.trim()` above can drop leading whitespace; re-anchor the marks if it did.
    marks: shiftForTrim(text.slice(start, end), marks),
    leadingEllipsis: start > 0,
    trailingEllipsis: end < text.length,
  };
}

function shiftForTrim(raw: string, marks: Range[]): Range[] {
  const lead = raw.length - raw.trimStart().length;
  if (lead === 0) return marks;
  return marks.map((m) => ({ start: m.start - lead, end: m.end - lead })).filter((m) => m.start >= 0);
}

/** Snippet → alternating plain/marked runs, ready for the component to render. */
export function splitByMarks(text: string, marks: Range[]): { text: string; mark: boolean }[] {
  if (marks.length === 0) return text ? [{ text, mark: false }] : [];

  const out: { text: string; mark: boolean }[] = [];
  let cursor = 0;
  for (const m of mergeRanges(marks)) {
    const start = Math.max(0, Math.min(m.start, text.length));
    const end = Math.max(start, Math.min(m.end, text.length));
    if (start > cursor) out.push({ text: text.slice(cursor, start), mark: false });
    if (end > start) out.push({ text: text.slice(start, end), mark: true });
    cursor = end;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), mark: false });
  return out;
}

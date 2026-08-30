/*
 * COURSE-P9-01 — Raw input box string → the needles to look for.
 *
 * Pure. `"quoted phrases"` are matched contiguously; everything else is split into terms
 * that must ALL be present (AND). An unterminated quote is treated as an open phrase, so
 * typing `"self att` keeps matching while the user is still typing the closing quote
 * rather than briefly returning nothing.
 */

import { normalizeAligned } from "./normalize";

/** Below this, the result list stays on the idle tips instead of matching everything. */
export const MIN_QUERY_LENGTH = 2;

export interface ParsedQuery {
  /** Normalized bare terms, longest first so the most selective needle is tested first. */
  terms:   string[];
  /** Normalized quoted phrases, whitespace-collapsed. */
  phrases: string[];
  /** True when there is not enough signal to search. Callers must return no results. */
  empty:   boolean;
}

export function parseQuery(raw: string): ParsedQuery {
  const normalized = normalizeAligned(raw);

  const phrases: string[] = [];
  // Consume `"…"` pairs, and a trailing unterminated `"…` as an open phrase.
  const rest = normalized
    .replace(/"([^"]*)"/g, (_m, inner: string) => {
      const phrase = inner.trim().replace(/\s+/g, " ");
      if (phrase) phrases.push(phrase);
      return " ";
    })
    .replace(/"([^"]*)$/, (_m, inner: string) => {
      const phrase = inner.trim().replace(/\s+/g, " ");
      if (phrase) phrases.push(phrase);
      return " ";
    });

  /*
   * Single-character terms are dropped, not searched. Two reasons, and the second is the
   * one that forced it: "a"/"y"/"e" are pure noise in an 78,000-word Spanish course, AND
   * a one-character needle matches at a word start thousands of times per course, so
   * `findTerm` scans nearly the whole corpus looking for its bounded quota. Measured: the
   * query "a b c d e" cost 8.7 ms before this line, against ~0.6 ms for a real query.
   */
  const terms = rest.split(/\s+/).filter((t) => t.length >= MIN_QUERY_LENGTH);

  // Counted across everything that SURVIVED, so "a b" is empty rather than a scan of the
  // whole course for two letters.
  const signal = [...terms, ...phrases].join("");
  return {
    terms:   terms.sort((a, b) => b.length - a.length),
    phrases,
    empty:   signal.length < MIN_QUERY_LENGTH,
  };
}

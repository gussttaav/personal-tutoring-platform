/*
 * COURSE-P9-01 — Finding needles in already-normalized text.
 *
 * Pure and hot: this is what runs on every keystroke. Measured against the real 254-chunk
 * corpus, a 3-term AND scan over the whole 416 KB costs ~0.65 ms, and the pathological
 * case (collecting all 8,413 occurrences of `"de"`) costs 0.91 ms. That is why there is
 * no inverted index here and no debounce anywhere in the feature — see the escalation
 * ladder in ./rank.ts before reaching for one.
 *
 * MATCHING RULE: left-anchored prefix. A term matches where it begins at a word start.
 * So `aten` finds `atención`, and `sol` does NOT match inside `resolver`.
 *
 * Prefix matching applies to EVERY term, not just the last one the user typed. Spanish
 * inflection is the reason: `gradiente`/`gradientes`, `vector`/`vectores`,
 * `codificar`/`codificación`. There is no stemmer in this pipeline, so whole-word
 * matching on non-final terms would silently drop obvious hits. Left anchoring alone
 * already removes the substring noise that makes naive `includes()` search unusable.
 *
 * TWO PERFORMANCE DETAILS, both load-bearing — an early version of this file spent 14 ms
 * on the query "de la", which is ~70 ms on a phone and visibly laggy:
 *
 *   - `hasTerm` exists so the AND gate in rank.ts can reject a chunk on the FIRST hit
 *     instead of collecting every occurrence and then discovering the chunk was needed.
 *   - `findTerm` is BOUNDED. A stopword-ish term has thousands of hits per course and the
 *     snippet needs a handful; collecting the rest only to sort and discard them was the
 *     bulk of that 14 ms. See MAX_RANGES_PER_TERM.
 */

/** Half-open `[start, end)` offsets into the text they were found in. */
export interface Range {
  start: number;
  end:   number;
}

/*
 * Underscore is absent on purpose: `normalizeAligned` has already folded it to a space,
 * so it can never appear in the text this runs against.
 */
const WORD_CHAR = /[\p{L}\p{N}]/u;

function isWordChar(ch: string | undefined): boolean {
  if (ch === undefined) return false;
  // ASCII fast path. A `\p{L}` regex test per candidate character was, by itself, a
  // large share of the old cost — this runs millions of times on a broad query.
  const code = ch.charCodeAt(0);
  if (code < 128) {
    return (code >= 97 && code <= 122) || (code >= 48 && code <= 57) || (code >= 65 && code <= 90);
  }
  return WORD_CHAR.test(ch);
}

/**
 * Enough occurrences to pick a snippet window from and to judge frequency, and no more.
 * `FREQUENCY_CAP` in rank.ts is 3, so nothing downstream can tell the difference.
 */
export const MAX_RANGES_PER_TERM = 12;

/** Does `term` occur at a word start in `haystack`? Stops at the first hit. */
export function hasTerm(haystack: string, term: string): boolean {
  if (!term) return false;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(term, from);
    if (at === -1) return false;
    if (!isWordChar(haystack[at - 1])) return true;
    from = at + 1;
  }
}

/**
 * Word-start occurrences of `term` in already-normalized `haystack`, at most `limit`.
 * The cap is a performance guard, not an approximation the caller must think about —
 * see MAX_RANGES_PER_TERM.
 */
export function findTerm(haystack: string, term: string, limit = MAX_RANGES_PER_TERM): Range[] {
  if (!term) return [];
  const out: Range[] = [];
  let from = 0;
  while (out.length < limit) {
    const at = haystack.indexOf(term, from);
    if (at === -1) break;
    if (!isWordChar(haystack[at - 1])) out.push({ start: at, end: at + term.length });
    // Advance by one, not by term.length: overlapping starts are legitimate for a prefix.
    from = at + 1;
  }
  return out;
}

/** Same, for a multi-word phrase. Only the first character is boundary-checked. */
export function findPhrase(haystack: string, phrase: string, limit?: number): Range[] {
  return findTerm(haystack, phrase, limit);
}

/**
 * Grow a range forward to the end of the word it started in.
 *
 * Matching is by prefix, so "atencion" hits inside "atenciones". Highlighting the raw
 * match renders `atencion|es` — the mark stops mid-word and reads like a rendering bug.
 * Every mainstream search UI highlights the whole word instead, so display ranges are
 * widened here. MATCHING is unaffected: this runs only on ranges destined for a <mark>.
 */
export function extendToWordEnd(haystack: string, range: Range): Range {
  let end = range.end;
  while (isWordChar(haystack[end])) end++;
  return { start: range.start, end };
}

/** Does `term` match a WHOLE word here, rather than only a prefix of a longer one? */
export function isWholeWord(haystack: string, range: Range): boolean {
  return !isWordChar(haystack[range.end]);
}

/** Sort ascending and merge overlapping/adjacent ranges. Input is not mutated. */
export function mergeRanges(ranges: Range[]): Range[] {
  if (ranges.length <= 1) return [...ranges];
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
  // Cloned: the merge below mutates `last.end`, and these ranges belong to the caller.
  const out: Range[] = [{ ...sorted[0] }];
  for (const r of sorted.slice(1)) {
    const last = out[out.length - 1];
    if (r.start <= last.end) last.end = Math.max(last.end, r.end);
    else out.push({ ...r });
  }
  return out;
}

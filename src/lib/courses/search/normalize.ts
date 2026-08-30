/*
 * COURSE-P9-01 — Accent- and case-folding that PRESERVES STRING OFFSETS.
 *
 * Pure, isomorphic, DOM-free: it runs at build time in the index builder and in the
 * browser on every keystroke.
 *
 * The offset guarantee is the whole point. Matching happens in normalized space, but the
 * snippet is cut from the ORIGINAL text so the student reads real Spanish with real
 * accents — which only works if `normalizeAligned(t)[i]` describes `t[i]`. Naive
 * normalisation breaks that: `"café".normalize("NFD")` is 5 characters, not 4, so every
 * highlight after the first accent would sit one character to the left.
 *
 * The fast path (whole-string NFD → drop combining marks → lowercase) is length-preserving
 * for every character in the current corpus — measured: 0 of 18,121 lines change length.
 * The per-character fallback exists for what the corpus does not contain yet: a pasted `ﬁ`
 * ligature, a Turkish `İ` (whose lowercase is two code points). Without it, one such
 * character silently shifts every highlight in its section.
 *
 * SPANISH NOTE: this maps `ñ → n` and `á → a`. That is deliberate and correct for a
 * search box — "nino" should find "niño", "atencion" should find "atención". It is NOT
 * correct collation for sorting or display, and this function must never be used for that.
 *
 * SEPARATORS. Hyphens, dashes, slashes and underscores fold to a SPACE, which is why this
 * is not merely accent folding. The course writes `self-attention` (15 times); a student
 * types "self attention". Without this they get nothing, which reads as a broken search
 * box. Folding to a space rather than deleting keeps the 1:1 length guarantee AND makes
 * the second half of a compound reachable — "attention" now begins at a word boundary.
 */

const COMBINING_MARKS = /\p{M}/gu;
/** Hyphen-minus, non-breaking/soft hyphens, en/em dash, underscore, slash, middot. */
const SEPARATORS = /[-\u00AD\u2010\u2011\u2012\u2013\u2014_/\u00B7]/g;

/** Fold one character to exactly one character. */
function foldChar(ch: string): string {
  const folded = ch.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase();
  if (folded.length === 1) return folded;
  // Empty: `ch` was itself a bare combining mark. Longer: a ligature or a locale-special
  // lowercase. Either way, keep the position filled with something stable.
  return folded.charAt(0) || ch.toLowerCase().charAt(0) || ch;
}

/**
 * NFD → drop combining marks → lowercase.
 * GUARANTEES `normalizeAligned(text).length === text.length`.
 */
export function normalizeAligned(text: string): string {
  const fast = text
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(SEPARATORS, " ")
    .toLowerCase();
  if (fast.length === text.length) return fast;

  let out = "";
  for (const ch of text) {
    // Iterating a string yields code points, which may be 2 UTF-16 units wide. Pad so the
    // output stays index-aligned with the input rather than merely equal in total length.
    const folded = SEPARATORS.test(ch) ? " " : foldChar(ch);
    SEPARATORS.lastIndex = 0; // /g regex: .test is stateful
    out += ch.length === folded.length ? folded : folded.padEnd(ch.length, " ");
  }
  return out;
}

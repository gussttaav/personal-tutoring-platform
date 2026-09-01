/*
 * COURSE-P2-02 — Tiny committed BPE merge list for `tokenizer-playground`.
 *
 * A byte-pair-encoding demo needs a merge table, but pulling a tokenizer package
 * for a teaching widget is not worth the bytes (see the task doc). So this is a
 * SMALL, hand-authored, illustrative merge list — not a trained vocabulary. It is
 * enough to show that subword tokenisation greedily glues frequent character pairs
 * into morpheme-like pieces (common Spanish endings: -ción, -mente, -ando, …).
 *
 * A merge is an ordered pair of symbols; earlier merges have higher priority
 * (lower rank), exactly as in real BPE. `tokenisation.ts` consumes this.
 */

export interface BpeMerge {
  /** The two adjacent symbols this rule glues together. */
  pair: [string, string];
}

const M = (a: string, b: string): BpeMerge => ({ pair: [a, b] });

/*
 * Ordered by priority (index = rank). The early rules build very common short
 * clusters; later rules build longer suffixes on top of them. Authored so a word
 * like "tokenización" breaks into a few plausible pieces rather than staying whole
 * or exploding into single characters.
 */
export const BPE_MERGES: readonly BpeMerge[] = [
  // Frequent vowel+consonant / consonant+vowel bigrams
  M("c", "i"),
  M("c", "o"),
  M("t", "o"),
  M("t", "e"),
  M("k", "e"),
  M("e", "n"),
  M("a", "n"),
  M("i", "n"),
  M("o", "n"),
  M("a", "r"),
  M("e", "r"),
  M("i", "r"),
  M("a", "l"),
  M("e", "s"),
  M("i", "s"),
  M("a", "s"),
  M("m", "e"),
  M("d", "o"),
  M("d", "a"),
  M("z", "a"),
  M("ó", "n"),
  M("i", "ó"),
  // Second-order clusters built from the above
  M("ci", "ó"),      // "ci" + "ó"
  M("ció", "n"),     // → "ción"
  M("i", "za"),      // → "iza"
  M("k", "en"),      // "k" + "en" → "ken"
  M("to", "ken"),    // → "token" (applies once "ken" exists — rank only breaks ties)
  M("me", "n"),      // → "men"
  M("men", "te"),    // → "mente"
  M("an", "do"),     // → "ando"
  M("i", "en"),      // → "ien"
  M("ien", "do"),    // → "iendo"
  M("a", "do"),      // → "ado"
  M("a", "da"),      // → "ada"
  M("er", "es"),     // → "eres"
  M("al", "es"),     // → "ales"
  M("ar", "es"),     // → "ares"
  M("in", "ter"),
  M("t", "er"),      // "ter"
  M("es", "t"),      // "est"
  M("est", "a"),     // "esta"
  M("o", "s"),       // "os"
];

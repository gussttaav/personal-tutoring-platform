/*
 * COURSE-C2-P1-01 — Byte-level BPE, trained, for `bpe-merges` (llm-agents Block 1
 * lesson 2, «BPE de verdad»).
 *
 * A TypeScript port of `public/courses/llm-agents/bpe.py`, the tokeniser the mini-GPT was
 * trained with and the file the lesson's cells exec. Same three decisions, so that what
 * the widget shows on its small corpus is what the lesson's code does on the big one:
 *
 *   - the base vocabulary is the 256 BYTES of UTF-8, not the characters — so `ñ` starts
 *     as two tokens (C3 B1), and a merge is what makes it one;
 *   - a merge never crosses a PRE-TOKEN: the text is first cut by `PRETOKEN_RE` (a word
 *     with its leading space, a number, a run of signs, whitespace), exactly as
 *     `bpe.py`'s `PATRON` cuts it;
 *   - ties go to the smallest pair: highest frequency, then smallest left id, then
 *     smallest right id — `max(..., key=(f, -a, -b))` in the Python.
 *
 * `__tests__/bpe-merges.test.ts` holds the port to that: trained on the course corpus it
 * must reproduce `bpe-merges.json` merge for merge.
 *
 * Why not `bpe-vocab.ts`: that file is a hand-authored list of CHARACTER merges for the
 * first course's playground, with string pairs and no training. Nothing in it fits a byte
 * vocabulary, so this module shares only the idea (an ordered merge list = the rules).
 *
 * The trainer recounts every pair at every step, like the lesson's formal statement.
 * `bpe.py` recounts only where the merged pair was, for speed; the two produce the same
 * merges, and on a widget corpus of a few hundred bytes the difference is invisible.
 */

/** The base vocabulary: every byte value. Merge `i` (from zero) creates token 256 + i. */
export const N_BYTES = 256;

/*
 * `bpe.py`'s PATRON, `r" ?[^\W\d_]+| ?\d+| ?(?:[^\w\s]|_)+|\s+(?!\S)|\s+"`, in JS classes.
 * Python's `\w` on str is letters + numerics + `_`, and `\d` is the decimal digits (Nd),
 * so `[^\W\d_]` is letters plus the non-decimal numerics (Nl, No), and the run of signs
 * is anything that is neither alphanumeric nor whitespace — `_` included, which is the
 * P1-01 fix to bpe.py. Order of the alternatives is the same, and both engines take the
 * first one that matches.
 */
const PRETOKEN_SOURCE = String.raw` ?[\p{L}\p{Nl}\p{No}]+| ?\p{Nd}+| ?[^\p{L}\p{N}\s]+|\s+(?!\S)|\s+`;

/** Cut a text into pre-tokens. A merge never joins two of them. */
export function pretokens(text: string): string[] {
  return text.match(new RegExp(PRETOKEN_SOURCE, "gu")) ?? [];
}

const encoder = new TextEncoder();

/** UTF-8 bytes of a string, as plain numbers (the token ids of an unmerged text). */
export function utf8(text: string): number[] {
  return Array.from(encoder.encode(text));
}

export type Pair = readonly [number, number];

/** Pair → map key. Ids stay far below 65 536 for any merge count this module meets. */
const key = (a: number, b: number) => a * 65536 + b;
const unkey = (k: number): Pair => [Math.floor(k / 65536), k % 65536];

/**
 * Replace every occurrence of `pair` in `ids` by `id`, left to right, without overlap —
 * `fusionar` in the Python. `[a, a, a]` merged on `(a, a)` is `[id, a]`, never `[a, id]`.
 */
export function mergePair(ids: readonly number[], pair: Pair, id: number): number[] {
  const out: number[] = [];
  let i = 0;
  while (i < ids.length) {
    if (i + 1 < ids.length && ids[i] === pair[0] && ids[i + 1] === pair[1]) {
      out.push(id);
      i += 2;
    } else {
      out.push(ids[i]);
      i += 1;
    }
  }
  return out;
}

export interface PairCount {
  pair: Pair;
  /** How many times the pair occurs, inside pre-tokens, under the current segmentation. */
  freq: number;
}

export interface MergeStep {
  /** The two tokens glued, in order. */
  pair: Pair;
  /** The token the merge creates: `N_BYTES + index`. */
  id: number;
  /** f(a, b) at the moment of merging — what the lesson calls the pair's frequency. */
  freq: number;
  /** The best pairs at that moment, winner first (at most `CANDIDATES`). */
  candidates: PairCount[];
}

export interface BpeTraining {
  merges: MergeStep[];
  /** Why training stopped: the cap was reached, or no pair reached `minFreq`. */
  stop: "max-merges" | "min-freq";
}

/** How many runner-up pairs each step records for display. */
export const CANDIDATES = 3;

/*
 * The explorable's own run: merge while some pair still occurs twice (a pair seen once is
 * the corpus memorising itself, not a regularity), capped so the slider stays usable if a
 * reader's corpus never runs dry. The default corpora stop on the frequency, well under
 * the cap — asserted in corpora.test.ts.
 */
export const BPE_WIDGET_MAX_MERGES = 40;
export const BPE_WIDGET_MIN_FREQ = 2;

/** Highest frequency first; then the smaller left id; then the smaller right id. */
function better(keyA: number, freqA: number, keyB: number, freqB: number): boolean {
  if (freqA !== freqB) return freqA > freqB;
  // A key orders by left id, then right id — exactly bpe.py's `(f, -a, -b)` tie-break.
  return keyA < keyB;
}

/**
 * Learn up to `maxMerges` merges on `text`. Stops early when the most frequent pair
 * occurs fewer than `minFreq` times (bpe.py's `entrenar` is `minFreq = 1`: it merges
 * while any pair exists). Every step recounts every pair — the algorithm as stated.
 */
export function trainBpe(text: string, maxMerges: number, minFreq = 1): BpeTraining {
  const counts = new Map<string, number>();
  for (const w of pretokens(text)) counts.set(w, (counts.get(w) ?? 0) + 1);
  const words = [...counts.keys()];
  const weight = words.map((w) => counts.get(w)!);
  let pieces = words.map((w) => utf8(w));

  const merges: MergeStep[] = [];
  for (let i = 0; i < maxMerges; i++) {
    const f = new Map<number, number>();
    pieces.forEach((ids, wi) => {
      for (let j = 0; j + 1 < ids.length; j++) {
        const k = key(ids[j], ids[j + 1]);
        f.set(k, (f.get(k) ?? 0) + weight[wi]);
      }
    });

    // The top CANDIDATES pairs, in the trainer's own order, in one pass.
    const top: [number, number][] = [];
    for (const [k, n] of f) {
      let at = top.length;
      while (at > 0 && better(k, n, top[at - 1][0], top[at - 1][1])) at--;
      if (at < CANDIDATES) {
        top.splice(at, 0, [k, n]);
        if (top.length > CANDIDATES) top.pop();
      }
    }
    if (top.length === 0 || top[0][1] < minFreq) {
      return { merges, stop: "min-freq" };
    }

    const pair = unkey(top[0][0]);
    const id = N_BYTES + i;
    merges.push({
      pair,
      id,
      freq: top[0][1],
      candidates: top.map(([k, n]) => ({ pair: unkey(k), freq: n })),
    });
    pieces = pieces.map((ids) => mergePair(ids, pair, id));
  }
  return { merges, stop: "max-merges" };
}

/**
 * Text → token ids with the first merges of a list, applied in the order they were
 * learned (lowest rank first), per pre-token — `codificar` in the Python. NOT by the
 * pair frequencies of the new text: the merge list is the whole rule.
 */
export function encode(text: string, merges: readonly Pick<MergeStep, "pair" | "id">[]): number[] {
  const rank = new Map<number, number>();
  merges.forEach((m, r) => {
    const k = key(m.pair[0], m.pair[1]);
    if (!rank.has(k)) rank.set(k, r);
  });
  const out: number[] = [];
  for (const w of pretokens(text)) {
    let ids = utf8(w);
    for (;;) {
      let best = -1;
      let bestRank = Infinity;
      for (let j = 0; j + 1 < ids.length; j++) {
        const r = rank.get(key(ids[j], ids[j + 1]));
        if (r !== undefined && r < bestRank) {
          bestRank = r;
          best = j;
        }
      }
      if (best === -1) break;
      ids = mergePair(ids, [ids[best], ids[best + 1]], merges[bestRank].id);
    }
    out.push(...ids);
  }
  return out;
}

/** Token id → its bytes, for the 256 bytes and every merge in the list. */
export function vocabulary(merges: readonly Pick<MergeStep, "pair" | "id">[]): number[][] {
  const vocab: number[][] = Array.from({ length: N_BYTES }, (_, b) => [b]);
  for (const m of merges) vocab[m.id] = [...vocab[m.pair[0]], ...vocab[m.pair[1]]];
  return vocab;
}

const strict = new TextDecoder("utf-8", { fatal: true });

export interface TokenLabel {
  /** What to print: the text when the bytes are valid UTF-8, else their hex, `C3 B1`. */
  text: string;
  /** False when the token is not text on its own: part of a character (a byte of `ñ`). */
  valid: boolean;
}

/** How a token reads: its text, or — for a piece of a character — its bytes in hex. */
export function tokenLabel(bytes: readonly number[]): TokenLabel {
  try {
    return { text: strict.decode(new Uint8Array(bytes)), valid: true };
  } catch {
    return {
      text: bytes.map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" "),
      valid: false,
    };
  }
}

/** Bytes → text, the way `decodificar` does: a stray byte becomes U+FFFD. */
export function decode(ids: readonly number[], vocab: readonly number[][]): string {
  return new TextDecoder("utf-8").decode(new Uint8Array(ids.flatMap((id) => vocab[id])));
}

/** The first course's ℓ̄, in bytes: how many bytes of text one token carries on average. */
export function meanBytesPerToken(text: string, tokens: number): number {
  return tokens === 0 ? 0 : utf8(text).length / tokens;
}

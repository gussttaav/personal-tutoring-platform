/*
 * COURSE-P5-05 — `self-attention-heatmap`: the token-to-token attention matrix of one
 * Spanish sentence (Block 5 lessons 2 and 7). Pure and DOM-free, like every other
 * widget's numbers, so the two claims the lesson rests on can be unit-tested: every row
 * of the map sums to 1, and WITHOUT the three projections the map is a near-identity —
 * its scores are symmetric and every row peaks on its own diagonal.
 *
 * WHERE THE NUMBERS COME FROM, said plainly because the widget says it too. A trained
 * Transformer does not fit in a widget, so the vectors and the projections here are
 * MINE, hand-set for the course. Each entry of the lexicon is a vector of seven
 * grammatical features, scaled to length 1; the query and key projections are four
 * rank-1 rules chosen so the map shows something a Spanish speaker can check:
 *
 *   1. a verb looks for nouns,
 *   2. number agreement — plural pulls plural, and a mismatch PUSHES AWAY,
 *   3. a noun looks at its determiner and its modifiers,
 *   4. a determiner or a modifier looks at nouns.
 *
 * Rule 2 is the one worth the trouble: in «las llaves del coche están ahí» it is what
 * makes «están» reach past the nearer «coche» to «llaves». That is a real property of
 * Spanish and a real thing a trained model learns; here it is in the projections
 * because I put it there, and the lesson says so.
 *
 * Building W^Q and W^K out of rank-1 rules is not decoration either. A score is
 * x_iᵀ W^Q (W^K)ᵀ x_j, so writing the columns of the two matrices as the two sides of
 * each rule makes that product exactly Σ_r (x_i·u_r)(x_j·w_r) — the rules ARE the
 * matrices, and d_k = 4 because there are four of them.
 *
 * A token outside the lexicon gets a deterministic direction derived from its own
 * characters. That keeps every vector unit-length (which is what makes the identity
 * claim above exact rather than approximate) and keeps the widget honest: the map for a
 * word I never chose a vector for means nothing, and the component flags it.
 *
 * COURSE-P11-08 — an English lexicon beside the Spanish one (`LEXICONS.en`), for the
 * English Block 5 lesson 2. Same seven features, same four rules, same projections: only
 * the words and their feature values move, so every claim above holds unchanged. English
 * marks number on fewer words, and the lexicon says so rather than inventing marks it
 * does not have: `the`, `my` and the adjectives carry number 0, and only the present
 * tense of a verb is singular or plural. Rule 2 still has what it needs in "the keys to
 * this car are here" — `are` and `keys` plural, `this` and `car` singular — and the
 * sentence repeats no vector (no second `the`), so the unprojected diagonal wins every
 * row STRICTLY, as it does in Spanish. Every function takes the locale last and
 * defaults to `es`, which is why `multi-head` (still Spanish-only) did not change.
 */

import { scaledDotProductAttention } from "./attention";
import { matmul, type Matrix } from "./linalg";
import { tokenizeWords } from "./tokenisation";

/** The seven coordinates of a lexicon vector, in order. */
export const FEATURES = [
  "determinante",
  "sustantivo",
  "verbo",
  "modificador",
  "enlace",
  "número",
  "animado",
] as const;

const DET = 0;
const SUST = 1;
const VERB = 2;
const MOD = 3;
const ENL = 4;
const NUM = 5;
const ANIM = 6;

export const D_MODEL = FEATURES.length;
/** One coordinate per rule below. */
export const D_K = 4;
export const D_V = 5;

/**
 * Ten positions is where a T×T grid stops fitting a phone: at the component's minimum
 * cell it already scrolls sideways inside its own box, and past that the labels shrink
 * below reading size. Longer input is cut, and the component says it was.
 */
export const MAX_TOKENS = 10;

/**
 * A group of entries sharing a feature slot, a number (+1 plural, −1 singular, 0
 * neither) and an animacy flag. Written this way because the alternative — one literal
 * vector per word — is forty rows of seven numbers nobody can proofread.
 */
type Group = [words: string[], slots: number[], number: number, animate: number];

const GROUPS_ES: Group[] = [
  // Determinantes.
  [["el", "la", "un", "una", "mi", "su", "este", "esta"], [DET], -1, 0],
  [["los", "las", "unos", "unas", "mis", "sus", "estos", "estas"], [DET], 1, 0],
  // «del» y «al» son contracciones: determinante y enlace a la vez.
  [["del", "al"], [DET, ENL], -1, 0],
  // Enlaces.
  [["de", "en", "con", "a", "por", "para", "sin", "sobre", "y", "que"], [ENL], 0, 0],
  // Sustantivos.
  [["llave", "mesa", "casa", "ciudad", "coche", "libro", "leche", "agua"], [SUST], -1, 0],
  [["gato", "perro", "niño", "niña", "ratón", "vecino", "vecina"], [SUST], -1, 1],
  [["llaves", "mesas", "casas", "ciudades", "coches", "libros"], [SUST], 1, 0],
  [["gatos", "perros", "niños", "niñas", "ratones", "vecinos", "vecinas"], [SUST], 1, 1],
  // Verbos.
  [["está", "come", "duerme", "persigue", "lee", "vive", "es", "muerde"], [VERB], -1, 0],
  [["están", "comen", "duermen", "persiguen", "leen", "viven", "son", "muerden"], [VERB], 1, 0],
  // Modificadores con número.
  [["rojo", "roja", "nuevo", "nueva", "viejo", "vieja"], [MOD], -1, 0],
  [["bueno", "buena", "pequeño", "pequeña", "negro", "negra"], [MOD], -1, 0],
  [["rojos", "rojas", "nuevos", "nuevas", "viejos", "viejas"], [MOD], 1, 0],
  [["buenos", "buenas", "pequeños", "pequeñas", "negros", "negras"], [MOD], 1, 0],
  // Modificadores invariables, adverbios incluidos.
  [["grande", "grandes", "azul", "azules", "muy", "mucho", "poco"], [MOD], 0, 0],
  [["ahí", "aquí", "hoy", "ayer", "siempre", "nunca"], [MOD], 0, 0],
];

/** COURSE-P11-08 — the English lexicon. Same slots, English number marking. */
const GROUPS_EN: Group[] = [
  // Determiners: most carry no number in English; a few are singular or plural.
  [["the", "my", "your", "his", "her", "its", "our", "their"], [DET], 0, 0],
  [["a", "an", "this", "that", "every", "each"], [DET], -1, 0],
  [["these", "those", "many", "several"], [DET], 1, 0],
  // Links: prepositions, conjunctions and relative pronouns.
  [["of", "to", "in", "on", "at", "with", "by", "for", "from", "and", "who", "which"], [ENL], 0, 0],
  // Nouns.
  [["key", "table", "house", "city", "car", "book", "door", "box", "milk", "water"], [SUST], -1, 0],
  [["cat", "dog", "child", "boy", "girl", "mouse", "neighbour", "postman"], [SUST], -1, 1],
  [["keys", "tables", "houses", "cities", "cars", "books", "doors", "boxes"], [SUST], 1, 0],
  [["cats", "dogs", "children", "boys", "girls", "mice", "neighbours", "postmen"], [SUST], 1, 1],
  // Verbs: English marks number in the present tense only.
  [["is", "sleeps", "eats", "chases", "reads", "lives", "bites", "has"], [VERB], -1, 0],
  [["are", "sleep", "eat", "chase", "read", "live", "bite", "have"], [VERB], 1, 0],
  // Modifiers: adjectives and adverbs carry no number in English.
  [["red", "new", "old", "good", "small", "big", "black", "blue", "very", "little", "much"], [MOD], 0, 0],
  [["here", "there", "today", "yesterday", "always", "never"], [MOD], 0, 0],
];

/** The locales this widget has a lexicon for; anything else falls back to `es`. */
export type LexiconLocale = "es" | "en";

export const lexiconLocale = (locale: string): LexiconLocale => (locale === "en" ? "en" : "es");

const GROUPS_BY_LOCALE: Record<LexiconLocale, Group[]> = { es: GROUPS_ES, en: GROUPS_EN };

/** Scale a vector to length 1. Every vector in this module is unit-length — see the header. */
function unit(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((acc, x) => acc + x * x, 0));
  return norm === 0 ? v.map(() => 0) : v.map((x) => x / norm);
}

/** One lexicon: one unit-length vector per entry. */
const buildLexicon = (groups: Group[]): Record<string, number[]> =>
  Object.fromEntries(
    groups.flatMap(([words, slots, number, animate]) =>
      words.map((word) => {
        const vector = new Array<number>(D_MODEL).fill(0);
        for (const s of slots) vector[s] = 1;
        vector[NUM] = number;
        vector[ANIM] = animate;
        return [word, unit(vector)] as const;
      }),
    ),
  );

export const LEXICONS: Record<LexiconLocale, Record<string, number[]>> = {
  es: buildLexicon(GROUPS_BY_LOCALE.es),
  en: buildLexicon(GROUPS_BY_LOCALE.en),
};

/** The Spanish lexicon, which `multi-head` reads. */
export const LEXICON = LEXICONS.es;

/** Everything a lexicon knows — the component tells the reader how many there are. */
export const lexiconWords = (locale: LexiconLocale = "es"): string[] =>
  Object.keys(LEXICONS[locale]).sort((a, b) => a.localeCompare(b, locale));

export const LEXICON_WORDS: string[] = lexiconWords("es");

/** Sentences that stay inside the lexicon. The first is the heatmap's default; the
 *  multi-head view's tests sweep all of them (MH_PRESETS). */
export const PRESETS = [
  "las llaves del coche están ahí",
  "el gato duerme y los perros comen",
  "la vecina que lee duerme poco",
] as const;

/** COURSE-P11-08 — the English presets, inside `LEXICONS.en`. The first is the default. */
export const PRESETS_EN = [
  "the keys to this car are here",
  "the cat sleeps and the dogs eat",
  "the neighbour who reads sleeps little",
] as const;

export const PRESETS_BY_LOCALE: Record<LexiconLocale, readonly string[]> = {
  es: PRESETS,
  en: PRESETS_EN,
};

/** The row the heatmap opens on: the verb of the default sentence, «están» / `are`. */
export const FOCUS_ROW: Record<LexiconLocale, number> = { es: 4, en: 5 };

/**
 * The four rules, as the columns of W^Q and W^K. `query` is what the asking position is
 * measured on, `key` is what the asked position offers; the rule's weight rides on the
 * query side only, because what reaches the score is the product of the two.
 */
interface Rule {
  name: string;
  query: number[];
  key: number[];
}

/** A vector with `weight` in the named slots and zero everywhere else. */
const slots = (weight: number, ...which: number[]): number[] => {
  const v = new Array<number>(D_MODEL).fill(0);
  for (const s of which) v[s] = weight;
  return v;
};

export const RULES: Rule[] = [
  {
    name: "un verbo busca sustantivos",
    query: slots(3.6, VERB),
    key: slots(1, SUST),
  },
  {
    name: "concordancia de número",
    query: slots(4.2, NUM),
    key: slots(1, NUM),
  },
  {
    name: "un sustantivo mira su determinante y sus modificadores",
    query: slots(2.6, SUST),
    key: slots(1, DET, MOD),
  },
  {
    name: "un determinante o un modificador mira los sustantivos",
    query: slots(2.6, DET, MOD),
    key: slots(1, SUST),
  },
];

/** Column r of each matrix is rule r's side of the product. Shape (d_model × d_k). */
const ruleColumns = (side: "query" | "key"): Matrix =>
  Array.from({ length: D_MODEL }, (_, f) => RULES.map((rule) => rule[side][f]));

export const W_Q: Matrix = ruleColumns("query");
export const W_K: Matrix = ruleColumns("key");

/**
 * W^V, shape (d_model × d_v). Hand-set like everything else here, and deliberately not
 * a permutation of the features: what a value carries is a mix, which is the point of
 * the value being a projection at all rather than the vector itself.
 */
export const W_V: Matrix = [
  [0.9, -0.2, 0.1, 0.4, 0.0], // determinante
  [0.2, 0.8, -0.3, 0.1, 0.5], // sustantivo
  [-0.4, 0.3, 0.9, -0.2, 0.1], // verbo
  [0.1, -0.5, 0.2, 0.8, -0.3], // modificador
  [0.5, 0.1, -0.4, -0.3, 0.2], // enlace
  [-0.2, 0.6, 0.3, 0.2, -0.7], // número
  [0.3, 0.2, -0.1, -0.6, 0.8], // animado
];

/**
 * A direction for a token the lexicon does not have. FNV-1a per coordinate, so it is a
 * pure function of the string — the same unknown word always draws the same map — and
 * the result is unit-length like every entry of the lexicon.
 */
export function unknownVector(token: string): number[] {
  const coords = Array.from({ length: D_MODEL }, (_, k) => {
    let hash = 0x811c9dc5;
    for (const ch of `${token}#${k}`) {
      hash ^= ch.codePointAt(0) ?? 0;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return (hash % 2001) / 1000 - 1; // (−1, 1)
  });
  // A hash can land on the zero vector; point it somewhere rather than divide by zero.
  return unit(coords.some((x) => x !== 0) ? coords : coords.map((_, k) => (k === 0 ? 1 : 0)));
}

export interface TokenisedSentence {
  tokens: string[];
  /** Is the token in the lexicon? A `false` means its vector means nothing. */
  known: boolean[];
  /** Did the sentence run past `MAX_TOKENS`? */
  truncated: boolean;
}

/**
 * Lowercase, cut into tokens by Block 1's own tokeniser, drop punctuation (a comma has
 * no features here) and stop at `MAX_TOKENS`.
 */
export function tokeniseSentence(text: string, locale: LexiconLocale = "es"): TokenisedSentence {
  const all = tokenizeWords(text.toLocaleLowerCase(locale)).filter((token) =>
    /[\p{L}\p{N}]/u.test(token),
  );
  const tokens = all.slice(0, MAX_TOKENS);
  return {
    tokens,
    known: tokens.map((token) => token in LEXICONS[locale]),
    truncated: all.length > tokens.length,
  };
}

/** The rows of X: one unit-length vector per token, from the lexicon or from the hash. */
export function embedTokens(tokens: string[], locale: LexiconLocale = "es"): Matrix {
  return tokens.map((token) => LEXICONS[locale][token] ?? unknownVector(token));
}

export interface SelfAttentionMap extends TokenisedSentence {
  /** X, shape (T × d_model) — row t is the vector of token t. */
  x: Matrix;
  /** Q·Kᵀ/√dₖ, shape (T × T). */
  scores: Matrix;
  /** The map itself, shape (T × T). Every row sums to 1. */
  weights: Matrix;
  /** The output: (T × d_v) with the projections, (T × d_model) without them. */
  output: Matrix;
}

/**
 * Self-attention over one sentence: the three lists are three readings of the SAME X.
 *
 * With `project: false` the three readings collapse into X itself — Q = K = V = X —
 * which is the ablation Block 5 lesson 2 argues from: the scores are then symmetric and
 * each row's maximum is its own diagonal, so the layer hands every position back
 * roughly what it already had.
 *
 * With `causal: true` the map is the decoder's, of Block 5 lesson 7: position i sees
 * 1..i and nothing after, the first row has nowhere to look but itself, and every row
 * still sums to 1 because the mask goes in before the softmax and not after it.
 */
export function selfAttentionMap(
  text: string,
  project = true,
  causal = false,
  locale: LexiconLocale = "es",
): SelfAttentionMap {
  const { tokens, known, truncated } = tokeniseSentence(text, locale);
  const x = embedTokens(tokens, locale);
  if (tokens.length === 0) {
    return { tokens, known, truncated, x, scores: [], weights: [], output: [] };
  }

  const q = project ? matmul(x, W_Q) : x;
  const k = project ? matmul(x, W_K) : x;
  const v = project ? matmul(x, W_V) : x;
  const { scores, weights, output } = scaledDotProductAttention(q, k, v, causal);
  return { tokens, known, truncated, x, scores, weights, output };
}

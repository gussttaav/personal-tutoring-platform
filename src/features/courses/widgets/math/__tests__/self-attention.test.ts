/*
 * COURSE-P5-05 — self-attention tests: the two claims Block 5 lesson 2 rests on, checked
 * independently of the code that draws them.
 *
 * 1. Every row of the map is a distribution. A row summing to 0.97 looks exactly like a
 *    row summing to 1, so this is the invariant a heat map cannot show and the block's
 *    acceptance criteria name explicitly.
 * 2. Without the three projections the layer is a near-identity: the scores are
 *    symmetric (x_iᵀx_j = x_jᵀx_i) and every row's maximum sits on its own diagonal,
 *    because every vector here has length 1 and Cauchy–Schwarz then bounds every other
 *    entry of the row by that diagonal. With the projections in, both properties break —
 *    which is the whole reason the projections exist.
 *
 * The weights are also recomputed here from W_Q, W_K and the lexicon by an independent
 * route — explicit loops, no matmul, no shared helper — so a bug inside `matmul` or the
 * kernel cannot pass both implementations at once.
 */

import {
  D_K,
  D_MODEL,
  D_V,
  LEXICON,
  LEXICON_WORDS,
  MAX_TOKENS,
  PRESETS,
  RULES,
  W_K,
  W_Q,
  embedTokens,
  selfAttentionMap,
  tokeniseSentence,
  unknownVector,
} from "../self-attention";

const FLAGSHIP = PRESETS[0]; // «las llaves del coche están ahí»

/** Sum of a row, for the distribution checks. */
const total = (row: number[]) => row.reduce((acc, w) => acc + w, 0);

/** Length of a vector — every vector in this module must be 1. */
const norm = (v: number[]) => Math.sqrt(v.reduce((acc, x) => acc + x * x, 0));

describe("the lexicon and the projections", () => {
  it("gives every entry a unit-length vector of d_model coordinates", () => {
    expect(LEXICON_WORDS.length).toBeGreaterThan(40);
    for (const word of LEXICON_WORDS) {
      expect(LEXICON[word]).toHaveLength(D_MODEL);
      expect(norm(LEXICON[word])).toBeCloseTo(1, 12);
    }
  });

  it("gives an unknown token a unit-length vector too, and the same one every time", () => {
    const v = unknownVector("criptomoneda");
    expect(v).toHaveLength(D_MODEL);
    expect(norm(v)).toBeCloseTo(1, 12);
    expect(unknownVector("criptomoneda")).toEqual(v);
    expect(unknownVector("criptomonedas")).not.toEqual(v);
  });

  it("shapes W^Q and W^K as one column per rule", () => {
    expect(RULES).toHaveLength(D_K);
    for (const w of [W_Q, W_K]) {
      expect(w).toHaveLength(D_MODEL);
      for (const row of w) expect(row).toHaveLength(D_K);
    }
  });

  it("separates number agreement from mismatch, which is what rule 2 is for", () => {
    // The rule reads the `número` coordinate on both sides, so its contribution to the
    // score is positive between two plurals and negative between a plural and a singular.
    const [q] = [LEXICON["están"]];
    const agree = q.map((x, f) => x * W_Q[f][1]).reduce((a, b) => a + b, 0);
    const plural = LEXICON["llaves"].map((x, f) => x * W_K[f][1]).reduce((a, b) => a + b, 0);
    const singular = LEXICON["coche"].map((x, f) => x * W_K[f][1]).reduce((a, b) => a + b, 0);
    expect(agree * plural).toBeGreaterThan(0);
    expect(agree * singular).toBeLessThan(0);
  });
});

describe("tokeniseSentence", () => {
  it("lowercases, drops punctuation and flags what the lexicon does not have", () => {
    const { tokens, known, truncated } = tokeniseSentence("¡El GATO duerme, siempre!");
    expect(tokens).toEqual(["el", "gato", "duerme", "siempre"]);
    expect(known).toEqual([true, true, true, true]);
    expect(truncated).toBe(false);
  });

  it("marks a token outside the lexicon without dropping it", () => {
    const { tokens, known } = tokeniseSentence("el zorullo duerme");
    expect(tokens).toEqual(["el", "zorullo", "duerme"]);
    expect(known).toEqual([true, false, true]);
    expect(embedTokens(tokens)[1]).toEqual(unknownVector("zorullo"));
  });

  it("stops at MAX_TOKENS and says it did", () => {
    const long = tokeniseSentence(new Array(MAX_TOKENS + 4).fill("gato").join(" "));
    expect(long.tokens).toHaveLength(MAX_TOKENS);
    expect(long.truncated).toBe(true);
  });
});

describe("selfAttentionMap", () => {
  it("returns a square map and an output of one row per position", () => {
    const map = selfAttentionMap(FLAGSHIP);
    const t = map.tokens.length;
    expect(t).toBe(6);
    expect(map.x).toHaveLength(t);
    expect(map.x[0]).toHaveLength(D_MODEL);
    expect(map.weights).toHaveLength(t);
    for (const row of map.weights) expect(row).toHaveLength(t);
    expect(map.output).toHaveLength(t);
    expect(map.output[0]).toHaveLength(D_V);
  });

  it("gives every row of every preset a distribution summing to 1", () => {
    for (const preset of PRESETS) {
      for (const project of [true, false]) {
        const { weights } = selfAttentionMap(preset, project);
        for (const row of weights) {
          expect(total(row)).toBeCloseTo(1, 12);
          for (const w of row) expect(w).toBeGreaterThan(0);
        }
      }
    }
  });

  it("mixes: every output coordinate lies between the smallest and largest value", () => {
    // A convex combination cannot leave the range of what it combines. It is the
    // property that makes the output a MIXTURE rather than a sum.
    const { weights, output, x } = selfAttentionMap(FLAGSHIP, false);
    output.forEach((out, i) => {
      out.forEach((coordinate, c) => {
        const column = x.map((row) => row[c]);
        expect(coordinate).toBeGreaterThanOrEqual(Math.min(...column) - 1e-12);
        expect(coordinate).toBeLessThanOrEqual(Math.max(...column) + 1e-12);
      });
      expect(total(weights[i])).toBeCloseTo(1, 12);
    });
  });

  it("without the projections, the scores are symmetric and the diagonal wins its row", () => {
    for (const preset of PRESETS) {
      const { scores, weights, x } = selfAttentionMap(preset, false);
      const sameVector = (i: number, j: number) => x[i].every((coord, f) => coord === x[j][f]);
      scores.forEach((row, i) =>
        row.forEach((s, j) => {
          expect(s).toBeCloseTo(scores[j][i], 12);
          // Unit-length vectors: x_iᵀx_j ≤ 1 = x_iᵀx_i, and the equality needs the same
          // direction — which two positions can genuinely have («el» and «la» share a
          // vector, this lexicon carrying no gender), so the strict case is guarded.
          expect(s).toBeLessThanOrEqual(scores[i][i] + 1e-12);
          if (!sameVector(i, j)) expect(weights[i][j]).toBeLessThan(weights[i][i]);
        }),
      );
    }
  });

  it("with the projections, neither property survives", () => {
    const { scores, weights, tokens } = selfAttentionMap(FLAGSHIP);
    const asymmetric = scores.some((row, i) => row.some((s, j) => Math.abs(s - scores[j][i]) > 1e-6));
    expect(asymmetric).toBe(true);
    // «están» leans on «llaves», four positions away, and not on itself.
    const verb = tokens.indexOf("están");
    const subject = tokens.indexOf("llaves");
    const distractor = tokens.indexOf("coche");
    expect(weights[verb][subject]).toBeGreaterThan(weights[verb][verb]);
    expect(weights[verb][subject]).toBeGreaterThan(weights[verb][distractor]);
  });

  it("matches an independent recomputation of softmax(QKᵀ/√d_k) by hand", () => {
    const { tokens, weights } = selfAttentionMap(FLAGSHIP);
    const x = embedTokens(tokens);
    const project = (v: number[], w: number[][]) =>
      Array.from({ length: D_K }, (_, r) => v.reduce((acc, coord, f) => acc + coord * w[f][r], 0));

    const expected = x.map((xi) => {
      const q = project(xi, W_Q);
      const raw = x.map((xj) => {
        const k = project(xj, W_K);
        return q.reduce((acc, qr, r) => acc + qr * k[r], 0) / Math.sqrt(D_K);
      });
      const max = Math.max(...raw);
      const exps = raw.map((s) => Math.exp(s - max));
      const sum = exps.reduce((a, b) => a + b, 0);
      return exps.map((e) => e / sum);
    });

    weights.forEach((row, i) => row.forEach((w, j) => expect(w).toBeCloseTo(expected[i][j], 12)));
  });

  it("returns empty rather than throwing on an empty sentence", () => {
    const map = selfAttentionMap("   ¿?  ");
    expect(map.tokens).toEqual([]);
    expect(map.weights).toEqual([]);
    expect(map.output).toEqual([]);
    expect(map.truncated).toBe(false);
  });
});

/*
 * COURSE-P5-05 — the causal mask (Block 5 lesson 7). Three claims, and the third is the
 * one worth the file: masking then normalising is the SAME operation restricted, so a
 * masked row is the unmasked row's prefix divided by what that prefix summed to. That
 * gives an independent route to every masked number — computed from the unmasked map,
 * which the tests above already pin down — so a bug in the mask cannot pass both.
 */
describe("selfAttentionMap with the causal mask", () => {
  it("blanks the future exactly and still hands every row a distribution", () => {
    for (const preset of PRESETS) {
      const { weights } = selfAttentionMap(preset, true, true);
      weights.forEach((row, i) => {
        expect(total(row)).toBeCloseTo(1, 12);
        row.forEach((w, j) => {
          if (j > i) expect(w).toBe(0);
          else expect(w).toBeGreaterThan(0);
        });
      });
    }
  });

  it("leaves the first position with nowhere to look but itself", () => {
    const { weights } = selfAttentionMap(FLAGSHIP, true, true);
    expect(weights[0][0]).toBe(1);
    expect(weights[0].slice(1).every((w) => w === 0)).toBe(true);
  });

  it("equals the unmasked row's prefix renormalised", () => {
    for (const project of [true, false]) {
      const open = selfAttentionMap(FLAGSHIP, project).weights;
      const masked = selfAttentionMap(FLAGSHIP, project, true).weights;
      masked.forEach((row, i) => {
        const prefix = open[i].slice(0, i + 1);
        const kept = prefix.reduce((acc, w) => acc + w, 0);
        prefix.forEach((w, j) => expect(row[j]).toBeCloseTo(w / kept, 12));
      });
    }
  });

  it("keeps what a position reads independent of everything after it", () => {
    // The invariant the lesson turns on: cut the sentence short and the rows that
    // survive read exactly what they read in the long one.
    const long = selfAttentionMap("el gato duerme y los perros comen", true, true);
    const short = selfAttentionMap("el gato duerme y", true, true);
    expect(short.tokens).toEqual(long.tokens.slice(0, short.tokens.length));
    short.output.forEach((row, i) =>
      row.forEach((coordinate, c) => expect(coordinate).toBeCloseTo(long.output[i][c], 12)),
    );
  });

  it("does nothing to a one-token sentence, masked or not", () => {
    const { weights } = selfAttentionMap("gato", true, true);
    expect(weights).toEqual([[1]]);
  });
});

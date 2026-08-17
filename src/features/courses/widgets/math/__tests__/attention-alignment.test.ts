/*
 * COURSE-P5-04 — attention-alignment tests. Two independent ways, as the widget rules
 * require: exact hand cases first (a one-hot row, a uniform row, the frozen alignment —
 * each one a mixture whose answer is known without running the code), then the reference
 * values the lesson's prose, its code cell and the widget readout all quote.
 *
 * The row-stochastic assertions are the ones that earn their keep. A visualisation whose
 * rows sum to 0.97 is indistinguishable by eye from one that sums to 1, so nothing but a
 * test catches it — and every claim the lesson makes about c_i being a MIXTURE (rather
 * than an arbitrary linear combination) rests on that one invariant.
 */

import {
  ALIGNMENT_SOURCE,
  ALIGNMENT_TARGET,
  ATTENTION_ALIGNMENT,
  ENCODER_STATES,
  contextVectors,
  frozenAlignment,
  mixture,
  rowSums,
  topSource,
} from "../attention-alignment";

const T_X = ALIGNMENT_SOURCE.length; // 6
const T_Y = ALIGNMENT_TARGET.length; // 8
const D_H = ENCODER_STATES[0].length; // 5

const FROZEN = frozenAlignment(T_Y, T_X);

describe("the alignment matrices are legal attention weights", () => {
  it("has one row per output step and one column per source position", () => {
    expect(ATTENTION_ALIGNMENT).toHaveLength(T_Y);
    for (const row of ATTENTION_ALIGNMENT) expect(row).toHaveLength(T_X);
    expect(ENCODER_STATES).toHaveLength(T_X);
    for (const state of ENCODER_STATES) expect(state).toHaveLength(D_H);
  });

  it("sums every row to exactly 1 — both matrices", () => {
    for (const sum of rowSums(ATTENTION_ALIGNMENT)) expect(sum).toBeCloseTo(1, 12);
    for (const sum of rowSums(FROZEN)) expect(sum).toBeCloseTo(1, 12);
  });

  it("keeps every weight in [0, 1]", () => {
    for (const row of [...ATTENTION_ALIGNMENT, ...FROZEN]) {
      for (const w of row) {
        expect(w).toBeGreaterThanOrEqual(0);
        expect(w).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("the pair is not monotonic — which is why it teaches anything", () => {
  const peaks = ATTENTION_ALIGNMENT.map((row) => topSource(row).index);

  it("sends «i» and «read» to the same source token, «leí»", () => {
    const lei = ALIGNMENT_SOURCE.indexOf("leí");
    expect(peaks[ALIGNMENT_TARGET.indexOf("i")]).toBe(lei);
    expect(peaks[ALIGNMENT_TARGET.indexOf("read")]).toBe(lei);
  });

  it("crosses: «book» reaches back past «very good» to «libro»", () => {
    const very = ALIGNMENT_TARGET.indexOf("very");
    const good = ALIGNMENT_TARGET.indexOf("good");
    const book = ALIGNMENT_TARGET.indexOf("book");
    expect(peaks[very]).toBe(ALIGNMENT_SOURCE.indexOf("muy"));
    expect(peaks[good]).toBe(ALIGNMENT_SOURCE.indexOf("bueno"));
    expect(peaks[book]).toBe(ALIGNMENT_SOURCE.indexOf("libro"));
    // The peak goes backwards from «good» to «book»: a diagonal alignment cannot do this.
    expect(peaks[book]).toBeLessThan(peaks[good]);
  });

  it("leans on «libro» with the weight the lesson quotes", () => {
    const book = topSource(ATTENTION_ALIGNMENT[ALIGNMENT_TARGET.indexOf("book")]);
    expect(book.index).toBe(ALIGNMENT_SOURCE.indexOf("libro"));
    expect(book.weight).toBeCloseTo(0.76, 12);
  });

  it("rejects an empty row", () => {
    expect(() => topSource([])).toThrow(/empty weight row/);
  });
});

describe("mixture — the exact hand cases", () => {
  it("returns the state itself when the row is one-hot", () => {
    for (let j = 0; j < T_X; j++) {
      const oneHot = Array.from({ length: T_X }, (_, k) => (k === j ? 1 : 0));
      expect(mixture(oneHot, ENCODER_STATES)).toEqual(ENCODER_STATES[j]);
    }
  });

  it("returns the mean when the row is uniform", () => {
    const uniform = new Array(T_X).fill(1 / T_X);
    const got = mixture(uniform, ENCODER_STATES);
    for (let k = 0; k < D_H; k++) {
      const mean = ENCODER_STATES.reduce((acc, s) => acc + s[k], 0) / T_X;
      expect(got[k]).toBeCloseTo(mean, 12);
    }
  });

  it("is d_h long whatever the source length — the shape that lets c_i sit where c sat", () => {
    for (const length of [1, 2, 6]) {
      const states = ENCODER_STATES.slice(0, length);
      const weights = new Array(length).fill(1 / length);
      expect(mixture(weights, states)).toHaveLength(D_H);
    }
  });

  it("rejects mismatched shapes", () => {
    expect(() => mixture([1, 0], ENCODER_STATES)).toThrow(/2 weights against 6 states/);
    expect(() => mixture([1, 0], [[0.1, 0.2], [0.3]])).toThrow(/width 1, not 2/);
  });
});

describe("frozenAlignment — the fixed summary, written as attention", () => {
  it("puts all the mass on the last source position, at every step", () => {
    for (const row of FROZEN) {
      expect(topSource(row)).toEqual({ index: T_X - 1, weight: 1 });
    }
  });

  it("hands every output step the SAME vector, and it is the last encoder state", () => {
    const contexts = contextVectors(FROZEN, ENCODER_STATES);
    expect(contexts).toHaveLength(T_Y);
    for (const c of contexts) expect(c).toEqual(ENCODER_STATES[T_X - 1]);
  });

  it("rejects impossible lengths", () => {
    expect(() => frozenAlignment(0, 6)).toThrow(/T_y must be a positive integer/);
    expect(() => frozenAlignment(8, 2.5)).toThrow(/T_x must be a positive integer/);
  });
});

describe("contextVectors under attention — the widget's punchline", () => {
  const contexts = contextVectors(ATTENTION_ALIGNMENT, ENCODER_STATES);

  it("produces T_y DIFFERENT vectors, against the frozen alignment's one", () => {
    expect(contexts).toHaveLength(T_Y);
    const seen = new Set(contexts.map((c) => c.map((v) => v.toFixed(6)).join(",")));
    expect(seen.size).toBe(T_Y);
  });

  it("matches the value computed by hand for step 7, «book»", () => {
    // 0.02·h̄₁ + 0.03·h̄₂ + 0.06·h̄₃ + 0.76·h̄₄ + 0.05·h̄₅ + 0.08·h̄₆, worked out on paper.
    const expected = [0.3443, -0.4446, 0.3629, 0.588, 0.0033];
    const got = contexts[ALIGNMENT_TARGET.indexOf("book")];
    got.forEach((v, k) => expect(v).toBeCloseTo(expected[k], 9));
  });

  it("lands step 7 nearer «libro» than the frozen summary ever gets", () => {
    const libro = ENCODER_STATES[ALIGNMENT_SOURCE.indexOf("libro")];
    const dist = (u: number[], v: number[]) =>
      Math.sqrt(u.reduce((acc, x, k) => acc + (x - v[k]) ** 2, 0));
    const attended = dist(contexts[ALIGNMENT_TARGET.indexOf("book")], libro);
    const frozen = dist(ENCODER_STATES[T_X - 1], libro);
    expect(attended).toBeLessThan(frozen);
  });
});

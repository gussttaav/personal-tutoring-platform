/*
 * COURSE-P5-04 — context-bottleneck tests: the counting bound checked two independent
 * ways. Exact hand cases first, where q, |V_x| and d_h are powers of two and every
 * quantity is an integer known without the code; then the reference values the lesson's
 * prose and the widget readout quote at the default preset.
 */

import {
  codeOrders,
  sequenceOrders,
  maxExactLength,
  log10Ceiling,
  bottleneckCurves,
} from "../context-bottleneck";

// The widget's defaults, and the numbers the lesson quotes.
const DH = 256;
const Q = 8;
const VOCAB = 32768; // 2^15

describe("codeOrders / sequenceOrders", () => {
  it("counts codes as q^{d_h}, in orders of magnitude", () => {
    // 2^10 = 1024, three orders of magnitude and a hair.
    expect(codeOrders(10, 2)).toBeCloseTo(Math.log10(1024), 12);
    expect(codeOrders(1, 8)).toBeCloseTo(Math.log10(8), 12);
  });

  it("counts sequences as |V_x|^{T_x}, in orders of magnitude", () => {
    expect(sequenceOrders(0, VOCAB)).toBe(0); // one sequence: the empty one
    expect(sequenceOrders(3, 10)).toBeCloseTo(3, 12); // 1000 sequences
  });

  it("grows demand by exactly one log|V_x| per extra token", () => {
    for (let t = 1; t <= 20; t++) {
      const step = sequenceOrders(t, VOCAB) - sequenceOrders(t - 1, VOCAB);
      expect(step).toBeCloseTo(Math.log10(VOCAB), 12);
    }
  });

  it("rejects impossible parameters", () => {
    expect(() => codeOrders(0, 8)).toThrow(/positive integer/);
    expect(() => codeOrders(4.5, 8)).toThrow(/positive integer/);
    expect(() => codeOrders(8, 1)).toThrow(/at least 2 levels/);
    expect(() => sequenceOrders(3, 1)).toThrow(/at least 2/);
    expect(() => sequenceOrders(-1, 10)).toThrow(/non-negative integer/);
  });
});

describe("maxExactLength", () => {
  it("matches the exact power-of-two cases", () => {
    // q = 2, |V_x| = 2: one coordinate per token, so T* = d_h exactly.
    expect(maxExactLength(4, 2, 2)).toBe(4);
    expect(maxExactLength(256, 2, 2)).toBe(256);
    // q = 8, |V_x| = 4096: log q / log |V_x| = 3/12, so T* = d_h/4. The quiz's case.
    expect(maxExactLength(64, 8, 4096)).toBe(16);
    // q = 8, |V_x| = 2^15: ratio 3/15, so T* = 256/5 = 51,2 → 51.
    expect(maxExactLength(DH, Q, VOCAB)).toBe(51);
  });

  it("is linear in d_h — doubling the state doubles the length", () => {
    // Exactly double where the division is exact and the floor has nothing to absorb.
    for (const dh of [32, 64, 128, 256]) {
      expect(maxExactLength(2 * dh, 8, 4096)).toBe(2 * maxExactLength(dh, 8, 4096));
    }
    // And to within the floor's one token everywhere else: 32 → 6, 64 → 12, 128 → 25.
    for (const dh of [32, 64, 128, 256]) {
      const doubled = maxExactLength(2 * dh, Q, VOCAB);
      const single = maxExactLength(dh, Q, VOCAB);
      expect(doubled === 2 * single || doubled === 2 * single + 1).toBe(true);
    }
    expect(maxExactLength(32, Q, VOCAB)).toBe(6);
    expect(maxExactLength(64, Q, VOCAB)).toBe(12);
    expect(maxExactLength(128, Q, VOCAB)).toBe(25);
  });

  it("is the largest T with |V_x|^T ≤ q^{d_h}", () => {
    for (const [dh, q, v] of [
      [64, 8, 4096],
      [256, 8, 32768],
      [100, 5, 37],
      [7, 3, 2],
    ] as const) {
      const t = maxExactLength(dh, q, v);
      expect(sequenceOrders(t, v)).toBeLessThanOrEqual(codeOrders(dh, q) + 1e-9);
      expect(sequenceOrders(t + 1, v)).toBeGreaterThan(codeOrders(dh, q));
    }
  });
});

describe("log10Ceiling", () => {
  it("is a ceiling of 1 exactly while the sequences fit", () => {
    for (let t = 0; t <= maxExactLength(DH, Q, VOCAB); t++) {
      expect(log10Ceiling(t, DH, Q, VOCAB)).toBe(0);
    }
  });

  it("halves per token in the q = 2, |V_x| = 4 hand case", () => {
    // d_h = 4, q = 2: 16 codes. |V_x| = 4: 4^T sequences, so T* = 2 and the ceiling
    // is 1, then 1/4, then 1/16 — checked as plain fractions, not in logs.
    expect(maxExactLength(4, 2, 4)).toBe(2);
    expect(Math.pow(10, log10Ceiling(2, 4, 2, 4))).toBeCloseTo(1, 12);
    expect(Math.pow(10, log10Ceiling(3, 4, 2, 4))).toBeCloseTo(0.25, 12);
    expect(Math.pow(10, log10Ceiling(4, 4, 2, 4))).toBeCloseTo(0.0625, 12);
  });

  it("never exceeds 1 and never increases with the length", () => {
    let previous = 0;
    for (let t = 0; t <= 200; t++) {
      const c = log10Ceiling(t, DH, Q, VOCAB);
      expect(c).toBeLessThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(previous);
      previous = c;
    }
  });

  it("is ≈ 10⁻⁴⁴ ten tokens past the crossing — the figure the lesson quotes", () => {
    expect(log10Ceiling(61, DH, Q, VOCAB)).toBeCloseTo(-44.25, 2);
  });
});

describe("bottleneckCurves", () => {
  it("returns a flat capacity and a demand rising from the origin", () => {
    const { capacity, demand } = bottleneckCurves(DH, Q, VOCAB, 200);
    expect(capacity[0][1]).toBeCloseTo(capacity[1][1], 12);
    expect(capacity[0][1]).toBeCloseTo(codeOrders(DH, Q), 12);
    expect(demand[0]).toEqual([0, 0]);
    expect(demand[1][1]).toBeCloseTo(sequenceOrders(200, VOCAB), 12);
  });

  it("crosses where maxExactLength says, and the y range holds both lines", () => {
    const { crossing, yDomain } = bottleneckCurves(DH, Q, VOCAB, 200);
    expect(crossing).toBe(51);
    expect(yDomain[0]).toBe(0);
    expect(yDomain[1]).toBeGreaterThanOrEqual(sequenceOrders(200, VOCAB));
  });

  it("rejects a non-integer maximum length", () => {
    expect(() => bottleneckCurves(DH, Q, VOCAB, 12.5)).toThrow(/non-negative integer/);
  });
});

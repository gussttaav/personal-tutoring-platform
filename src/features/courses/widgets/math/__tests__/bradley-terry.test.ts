/*
 * COURSE-C2-P1-02 — `math/bradley-terry.ts`, checked two independent ways, as AUTHORING §7 asks
 * of a widget's maths:
 *
 *   1. HAND AND LIMIT CASES — equal rewards are a coin toss and cost ln 2; the probability is the
 *      softmax of the two rewards; a constant added to both changes nothing; the loss neither
 *      overflows nor turns NaN at margins of ±1000; the slope is the loss's derivative, checked
 *      against a finite difference.
 *   2. THE LESSON'S NUMBERS — three annotators in four is a margin of ln 3; two such margins in
 *      a row give 9/10; the quiz's two comparisons weigh σ(−4) ≈ 0.018 and σ(1) ≈ 0.731, some
 *      forty times apart.
 */

import {
  comparisonLoss,
  lossSlope,
  marginForProbability,
  negLogSigmoid,
  preferProbability,
  sampleCurve,
} from "../bradley-terry";

describe("bradley-terry — hand and limit cases", () => {
  it("makes equal rewards a coin toss that costs ln 2", () => {
    expect(preferProbability(1.3, 1.3)).toBe(0.5);
    expect(comparisonLoss(-2, -2)).toBeCloseTo(Math.LN2, 12);
  });

  it("is the softmax of the two rewards", () => {
    for (const [a, b] of [
      [0.4, -1.1],
      [3, 2.5],
      [-2, 1],
    ]) {
      expect(preferProbability(a, b)).toBeCloseTo(Math.exp(a) / (Math.exp(a) + Math.exp(b)), 12);
    }
  });

  it("gives the two orders probabilities that add up to one", () => {
    for (const [a, b] of [
      [0.7, -0.2],
      [-5, 4],
      [12, 11.5],
    ]) {
      expect(preferProbability(a, b) + preferProbability(b, a)).toBeCloseTo(1, 12);
    }
  });

  it("does not move when one constant is added to both rewards", () => {
    for (const c of [-3, -0.5, 2, 40]) {
      expect(preferProbability(1.5 + c, 0.25 + c)).toBeCloseTo(preferProbability(1.5, 0.25), 12);
      expect(comparisonLoss(1.5 + c, 0.25 + c)).toBeCloseTo(comparisonLoss(1.5, 0.25), 12);
      expect(lossSlope(1.5 + c, 0.25 + c)).toBeCloseTo(lossSlope(1.5, 0.25), 12);
    }
  });

  it("moves when both rewards are scaled: the comparisons fix the unit", () => {
    expect(preferProbability(2, 0)).not.toBeCloseTo(preferProbability(1, 0), 3);
  });

  it("stays finite at margins far beyond the widget's range", () => {
    expect(negLogSigmoid(1000)).toBe(0);
    expect(negLogSigmoid(-1000)).toBeCloseTo(1000, 9);
    expect(preferProbability(1000, 0)).toBe(1);
    expect(preferProbability(-1000, 0)).toBe(0);
    expect(Number.isNaN(lossSlope(-1000, 0))).toBe(false);
  });

  it("has the loss's derivative as its slope, and the two slopes add up to zero", () => {
    const h = 1e-6;
    for (const [a, b] of [
      [0.3, -0.9],
      [-2.2, 1.4],
      [5, 5],
    ]) {
      const numeric = (comparisonLoss(a + h, b) - comparisonLoss(a - h, b)) / (2 * h);
      expect(lossSlope(a, b)).toBeCloseTo(numeric, 6);
      const wrtB = (comparisonLoss(a, b + h) - comparisonLoss(a, b - h)) / (2 * h);
      expect(lossSlope(a, b) + wrtB).toBeCloseTo(0, 6);
    }
  });

  it("inverts the probability with the log odds", () => {
    for (const m of [-3, -0.4, 0, 1.7]) {
      expect(marginForProbability(preferProbability(m, 0))).toBeCloseTo(m, 10);
    }
    expect(() => marginForProbability(1)).toThrow(RangeError);
  });

  it("samples a curve end to end", () => {
    const pts = sampleCurve((m) => preferProbability(m, 0), -6, 6, 121);
    expect(pts).toHaveLength(121);
    expect(pts[0][0]).toBe(-6);
    expect(pts[120][0]).toBe(6);
    expect(pts[60][1]).toBeCloseTo(0.5, 12);
  });
});

describe("bradley-terry — the lesson's numbers", () => {
  it("reads three annotators in four as a margin of ln 3", () => {
    expect(marginForProbability(0.75)).toBeCloseTo(Math.log(3), 12);
    expect(marginForProbability(0.75)).toBeCloseTo(1.0986, 4);
  });

  it("chains two three-to-one margins into nine in ten", () => {
    const m = marginForProbability(0.75);
    expect(preferProbability(2 * m, 0)).toBeCloseTo(0.9, 12);
  });

  it("weighs a well-ordered comparison some forty times less than a misordered one", () => {
    const wellOrdered = -lossSlope(4, 0); // the chosen one already 4 above
    const misordered = -lossSlope(-1, 0); // the chosen one 1 below
    expect(wellOrdered).toBeCloseTo(0.018, 3);
    expect(misordered).toBeCloseTo(0.731, 3);
    expect(misordered / wellOrdered).toBeGreaterThan(40);
    expect(misordered / wellOrdered).toBeLessThan(41);
  });
});

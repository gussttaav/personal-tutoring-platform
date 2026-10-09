/*
 * COURSE-C2-P1-02 — `math/dpo.ts`, checked two independent ways, as AUTHORING §7 asks of a
 * widget's maths:
 *
 *   1. HAND AND LIMIT CASES — equal log ratios cost ln 2 with a factor of ½ at any β; as β → 0
 *      the loss tends to ln 2 and the push to zero whatever the log ratios; the factor tends to
 *      1 and to 0 at the two extremes without overflowing; adding one constant to both log
 *      ratios changes nothing; the gradient is the loss's derivative (finite differences); the
 *      factor's isoline sits where the closed form says, and its loss is −log(1 − f).
 *   2. THE LESSON'S NUMBERS — the cell's first step costs ln 2 = 0.693; the quiz's comparison
 *      (β = 0.1, ℓ_w = 3, ℓ_l = −2) has a margin of 0.5 and a factor of 0.378; a margin of 3, a
 *      comparison won by three letters in the cell, leaves a factor of 0.047; the widget's three
 *      isolines are the factors 0.9, 0.5 and 0.1, at losses 2.30, 0.69 and 0.11.
 */

import {
  dpoLoss,
  gapForFactor,
  gradientFactor,
  implicitMargin,
  logRatioGradient,
  lossForFactor,
  marginForFactor,
} from "../dpo";

describe("dpo — hand and limit cases", () => {
  it("costs ln 2 with a factor of one half when the two log ratios are equal, at any β", () => {
    for (const beta of [0.05, 0.1, 0.5, 1]) {
      for (const l of [-3, 0, 2.5]) {
        expect(dpoLoss(l, l, beta)).toBeCloseTo(Math.LN2, 12);
        expect(gradientFactor(l, l, beta)).toBe(0.5);
      }
    }
  });

  it("tends to ln 2 and stops pushing as β → 0, whatever the log ratios", () => {
    for (const [lw, ll] of [
      [4, -4],
      [-5, 3],
      [6, 0],
    ]) {
      expect(dpoLoss(lw, ll, 1e-9)).toBeCloseTo(Math.LN2, 6);
      expect(gradientFactor(lw, ll, 1e-9)).toBeCloseTo(0.5, 6);
      expect(logRatioGradient(lw, ll, 1e-9).dl).toBeLessThan(1e-8);
    }
  });

  it("is lesson 4's Bradley–Terry loss with β ℓ for the reward", () => {
    const [lw, ll, beta] = [1.7, -0.6, 0.4];
    const m = implicitMargin(lw, ll, beta);
    expect(m).toBeCloseTo(0.92, 12);
    expect(dpoLoss(lw, ll, beta)).toBeCloseTo(Math.log(1 + Math.exp(-m)), 12);
  });

  it("has a factor that tends to 1 and to 0 at the two extremes, without overflowing", () => {
    expect(gradientFactor(-1000, 1000, 1)).toBe(1);
    expect(gradientFactor(1000, -1000, 1)).toBe(0);
    expect(dpoLoss(1000, -1000, 1)).toBe(0);
    expect(dpoLoss(-1000, 1000, 1)).toBeCloseTo(2000, 9);
    expect(gradientFactor(-20, 20, 0.5)).toBeGreaterThan(0.9999);
    expect(gradientFactor(20, -20, 0.5)).toBeLessThan(1e-8);
  });

  it("does not move when one constant is added to both log ratios", () => {
    for (const c of [-4, -0.3, 1, 25]) {
      expect(dpoLoss(1.2 + c, -0.8 + c, 0.5)).toBeCloseTo(dpoLoss(1.2, -0.8, 0.5), 12);
      expect(gradientFactor(1.2 + c, -0.8 + c, 0.5)).toBeCloseTo(gradientFactor(1.2, -0.8, 0.5), 12);
    }
  });

  it("has the loss's derivatives as its gradient, and they add up to zero", () => {
    const h = 1e-6;
    for (const [lw, ll, beta] of [
      [0.3, -0.9, 0.5],
      [-2.2, 1.4, 0.1],
      [5, 5, 1],
    ]) {
      const { dw, dl } = logRatioGradient(lw, ll, beta);
      expect(dw).toBeCloseTo((dpoLoss(lw + h, ll, beta) - dpoLoss(lw - h, ll, beta)) / (2 * h), 6);
      expect(dl).toBeCloseTo((dpoLoss(lw, ll + h, beta) - dpoLoss(lw, ll - h, beta)) / (2 * h), 6);
      expect(dw + dl).toBe(0);
    }
  });

  it("puts each isoline where the closed form says, with loss −log(1 − f)", () => {
    for (const f of [0.1, 0.5, 0.9]) {
      for (const beta of [0.2, 0.5]) {
        const gap = gapForFactor(f, beta);
        expect(gradientFactor(gap, 0, beta)).toBeCloseTo(f, 12);
        expect(dpoLoss(gap, 0, beta)).toBeCloseTo(lossForFactor(f), 12);
      }
    }
    expect(marginForFactor(0.5)).toBe(0);
    expect(() => marginForFactor(1)).toThrow(RangeError);
    expect(() => lossForFactor(1)).toThrow(RangeError);
  });

  it("goes quiet closer to the diagonal as β grows", () => {
    expect(gapForFactor(0.1, 1)).toBeCloseTo(Math.log(9), 12);
    expect(gapForFactor(0.1, 0.1)).toBeCloseTo(10 * Math.log(9), 12);
  });
});

describe("dpo — the lesson's numbers", () => {
  it("starts every training at ln 2 = 0.693, where the policy is the reference", () => {
    expect(dpoLoss(0, 0, 0.5)).toBeCloseTo(0.693, 3);
  });

  it("gives the quiz's comparison a margin of 0.5 and a factor of 0.378", () => {
    expect(implicitMargin(3, -2, 0.1)).toBeCloseTo(0.5, 12);
    expect(gradientFactor(3, -2, 0.1)).toBeCloseTo(0.378, 3);
  });

  it("leaves a comparison ordered by a margin of 3 with a factor of 0.047", () => {
    expect(gradientFactor(3, 0, 1)).toBeCloseTo(0.047, 3);
  });

  it("labels the widget's three isolines with losses 2.30, 0.69 and 0.11", () => {
    expect(lossForFactor(0.9)).toBeCloseTo(2.303, 3);
    expect(lossForFactor(0.5)).toBeCloseTo(0.693, 3);
    expect(lossForFactor(0.1)).toBeCloseTo(0.105, 3);
  });
});

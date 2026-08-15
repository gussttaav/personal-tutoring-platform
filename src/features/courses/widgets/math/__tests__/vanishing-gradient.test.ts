/*
 * COURSE-P5-03 — vanishing-gradient envelope tests: base case, per-step ratio,
 * and the three regimes (vanish / explode / crossover).
 */

import {
  MAX_TANH_PRIME,
  stepFactor,
  gradientMagnitudes,
} from "../vanishing-gradient";

describe("stepFactor", () => {
  it("multiplies the spectral radius by the saturation factor", () => {
    expect(stepFactor(1.5, 0.5)).toBeCloseTo(0.75, 12);
  });

  it("defaults to the most favourable mask, γ = 1", () => {
    expect(MAX_TANH_PRIME).toBe(1);
    expect(stepFactor(0.8)).toBeCloseTo(0.8, 12);
  });
});

describe("gradientMagnitudes", () => {
  it("returns maxDistance + 1 points, starting at 1", () => {
    const m = gradientMagnitudes(0.5, 1, 10);
    expect(m.length).toBe(11);
    expect(m[0]).toBe(1);
  });

  it("has a constant per-step ratio equal to γρ", () => {
    const rho = 0.9;
    const gamma = 0.7;
    const m = gradientMagnitudes(rho, gamma, 12);
    for (let d = 1; d < m.length; d++) {
      expect(m[d] / m[d - 1]).toBeCloseTo(rho * gamma, 10);
    }
  });

  it("decays strictly toward zero when γρ < 1 (vanishing)", () => {
    const m = gradientMagnitudes(0.5, 1, 40);
    for (let d = 1; d < m.length; d++) {
      expect(m[d]).toBeLessThan(m[d - 1]);
    }
    // ρ = 0,5 over 40 steps is ~9·10⁻¹³ — the number the prose quotes.
    expect(m[40]).toBeLessThan(1e-11);
    expect(m[40]).toBeCloseTo(Math.pow(0.5, 40), 20);
  });

  it("grows strictly without bound when γρ > 1 (exploding)", () => {
    const m = gradientMagnitudes(1.5, 1, 40);
    for (let d = 1; d < m.length; d++) {
      expect(m[d]).toBeGreaterThan(m[d - 1]);
    }
    expect(m[40]).toBeGreaterThan(1e6);
  });

  it("stays flat at 1 at the crossover γρ = 1", () => {
    const m = gradientMagnitudes(1, 1, 20);
    for (const v of m) {
      expect(v).toBeCloseTo(1, 12);
    }
  });

  it("saturation only deepens the decay — a subunit mask cannot rescue ρ = 1", () => {
    const atCrossover = gradientMagnitudes(1, 1, 20);
    const masked = gradientMagnitudes(1, 0.4, 20);
    for (let d = 1; d < masked.length; d++) {
      expect(masked[d]).toBeLessThan(atCrossover[d]);
    }
  });

  it("rejects a non-integer or negative distance", () => {
    expect(() => gradientMagnitudes(0.5, 1, 3.5)).toThrow(/integer/);
    expect(() => gradientMagnitudes(0.5, 1, -1)).toThrow(/integer/);
  });
});

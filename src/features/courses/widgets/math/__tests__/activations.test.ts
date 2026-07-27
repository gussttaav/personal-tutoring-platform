/*
 * COURSE-P2-01 — Activation tests: known values + derivatives vs finite differences.
 */

import {
  sigmoid,
  sigmoidPrime,
  tanh,
  tanhPrime,
  relu,
  reluPrime,
  leakyRelu,
  leakyReluPrime,
  gelu,
  geluPrime,
} from "../activations";

// Central finite difference: f'(x) ≈ (f(x+h) − f(x−h)) / 2h.
function fdApprox(f: (x: number) => number, x: number, h = 1e-5): number {
  return (f(x + h) - f(x - h)) / (2 * h);
}

const SAMPLES = [-3, -1.5, -0.25, 0.5, 1.7, 4];

describe("sigmoid", () => {
  it("hits known values", () => {
    expect(sigmoid(0)).toBeCloseTo(0.5, 12);
    expect(sigmoid(100)).toBeCloseTo(1, 12);
    expect(sigmoid(-100)).toBeCloseTo(0, 12);
  });

  it("does not overflow for large-magnitude inputs", () => {
    expect(Number.isFinite(sigmoid(1000))).toBe(true);
    expect(Number.isFinite(sigmoid(-1000))).toBe(true);
    expect(sigmoid(1000)).toBeCloseTo(1, 12);
    expect(sigmoid(-1000)).toBeCloseTo(0, 12);
  });

  it("derivative matches finite differences", () => {
    for (const x of SAMPLES) {
      expect(sigmoidPrime(x)).toBeCloseTo(fdApprox(sigmoid, x), 6);
    }
  });
});

describe("tanh", () => {
  it("hits known values", () => {
    expect(tanh(0)).toBeCloseTo(0, 12);
    expect(tanh(100)).toBeCloseTo(1, 12);
  });

  it("derivative matches finite differences", () => {
    for (const x of SAMPLES) {
      expect(tanhPrime(x)).toBeCloseTo(fdApprox(tanh, x), 6);
    }
  });
});

describe("relu / leakyRelu", () => {
  it("relu clamps negatives to zero", () => {
    expect(relu(-2)).toBe(0);
    expect(relu(0)).toBe(0);
    expect(relu(3.5)).toBe(3.5);
  });

  it("relu derivative is the step function", () => {
    expect(reluPrime(-1)).toBe(0);
    expect(reluPrime(2)).toBe(1);
    // Away from the kink, matches finite differences.
    expect(reluPrime(2)).toBeCloseTo(fdApprox(relu, 2), 6);
    expect(reluPrime(-2)).toBeCloseTo(fdApprox(relu, -2), 6);
  });

  it("leakyRelu leaks negatives by alpha", () => {
    expect(leakyRelu(-10)).toBeCloseTo(-0.1, 12);
    expect(leakyRelu(-10, 0.2)).toBeCloseTo(-2, 12);
    expect(leakyRelu(4)).toBe(4);
  });

  it("leakyRelu derivative matches finite differences off the kink", () => {
    expect(leakyReluPrime(3)).toBeCloseTo(fdApprox(leakyRelu, 3), 6);
    expect(leakyReluPrime(-3)).toBeCloseTo(fdApprox((x) => leakyRelu(x), -3), 6);
  });
});

describe("gelu", () => {
  it("hits known values", () => {
    expect(gelu(0)).toBeCloseTo(0, 12);
    // Large positive → ≈ x; large negative → ≈ 0.
    expect(gelu(10)).toBeCloseTo(10, 4);
    expect(gelu(-10)).toBeCloseTo(0, 6);
  });

  it("derivative matches finite differences", () => {
    for (const x of SAMPLES) {
      expect(geluPrime(x)).toBeCloseTo(fdApprox(gelu, x), 5);
    }
  });
});

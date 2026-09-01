/*
 * COURSE-P2-02 — Backprop tests. The centrepiece widget must show trustworthy
 * numbers, so its gradients are verified TWO independent ways:
 *   1. Every analytic gradient against central finite differences of the loss.
 *   2. A fully hand-computed round-number example (o, loss, and every gradient).
 * Plus: each trace step's value equals the product of its factors.
 */

import { forward, runBackprop, BACKPROP_PRESET, type MlpParams } from "../backprop";

const cloneParams = (p: MlpParams): MlpParams => ({
  W1: p.W1.map((r) => r.slice()),
  b1: p.b1.slice(),
  w2: p.w2.slice(),
  b2: p.b2,
  target: p.target,
});

const lossAt = (p: MlpParams, x: number[]) => forward(p, x).loss;

// Central finite difference of the loss w.r.t. a single mutated scalar.
function fd(p: MlpParams, x: number[], mutate: (p: MlpParams, delta: number) => void): number {
  const h = 1e-6;
  const up = cloneParams(p);
  mutate(up, +h);
  const down = cloneParams(p);
  mutate(down, -h);
  return (lossAt(up, x) - lossAt(down, x)) / (2 * h);
}

describe("runBackprop — gradients vs finite differences", () => {
  const { params, x } = BACKPROP_PRESET;
  const { grads } = runBackprop(params, x);

  it("matches ∂L/∂W1 for every hidden weight", () => {
    for (let j = 0; j < 2; j++) {
      for (let k = 0; k < 2; k++) {
        const approx = fd(params, x, (p, d) => (p.W1[j][k] += d));
        expect(grads.dW1[j][k]).toBeCloseTo(approx, 5);
      }
    }
  });

  it("matches ∂L/∂b1 for every hidden bias", () => {
    for (let j = 0; j < 2; j++) {
      const approx = fd(params, x, (p, d) => (p.b1[j] += d));
      expect(grads.db1[j]).toBeCloseTo(approx, 5);
    }
  });

  it("matches ∂L/∂w2 for every output weight", () => {
    for (let j = 0; j < 2; j++) {
      const approx = fd(params, x, (p, d) => (p.w2[j] += d));
      expect(grads.dw2[j]).toBeCloseTo(approx, 5);
    }
  });

  it("matches ∂L/∂b2 for the output bias", () => {
    const approx = fd(params, x, (p, d) => (p.b2 += d));
    expect(grads.db2).toBeCloseTo(approx, 5);
  });
});

describe("runBackprop — hand-computed example", () => {
  // All weights/biases zero, x = [1, 0], target 0:
  //   z1 = [0,0] → a1 = [0.5, 0.5];  z2 = 0 → o = 0.5;  L = ½·0.5² = 0.125
  //   ∂L/∂o = 0.5;  o(1−o) = 0.25;  δ2 = 0.125
  //   ∂L/∂w2ⱼ = δ2·a1ⱼ = 0.0625;  ∂L/∂b2 = 0.125
  //   ∂L/∂a1ⱼ = δ2·w2ⱼ = 0;  δ1ⱼ = 0;  ∂L/∂W1 = 0;  ∂L/∂b1 = 0
  const params: MlpParams = {
    W1: [
      [0, 0],
      [0, 0],
    ],
    b1: [0, 0],
    w2: [0, 0],
    b2: 0,
    target: 0,
  };
  const x = [1, 0];
  const result = runBackprop(params, x);

  it("computes the forward values exactly", () => {
    expect(result.forward.a1).toEqual([0.5, 0.5]);
    expect(result.forward.o).toBeCloseTo(0.5, 12);
    expect(result.forward.loss).toBeCloseTo(0.125, 12);
  });

  it("computes every gradient exactly", () => {
    expect(result.grads.dw2[0]).toBeCloseTo(0.0625, 12);
    expect(result.grads.dw2[1]).toBeCloseTo(0.0625, 12);
    expect(result.grads.db2).toBeCloseTo(0.125, 12);
    expect(result.grads.dW1).toEqual([
      [0, 0],
      [0, 0],
    ]);
    expect(result.grads.db1).toEqual([0, 0]);
  });
});

describe("runBackprop — trace integrity", () => {
  it("every step's value equals the product of its factors", () => {
    const { steps } = runBackprop(BACKPROP_PRESET.params, BACKPROP_PRESET.x);
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      const product = step.factors.reduce((acc, f) => acc * f.value, 1);
      expect(step.value).toBeCloseTo(product, 12);
    }
  });

  it("traces both the output and hidden layers", () => {
    const { steps } = runBackprop(BACKPROP_PRESET.params, BACKPROP_PRESET.x);
    const ids = steps.map((s) => s.id);
    expect(ids).toContain("dL_dz2"); // output layer
    expect(ids).toContain("dL_dz1_0"); // hidden layer
    expect(ids).toContain("dL_dW1_0_0"); // input weights
  });
});

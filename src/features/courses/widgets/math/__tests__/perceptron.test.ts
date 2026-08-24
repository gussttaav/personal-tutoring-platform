/*
 * COURSE-P2-02 — Perceptron tests: classification, boundary geometry, and the
 * separable-converges / XOR-never-converges pedagogical guarantee.
 */

import {
  classify,
  decisionBoundaryLine,
  perceptronEpoch,
  trainPerceptron,
  linearlySeparable,
  XOR_PRESET,
  SEPARABLE_PRESET,
  type Point2,
} from "../perceptron";

describe("classify", () => {
  it("returns the sign of w·x + b, boundary counts as positive", () => {
    expect(classify([1, 1], [1, 0], 0)).toBe(1);
    expect(classify([-1, 1], [1, 0], 0)).toBe(-1);
    expect(classify([0, 0], [1, 1], 0)).toBe(1); // exactly on the boundary
  });
});

describe("decisionBoundaryLine", () => {
  const X: [number, number] = [-2, 2];
  const Y: [number, number] = [-2, 2];

  it("draws a vertical line for a purely horizontal weight", () => {
    // w = [1, 0], b = 0 → x = 0.
    expect(decisionBoundaryLine([1, 0], 0, X, Y)).toEqual([
      [0, -2],
      [0, 2],
    ]);
  });

  it("draws a horizontal line for a purely vertical weight", () => {
    // w = [0, 1], b = 0 → y = 0.
    expect(decisionBoundaryLine([0, 1], 0, X, Y)).toEqual([
      [-2, 0],
      [2, 0],
    ]);
  });

  it("draws the y = -x diagonal for w = [1, 1], b = 0", () => {
    expect(decisionBoundaryLine([1, 1], 0, X, Y)).toEqual([
      [-2, 2],
      [2, -2],
    ]);
  });

  it("returns null when there is no boundary (both weights ~0)", () => {
    expect(decisionBoundaryLine([0, 0], 0, X, Y)).toBeNull();
  });
});

describe("perceptronEpoch", () => {
  it("counts misclassifications and nudges weights toward them", () => {
    const data: { point: Point2; label: 1 | -1 }[] = [{ point: [2, 0], label: 1 }];
    // Start at w = [0,0], b = 0 → predicts +1 (boundary positive), already correct.
    const ok = perceptronEpoch(data, [0, 0], 0, 0.1);
    expect(ok.errors).toBe(0);
    // A point that should be −1 but sits on the positive side is an error.
    const bad = perceptronEpoch([{ point: [2, 0], label: -1 }], [0, 0], 0, 0.1);
    expect(bad.errors).toBe(1);
    expect(bad.w[0]).toBeCloseTo(-0.2, 12); // w += lr·y·x = 0 + 0.1·(−1)·2
    expect(bad.b).toBeCloseTo(-0.1, 12);
  });
});

describe("separability", () => {
  it("converges on a linearly separable set and classifies every point", () => {
    const result = trainPerceptron(SEPARABLE_PRESET, { lr: 0.1, maxEpochs: 1000 });
    expect(result.converged).toBe(true);
    for (const { point, label } of SEPARABLE_PRESET) {
      expect(classify(point, result.w, result.b)).toBe(label);
    }
    expect(linearlySeparable(SEPARABLE_PRESET)).toBe(true);
  });

  it("NEVER converges on XOR — the whole point of the widget", () => {
    const result = trainPerceptron(XOR_PRESET, { lr: 0.1, maxEpochs: 500 });
    expect(result.converged).toBe(false);
    expect(result.epochs).toBe(500);
    expect(linearlySeparable(XOR_PRESET, { maxEpochs: 2000 })).toBe(false);
  });
});

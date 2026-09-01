/*
 * COURSE-P2-01 — linalg tests: shape + values, and softmax numerical stability.
 */

import { matmul, transpose, softmax, softmaxRows } from "../linalg";

describe("matmul", () => {
  it("computes a known product with correct shape", () => {
    const a = [
      [1, 2, 3],
      [4, 5, 6],
    ]; // 2×3
    const b = [
      [7, 8],
      [9, 10],
      [11, 12],
    ]; // 3×2
    const out = matmul(a, b);
    expect(out).toEqual([
      [58, 64],
      [139, 154],
    ]); // 2×2
    expect(out.length).toBe(2);
    expect(out[0].length).toBe(2);
  });

  it("throws on an inner-dimension mismatch", () => {
    expect(() => matmul([[1, 2]], [[1, 2]])).toThrow(/shape mismatch/);
  });
});

describe("transpose", () => {
  it("swaps rows and columns", () => {
    expect(
      transpose([
        [1, 2, 3],
        [4, 5, 6],
      ]),
    ).toEqual([
      [1, 4],
      [2, 5],
      [3, 6],
    ]);
  });

  it("is its own inverse", () => {
    const a = [
      [1, 2],
      [3, 4],
      [5, 6],
    ];
    expect(transpose(transpose(a))).toEqual(a);
  });
});

describe("softmax", () => {
  it("returns a distribution that sums to 1", () => {
    const p = softmax([1, 2, 3]);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    // Monotonic: larger input → larger probability.
    expect(p[2]).toBeGreaterThan(p[1]);
    expect(p[1]).toBeGreaterThan(p[0]);
  });

  it("is numerically stable at [1000, 1001]", () => {
    const p = softmax([1000, 1001]);
    expect(p.every((x) => Number.isFinite(x))).toBe(true);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    // Shift-invariance: softmax([1000,1001]) == softmax([0,1]).
    const ref = softmax([0, 1]);
    expect(p[0]).toBeCloseTo(ref[0], 12);
    expect(p[1]).toBeCloseTo(ref[1], 12);
  });

  it("handles an empty vector", () => {
    expect(softmax([])).toEqual([]);
  });
});

describe("softmaxRows", () => {
  it("normalises each row independently", () => {
    const m = softmaxRows([
      [1, 1],
      [0, 100],
    ]);
    expect(m[0][0]).toBeCloseTo(0.5, 12);
    expect(m[0][1]).toBeCloseTo(0.5, 12);
    expect(m[1][1]).toBeCloseTo(1, 12);
    expect(m[1][0]).toBeCloseTo(0, 12);
  });
});

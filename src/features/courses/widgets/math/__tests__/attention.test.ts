/*
 * COURSE-P2-01 — scaled dot-product attention tests: shape + known behaviour.
 */

import { scaledDotProductAttention } from "../attention";

describe("scaledDotProductAttention", () => {
  it("produces weights (nq×nk) and output (nq×dv) of the right shape", () => {
    const q = [
      [1, 0],
      [0, 1],
      [1, 1],
    ]; // 3 queries, dk=2
    const k = [
      [1, 0],
      [0, 1],
    ]; // 2 keys, dk=2
    const v = [
      [10, 20, 30],
      [40, 50, 60],
    ]; // 2 values, dv=3

    const { weights, output } = scaledDotProductAttention(q, k, v);
    expect(weights.length).toBe(3);
    expect(weights[0].length).toBe(2);
    expect(output.length).toBe(3);
    expect(output[0].length).toBe(3);
  });

  it("gives each weight row a distribution summing to 1", () => {
    const q = [[1, 2]];
    const k = [
      [1, 0],
      [0, 1],
      [2, 2],
    ];
    const v = [
      [1, 0],
      [0, 1],
      [1, 1],
    ];
    const { weights } = scaledDotProductAttention(q, k, v);
    expect(weights[0].reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });

  it("returns the mean of the values when all scores tie", () => {
    // Zero queries → all scores 0 → uniform weights → output is the column mean.
    const q = [[0, 0]];
    const k = [
      [5, 1],
      [1, 5],
    ];
    const v = [
      [2, 4],
      [6, 8],
    ];
    const { weights, output } = scaledDotProductAttention(q, k, v);
    expect(weights[0][0]).toBeCloseTo(0.5, 12);
    expect(weights[0][1]).toBeCloseTo(0.5, 12);
    expect(output[0][0]).toBeCloseTo(4, 12); // (2+6)/2
    expect(output[0][1]).toBeCloseTo(6, 12); // (4+8)/2
  });

  it("throws when K and V counts disagree", () => {
    expect(() =>
      scaledDotProductAttention([[1, 1]], [[1, 1]], [[1], [2]]),
    ).toThrow(/K has|values/);
  });

  it("throws when Q and K feature dims disagree", () => {
    expect(() =>
      scaledDotProductAttention([[1, 1, 1]], [[1, 1]], [[1, 1]]),
    ).toThrow(/feature dim/);
  });
});

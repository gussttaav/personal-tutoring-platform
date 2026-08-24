/*
 * COURSE-P2-01 — gradient descent tests: convergence, shape, learning rate.
 */

import { gradientDescentPath } from "../optimisation";

describe("gradientDescentPath", () => {
  it("returns steps + 1 points including the start", () => {
    const path = gradientDescentPath((x) => [2 * x[0]], [5], 0.1, 10);
    expect(path.length).toBe(11);
    expect(path[0]).toEqual([5]);
  });

  it("converges toward the minimum of f(x) = x²", () => {
    // grad f = 2x, minimum at 0.
    const path = gradientDescentPath((x) => [2 * x[0]], [10], 0.1, 100);
    const last = path[path.length - 1][0];
    expect(Math.abs(last)).toBeLessThan(1e-3);
  });

  it("descends monotonically toward zero for a convex bowl", () => {
    const path = gradientDescentPath((x) => [2 * x[0]], [8], 0.1, 20);
    for (let i = 1; i < path.length; i++) {
      expect(Math.abs(path[i][0])).toBeLessThan(Math.abs(path[i - 1][0]));
    }
  });

  it("works in multiple dimensions", () => {
    // f(x, y) = x² + y², grad = [2x, 2y], minimum at origin.
    const path = gradientDescentPath((p) => [2 * p[0], 2 * p[1]], [3, -4], 0.1, 100);
    const [x, y] = path[path.length - 1];
    expect(Math.hypot(x, y)).toBeLessThan(1e-3);
    expect(path[0]).toEqual([3, -4]);
  });

  it("throws when the gradient dimension mismatches the point", () => {
    expect(() => gradientDescentPath(() => [1, 2], [0], 0.1, 1)).toThrow(/length/);
  });
});

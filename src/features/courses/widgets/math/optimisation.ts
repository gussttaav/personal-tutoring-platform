/*
 * COURSE-P2-01 — Gradient descent, as a pure function.
 *
 * Returns the whole trajectory (not just the final point) so a widget can trace
 * the path a step at a time — which is also what makes it a `prefers-reduced-motion`
 * friendly "step" control instead of a forced animation. No DOM, fully testable.
 */

export type Point = number[];

/**
 * Run vanilla gradient descent from `start` for `steps` iterations at learning
 * rate `lr`, following the supplied gradient function.
 *
 *   xₜ₊₁ = xₜ − lr · ∇f(xₜ)
 *
 * Returns the path INCLUDING the start point, so the result has `steps + 1`
 * points. Works in any dimension: `start` and the gradient share a length.
 */
export function gradientDescentPath(
  grad: (x: Point) => Point,
  start: Point,
  lr: number,
  steps: number,
): Point[] {
  const path: Point[] = [start.slice()];
  let current = start.slice();

  for (let s = 0; s < steps; s++) {
    const g = grad(current);
    if (g.length !== current.length) {
      throw new Error(
        `gradientDescentPath: gradient length ${g.length} ≠ point length ${current.length}`,
      );
    }
    const next = current.map((xi, i) => xi - lr * g[i]);
    path.push(next);
    current = next;
  }

  return path;
}

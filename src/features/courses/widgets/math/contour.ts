/*
 * COURSE-P2-02 — 2D scalar fields + marching-squares contours for the optimisation
 * widgets (`gradient-descent-2d`, `loss-landscape`).
 *
 * We hand-roll contour extraction rather than add `d3-contour` (not installed) — a
 * teaching demo does not justify the dependency, and marching squares is ~40 lines.
 * All pure and DOM-free: `evalField` samples a function on a grid; `contourSegments`
 * turns a grid into iso-line segments at a level. The fields carry an ANALYTIC
 * gradient so `optimisation.gradientDescentPath` can walk them exactly.
 */

export type Vec2 = [number, number];

export interface Field2D {
  f: (x: number, y: number) => number;
  grad: (x: number, y: number) => Vec2;
  xDomain: [number, number];
  yDomain: [number, number];
}

export interface FieldGrid {
  /** grid[iy][ix] = f(xs[ix], ys[iy]). */
  grid: number[][];
  xs: number[];
  ys: number[];
  min: number;
  max: number;
}

/** Sample `f` on an `nx × ny` grid across the domain. */
export function evalField(
  f: (x: number, y: number) => number,
  xDomain: [number, number],
  yDomain: [number, number],
  nx: number,
  ny: number,
): FieldGrid {
  const xs = Array.from({ length: nx }, (_, i) => xDomain[0] + ((xDomain[1] - xDomain[0]) * i) / (nx - 1));
  const ys = Array.from({ length: ny }, (_, j) => yDomain[0] + ((yDomain[1] - yDomain[0]) * j) / (ny - 1));
  let min = Infinity;
  let max = -Infinity;
  const grid = ys.map((y) =>
    xs.map((x) => {
      const v = f(x, y);
      if (v < min) min = v;
      if (v > max) max = v;
      return v;
    }),
  );
  return { grid, xs, ys, min, max };
}

/** `n` evenly spaced contour levels strictly inside [min, max]. */
export function contourLevels(min: number, max: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => min + ((max - min) * (i + 1)) / (n + 1));
}

// Cell edges: 0 = bottom (bl→br), 1 = right (br→tr), 2 = top (tl→tr), 3 = left (bl→tl).
// Indexed by the 4-bit corner mask (bl=1, br=2, tr=4, tl=8); each entry is the list
// of edge pairs to connect. Saddle cases (5, 10) yield two segments.
const SEG_TABLE: readonly (readonly [number, number][])[] = [
  [], // 0
  [[0, 3]], // 1  bl
  [[0, 1]], // 2  br
  [[3, 1]], // 3  bl br
  [[1, 2]], // 4  tr
  [[0, 3], [1, 2]], // 5  bl tr (saddle)
  [[0, 2]], // 6  br tr
  [[2, 3]], // 7  bl br tr
  [[2, 3]], // 8  tl
  [[0, 2]], // 9  bl tl
  [[0, 1], [2, 3]], // 10 br tl (saddle)
  [[1, 2]], // 11 bl br tl
  [[3, 1]], // 12 tl tr
  [[0, 1]], // 13 bl tl tr
  [[0, 3]], // 14 br tr tl
  [], // 15
];

/** Iso-line segments of `field` at `level`, via marching squares. */
export function contourSegments(field: FieldGrid, level: number): [Vec2, Vec2][] {
  const { grid, xs, ys } = field;
  const ny = ys.length;
  const nx = xs.length;
  const segments: [Vec2, Vec2][] = [];

  // Linear crossing on an edge from point A (value vA) to B (value vB).
  const cross = (ax: number, ay: number, va: number, bx: number, by: number, vb: number): Vec2 => {
    const denom = vb - va;
    const t = Math.abs(denom) < 1e-12 ? 0.5 : (level - va) / denom;
    return [ax + t * (bx - ax), ay + t * (by - ay)];
  };

  for (let iy = 0; iy < ny - 1; iy++) {
    for (let ix = 0; ix < nx - 1; ix++) {
      const vBL = grid[iy][ix];
      const vBR = grid[iy][ix + 1];
      const vTR = grid[iy + 1][ix + 1];
      const vTL = grid[iy + 1][ix];

      const mask =
        (vBL >= level ? 1 : 0) |
        (vBR >= level ? 2 : 0) |
        (vTR >= level ? 4 : 0) |
        (vTL >= level ? 8 : 0);

      const pairs = SEG_TABLE[mask];
      if (pairs.length === 0) continue;

      const x0 = xs[ix];
      const x1 = xs[ix + 1];
      const y0 = ys[iy];
      const y1 = ys[iy + 1];

      // Crossing point on each of the four edges (computed lazily as referenced).
      const edge = (e: number): Vec2 => {
        switch (e) {
          case 0:
            return cross(x0, y0, vBL, x1, y0, vBR); // bottom
          case 1:
            return cross(x1, y0, vBR, x1, y1, vTR); // right
          case 2:
            return cross(x0, y1, vTL, x1, y1, vTR); // top
          default:
            return cross(x0, y0, vBL, x0, y1, vTL); // left
        }
      };

      for (const [a, b] of pairs) {
        segments.push([edge(a), edge(b)]);
      }
    }
  }
  return segments;
}

/** A convex bowl: f = x² + 3y². Gradient descent converges; nothing exotic. */
export const BOWL: Field2D = {
  f: (x, y) => x * x + 3 * y * y,
  grad: (x, y) => [2 * x, 6 * y],
  xDomain: [-3, 3],
  yDomain: [-3, 3],
};

/** Ill-conditioned bowl: f = x² + 20y². Steep in y — high lr diverges there first. */
export const RAVINE: Field2D = {
  f: (x, y) => x * x + 20 * y * y,
  grad: (x, y) => [2 * x, 40 * y],
  xDomain: [-3, 3],
  yDomain: [-1.5, 1.5],
};

/** Double well: f = (x² − 1)² + y². Two minima at (±1, 0) — a loss with basins. */
export const DOUBLE_WELL: Field2D = {
  f: (x, y) => (x * x - 1) * (x * x - 1) + y * y,
  grad: (x, y) => [4 * x * (x * x - 1), 2 * y],
  xDomain: [-2, 2],
  yDomain: [-1.5, 1.5],
};

export const FIELDS: Record<string, Field2D> = { BOWL, RAVINE, DOUBLE_WELL };

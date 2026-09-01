/*
 * COURSE-P2-02 — Contour tests: grid sampling, exact contours on a linear field,
 * the "every vertex sits on the iso-level" invariant on a curved field, and the
 * field gradients checked against finite differences.
 */

import {
  evalField,
  contourLevels,
  contourSegments,
  BOWL,
  RAVINE,
  DOUBLE_WELL,
  type Field2D,
} from "../contour";

describe("evalField", () => {
  it("samples f on the grid with correct dimensions and endpoints", () => {
    const fg = evalField((x, y) => x + y, [0, 1], [0, 2], 3, 5);
    expect(fg.xs).toEqual([0, 0.5, 1]);
    expect(fg.ys).toEqual([0, 0.5, 1, 1.5, 2]);
    expect(fg.grid.length).toBe(5); // ny rows
    expect(fg.grid[0].length).toBe(3); // nx cols
    expect(fg.grid[4][2]).toBeCloseTo(3, 12); // f(1, 2)
    expect(fg.min).toBeCloseTo(0, 12);
    expect(fg.max).toBeCloseTo(3, 12);
  });
});

describe("contourLevels", () => {
  it("places n levels strictly inside (min, max)", () => {
    expect(contourLevels(0, 4, 3)).toEqual([1, 2, 3]);
  });
});

describe("contourSegments", () => {
  it("extracts an exact vertical line for the linear field f = x at level 0", () => {
    const fg = evalField((x) => x, [-1, 1], [-1, 1], 9, 9);
    const segs = contourSegments(fg, 0);
    expect(segs.length).toBeGreaterThan(0);
    for (const [p, q] of segs) {
      expect(p[0]).toBeCloseTo(0, 9); // interpolation is exact on a linear field
      expect(q[0]).toBeCloseTo(0, 9);
    }
  });

  it("returns nothing when the level is outside the field range", () => {
    const fg = evalField((x, y) => x * x + y * y, [-1, 1], [-1, 1], 20, 20);
    expect(contourSegments(fg, 100)).toEqual([]);
  });

  it("every vertex lies on the iso-level of a curved field (within grid error)", () => {
    const level = 1;
    const fg = evalField(BOWL.f, BOWL.xDomain, BOWL.yDomain, 120, 120);
    const segs = contourSegments(fg, level);
    expect(segs.length).toBeGreaterThan(0);
    for (const [p, q] of segs) {
      expect(Math.abs(BOWL.f(p[0], p[1]) - level)).toBeLessThan(0.05);
      expect(Math.abs(BOWL.f(q[0], q[1]) - level)).toBeLessThan(0.05);
    }
  });
});

describe("field gradients vs finite differences", () => {
  const fdGrad = (f: Field2D["f"], x: number, y: number): [number, number] => {
    const h = 1e-5;
    return [(f(x + h, y) - f(x - h, y)) / (2 * h), (f(x, y + h) - f(x, y - h)) / (2 * h)];
  };
  const SAMPLES: [number, number][] = [
    [0.5, 0.7],
    [-1.2, 0.3],
    [1.4, -0.9],
  ];

  for (const [name, field] of Object.entries({ BOWL, RAVINE, DOUBLE_WELL })) {
    it(`${name} analytic gradient matches finite differences`, () => {
      for (const [x, y] of SAMPLES) {
        const [gx, gy] = field.grad(x, y);
        const [ax, ay] = fdGrad(field.f, x, y);
        expect(gx).toBeCloseTo(ax, 5);
        expect(gy).toBeCloseTo(ay, 5);
      }
    });
  }
});

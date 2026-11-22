/* BLOG-27 — reference-label layout of the latency-budget figure. */

import { crossings, layoutRefs, placeHorizontally } from "../latency-budget/ref-layout";

describe("placeHorizontally", () => {
  it("puts the label right of its line when it fits", () => {
    expect(placeHorizontally(100, 50, 300)).toEqual({ labelX: 104, anchor: "start", left: 104, right: 154 });
  });

  it("falls back to the left of the line, ending at it", () => {
    expect(placeHorizontally(280, 50, 300)).toEqual({ labelX: 276, anchor: "end", left: 226, right: 276 });
  });

  it("clamps inside the chart when neither side has room", () => {
    const p = placeHorizontally(60, 200, 220);
    expect(p.left).toBe(20);
    expect(p.right).toBe(220);
  });
});

describe("layoutRefs", () => {
  it("keeps the given order when no line crosses a label", () => {
    const rows = layoutRefs(
      [
        { x: 100, width: 60 },
        { x: 300, width: 60 },
        { x: 500, width: 60 },
      ],
      700,
    ).map((p) => p.row);
    expect(rows).toEqual([0, 1, 2]);
  });

  it("reorders rows so a rising line does not cut through a lower label", () => {
    // Two close lines, both labels too wide for the right: the second label sits left of its
    // line and covers the first line, so it must go ABOVE the first one.
    const refs = [
      { x: 360, width: 150 },
      { x: 380, width: 150 },
    ];
    const placed = layoutRefs(refs, 400);
    expect(placed[1].row).toBeLessThan(placed[0].row);
    expect(crossings(refs, placed, placed.map((p) => p.row))).toBe(0);
  });

  it("gives every label its own row", () => {
    const placed = layoutRefs(
      [
        { x: 10, width: 200 },
        { x: 20, width: 200 },
        { x: 30, width: 200 },
      ],
      260,
    );
    expect(new Set(placed.map((p) => p.row)).size).toBe(3);
  });
});

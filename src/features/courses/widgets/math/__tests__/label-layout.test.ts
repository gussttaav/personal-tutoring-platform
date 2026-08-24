/*
 * COURSE-P5-01 — Label spreading for `embedding-projection`. The cases that matter are
 * the ones the widget hits every time a word is selected: several labels inside one
 * tight cluster, and a label close enough to the right edge to need flipping.
 */

import { layoutLabels, estimateTextWidth, type LabelAnchor } from "../label-layout";

const BOX = { width: 200, height: 100, lineHeight: 10, offset: 8, padding: 4 };

describe("layoutLabels", () => {
  it("leaves a lone label on its point", () => {
    const [label] = layoutLabels([{ key: "gato", x: 150, y: 50, width: 30 }], BOX);
    expect(label.y).toBe(50);
    expect(label.x).toBe(158); // 150 + offset
    expect(label.anchor).toBe("start");
    expect(label.displaced).toBe(false);
  });

  it("points labels outward from the centre", () => {
    const [left, right] = layoutLabels(
      [
        { key: "izquierda", x: 60, y: 20, width: 30 }, // left of centre (100)
        { key: "derecha", x: 140, y: 60, width: 30 }, // right of it
      ],
      BOX,
    );

    expect(left.anchor).toBe("end");
    expect(left.x).toBe(52); // 60 − offset, text runs leftwards
    expect(right.anchor).toBe("start");
    expect(right.x).toBe(148);
  });

  it("falls back to the inward side when the outward one leaves the box", () => {
    const [label] = layoutLabels([{ key: "pegada-al-borde", x: 6, y: 50, width: 60 }], BOX);
    expect(label.anchor).toBe("start"); // left of centre, but no room on the left
  });

  it("spreads a cluster so no two labels are closer than lineHeight", () => {
    const cluster: LabelAnchor[] = ["madre", "padre", "hija", "hijo"].map((key) => ({
      key,
      x: 150,
      y: 50,
      width: 30,
    }));

    const ys = layoutLabels(cluster, BOX)
      .map((l) => l.y)
      .sort((a, b) => a - b);

    for (let i = 1; i < ys.length; i++) {
      expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(BOX.lineHeight - 1e-9);
    }
  });

  it("marks the labels it had to move, and only those", () => {
    const placed = layoutLabels(
      [
        { key: "a", x: 150, y: 50, width: 30 },
        { key: "b", x: 150, y: 51, width: 30 },
      ],
      BOX,
    );

    expect(placed[0].displaced).toBe(false); // kept its line
    expect(placed[1].displaced).toBe(true); // pushed down to clear it
    expect(placed[1].pointY).toBe(51); // the leader line still knows its point
  });

  it("keeps every label inside the box", () => {
    const bottom: LabelAnchor[] = Array.from({ length: 5 }, (_, i) => ({
      key: `w${i}`,
      x: 150,
      y: 99,
      width: 30,
    }));

    for (const label of layoutLabels(bottom, BOX)) {
      expect(label.y).toBeGreaterThanOrEqual(BOX.padding);
      expect(label.y).toBeLessThanOrEqual(BOX.height - BOX.padding);
    }
  });

  it("flips a label that would cross the right edge", () => {
    const [label] = layoutLabels([{ key: "cerca-del-borde", x: 190, y: 20, width: 60 }], BOX);

    expect(label.anchor).toBe("end");
    expect(label.x).toBe(182); // 190 − offset, text runs leftwards
  });

  it("spreads the two sides independently", () => {
    // Same y, opposite sides: neither should move, because they cannot overlap.
    const placed = layoutLabels(
      [
        { key: "izquierda", x: 60, y: 50, width: 40 },
        { key: "derecha", x: 140, y: 50, width: 40 },
      ],
      BOX,
    );

    expect(placed.map((l) => l.y)).toEqual([50, 50]);
    expect(placed.map((l) => l.anchor)).toEqual(["end", "start"]);
  });

  it("returns labels in input order", () => {
    const keys = layoutLabels(
      [
        { key: "z", x: 150, y: 80, width: 10 },
        { key: "a", x: 150, y: 10, width: 10 },
      ],
      BOX,
    ).map((l) => l.key);

    expect(keys).toEqual(["z", "a"]);
  });

  it("handles an empty input", () => {
    expect(layoutLabels([], BOX)).toEqual([]);
  });
});

describe("estimateTextWidth", () => {
  it("grows with the text and the font size", () => {
    expect(estimateTextWidth("automóvil", 12)).toBeGreaterThan(estimateTextWidth("gato", 12));
    expect(estimateTextWidth("gato", 16)).toBeGreaterThan(estimateTextWidth("gato", 12));
    expect(estimateTextWidth("", 12)).toBe(0);
  });
});

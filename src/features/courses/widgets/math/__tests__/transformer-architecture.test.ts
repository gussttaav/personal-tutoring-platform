/*
 * COURSE-P5-05 — transformer-architecture tests. The widget carries a claim rather
 * than a computation, so the checks come in two independent kinds.
 *
 * STRUCTURE — the claim Block 5 lesson 1 makes and the diagram is supposed to show:
 * exactly three of the fifteen boxes mix positions, and they are the three attention
 * ones. Plus the navigation invariant the widget exists for: every Block 5 lesson
 * that builds a component is reachable by clicking some box.
 *
 * LAYOUT — the two things a hand-written drawing gets silently wrong: a box outside
 * the viewBox, and two boxes of one column overlapping. Both are checked against the
 * geometry, not against a snapshot, so moving the drawing keeps the guarantees.
 */

import {
  MAX_LABEL_CHARS,
  REPEATED_FRAMES,
  RESIDUAL_LINKS,
  TRANSFORMER_COMPONENTS,
  VIEWBOX,
  centreX,
  centreY,
  componentById,
  crossAttentionPath,
  flowArrows,
  lessonReference,
  mixingComponents,
  residualPath,
  stackOf,
} from "../transformer-architecture";

const ATTENTION = ["atencion-encoder", "atencion-enmascarada", "atencion-cruzada"];

describe("the component list", () => {
  it("has a unique id for every box", () => {
    const ids = TRANSFORMER_COMPONENTS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("draws the fifteen boxes of the paper's figure, six and nine", () => {
    expect(TRANSFORMER_COMPONENTS).toHaveLength(15);
    expect(stackOf("encoder")).toHaveLength(6);
    expect(stackOf("decoder")).toHaveLength(9);
  });

  it("labels every box in lines short enough for its box", () => {
    for (const c of TRANSFORMER_COMPONENTS) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.label.length).toBeLessThanOrEqual(2);
      for (const line of c.label) {
        expect(line.length).toBeLessThanOrEqual(MAX_LABEL_CHARS);
      }
    }
  });

  it("gives every box a one-line description and a lesson", () => {
    for (const c of TRANSFORMER_COMPONENTS) {
      expect(c.description.length).toBeGreaterThan(20);
      expect(c.lesson.lesson).toBeGreaterThanOrEqual(1);
      expect(c.lesson.topic.length).toBeGreaterThan(0);
    }
  });
});

describe("what mixes positions", () => {
  // The teaching claim of Block 5 lesson 1: take the recurrence out and the ONLY
  // thing left that lets position i see position j is attention.
  it("marks the three attention boxes and nothing else", () => {
    expect(mixingComponents().map((c) => c.id).sort()).toEqual([...ATTENTION].sort());
  });

  it("leaves every other box acting on one position at a time", () => {
    const rest = TRANSFORMER_COMPONENTS.filter((c) => !ATTENTION.includes(c.id));
    expect(rest).toHaveLength(12);
    expect(rest.every((c) => !c.mixesPositions)).toBe(true);
  });

  it("puts one mixing box in the encoder and two in the decoder", () => {
    expect(mixingComponents().filter((c) => c.stack === "encoder")).toHaveLength(1);
    expect(mixingComponents().filter((c) => c.stack === "decoder")).toHaveLength(2);
  });
});

describe("navigation", () => {
  it("reaches every Block 5 lesson that builds a component", () => {
    const reached = new Set<number>();
    for (const c of TRANSFORMER_COMPONENTS) {
      for (const ref of [c.lesson, ...c.alsoLessons]) {
        if (ref.block === 5) reached.add(ref.lesson);
      }
    }
    // 2..8. Lesson 1 is the lesson the diagram opens; 9–11 are the project, the map
    // of what comes next and the Colab notebook, and none of them is a box.
    expect([...reached].sort((a, b) => a - b)).toEqual([2, 3, 4, 5, 6, 7, 8]);
  });

  it("names a lesson the way the course's prose does, never as a bare ordinal", () => {
    expect(lessonReference({ block: 5, lesson: 4, topic: "las múltiples cabezas" })).toBe(
      "la lección 4 de este bloque, sobre las múltiples cabezas",
    );
    expect(lessonReference({ block: 4, lesson: 6, topic: "la consulta, la clave y el valor" })).toBe(
      "la lección 6 del bloque anterior, sobre la consulta, la clave y el valor",
    );
    expect(lessonReference({ block: 1, lesson: 6, topic: "las representaciones densas" })).toBe(
      "la lección 6 del bloque 1, sobre las representaciones densas",
    );
  });

  it("resolves an id, and only a real one", () => {
    expect(componentById("atencion-cruzada")?.stack).toBe("decoder");
    expect(componentById("no-existe")).toBeUndefined();
  });
});

describe("the layout", () => {
  it("keeps every box inside the viewBox", () => {
    for (const { box } of TRANSFORMER_COMPONENTS) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.w).toBeLessThanOrEqual(VIEWBOX.width);
      expect(box.y + box.h).toBeLessThanOrEqual(VIEWBOX.height);
    }
  });

  it("never overlaps two boxes of the same column", () => {
    for (const stack of ["encoder", "decoder"] as const) {
      const boxes = stackOf(stack).map((c) => c.box);
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const gap =
            Math.max(boxes[i].y, boxes[j].y) -
            Math.min(boxes[i].y + boxes[i].h, boxes[j].y + boxes[j].h);
          expect(gap).toBeGreaterThan(0);
        }
      }
    }
  });

  it("puts the two columns side by side, each on one vertical axis", () => {
    for (const stack of ["encoder", "decoder"] as const) {
      const xs = new Set(stackOf(stack).map((c) => centreX(c.box)));
      expect(xs.size).toBe(1);
    }
    const [encX] = [...new Set(stackOf("encoder").map((c) => centreX(c.box)))];
    const [decX] = [...new Set(stackOf("decoder").map((c) => centreX(c.box)))];
    expect(decX).toBeGreaterThan(encX);
  });

  it("frames the repeated part of each column without spilling out", () => {
    expect(REPEATED_FRAMES).toHaveLength(2);
    for (const f of REPEATED_FRAMES) {
      expect(f.x).toBeGreaterThanOrEqual(0);
      expect(f.x + f.w).toBeLessThanOrEqual(VIEWBOX.width);
      expect(f.y + f.h).toBeLessThanOrEqual(VIEWBOX.height);
      const inside = stackOf(f.stack).filter(
        (c) => c.box.y >= f.y && c.box.y + c.box.h <= f.y + f.h,
      );
      // The embeddings and the positional encoding happen once; everything above
      // them is the layer that repeats, and the read-out sits on top of the stack.
      expect(inside.length).toBe(f.stack === "encoder" ? 4 : 6);
    }
  });
});

describe("the arrows", () => {
  it("joins consecutive boxes of a column, always upward", () => {
    for (const stack of ["encoder", "decoder"] as const) {
      const arrows = flowArrows(stack);
      expect(arrows).toHaveLength(stackOf(stack).length - 1);
      for (const a of arrows) {
        expect(a.y2).toBeLessThan(a.y1); // y grows downward: the flow goes up
        expect(a.x1).toBe(a.x2); // straight, on the column's axis
      }
    }
  });

  it("taps each residual between the two boxes it names and lands on the Add & Norm", () => {
    expect(RESIDUAL_LINKS).toHaveLength(5);
    for (const [fromId, sublayerId, toId] of RESIDUAL_LINKS) {
      const from = componentById(fromId)!;
      const sublayer = componentById(sublayerId)!;
      const to = componentById(toId)!;
      const [, tapX, tapY, , outer, , landY, , landX] = residualPath(
        fromId,
        sublayerId,
        toId,
      ).split(" ");

      expect(Number(tapX)).toBe(centreX(from.box));
      // Strictly between the top of the lower box and the bottom of the sublayer:
      // on the arrow that feeds it, which is what a residual taps.
      expect(Number(tapY)).toBeLessThan(from.box.y);
      expect(Number(tapY)).toBeGreaterThan(sublayer.box.y + sublayer.box.h);
      expect(Number(landY)).toBe(centreY(to.box));
      // Down the OUTER side of its column, and back into the box's near edge.
      if (from.stack === "encoder") {
        expect(Number(outer)).toBeLessThan(to.box.x);
        expect(Number(landX)).toBe(to.box.x);
      } else {
        expect(Number(outer)).toBeGreaterThan(to.box.x + to.box.w);
        expect(Number(landX)).toBe(to.box.x + to.box.w);
      }
      expect(Number(outer)).toBeGreaterThanOrEqual(0);
      expect(Number(outer)).toBeLessThanOrEqual(VIEWBOX.width);
    }
  });

  it("refuses to draw a residual through a box that does not exist", () => {
    expect(() => residualPath("pe-encoder", "no-existe", "suma-norm-enc-1")).toThrow(
      /no component with id/,
    );
  });

  it("carries the keys and the values from the top of the encoder into the cross-attention", () => {
    const top = componentById("suma-norm-enc-2")!.box;
    const target = componentById("atencion-cruzada")!.box;
    const parts = crossAttentionPath().split(" ");
    expect(Number(parts[1])).toBe(centreX(top));
    expect(Number(parts[2])).toBe(top.y); // leaves through the top edge
    const midX = Number(parts[6]);
    expect(midX).toBeGreaterThan(top.x + top.w); // runs between the two columns
    expect(midX).toBeLessThan(target.x);
    expect(Number(parts[8])).toBe(centreY(target)); // enters at its middle
    expect(Number(parts[10])).toBe(target.x); // through its left edge
  });
});

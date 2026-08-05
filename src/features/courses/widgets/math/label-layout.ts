/*
 * COURSE-P5-01 — Collision-free placement for point labels in a scatter plot.
 *
 * Written for `embedding-projection`, where the interesting words are by construction
 * the ones CLOSEST together: selecting an entry lights up its nearest neighbours, so
 * six labels land inside a cluster a few pixels wide and overprint each other into an
 * unreadable smear. Drawing each label at `point.x + r` is exactly wrong for this plot.
 *
 * The fix is the standard one-dimensional label-spreading pass: labels keep their point's
 * y where they can, and where they cannot they are pushed apart along y until each has a
 * line of its own, then clamped inside the box. A label that moved gets `displaced: true`
 * so the caller can draw a leader line back to its point — without that line, a label
 * pushed 20px away has stopped naming anything.
 *
 * Side is chosen OUTWARD — a point left of the plot's centre labels to its left, one right
 * of it to its right — falling back to the other side when the text would leave the box.
 * Outward matters because the drawing usually lives between the labelled points: in the
 * analogy view, labelling `hombre` and `mujer` to their right writes both names straight
 * along the arrows they are naming. The two sides are then spread INDEPENDENTLY: they
 * cannot collide with each other, and treating them as one column would move labels for
 * no reason.
 *
 * Pure, so it is tested rather than eyeballed in a browser.
 */

export interface LabelAnchor {
  /** Stable identity — the word being labelled. */
  key: string;
  /** The point the label belongs to, in px within the plot box. */
  x: number;
  y: number;
  /** Rendered text width in px. An estimate is fine; it only picks the side. */
  width: number;
}

export interface PlacedLabel {
  key: string;
  /** Text x, already offset from the point on the chosen side. */
  x: number;
  /** Text y after spreading. */
  y: number;
  /** SVG `text-anchor`: the label sits right of its point, or left of it. */
  anchor: "start" | "end";
  /** The label moved off its point's y — draw a leader line to `[pointX, pointY]`. */
  displaced: boolean;
  /** The point, so the caller can draw that leader without a second lookup. */
  pointX: number;
  pointY: number;
}

export interface LabelLayoutOptions {
  /** Plot width in px — the right edge a label must not cross. */
  width: number;
  /** Plot height in px — the vertical range labels are clamped into. */
  height: number;
  /** Minimum vertical distance between two labels, in px. */
  lineHeight?: number;
  /** Horizontal distance from the point to the start of its text, in px. */
  offset?: number;
  /** Keep-out margin at the edges, in px. */
  padding?: number;
  /** x labels point away from. Defaults to the middle of the plot. */
  centreX?: number;
}

/** A label counts as displaced past this many px of movement — below it, a leader
 *  line would be shorter than the text is tall and reads as a smudge. */
const DISPLACED_EPSILON = 2;

/**
 * Place `anchors` so no two labels on the same side overlap vertically.
 *
 * Order of the returned array matches the input, so the caller can zip it with its own
 * data. Anchors are not mutated.
 */
export function layoutLabels(
  anchors: readonly LabelAnchor[],
  { width, height, lineHeight = 14, offset = 8, padding = 4, centreX }: LabelLayoutOptions,
): PlacedLabel[] {
  const middle = centreX ?? width / 2;

  const placed = anchors.map((a) => {
    const fitsRight = a.x + offset + a.width <= width - padding;
    const fitsLeft = a.x - offset - a.width >= padding;
    // Outward from the centre, unless that side runs out of box.
    const right = a.x >= middle ? fitsRight || !fitsLeft : !(fitsLeft || !fitsRight);
    return {
      key: a.key,
      x: right ? a.x + offset : a.x - offset,
      y: a.y,
      anchor: (right ? "start" : "end") as "start" | "end",
      displaced: false,
      pointX: a.x,
      pointY: a.y,
    };
  });

  for (const side of ["start", "end"] as const) {
    // Indices into `placed`, so the spread can write back in input order.
    const column = placed
      .map((label, index) => ({ label, index }))
      .filter((entry) => entry.label.anchor === side)
      .sort((a, b) => a.label.y - b.label.y);

    if (column.length === 0) continue;

    // Downward pass: give every label the line below its neighbour if it needs one.
    let previous = -Infinity;
    for (const { label } of column) {
      label.y = Math.max(label.y, previous + lineHeight, padding + lineHeight / 2);
      previous = label.y;
    }

    // Upward pass: the downward one can push the last label off the bottom edge.
    let next = Infinity;
    for (let i = column.length - 1; i >= 0; i--) {
      const { label } = column[i];
      label.y = Math.min(label.y, next - lineHeight, height - padding - lineHeight / 2);
      next = label.y;
    }
  }

  return placed.map((label, i) => ({
    ...label,
    displaced: Math.abs(label.y - anchors[i].y) > DISPLACED_EPSILON,
  }));
}

/**
 * Rough rendered width of `text` at `fontSize`, in px, for picking a label's side.
 * A metric-accurate measurement needs a DOM; this only has to be close enough that a
 * label near the edge flips, so it takes the ~0.55em average of the UI sans stack.
 */
export function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.55;
}

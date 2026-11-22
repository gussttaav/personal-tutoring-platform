/*
 * BLOG-27 — where the latency-budget figure puts its reference labels (pure, unit-tested).
 *
 * Each reference (59 ms, 208 ms, Twilio's 1,115 ms) is a dashed vertical line with a label in
 * its own row above the lanes, and the line is drawn up to its label's row so the two read as
 * one mark. Horizontally a label sits right of its line, else left of it, else as far right as
 * it fits (a phone). The rows are then chosen so that no line, on its way up to its label,
 * crosses another label: a line passes every row below its own, so a label in a lower row must
 * not cover a line whose label is higher.
 */

export interface RefInput {
  x: number;
  /** Estimated rendered width of the label, px. */
  width: number;
}

export interface RefPlacement {
  /** Text position and anchor. */
  labelX: number;
  anchor: "start" | "end";
  /** The label's horizontal extent, px. */
  left: number;
  right: number;
  /** 0 = top row. */
  row: number;
}

const GAP = 4;
const CLEARANCE = 2;

export function placeHorizontally(x: number, width: number, maxX: number): Omit<RefPlacement, "row"> {
  if (x + GAP + width <= maxX) return { labelX: x + GAP, anchor: "start", left: x + GAP, right: x + GAP + width };
  if (x - GAP - width >= 0) return { labelX: x - GAP, anchor: "end", left: x - GAP - width, right: x - GAP };
  const left = Math.max(0, maxX - width);
  return { labelX: left, anchor: "start", left, right: left + width };
}

function permutations(n: number): number[][] {
  if (n === 0) return [[]];
  return permutations(n - 1).flatMap((p) =>
    Array.from({ length: n }, (_, i) => [...p.slice(0, i), n - 1, ...p.slice(i)]),
  );
}

/** How many label/line crossings a row assignment makes (rows[i] = row of ref i). */
export function crossings(refs: RefInput[], placed: Omit<RefPlacement, "row">[], rows: number[]): number {
  let n = 0;
  for (let i = 0; i < refs.length; i++) {
    for (let j = 0; j < refs.length; j++) {
      if (i === j || rows[j] <= rows[i]) continue;
      // ref i's line runs from row rows[i] down, through row rows[j], where ref j's label is.
      if (placed[j].left - CLEARANCE <= refs[i].x && refs[i].x <= placed[j].right + CLEARANCE) n++;
    }
  }
  return n;
}

/**
 * Places every label and picks the row order with the fewest crossings, preferring, among
 * equals, the order the refs were given in (left to right reads best).
 */
export function layoutRefs(refs: RefInput[], maxX: number): RefPlacement[] {
  const placed = refs.map((r) => placeHorizontally(r.x, r.width, maxX));
  let best: number[] = refs.map((_, i) => i);
  let bestCost = crossings(refs, placed, best);
  for (const rows of permutations(refs.length)) {
    if (bestCost === 0) break;
    const cost = crossings(refs, placed, rows);
    if (cost < bestCost) {
      best = rows;
      bestCost = cost;
    }
  }
  return placed.map((p, i) => ({ ...p, row: best[i] }));
}

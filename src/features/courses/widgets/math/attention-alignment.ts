/*
 * COURSE-P5-04 — The alignment matrix behind `attention-alignment` (Block 4 lessons 3
 * and 4), and the mixture it feeds.
 *
 * Attention gives output step i its own context vector, built as a weighted mixture of
 * every encoder state instead of a single frozen summary:
 *
 *   c_i = Σ_j α_ij · h̄_j,   with α_ij ≥ 0 and Σ_j α_ij = 1
 *
 * The α here are PRECOMPUTED and hand-set — I chose them for the course. A trained
 * attention model does not run in Pyodide or in a widget, and none of the teaching
 * claims need one: what the student has to see is that the row moves with i, that the
 * moves are interpretable, and that the whole row still sums to one. The lesson says
 * out loud that the numbers are mine.
 *
 * The pair is deliberately NOT monotonic, because a diagonal alignment teaches nothing
 * a fixed summary could not also do:
 *   · «leí» (j = 2) feeds BOTH «i» and «read» — one source token, two output steps,
 *     because Spanish carries the pronoun inside the conjugation.
 *   · «book» (i = 7) reaches back past «very good» to «libro» (j = 4), while steps 5
 *     and 6 sit on «muy» and «bueno» (j = 5, 6) — the lines cross, which is the
 *     reordering the fixed summary had to hold in its head.
 *
 * The row-stochastic invariant is the one that has to be checked rather than trusted
 * (it is the classic silent bug in an attention visualisation: a row that sums to 0.97
 * looks exactly like a row that sums to 1). `rowSums` is what the widget prints beside
 * every row, and the test asserts it on both matrices.
 */

/** Source tokens, x_{1:T_x} — what the encoder read, in order. */
export const ALIGNMENT_SOURCE = ["ayer", "leí", "un", "libro", "muy", "bueno"] as const;

/** Target tokens, y_{1:T_y} — what the decoder writes, <EOS> included. */
export const ALIGNMENT_TARGET = [
  "yesterday",
  "i",
  "read",
  "a",
  "very",
  "good",
  "book",
  "<EOS>",
] as const;

/**
 * α, shape (T_y × T_x): row i is what output step i draws from each source position.
 * Hand-set (see the header). Every row sums to 1 — asserted in the test, printed by the
 * widget.
 */
export const ATTENTION_ALIGNMENT: number[][] = [
  //  ayer   leí    un     libro  muy    bueno
  [0.86, 0.06, 0.03, 0.02, 0.02, 0.01], // yesterday
  [0.09, 0.74, 0.05, 0.07, 0.03, 0.02], // i      ← sale de la conjugación de «leí»
  [0.04, 0.81, 0.04, 0.06, 0.03, 0.02], // read   ← y «leí» otra vez: uno a muchos
  [0.02, 0.05, 0.72, 0.15, 0.03, 0.03], // a
  [0.02, 0.03, 0.04, 0.06, 0.79, 0.06], // very
  [0.02, 0.02, 0.03, 0.05, 0.1, 0.78], //  good
  [0.02, 0.03, 0.06, 0.76, 0.05, 0.08], // book   ← vuelve a «libro»: las líneas se cruzan
  [0.02, 0.03, 0.03, 0.12, 0.07, 0.73], // <EOS>
];

/**
 * Encoder states h̄_1 … h̄_{T_x}, shape (T_x × d_h) with d_h = 5. Also mine, and also
 * only illustrative: they exist so the mixture produces a vector the student can watch
 * change from step to step. Coordinates live in (−1, 1), which is where a tanh state
 * lives.
 */
export const ENCODER_STATES: number[][] = [
  [0.82, -0.31, 0.1, 0.45, -0.62], // ayer
  [-0.55, 0.71, 0.28, -0.14, 0.36], // leí
  [0.12, 0.44, -0.77, 0.21, 0.08], // un
  [0.39, -0.68, 0.52, 0.77, -0.11], // libro
  [-0.24, 0.15, 0.63, -0.58, 0.49], // muy
  [0.66, 0.29, -0.35, 0.18, 0.74], // bueno
];

/**
 * The alignment the encoder-decoder of Block 4 lesson 1 implements without ever writing
 * it down: all the mass on the last source position, at every output step. It is a legal
 * α — non-negative, rows summing to 1 — so the fixed summary is not a different
 * architecture, it is this one with its weights frozen and blind to i.
 */
export function frozenAlignment(targetLength: number, sourceLength: number): number[][] {
  assertPositive(targetLength, "T_y");
  assertPositive(sourceLength, "T_x");
  return Array.from({ length: targetLength }, () =>
    Array.from({ length: sourceLength }, (_, j) => (j === sourceLength - 1 ? 1 : 0)),
  );
}

/** Every row's total. One per output step; each must be 1. */
export function rowSums(alpha: number[][]): number[] {
  return alpha.map((row) => row.reduce((acc, w) => acc + w, 0));
}

/** Which source position a row leans on, and by how much. */
export function topSource(row: number[]): { index: number; weight: number } {
  if (row.length === 0) throw new Error("attention-alignment: empty weight row");
  let index = 0;
  for (let j = 1; j < row.length; j++) {
    if (row[j] > row[index]) index = j;
  }
  return { index, weight: row[index] };
}

/**
 * c_i = Σ_j α_ij · h̄_j for one output step — the weighted mixture, and the whole
 * mechanism in one line. Note what the shapes do: `weights` is as long as the source,
 * so it grows with the input, while the result is always d_h long, which is what lets
 * c_i sit exactly where the fixed summary used to.
 */
export function mixture(weights: number[], states: number[][]): number[] {
  if (weights.length !== states.length) {
    throw new Error(
      `attention-alignment: ${weights.length} weights against ${states.length} states`,
    );
  }
  const width = states[0]?.length ?? 0;
  const out = new Array<number>(width).fill(0);
  states.forEach((state, j) => {
    if (state.length !== width) {
      throw new Error(`attention-alignment: state ${j} has width ${state.length}, not ${width}`);
    }
    for (let k = 0; k < width; k++) out[k] += weights[j] * state[k];
  });
  return out;
}

/** Every step's context vector, shape (T_y × d_h). */
export function contextVectors(alpha: number[][], states: number[][]): number[][] {
  return alpha.map((row) => mixture(row, states));
}

function assertPositive(n: number, name: string): void {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`attention-alignment: ${name} must be a positive integer, got ${n}`);
  }
}

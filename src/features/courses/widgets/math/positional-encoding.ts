/*
 * COURSE-P5-05 — `positional-encoding`: the paper's sinusoidal encoding, as numbers
 * (Block 5 lesson 5).
 *
 * NOTHING HERE IS HAND-SET, which makes this module the odd one out among the block's
 * widgets. `self-attention` and `multi-head` run on four rules I wrote for the course;
 * this one is *Attention is All You Need*'s formula and only that:
 *
 *     PE[pos][2i]   = sin(pos · ω_i)      ω_i = 1 / 10000^(2i/d_model)
 *     PE[pos][2i+1] = cos(pos · ω_i)
 *
 * So d_model splits into d_model/2 PAIRS, each pair a sine and a cosine turning at its
 * own speed, and the speeds form a geometric progression: pair 0 comes back round every
 * 2π ≈ 6.28 positions, the last pair every 2π · 10000^((d−2)/d) — some 35 000 positions
 * at d = 32, which is flat over any text. That ladder is what the heat map draws.
 *
 * THE TWO IDENTITIES THE LESSON RESTS ON are both here rather than in the component,
 * because they are the teaching claim and the tests are what verify it:
 *
 *   - `shiftMatrix(k, d)` — moving k positions along is a rotation by the fixed angle
 *     ω_i·k inside every pair, so PE[pos+k] = M_k · PE[pos] with THE SAME M_k at every
 *     pos. That is the whole content of «relative positions are a linear function of the
 *     encoding», and `pos` genuinely does not appear in the matrix.
 *   - `overlap(k, d)` — the dot product of two rows k apart is Σ_i cos(ω_i·k), which
 *     depends on k and not on where the pair sits. It is the quantity an attention score
 *     can actually see, so it is the one the widget's panel prints from three different
 *     positions to show it does not move.
 *
 * Pure and DOM-free like every other widget's numbers.
 */

import type { Matrix, Vector } from "./linalg";

/** The paper's constant. Nothing derives it; it fixes how long the slowest pair is. */
export const BASE = 10000;

/** Drawn width and height of the default map — a phone still fits 32 columns. */
export const DEFAULT_D = 32;
export const DEFAULT_T = 24;

/** The largest offset the widget's slider offers. */
export const MAX_SHIFT = 8;

function assertEven(d: number): void {
  if (d < 2 || d % 2 !== 0) {
    throw new Error(`positional encoding: d_model must be even and ≥ 2, got ${d}`);
  }
}

/** Which pair a coordinate belongs to: 0 and 1 are pair 0, 2 and 3 are pair 1… */
export function pairOf(column: number): number {
  return Math.floor(column / 2);
}

/** Even coordinates carry the sine, odd ones the cosine of the same angle. */
export function isSine(column: number): boolean {
  return column % 2 === 0;
}

/** ω_i — how fast pair `i` turns, in radians per position. */
export function angularFrequency(pair: number, d: number): number {
  assertEven(d);
  return 1 / Math.pow(BASE, (2 * pair) / d);
}

/** 2π/ω_i — how many positions that pair takes to come back round. */
export function wavelength(pair: number, d: number): number {
  return (2 * Math.PI) / angularFrequency(pair, d);
}

/** PE, shape (T × d): row `pos` is that position's encoding. */
export function positionalEncoding(T: number, d: number): Matrix {
  assertEven(d);
  const omegas = Array.from({ length: d / 2 }, (_, i) => angularFrequency(i, d));
  return Array.from({ length: T }, (_, pos) =>
    Array.from({ length: d }, (_, col) => {
      const angle = pos * omegas[pairOf(col)];
      return isSine(col) ? Math.sin(angle) : Math.cos(angle);
    }),
  );
}

/**
 * M_k, shape (d × d): block-diagonal, one 2×2 rotation per pair, and no `pos` in it.
 *
 * Pair i's block is [[cos ω_i k, sin ω_i k], [−sin ω_i k, cos ω_i k]], which is the
 * angle-addition formulas read as a matrix: it sends (sin ω_i·pos, cos ω_i·pos) to
 * (sin ω_i(pos+k), cos ω_i(pos+k)) for every pos at once.
 */
export function shiftMatrix(k: number, d: number): Matrix {
  assertEven(d);
  const m: Matrix = Array.from({ length: d }, () => new Array<number>(d).fill(0));
  for (let i = 0; i < d / 2; i++) {
    const angle = k * angularFrequency(i, d);
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const even = 2 * i;
    m[even][even] = c;
    m[even][even + 1] = s;
    m[even + 1][even] = -s;
    m[even + 1][even + 1] = c;
  }
  return m;
}

/** Matrix by column vector — `matmul` wants a matrix on the right, and a row is not one. */
export function apply(m: Matrix, v: Vector): Vector {
  return m.map((row) => row.reduce((acc, value, j) => acc + value * v[j], 0));
}

export function dot(a: Vector, b: Vector): number {
  return a.reduce((acc, value, i) => acc + value * b[i], 0);
}

/**
 * Σ_i cos(ω_i·k) — what two rows `k` apart score against each other, wherever they are.
 *
 * At k = 0 every term is 1, so it is d/2: a position overlaps itself by half its
 * coordinates, which is the sines and cosines of one pair summing to 1.
 */
export function overlap(k: number, d: number): number {
  assertEven(d);
  let total = 0;
  for (let i = 0; i < d / 2; i++) {
    total += Math.cos(k * angularFrequency(i, d));
  }
  return total;
}

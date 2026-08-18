/*
 * COURSE-P2-01 — Scaled dot-product attention, the pure kernel.
 *
 * The single most important computation in the course (Block 4/5). Kept as a pure
 * function over plain matrices so it can be unit-tested for shape and known values,
 * and so the attention heat-map widget (P5) just renders whatever this returns.
 *
 * COURSE-P5-05 — + the scaled scores, pre-softmax. `self-attention-heatmap` (Block 5
 * lesson 2) needs them because one of that lesson's claims is about the SCORES and not
 * about the weights: with Q = K = X the grid Q·Kᵀ is symmetric, while the weights are
 * not, each row being normalised by its own denominator. Returning them here keeps the
 * widget from recomputing half the kernel to say so.
 */

import { matmul, transpose, softmaxRows, type Matrix } from "./linalg";

export interface AttentionResult {
  /** Q·Kᵀ/√dₖ, shape (nq × nk) — what the softmax is applied to. */
  scores: Matrix;
  /** Row-wise softmax weights, shape (nq × nk). Each row sums to 1. */
  weights: Matrix;
  /** Attention output, shape (nq × dv). */
  output: Matrix;
}

/**
 * Scaled dot-product attention:
 *
 *   Attention(Q, K, V) = softmax(Q·Kᵀ / √dₖ) · V
 *
 * Shapes: Q is (nq × dk), K is (nk × dk), V is (nk × dv). Returns the scaled scores
 * and the attention weights (both nq × nk) and the output (nq × dv). Throws when the
 * key/value counts or the Q/K feature dimensions disagree.
 */
export function scaledDotProductAttention(q: Matrix, k: Matrix, v: Matrix): AttentionResult {
  const dk = q[0]?.length ?? 0;
  if ((k[0]?.length ?? 0) !== dk) {
    throw new Error(
      `attention: Q feature dim ${dk} ≠ K feature dim ${k[0]?.length ?? 0}`,
    );
  }
  if (k.length !== v.length) {
    throw new Error(`attention: K has ${k.length} keys but V has ${v.length} values`);
  }

  const scale = dk > 0 ? Math.sqrt(dk) : 1;
  const scores = matmul(q, transpose(k)).map((row) => row.map((s) => s / scale));
  const weights = softmaxRows(scores);
  const output = matmul(weights, v);
  return { scores, weights, output };
}

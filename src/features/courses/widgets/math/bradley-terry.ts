/*
 * COURSE-C2-P1-02 — The Bradley–Terry model, for `bradley-terry` (llm-agents Block 2 lesson 4,
 * «Preferencias y el modelo de recompensa»).
 *
 * Two responses to one instruction carry rewards r_A and r_B, and an annotator prefers A with
 * probability σ(r_A − r_B): the softmax of the two rewards, which is why only their difference
 * enters. The widget draws that probability and the loss of the comparison «A was chosen»,
 * −log σ(r_A − r_B), against the margin, and lets the reader add one constant c to both rewards
 * to see that nothing below moves — the reward is defined up to a constant per instruction.
 *
 * Pure and DOM-free. `__tests__/bradley-terry.test.ts` checks the limits by hand and holds the
 * numbers the lesson quotes (ln 3 for three to one, 9/10 for two of them chained, the weights
 * σ(−4) and σ(1) its quiz compares).
 */

/** P(A ≻ B) = σ(r_A − r_B) = e^{r_A} / (e^{r_A} + e^{r_B}). Stable at any margin. */
export function preferProbability(rA: number, rB: number): number {
  const m = rA - rB;
  if (m >= 0) return 1 / (1 + Math.exp(-m));
  const e = Math.exp(m);
  return e / (1 + e);
}

/**
 * −log σ(m) = log(1 + e^{−m}), written so neither branch overflows: at m = 1000 it is 0, at
 * m = −1000 it is 1000, never Infinity or NaN.
 */
export function negLogSigmoid(m: number): number {
  return m >= 0 ? Math.log1p(Math.exp(-m)) : -m + Math.log1p(Math.exp(m));
}

/** The loss of one comparison in which A was chosen: −log σ(r_A − r_B). */
export function comparisonLoss(rA: number, rB: number): number {
  return negLogSigmoid(rA - rB);
}

/**
 * The derivative of that loss with respect to r_A: −σ(r_B − r_A). With respect to r_B it is the
 * same number with the sign flipped, so the two always add up to zero — which is the gradient
 * telling you, coordinate by coordinate, that a constant added to both cannot be learned.
 */
export function lossSlope(rA: number, rB: number): number {
  return -preferProbability(rB, rA);
}

/** The margin that reproduces a preference rate p: the log odds, ln(p / (1 − p)). */
export function marginForProbability(p: number): number {
  if (!(p > 0 && p < 1)) throw new RangeError(`a preference rate lies strictly between 0 and 1, got ${p}`);
  return Math.log(p / (1 - p));
}

/** Points of f over [lo, hi], n of them, for a polyline. */
export function sampleCurve(f: (m: number) => number, lo: number, hi: number, n: number): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const m = lo + ((hi - lo) * i) / (n - 1);
    return [m, f(m)] as [number, number];
  });
}

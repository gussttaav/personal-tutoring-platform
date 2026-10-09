/*
 * COURSE-C2-P1-02 — The DPO loss, for `dpo-loss` (llm-agents Block 2 lesson 6, «DPO: la
 * derivación completa»).
 *
 * One comparison, read through the two log ratios the loss sees: ℓ_w = log π_θ(y_w)/π_ref(y_w)
 * for the preferred response and ℓ_l for the rejected one. The implicit rewards are β ℓ_w and
 * β ℓ_l, the margin their difference, and the loss −log σ(margin): lesson 4's Bradley–Terry
 * loss with the implicit reward inside. Its gradient with respect to the two log ratios is
 * ∓β σ(−margin), and that factor, σ(r_l − r_w), is how wrong the implicit reward still is: near
 * 1 when the pair is ordered the wrong way round, ½ at the reference, and «quiet» (near 0) once
 * the pair is ordered by a margin of a few units.
 *
 * Everything depends on ℓ_w − ℓ_l only, so the field on the (ℓ_w, ℓ_l) plane is constant along
 * the diagonals, and β sets how far from the diagonal it goes quiet: the factor is f where
 * ℓ_w − ℓ_l = log((1 − f)/f) / β.
 *
 * Pure and DOM-free. `__tests__/dpo.test.ts` checks the limits by hand (equal log ratios, β → 0,
 * the two extremes of the factor) and holds the numbers the lesson quotes.
 */

import { negLogSigmoid, preferProbability } from "./bradley-terry";

/** The implicit-reward margin r_θ(x, y_w) − r_θ(x, y_l) = β (ℓ_w − ℓ_l). */
export function implicitMargin(lw: number, ll: number, beta: number): number {
  return beta * (lw - ll);
}

/** The DPO loss of one comparison: −log σ(β (ℓ_w − ℓ_l)). Finite at any margin. */
export function dpoLoss(lw: number, ll: number, beta: number): number {
  return negLogSigmoid(implicitMargin(lw, ll, beta));
}

/**
 * The factor that multiplies the comparison's direction in the gradient,
 * σ(r_θ(x, y_l) − r_θ(x, y_w)) = σ(−margin): the probability the implicit reward still gives
 * to the order the annotator did not choose.
 */
export function gradientFactor(lw: number, ll: number, beta: number): number {
  return preferProbability(0, implicitMargin(lw, ll, beta));
}

/**
 * The loss's derivatives with respect to the two log ratios: −β·factor for ℓ_w and +β·factor for
 * ℓ_l. A descent step therefore raises log π_θ(y_w) and lowers log π_θ(y_l) by the same amount,
 * β·factor times the step, and the two always add up to zero.
 */
export function logRatioGradient(lw: number, ll: number, beta: number): { dw: number; dl: number } {
  const push = beta * gradientFactor(lw, ll, beta);
  return { dw: -push, dl: push };
}

/** The margin at which the factor equals f: σ(−m) = f, so m = log((1 − f) / f). */
export function marginForFactor(f: number): number {
  if (!(f > 0 && f < 1)) throw new RangeError(`a factor lies strictly between 0 and 1, got ${f}`);
  return Math.log((1 - f) / f);
}

/** The loss of a comparison whose factor is f: −log σ(m) with σ(m) = 1 − f, so −log(1 − f). */
export function lossForFactor(f: number): number {
  if (!(f >= 0 && f < 1)) throw new RangeError(`a factor lies in [0, 1), got ${f}`);
  return -Math.log1p(-f);
}

/** The gap ℓ_w − ℓ_l at which the factor equals f, for a given β: where its isoline sits. */
export function gapForFactor(f: number, beta: number): number {
  return marginForFactor(f) / beta;
}

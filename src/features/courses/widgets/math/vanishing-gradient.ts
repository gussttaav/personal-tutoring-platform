/*
 * COURSE-P5-03 — The long-run pace of the BPTT product, as a pure function of the
 * spectral radius.
 *
 * Backpropagation through time (Block 3 lesson 3) transports the error from step T
 * back to step k by multiplying, once per step, by `diag(tanh'(p_t)) · W_hhᵀ`. With
 * every mask at 1 (a recurrence with no tanh) that product is (W_hhᵀ)^d, and its norm
 * moves per step at the long-run rate ρ, the spectral radius of W_hh
 * (‖Wᵈ‖^(1/d) → ρ). This module draws that pace, ρ^d, DOM-free so the widget can be
 * unit-tested without a browser (same split as math/activations.ts). ρ > 1 is allowed
 * on purpose: exploding gradients are half the phenomenon, not a footnote.
 *
 * COURSE-P11-06 — this is NOT a bound once the masks come in. The product is then no
 * longer a power; the guarantee is (γ·σ_max)^d, with σ_max the largest singular value
 * and γ the steepest slope over the steps crossed, and ρ alone guarantees nothing
 * (Block 3 lesson 4's <Details> has a ρ = 0 matrix whose masked product grows as
 * 1.8^d). `saturation` scales each step by a constant γ: a uniformly saturated mask,
 * a model rather than a bound.
 */

/** max of tanh'(x) = 1 − tanh(x)², attained at x = 0. The most favourable mask. */
export const MAX_TANH_PRIME = 1;

/**
 * The per-step multiplier of the modelled product: spectral radius × a constant tanh
 * slope. The curve falls when this is below 1 and rises when it is above 1, so the
 * crossover sits at ρ = 1/γ (at ρ = 1 when γ = 1, the maskless case the widget draws).
 */
export function stepFactor(spectralRadius: number, saturation: number = MAX_TANH_PRIME): number {
  return spectralRadius * saturation;
}

/**
 * Magnitude of the gradient transported across each distance 0..`maxDistance`,
 * relative to 1 at distance 0: (γ·ρ)^d.
 *
 *   magnitudes[0] === 1                       (nothing transported yet)
 *   magnitudes[d + 1] / magnitudes[d] === γρ  (one more step, one more factor)
 *
 * Strictly decreasing when γρ < 1 (vanishing), strictly increasing when γρ > 1
 * (exploding), flat when γρ = 1. `saturation` defaults to γ = 1, every mask at 1: the
 * recurrence with no tanh, where ρ is exactly the long-run pace of the transport.
 */
export function gradientMagnitudes(
  spectralRadius: number,
  saturation: number,
  maxDistance: number,
): number[] {
  if (!Number.isInteger(maxDistance) || maxDistance < 0) {
    throw new Error(
      `gradientMagnitudes: maxDistance must be a non-negative integer, got ${maxDistance}`,
    );
  }
  const factor = stepFactor(spectralRadius, saturation);
  // Math.pow(factor, d) rather than an accumulating product, so magnitudes[0] is
  // exactly 1 and the ratio test is not eroded by rounding.
  const out: number[] = [];
  for (let d = 0; d <= maxDistance; d++) {
    out.push(Math.pow(factor, d));
  }
  return out;
}

/*
 * COURSE-P5-03 — The exponential envelope of the BPTT product, as a pure function
 * of the spectral radius.
 *
 * Backpropagation through time (Block 3 lesson 3) transports the error from step T
 * back to step k by multiplying, once per step, by `diag(tanh'(p_t)) · W_hh`. Over a
 * distance d = T − k that is a product of d such factors, and its magnitude is
 * bounded by (γ·ρ)^d, where ρ is the spectral radius of W_hh and γ = max tanh' ≤ 1 is
 * the steepest the tanh mask can be. This module is that envelope, DOM-free so the
 * widget that draws it can be unit-tested without a browser (same split as
 * math/activations.ts). ρ > 1 is allowed on purpose: exploding gradients are half the
 * phenomenon, not a footnote.
 */

/** max of tanh'(x) = 1 − tanh(x)², attained at x = 0. The most favourable mask. */
export const MAX_TANH_PRIME = 1;

/**
 * The per-step multiplier of the transported gradient: spectral radius × tanh slope.
 * The gradient vanishes when this is below 1 and explodes when it is above 1, so the
 * crossover sits at ρ = 1/γ (at ρ = 1 when γ = 1).
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
 * (exploding), flat when γρ = 1. `saturation` defaults to the most optimistic mask
 * (γ = 1): even then a spectral radius below 1 vanishes, and saturation only makes it
 * worse.
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

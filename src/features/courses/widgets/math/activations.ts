/*
 * COURSE-P2-01 — Activation functions + their derivatives.
 *
 * Pure, DOM-free maths so the widgets that draw these curves can be unit-tested
 * without a browser (the whole reason the maths lives outside the components).
 * Every derivative has a finite-difference test guarding it.
 */

/** Logistic sigmoid, σ(x) = 1 / (1 + e⁻ˣ). Range (0, 1). */
export function sigmoid(x: number): number {
  // Split by sign to avoid overflow of e^x for large positive x.
  if (x >= 0) {
    return 1 / (1 + Math.exp(-x));
  }
  const ex = Math.exp(x);
  return ex / (1 + ex);
}

/** σ'(x) = σ(x)·(1 − σ(x)). */
export function sigmoidPrime(x: number): number {
  const s = sigmoid(x);
  return s * (1 - s);
}

/** Hyperbolic tangent. Range (−1, 1). */
export function tanh(x: number): number {
  return Math.tanh(x);
}

/** tanh'(x) = 1 − tanh(x)². */
export function tanhPrime(x: number): number {
  const t = Math.tanh(x);
  return 1 - t * t;
}

/** Rectified linear unit, max(0, x). */
export function relu(x: number): number {
  return x > 0 ? x : 0;
}

/** ReLU'(x): 1 for x > 0, else 0. Undefined at 0; we take the sub-gradient 0. */
export function reluPrime(x: number): number {
  return x > 0 ? 1 : 0;
}

/** Leaky ReLU: x for x > 0, else α·x (default α = 0.01). */
export function leakyRelu(x: number, alpha = 0.01): number {
  return x > 0 ? x : alpha * x;
}

/** Leaky ReLU'(x): 1 for x > 0, else α. Sub-gradient 1 at 0. */
export function leakyReluPrime(x: number, alpha = 0.01): number {
  return x >= 0 ? 1 : alpha;
}

// GELU via the tanh approximation used by GPT/BERT:
//   0.5·x·(1 + tanh[√(2/π)·(x + 0.044715·x³)]).
const GELU_C = Math.sqrt(2 / Math.PI);
const GELU_A = 0.044715;

/** Gaussian Error Linear Unit (tanh approximation). */
export function gelu(x: number): number {
  const inner = GELU_C * (x + GELU_A * x * x * x);
  return 0.5 * x * (1 + Math.tanh(inner));
}

/** GELU'(x) — analytic derivative of the tanh approximation above. */
export function geluPrime(x: number): number {
  const inner = GELU_C * (x + GELU_A * x * x * x);
  const t = Math.tanh(inner);
  const sech2 = 1 - t * t; // sech² = 1 − tanh²
  const dInner = GELU_C * (1 + 3 * GELU_A * x * x);
  return 0.5 * (1 + t) + 0.5 * x * sech2 * dInner;
}

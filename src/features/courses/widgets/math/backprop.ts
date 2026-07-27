/*
 * COURSE-P2-02 — Backpropagation, as a pure function, for `backprop-trace`.
 *
 * This is the course's centrepiece widget, so its NUMBERS must be trustworthy: the
 * whole value of the explorable is that a student believes the chain-rule factors
 * it shows. Everything here is DOM-free and verified two independent ways in the
 * tests — every analytic gradient against central finite differences of the loss,
 * plus a fully hand-computed round-number example.
 *
 * The fixed architecture is a tiny MLP:
 *
 *   x (2) ── W1,b1 ──▶ z1 (2) ──σ──▶ a1 (2) ── w2,b2 ──▶ z2 ──σ──▶ o ──▶ L = ½(o−t)²
 *
 * `runBackprop` returns the forward values, all parameter gradients, AND an ordered
 * list of chain-rule steps (each factor with its numeric value and their product),
 * which the widget steps through term by term, in either direction.
 */

import { sigmoid } from "./activations";

export interface MlpParams {
  /** Hidden weights, [hiddenNeuron][input]. 2×2. */
  W1: number[][];
  /** Hidden biases, one per hidden neuron. Length 2. */
  b1: number[];
  /** Output weights, one per hidden neuron. Length 2. */
  w2: number[];
  /** Output bias. */
  b2: number;
  /** Target for the squared-error loss. */
  target: number;
}

export interface ForwardState {
  x: number[];
  z1: number[];
  a1: number[];
  z2: number;
  o: number;
  loss: number;
}

export interface Gradients {
  dW1: number[][];
  db1: number[];
  dw2: number[];
  db2: number;
}

export interface TraceFactor {
  /** Human-readable symbol, e.g. "∂L/∂o" or "a1₀". */
  label: string;
  value: number;
}

export interface TraceStep {
  id: string;
  /** The derivative this step computes, e.g. "∂L/∂w2₀". */
  target: string;
  /** Ordered factors whose product is `value`. */
  factors: TraceFactor[];
  value: number;
}

export interface BackpropResult {
  forward: ForwardState;
  grads: Gradients;
  steps: TraceStep[];
}

const SUB = ["₀", "₁", "₂", "₃"] as const;
const sigmoidPrimeFrom = (a: number) => a * (1 - a); // σ'(z) in terms of a = σ(z)

/** Forward pass through the fixed 2-2-1 sigmoid MLP with ½(o−t)² loss. */
export function forward(params: MlpParams, x: number[]): ForwardState {
  const { W1, b1, w2, b2, target } = params;
  const z1 = W1.map((row, j) => row[0] * x[0] + row[1] * x[1] + b1[j]);
  const a1 = z1.map(sigmoid);
  const z2 = w2[0] * a1[0] + w2[1] * a1[1] + b2;
  const o = sigmoid(z2);
  const loss = 0.5 * (o - target) * (o - target);
  return { x, z1, a1, z2, o, loss };
}

/**
 * Backward pass: analytic gradients plus the ordered chain-rule trace. Each step's
 * `value` is exactly the product of its `factors`, so the widget can display "this ×
 * this = that" honestly at every node.
 */
export function runBackprop(params: MlpParams, x: number[]): BackpropResult {
  const fwd = forward(params, x);
  const { a1, o } = fwd;
  const { w2, target } = params;

  const steps: TraceStep[] = [];

  // ── Output node ────────────────────────────────────────────────────────────
  const dLdo = o - target; //           ∂L/∂o
  const doDz2 = sigmoidPrimeFrom(o); //  ∂o/∂z2 = o(1−o)
  const delta2 = dLdo * doDz2; //        ∂L/∂z2

  steps.push({
    id: "dL_do",
    target: "∂L/∂o",
    factors: [{ label: "o − t", value: dLdo }],
    value: dLdo,
  });
  steps.push({
    id: "do_dz2",
    target: "∂o/∂z2",
    factors: [{ label: "o(1 − o)", value: doDz2 }],
    value: doDz2,
  });
  steps.push({
    id: "dL_dz2",
    target: "∂L/∂z2",
    factors: [
      { label: "∂L/∂o", value: dLdo },
      { label: "∂o/∂z2", value: doDz2 },
    ],
    value: delta2,
  });

  // ── Output weights & bias ────────────────────────────────────────────────────
  const dw2 = a1.map((a1j) => delta2 * a1j);
  const db2 = delta2;
  dw2.forEach((g, j) => {
    steps.push({
      id: `dL_dw2_${j}`,
      target: `∂L/∂w2${SUB[j]}`,
      factors: [
        { label: "∂L/∂z2", value: delta2 },
        { label: `a1${SUB[j]}`, value: a1[j] },
      ],
      value: g,
    });
  });
  steps.push({
    id: "dL_db2",
    target: "∂L/∂b2",
    factors: [{ label: "∂L/∂z2", value: delta2 }],
    value: db2,
  });

  // ── Into the hidden layer ────────────────────────────────────────────────────
  const dLda1 = w2.map((w2j) => delta2 * w2j); //     ∂L/∂a1ⱼ
  const da1Dz1 = a1.map(sigmoidPrimeFrom); //          ∂a1ⱼ/∂z1ⱼ
  const delta1 = dLda1.map((d, j) => d * da1Dz1[j]); // ∂L/∂z1ⱼ

  dLda1.forEach((d, j) => {
    steps.push({
      id: `dL_da1_${j}`,
      target: `∂L/∂a1${SUB[j]}`,
      factors: [
        { label: "∂L/∂z2", value: delta2 },
        { label: `w2${SUB[j]}`, value: w2[j] },
      ],
      value: d,
    });
    steps.push({
      id: `dL_dz1_${j}`,
      target: `∂L/∂z1${SUB[j]}`,
      factors: [
        { label: `∂L/∂a1${SUB[j]}`, value: d },
        { label: `a1${SUB[j]}(1 − a1${SUB[j]})`, value: da1Dz1[j] },
      ],
      value: delta1[j],
    });
  });

  // ── Hidden weights & biases ──────────────────────────────────────────────────
  const dW1 = delta1.map((d1j) => x.map((xk) => d1j * xk));
  const db1 = delta1.slice();
  dW1.forEach((row, j) => {
    row.forEach((g, k) => {
      steps.push({
        id: `dL_dW1_${j}_${k}`,
        target: `∂L/∂W1${SUB[j]}${SUB[k]}`,
        factors: [
          { label: `∂L/∂z1${SUB[j]}`, value: delta1[j] },
          { label: `x${SUB[k]}`, value: x[k] },
        ],
        value: g,
      });
    });
  });

  return {
    forward: fwd,
    grads: { dW1, db1, dw2, db2 },
    steps,
  };
}

/** A fixed, tidy default configuration for the widget's initial render. */
export const BACKPROP_PRESET: { params: MlpParams; x: number[] } = {
  params: {
    W1: [
      [0.5, -0.3],
      [0.8, 0.2],
    ],
    b1: [0.1, -0.2],
    w2: [0.7, -0.6],
    b2: 0.15,
    target: 1,
  },
  x: [1, 0.5],
};

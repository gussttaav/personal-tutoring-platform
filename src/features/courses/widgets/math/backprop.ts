/*
 * COURSE-P2-02 — Backpropagation, as a pure function, for `backprop-trace`.
 * COURSE-P5-02 — Display labels rewritten in the course's notation (see below).
 *
 * This is the course's centrepiece widget, so its NUMBERS must be trustworthy: the
 * whole value of the explorable is that a student believes the chain-rule factors
 * it shows. Everything here is DOM-free and verified two independent ways in the
 * tests — every analytic gradient against central finite differences of the loss,
 * plus a fully hand-computed round-number example.
 *
 * The fixed architecture is a tiny MLP:
 *
 *   x (2) ── W1,b1 ──▶ z1 (2) ──σ──▶ a1 (2) ── w2,b2 ──▶ z2 ──σ──▶ ŷ ──▶ ℓ = ½(ŷ−y)²
 *
 * TWO NAMING LAYERS, AND THE SPLIT IS DELIBERATE. The identifiers here (`a1`, `o`,
 * `w2`, `target`, and the step `id`s) are internal: the tests and the widget's
 * `highlight()` match on them, and they are 0-indexed like the arrays they name.
 * The `label` and `target` STRINGS are what the student reads, and those follow
 * docs/courses/NOTATION.md exactly — 1-indexed, `ℓ` for the per-example loss, `ŷ`
 * for the prediction, `h(1)ⱼ` for a hidden activation, `W(2)₁ⱼ` for an output
 * weight. Block 2 lesson 8 quotes these numbers digit for digit, so a reader
 * comparing the two must not meet a second notation. Change the strings freely;
 * changing an `id` breaks `highlight()`.
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
  /** Output weights, one per hidden neuron. Length 2 — row 1 of W(2) to the student. */
  w2: number[];
  /** Output bias — b(2)₁ to the student. */
  b2: number;
  /** The example's label, `y`, for the squared-error loss. */
  target: number;
}

/** Internal names; to the student these are x, z(1), h(1), z(2)₁, ŷ and ℓ. */
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
  /** Symbol as the student reads it, in course notation — e.g. "∂ℓ/∂ŷ" or "h(1)₁". */
  label: string;
  value: number;
}

export interface TraceStep {
  id: string;
  /** The derivative this step computes, in course notation — e.g. "∂ℓ/∂W(2)₁₁". */
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

/** 0-based array index → the 1-based subscript the course prints. `SUB[0]` is "₁". */
const SUB = ["₁", "₂", "₃", "₄"] as const;
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
    target: "∂ℓ/∂ŷ",
    factors: [{ label: "ŷ − y", value: dLdo }],
    value: dLdo,
  });
  steps.push({
    id: "do_dz2",
    target: "∂ŷ/∂z(2)₁",
    factors: [{ label: "ŷ(1 − ŷ)", value: doDz2 }],
    value: doDz2,
  });
  steps.push({
    id: "dL_dz2",
    target: "δ(2)₁ = ∂ℓ/∂z(2)₁",
    factors: [
      { label: "∂ℓ/∂ŷ", value: dLdo },
      { label: "∂ŷ/∂z(2)₁", value: doDz2 },
    ],
    value: delta2,
  });

  // ── Output weights & bias ────────────────────────────────────────────────────
  const dw2 = a1.map((a1j) => delta2 * a1j);
  const db2 = delta2;
  dw2.forEach((g, j) => {
    steps.push({
      id: `dL_dw2_${j}`,
      target: `∂ℓ/∂W(2)₁${SUB[j]}`,
      factors: [
        { label: "δ(2)₁", value: delta2 },
        { label: `h(1)${SUB[j]}`, value: a1[j] },
      ],
      value: g,
    });
  });
  steps.push({
    id: "dL_db2",
    target: "∂ℓ/∂b(2)₁",
    factors: [{ label: "δ(2)₁", value: delta2 }],
    value: db2,
  });

  // ── Into the hidden layer ────────────────────────────────────────────────────
  const dLda1 = w2.map((w2j) => delta2 * w2j); //     ∂L/∂a1ⱼ
  const da1Dz1 = a1.map(sigmoidPrimeFrom); //          ∂a1ⱼ/∂z1ⱼ
  const delta1 = dLda1.map((d, j) => d * da1Dz1[j]); // ∂L/∂z1ⱼ

  dLda1.forEach((d, j) => {
    steps.push({
      id: `dL_da1_${j}`,
      target: `∂ℓ/∂h(1)${SUB[j]}`,
      factors: [
        { label: "δ(2)₁", value: delta2 },
        { label: `W(2)₁${SUB[j]}`, value: w2[j] },
      ],
      value: d,
    });
    steps.push({
      id: `dL_dz1_${j}`,
      target: `δ(1)${SUB[j]} = ∂ℓ/∂z(1)${SUB[j]}`,
      factors: [
        { label: `∂ℓ/∂h(1)${SUB[j]}`, value: d },
        { label: `φ'(z(1)${SUB[j]})`, value: da1Dz1[j] },
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
        target: `∂ℓ/∂W(1)${SUB[j]}${SUB[k]}`,
        factors: [
          { label: `δ(1)${SUB[j]}`, value: delta1[j] },
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

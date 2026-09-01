/*
 * COURSE-P5-03 — Backpropagation-through-time (BPTT), as a pure function, for the
 * `rnn-unrolled` widget. DOM-free, so the whole backward sweep can be unit-tested
 * without a browser — the same reason `backprop.ts` lives outside its component.
 *
 * The widget's teaching claim is STRUCTURAL: the backward pass is one sweep from
 * step T down to step 1, and the gradient of a SHARED weight is the *sum* of a
 * per-step contribution — so those numbers must be trustworthy. Everything here is
 * verified two independent ways in the tests: every analytic gradient against
 * central finite differences of ℓ (the exact check the lesson's `ch-bptt` challenge
 * uses), plus fully hand-computed round-number examples.
 *
 * The fixed architecture is a vanilla RNN over a length-T sequence with a single
 * scalar sigmoid output and a binary cross-entropy loss:
 *
 *   h_0 = 0
 *   p_t = W_hh·h_{t-1} + W_xh·x_t + b_h      (the pre-activation)
 *   h_t = tanh(p_t)                          t = 1 … T
 *   ŷ   = σ(W_hy·h_T + b_y)
 *   ℓ   = −( y·ln ŷ + (1−y)·ln(1−ŷ) )        (the ONE-example loss)
 *
 * Backward (BPTT), with the per-step error δ_t = ∇_{p_t} ℓ ∈ ℝ^{d_h}:
 *
 *   δ_T = (1 − h_T ⊙ h_T) ⊙ ((ŷ − y)·W_hyᵀ)
 *   δ_t = (1 − h_t ⊙ h_t) ⊙ (W_hhᵀ·δ_{t+1})            t = T−1 … 1
 *   ∇W_hh = Σ_t δ_t·h_{t-1}ᵀ,  ∇W_xh = Σ_t δ_t·x_tᵀ,  ∇b_h = Σ_t δ_t
 *   ∇W_hy = (ŷ − y)·h_Tᵀ,  ∇b_y = ŷ − y
 *
 * Notation follows docs/courses/NOTATION.md (Block 3) exactly. `runRnn` returns the
 * forward states, the final gradients, AND an ordered list of backward steps (t = T
 * … 1) each carrying its own transport/mask/δ, its per-step contribution, and the
 * RUNNING accumulated gradient after that step — the list the widget steps through
 * in either direction. The t = 1 contribution to ∇W_hh is the zero matrix because
 * h_0 = 0, so the accumulator does not move on the last step: that is the payoff the
 * widget draws.
 *
 * The maths is dimension-general (matmul/transpose/outer over `number[][]`), so the
 * tests can drive it at 1×1 for the hand examples while the widget preset runs at
 * d_h = 2, d_model = 3.
 */

import { sigmoid } from "./activations";
import { transpose, type Matrix, type Vector } from "./linalg";

export interface RnnParams {
  /** Recurrent weights, d_h × d_h. */
  Whh: Matrix;
  /** Input weights, d_h × d_model. */
  Wxh: Matrix;
  /** Recurrence bias, length d_h. */
  bh: Vector;
  /** Output weights, 1 × d_h (a single row). */
  Why: Matrix;
  /** Output bias (scalar). */
  by: number;
  /** The example's binary label y ∈ {0, 1}. */
  y: number;
}

/** One forward step, time t (1-indexed); `hPrev` is h_{t-1}. */
export interface RnnForwardStep {
  t: number;
  x: Vector;
  /** W_hh·h_{t-1} — the state contribution (zero at t = 1 since h_0 = 0). */
  recurrent: Vector;
  /** W_xh·x_t — the token contribution. */
  input: Vector;
  /** p_t = recurrent + input + b_h. */
  p: Vector;
  hPrev: Vector;
  h: Vector;
}

export interface RnnForward {
  /** States h_0 … h_T, length T + 1; h[0] is the zero start state. */
  h: Vector[];
  yhat: number;
  loss: number;
  /** Per-step forward detail, ordered t = 1 … T. */
  steps: RnnForwardStep[];
}

/** One backward step of the sweep, time t (1-indexed). */
export interface RnnBackStep {
  t: number;
  /** (ŷ − y)·W_hyᵀ at t = T, else W_hhᵀ·δ_{t+1} — before the tanh mask. */
  transport: Vector;
  /** 1 − h_t ⊙ h_t — the tanh′ mask. */
  mask: Vector;
  /** δ_t = mask ⊙ transport. */
  delta: Vector;
  /** This step's contribution to ∇W_hh: δ_t·h_{t-1}ᵀ (zero matrix at t = 1). */
  whhTerm: Matrix;
  /** This step's contribution to ∇W_xh: δ_t·x_tᵀ. */
  wxhTerm: Matrix;
  /** This step's contribution to ∇b_h: δ_t. */
  bhTerm: Vector;
  /** Running ∑ after visiting steps T … t (the last step equals the final grad). */
  runWhh: Matrix;
  runWxh: Matrix;
  runBh: Vector;
  /** How many terms have been summed so far: T − t + 1. */
  termsSummed: number;
}

export interface RnnGrads {
  Whh: Matrix;
  Wxh: Matrix;
  bh: Vector;
  Why: Matrix;
  by: number;
}

export interface RnnResult {
  forward: RnnForward;
  /** Backward sweep, ordered t = T, T−1, …, 1. */
  back: RnnBackStep[];
  grads: RnnGrads;
}

const zeros = (n: number): Vector => new Array<number>(n).fill(0);
const zerosMat = (rows: number, cols: number): Matrix =>
  Array.from({ length: rows }, () => zeros(cols));

/** Matrix·vector: A is m×n, v is length n, result length m. */
function matVec(a: Matrix, v: Vector): Vector {
  return a.map((row) => row.reduce((acc, aij, j) => acc + aij * v[j], 0));
}

/** Outer product u·vᵀ: u length m, v length n → m×n with [i][j] = u[i]·v[j]. */
function outer(u: Vector, v: Vector): Matrix {
  return u.map((ui) => v.map((vj) => ui * vj));
}

/** Forward pass through the fixed vanilla RNN with a sigmoid output and BCE loss. */
export function forwardRnn(params: RnnParams, xs: Matrix): RnnForward {
  const { Whh, Wxh, bh, Why, by, y } = params;
  const T = xs.length;
  const dh = bh.length;

  const h: Vector[] = [zeros(dh)]; // h[0] = 0
  const steps: RnnForwardStep[] = [];

  for (let t = 1; t <= T; t++) {
    const x = xs[t - 1];
    const hPrev = h[t - 1];
    const recurrent = matVec(Whh, hPrev); // W_hh·h_{t-1}
    const input = matVec(Wxh, x); //         W_xh·x_t
    const p = recurrent.map((r, i) => r + input[i] + bh[i]);
    const ht = p.map((pi) => Math.tanh(pi));
    h.push(ht);
    steps.push({ t, x, recurrent, input, p, hPrev, h: ht });
  }

  const hT = h[T];
  const zy = Why[0].reduce((acc, w, i) => acc + w * hT[i], 0) + by;
  const yhat = sigmoid(zy);
  const loss = -(y * Math.log(yhat) + (1 - y) * Math.log(1 - yhat));

  return { h, yhat, loss, steps };
}

/**
 * Full BPTT: the forward states, the ordered backward sweep (each step with its
 * transport, mask, δ, per-step contribution and the running accumulated gradient),
 * and the final gradients for every parameter.
 */
export function runRnn(params: RnnParams, xs: Matrix): RnnResult {
  const { Whh, Wxh, Why, by, y } = params;
  const T = xs.length;
  const dh = params.bh.length;
  const dModel = Wxh[0].length;

  const forward = forwardRnn(params, xs);
  const { h, yhat } = forward;
  const hT = h[T];
  const err = yhat - y; // ∂ℓ/∂z_y for a sigmoid + BCE output

  // Output-layer gradients: neither W_hy nor b_y feeds back into any h_t, so these
  // are just the direct sensitivities at the output node.
  const gWhy: Matrix = [hT.map((hti) => err * hti)];
  const gBy = err;

  // Running accumulators for the shared parameters, filled by the sweep below.
  const gWhh = zerosMat(dh, dh);
  const gWxh = zerosMat(dh, dModel);
  const gBh = zeros(dh);

  const WhhT = transpose(Whh);
  const back: RnnBackStep[] = [];
  let deltaNext: Vector | null = null;

  for (let t = T; t >= 1; t--) {
    const ht = h[t];
    const hPrev = h[t - 1];
    const x = xs[t - 1];

    const mask = ht.map((v) => 1 - v * v); // 1 − h_t ⊙ h_t
    const transport: Vector =
      t === T
        ? Why[0].map((w) => err * w) //     (ŷ − y)·W_hyᵀ   (seed from the output)
        : matVec(WhhT, deltaNext as Vector); // W_hhᵀ·δ_{t+1} (transport one step back)
    const delta = mask.map((m, i) => m * transport[i]);

    const whhTerm = outer(delta, hPrev); // δ_t·h_{t-1}ᵀ — zero matrix at t = 1
    const wxhTerm = outer(delta, x); //     δ_t·x_tᵀ
    const bhTerm = delta.slice(); //        δ_t

    for (let i = 0; i < dh; i++) {
      for (let j = 0; j < dh; j++) gWhh[i][j] += whhTerm[i][j];
      for (let j = 0; j < dModel; j++) gWxh[i][j] += wxhTerm[i][j];
      gBh[i] += delta[i];
    }

    back.push({
      t,
      transport,
      mask,
      delta,
      whhTerm,
      wxhTerm,
      bhTerm,
      runWhh: gWhh.map((row) => row.slice()),
      runWxh: gWxh.map((row) => row.slice()),
      runBh: gBh.slice(),
      termsSummed: T - t + 1,
    });

    deltaNext = delta;
  }

  return {
    forward,
    back,
    grads: {
      Whh: gWhh,
      Wxh: gWxh,
      bh: gBh,
      Why: gWhy,
      by: gBy,
    },
  };
}

/**
 * A fixed, seeded configuration for the widget's initial render. Small dims
 * (d_h = 2, d_model = 3) keep the ∇W_hh accumulator a legible 2×2 on a phone, and
 * the weights are small enough that ŷ stays mid-range (a well-conditioned BCE). The
 * sequence holds 8 tokens; the widget's T slider (3–8) slices `xs.slice(0, T)`.
 */
export const RNN_PRESET: { params: RnnParams; xs: Matrix } = {
  params: {
    Whh: [
      [0.3, -0.5],
      [0.4, 0.2],
    ],
    Wxh: [
      [0.5, -0.2, 0.3],
      [-0.4, 0.6, 0.1],
    ],
    bh: [0.1, -0.1],
    Why: [[0.7, -0.5]],
    by: 0.2,
    y: 1,
  },
  xs: [
    [1, 0, -1],
    [0.5, -0.5, 0.5],
    [-1, 1, 0],
    [0.2, 0.8, -0.6],
    [-0.4, -0.2, 1],
    [0.9, 0.1, -0.3],
    [-0.7, 0.6, 0.2],
    [0.3, -0.9, 0.4],
  ],
};

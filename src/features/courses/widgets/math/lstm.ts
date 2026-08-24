/*
 * COURSE-P5-03 — The LSTM forward pass, as a pure function, for the `lstm-gates`
 * widget. DOM-free, so the whole gated recurrence can be unit-tested without a
 * browser — the same split as math/rnn.ts and math/activations.ts.
 *
 * The widget's teaching claim is about the CELL PATH (Block 3 lesson 5): the cell
 * state advances by
 *
 *   c_t = f_t ⊙ c_{t-1} + i_t ⊙ c̃_t
 *
 * with no matrix in the way, so what a value written into c_1 has left in c_t is the
 * running product ∏_{s=2}^{t} f_s — a number per coordinate that the network chooses,
 * not a fixed power of a shared matrix. Raising the forget-gate bias b_f pushes every
 * f_t toward 1 and that product toward 1: a leaky memory becomes a persistent one.
 * The widget puts b_f on a slider and steps through the sequence; this module is the
 * maths behind it, so those gate values and that survival product must be trustworthy.
 *
 * The four pieces are the vanilla-RNN recurrence of lesson 2 copied four times, each a
 * gate over the same inputs (x_t, h_{t-1}); σ for the three gates, tanh for the
 * candidate:
 *
 *   f_t = σ(W_xf·x_t + W_hf·h_{t-1} + b_f)          forget
 *   i_t = σ(W_xi·x_t + W_hi·h_{t-1} + b_i)          input
 *   o_t = σ(W_xo·x_t + W_ho·h_{t-1} + b_o)          output
 *   c̃_t = tanh(W_xc·x_t + W_hc·h_{t-1} + b_c)       candidate
 *   c_t = f_t ⊙ c_{t-1} + i_t ⊙ c̃_t                 h_0 = c_0 = 0
 *   h_t = o_t ⊙ tanh(c_t)
 *
 * Notation follows docs/courses/NOTATION.md (Block 3) exactly. `lstmStep` runs one
 * step (the object the lesson's `ch-lstm-paso` challenge asks the student to write);
 * `runLstm` runs the sequence and additionally reports, per step, the survival product
 * ∏_{s=2}^{t} f_s the widget draws — all-ones at t = 1 (nothing has decayed yet), then
 * multiplied by f_t at every later step.
 *
 * The maths is dimension-general (matmul over `number[][]`), so the tests drive it at
 * d_h = 1 for exact saturation cases while the widget preset runs at d_h = 3.
 */

import { sigmoid } from "./activations";
import type { Matrix, Vector } from "./linalg";

/** One gate's parameters: input weights (d_h × d_model), recurrent (d_h × d_h), bias. */
export interface Gate {
  Wx: Matrix;
  Wh: Matrix;
  b: Vector;
}

export interface LstmParams {
  /** Forget gate — how much of c_{t-1} to keep. */
  f: Gate;
  /** Input gate — how much of the candidate to write. */
  i: Gate;
  /** Output gate — how much of the cell to reveal as h_t. */
  o: Gate;
  /** Candidate — what this step proposes to write (a tanh, not a gate). */
  c: Gate;
}

/** The gate activations and both states produced by one step. */
export interface LstmStepOut {
  /** Forget gate f_t ∈ (0,1)^{d_h}. */
  f: Vector;
  /** Input gate i_t. */
  i: Vector;
  /** Output gate o_t. */
  o: Vector;
  /** Candidate c̃_t ∈ (−1,1)^{d_h}. */
  cand: Vector;
  /** New cell state c_t = f_t ⊙ c_{t-1} + i_t ⊙ c̃_t. */
  c: Vector;
  /** New hidden state h_t = o_t ⊙ tanh(c_t). */
  h: Vector;
}

/** One LSTM forward step, time t (1-indexed), with what it read. */
export interface LstmStep extends LstmStepOut {
  t: number;
  x: Vector;
  cPrev: Vector;
  hPrev: Vector;
  /**
   * ∏_{s=2}^{t} f_s, per coordinate — the fraction of what c_1 held that still
   * survives in c_t along the additive path. All-ones at t = 1 (nothing decayed yet);
   * multiplied by f_t at each later step, so it never increases.
   */
  survival: Vector;
}

export interface LstmResult {
  /** Per-step detail, ordered t = 1 … T. */
  steps: LstmStep[];
}

const zeros = (n: number): Vector => new Array<number>(n).fill(0);
const ones = (n: number): Vector => new Array<number>(n).fill(1);

/** Matrix·vector: A is m×n, v is length n, result length m. */
function matVec(a: Matrix, v: Vector): Vector {
  return a.map((row) => row.reduce((acc, aij, j) => acc + aij * v[j], 0));
}

/** One affine gate pre-activation, W_x·x + W_h·h + b, before its activation. */
function pre(gate: Gate, x: Vector, hPrev: Vector): Vector {
  const gx = matVec(gate.Wx, x);
  const gh = matVec(gate.Wh, hPrev);
  return gate.b.map((bi, k) => gx[k] + gh[k] + bi);
}

/**
 * One LSTM step. Reads x_t, the previous hidden state and the previous cell state;
 * returns the three gates, the candidate, and the new cell and hidden states. Writes
 * to none of its inputs (fresh arrays), so the caller's state is never mutated.
 */
export function lstmStep(
  params: LstmParams,
  hPrev: Vector,
  cPrev: Vector,
  x: Vector,
): LstmStepOut {
  const f = pre(params.f, x, hPrev).map(sigmoid);
  const i = pre(params.i, x, hPrev).map(sigmoid);
  const o = pre(params.o, x, hPrev).map(sigmoid);
  const cand = pre(params.c, x, hPrev).map(Math.tanh);
  // The cell updates BEFORE the hidden state, because h_t reads the NEW cell.
  const c = f.map((ft, k) => ft * cPrev[k] + i[k] * cand[k]);
  const h = o.map((ot, k) => ot * Math.tanh(c[k]));
  return { f, i, o, cand, c, h };
}

/**
 * Full forward pass over a length-T sequence from h_0 = c_0 = 0, plus the running
 * survival product the widget draws. `xs` is T rows of length d_model.
 */
export function runLstm(params: LstmParams, xs: Matrix): LstmResult {
  const dh = params.f.b.length;
  let h = zeros(dh);
  let c = zeros(dh);
  let survival = ones(dh); // ∏ f from step 2; at t = 1 nothing has decayed yet
  const steps: LstmStep[] = [];

  for (let t = 1; t <= xs.length; t++) {
    const x = xs[t - 1];
    const hPrev = h;
    const cPrev = c;
    const out = lstmStep(params, hPrev, cPrev, x);
    if (t >= 2) survival = survival.map((s, k) => s * out.f[k]);
    steps.push({ t, x, cPrev, hPrev, survival: survival.slice(), ...out });
    h = out.h;
    c = out.c;
  }

  return { steps };
}

/**
 * Build the preset's params for a given forget-gate bias. The input/output/candidate
 * biases stay at 0 and only b_f moves — exactly the knob the lesson's first code cell
 * turns (b_f = 1 vs b_f = 3), so the widget's slider reproduces that experiment. The
 * weights are small and fixed so the gates start mid-range (a well-conditioned demo).
 */
export function presetParams(forgetBias: number): LstmParams {
  const bf = new Array<number>(3).fill(forgetBias);
  return {
    f: {
      Wx: [
        [0.4, -0.3, 0.2],
        [0.1, 0.5, -0.2],
        [-0.3, 0.2, 0.4],
      ],
      Wh: [
        [0.2, 0.1, -0.2],
        [-0.1, 0.3, 0.1],
        [0.2, -0.2, 0.1],
      ],
      b: bf,
    },
    i: {
      Wx: [
        [0.3, 0.2, -0.4],
        [-0.2, 0.4, 0.1],
        [0.5, -0.1, -0.3],
      ],
      Wh: [
        [0.1, -0.2, 0.2],
        [0.3, 0.1, -0.1],
        [-0.2, 0.2, 0.3],
      ],
      b: [0, 0, 0],
    },
    o: {
      Wx: [
        [-0.2, 0.4, 0.3],
        [0.5, -0.3, 0.1],
        [0.1, 0.2, -0.4],
      ],
      Wh: [
        [0.2, 0.2, -0.1],
        [-0.3, 0.1, 0.2],
        [0.1, -0.2, 0.2],
      ],
      b: [0, 0, 0],
    },
    c: {
      Wx: [
        [0.5, -0.2, 0.3],
        [0.2, 0.4, -0.5],
        [-0.3, 0.1, 0.4],
      ],
      Wh: [
        [0.1, 0.2, -0.2],
        [0.2, -0.1, 0.3],
        [-0.2, 0.3, 0.1],
      ],
      b: [0, 0, 0],
    },
  };
}

/**
 * The widget's fixed example sequence: 6 invented token vectors of length d_model = 3.
 * The b_f slider rebuilds the params via `presetParams`; the sequence is constant.
 */
export const LSTM_PRESET_XS: Matrix = [
  [1.0, 0.0, -1.0],
  [0.5, -0.5, 0.5],
  [-1.0, 1.0, 0.0],
  [0.2, 0.8, -0.6],
  [-0.4, -0.2, 1.0],
  [0.9, 0.1, -0.3],
];

/** Default forget-gate bias — a mid-range, leaky memory the student can then raise. */
export const DEFAULT_FORGET_BIAS = 1.0;

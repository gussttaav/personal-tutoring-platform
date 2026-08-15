/*
 * COURSE-P5-03 — LSTM forward tests for `lstm-gates`. The widget shows the gate
 * activations and the cell-state survival product, so those numbers are verified two
 * independent ways:
 *   1. Exact saturation cases at d_h = 1 (b → ±40 drives a gate to 1 or 0), which pin
 *      the additive recurrence c_t = f_t·c_{t-1} + i_t·c̃_t and h_t = o_t·tanh(c_t) —
 *      the same limits the lesson's `ch-lstm-paso` challenge tests use.
 *   2. Reference values of the fixed preset, matching the numbers the lesson's prose
 *      and its first code cell quote (survival of c_1 at b_f = 1 vs b_f = 3).
 * Plus the structural invariants of the survival product the widget steps through, and
 * the monotonic b_f → survival relationship that is the widget's whole claim.
 */

import {
  lstmStep,
  runLstm,
  presetParams,
  LSTM_PRESET_XS,
  DEFAULT_FORGET_BIAS,
  type LstmParams,
} from "../lstm";

// A d_h = 1, d_model = 1 gate set with all weights zero, so every gate is σ(b) / tanh(b)
// and the bias alone drives it. Handy for exact saturation limits.
const scalarParams = (bf: number, bi: number, bo: number, bc: number): LstmParams => ({
  f: { Wx: [[0]], Wh: [[0]], b: [bf] },
  i: { Wx: [[0]], Wh: [[0]], b: [bi] },
  o: { Wx: [[0]], Wh: [[0]], b: [bo] },
  c: { Wx: [[0]], Wh: [[0]], b: [bc] },
});

describe("lstmStep — exact saturation cases", () => {
  it("forget open (f→1), input shut (i→0): the cell passes through unchanged", () => {
    const p = scalarParams(40, -40, 0, 0); // f≈1, i≈0
    const out = lstmStep(p, [0], [0.7], [0]);
    expect(out.f[0]).toBeCloseTo(1, 12);
    expect(out.i[0]).toBeCloseTo(0, 12);
    // c_t = 1·0.7 + 0·c̃ = 0.7, independent of the candidate.
    expect(out.c[0]).toBeCloseTo(0.7, 10);
  });

  it("forget shut (f→0): the previous cell cannot influence the new one", () => {
    const p = scalarParams(-40, 0, 0, 0); // f≈0
    const a = lstmStep(p, [0], [0.7], [0]);
    const b = lstmStep(p, [0], [-3.0], [0]); // wildly different c_{t-1}
    expect(a.c[0]).toBeCloseTo(b.c[0], 10); // same new cell → the old one was erased
  });

  it("h_t reads the NEW cell through the output gate: h = o ⊙ tanh(c)", () => {
    const p = scalarParams(40, -40, 5, 0); // f≈1, i≈0, o = σ(5)
    const out = lstmStep(p, [0], [0.5], [0]);
    const expectedO = 1 / (1 + Math.exp(-5));
    expect(out.o[0]).toBeCloseTo(expectedO, 12);
    expect(out.h[0]).toBeCloseTo(expectedO * Math.tanh(0.5), 10);
  });

  it("does not mutate the state arrays it is given", () => {
    const p = presetParams(1);
    const hPrev = [0.1, -0.2, 0.3];
    const cPrev = [0.4, 0.5, -0.6];
    const x = [1, 0, -1];
    const hCopy = hPrev.slice();
    const cCopy = cPrev.slice();
    lstmStep(p, hPrev, cPrev, x);
    expect(hPrev).toEqual(hCopy);
    expect(cPrev).toEqual(cCopy);
  });
});

describe("runLstm — the additive path and the survival product", () => {
  const p = presetParams(DEFAULT_FORGET_BIAS);
  const result = runLstm(p, LSTM_PRESET_XS);
  const T = LSTM_PRESET_XS.length;
  const dh = p.f.b.length;

  it("visits every position once, ordered t = 1 … T", () => {
    expect(result.steps.map((s) => s.t)).toEqual(
      Array.from({ length: T }, (_, k) => k + 1),
    );
  });

  it("starts from h_0 = c_0 = 0, so c_1 = i_1 ⊙ c̃_1 (forget gate multiplies nothing)", () => {
    const s1 = result.steps[0];
    expect(s1.cPrev).toEqual([0, 0, 0]);
    expect(s1.hPrev).toEqual([0, 0, 0]);
    for (let k = 0; k < dh; k++) {
      expect(s1.c[k]).toBeCloseTo(s1.i[k] * s1.cand[k], 12);
    }
  });

  it("keeps the survival product = 1 at t = 1 and multiplies by f_t thereafter", () => {
    expect(result.steps[0].survival).toEqual([1, 1, 1]);
    for (let t = 1; t < T; t++) {
      const prev = result.steps[t - 1].survival;
      const cur = result.steps[t].survival;
      for (let k = 0; k < dh; k++) {
        expect(cur[k]).toBeCloseTo(prev[k] * result.steps[t].f[k], 12);
      }
    }
  });

  it("never lets a survival coordinate increase (every f_t ∈ (0,1))", () => {
    for (let t = 1; t < T; t++) {
      for (let k = 0; k < dh; k++) {
        expect(result.steps[t].survival[k]).toBeLessThanOrEqual(
          result.steps[t - 1].survival[k] + 1e-12,
        );
      }
    }
  });

  it("computes h_t = o_t ⊙ tanh(c_t) at every step", () => {
    for (const s of result.steps) {
      for (let k = 0; k < dh; k++) {
        expect(s.h[k]).toBeCloseTo(s.o[k] * Math.tanh(s.c[k]), 12);
      }
    }
  });
});

describe("runLstm — preset reference values (match the lesson's prose and code cell)", () => {
  it("reproduces c_1, which does not depend on b_f (c_0 = 0)", () => {
    const c1 = runLstm(presetParams(1), LSTM_PRESET_XS).steps[0].c;
    expect(c1[0]).toBeCloseTo(0.131884, 5);
    expect(c1[1]).toBeCloseTo(0.257193, 5);
    expect(c1[2]).toBeCloseTo(-0.416998, 5);
  });

  it("survives ~20% of c_1 at b_f = 1 and ~78% at b_f = 3 (the prose's two numbers)", () => {
    const survLow = runLstm(presetParams(1), LSTM_PRESET_XS).steps.at(-1)!.survival;
    const survHigh = runLstm(presetParams(3), LSTM_PRESET_XS).steps.at(-1)!.survival;
    expect(survLow[0]).toBeCloseTo(0.191007, 5);
    expect(survLow[1]).toBeCloseTo(0.227488, 5);
    expect(survLow[2]).toBeCloseTo(0.213895, 5);
    expect(survHigh[0]).toBeCloseTo(0.772365, 5);
    expect(survHigh[1]).toBeCloseTo(0.793919, 5);
    expect(survHigh[2]).toBeCloseTo(0.784840, 5);
  });
});

describe("runLstm — raising b_f is the widget's central claim", () => {
  it("pushes every forget gate up and every survival coordinate up", () => {
    const low = runLstm(presetParams(0), LSTM_PRESET_XS).steps;
    const high = runLstm(presetParams(4), LSTM_PRESET_XS).steps;
    const dh = 3;
    // Every forget gate is larger with the higher bias.
    for (let t = 0; t < low.length; t++) {
      for (let k = 0; k < dh; k++) {
        expect(high[t].f[k]).toBeGreaterThan(low[t].f[k]);
      }
    }
    // And the end-to-end survival of c_1 is larger on every coordinate.
    const survLow = low.at(-1)!.survival;
    const survHigh = high.at(-1)!.survival;
    for (let k = 0; k < dh; k++) {
      expect(survHigh[k]).toBeGreaterThan(survLow[k]);
    }
  });
});

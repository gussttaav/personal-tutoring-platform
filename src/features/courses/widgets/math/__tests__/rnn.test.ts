/*
 * COURSE-P5-03 — BPTT tests for `rnn-unrolled`. The widget shows the backward sweep
 * and the accumulating gradient of a shared weight, so its numbers are verified TWO
 * independent ways:
 *   1. Every analytic gradient against central finite differences of ℓ — the exact
 *      check the lesson's `ch-bptt` challenge runs (worst-case disagreement < 1e-6).
 *   2. Fully hand-computed round-number examples (a T = 1 case that isolates the
 *      h_0 = 0 zero-term for ∇W_hh, and a T = 2 case that exercises the recurrent
 *      transport W_hhᵀ·δ_{t+1}).
 * Plus structural invariants of the running accumulator the widget steps through.
 */

import { forwardRnn, runRnn, RNN_PRESET, type RnnParams } from "../rnn";
import type { Matrix, Vector } from "../linalg";

const cloneParams = (p: RnnParams): RnnParams => ({
  Whh: p.Whh.map((r) => r.slice()),
  Wxh: p.Wxh.map((r) => r.slice()),
  bh: p.bh.slice(),
  Why: p.Why.map((r) => r.slice()),
  by: p.by,
  y: p.y,
});

const lossAt = (p: RnnParams, xs: Matrix) => forwardRnn(p, xs).loss;

// Central finite difference of the loss w.r.t. a single mutated scalar.
function fd(p: RnnParams, xs: Matrix, mutate: (p: RnnParams, delta: number) => void): number {
  const h = 1e-6;
  const up = cloneParams(p);
  mutate(up, +h);
  const down = cloneParams(p);
  mutate(down, -h);
  return (lossAt(up, xs) - lossAt(down, xs)) / (2 * h);
}

describe("runRnn — gradients vs finite differences", () => {
  const { params, xs } = RNN_PRESET;
  const { grads } = runRnn(params, xs);
  const dh = params.bh.length;
  const dModel = params.Wxh[0].length;

  it("matches ∂ℓ/∂W_hh for every recurrent weight", () => {
    for (let i = 0; i < dh; i++) {
      for (let j = 0; j < dh; j++) {
        const approx = fd(params, xs, (p, d) => (p.Whh[i][j] += d));
        expect(grads.Whh[i][j]).toBeCloseTo(approx, 6);
      }
    }
  });

  it("matches ∂ℓ/∂W_xh for every input weight", () => {
    for (let i = 0; i < dh; i++) {
      for (let j = 0; j < dModel; j++) {
        const approx = fd(params, xs, (p, d) => (p.Wxh[i][j] += d));
        expect(grads.Wxh[i][j]).toBeCloseTo(approx, 6);
      }
    }
  });

  it("matches ∂ℓ/∂b_h for every recurrence bias", () => {
    for (let i = 0; i < dh; i++) {
      const approx = fd(params, xs, (p, d) => (p.bh[i] += d));
      expect(grads.bh[i]).toBeCloseTo(approx, 6);
    }
  });

  it("matches ∂ℓ/∂W_hy for every output weight", () => {
    for (let j = 0; j < dh; j++) {
      const approx = fd(params, xs, (p, d) => (p.Why[0][j] += d));
      expect(grads.Why[0][j]).toBeCloseTo(approx, 6);
    }
  });

  it("matches ∂ℓ/∂b_y for the output bias", () => {
    const approx = fd(params, xs, (p, d) => (p.by += d));
    expect(grads.by).toBeCloseTo(approx, 6);
  });

  it("agrees with the numeric probe to better than 1e-6 everywhere (the ch-bptt check)", () => {
    let worst = 0;
    const probe = (analytic: number, mutate: (p: RnnParams, d: number) => void) => {
      worst = Math.max(worst, Math.abs(analytic - fd(params, xs, mutate)));
    };
    for (let i = 0; i < dh; i++) {
      for (let j = 0; j < dh; j++) probe(grads.Whh[i][j], (p, d) => (p.Whh[i][j] += d));
      for (let j = 0; j < dModel; j++) probe(grads.Wxh[i][j], (p, d) => (p.Wxh[i][j] += d));
      probe(grads.bh[i], (p, d) => (p.bh[i] += d));
      probe(grads.Why[0][i], (p, d) => (p.Why[0][i] += d));
    }
    probe(grads.by, (p, d) => (p.by += d));
    expect(worst).toBeLessThan(1e-6);
  });
});

describe("runRnn — hand-computed example, T = 1 (isolates the h_0 = 0 zero-term)", () => {
  // d_h = d_model = 1. W_hh doesn't matter (h_0 = 0), and b_h = −3 cancels W_xh·x_1:
  //   p_1 = 0.5·0 + 1·3 + (−3) = 0 → h_1 = tanh(0) = 0
  //   z_y = 2·0 + 0 = 0 → ŷ = σ(0) = 0.5;  y = 1 → ℓ = −ln 0.5 = ln 2
  //   δ_1 = (1 − 0)·((0.5 − 1)·2) = −1
  //   ∇W_xh = δ_1·x_1 = −3;  ∇W_hh = δ_1·h_0 = 0;  ∇b_h = δ_1 = −1
  //   ∇W_hy = (ŷ − y)·h_1 = 0;  ∇b_y = ŷ − y = −0.5
  const params: RnnParams = { Whh: [[0.5]], Wxh: [[1]], bh: [-3], Why: [[2]], by: 0, y: 1 };
  const xs: Matrix = [[3]];
  const result = runRnn(params, xs);

  it("computes the forward values exactly", () => {
    expect(result.forward.h[0]).toEqual([0]);
    expect(result.forward.h[1][0]).toBeCloseTo(0, 12);
    expect(result.forward.yhat).toBeCloseTo(0.5, 12);
    expect(result.forward.loss).toBeCloseTo(Math.LN2, 12);
  });

  it("computes δ_1 and every gradient exactly", () => {
    expect(result.back).toHaveLength(1);
    expect(result.back[0].delta[0]).toBeCloseTo(-1, 12);
    expect(result.grads.Wxh[0][0]).toBeCloseTo(-3, 12);
    expect(result.grads.Whh[0][0]).toBeCloseTo(0, 12); // h_0 = 0 → zero contribution
    expect(result.grads.bh[0]).toBeCloseTo(-1, 12);
    expect(result.grads.Why[0][0]).toBeCloseTo(0, 12);
    expect(result.grads.by).toBeCloseTo(-0.5, 12);
  });

  it("draws the t = 1 ∇W_hh contribution as the zero matrix", () => {
    // −0 is a valid zero here (δ_1·h_0 = −1·0), so compare by value, not Object.is.
    expect(result.back[0].whhTerm.every((row) => row.every((v: number) => v === 0))).toBe(true);
    expect(result.back[0].wxhTerm[0][0]).toBeCloseTo(-3, 12); // ∇W_xh's t=1 term IS nonzero
  });
});

describe("runRnn — hand-computed example, T = 2 (exercises the recurrent transport)", () => {
  // d_h = d_model = 1, x = [0, 0], b_h = 0 → every p_t = 0, so h_1 = h_2 = 0.
  //   z_y = 2·0 + 0 = 0 → ŷ = 0.5;  y = 1 → ℓ = ln 2
  //   δ_2 = (1 − 0)·((0.5 − 1)·2) = −1
  //   transport(t=1) = W_hhᵀ·δ_2 = 0.5·(−1) = −0.5;  mask = 1 → δ_1 = −0.5
  //   ∇W_hh = δ_1·h_0 + δ_2·h_1 = 0;  ∇b_h = δ_1 + δ_2 = −1.5;  ∇b_y = −0.5
  const params: RnnParams = { Whh: [[0.5]], Wxh: [[1]], bh: [0], Why: [[2]], by: 0, y: 1 };
  const xs: Matrix = [
    [0],
    [0],
  ];
  const result = runRnn(params, xs);

  it("transports the error one step back through W_hhᵀ", () => {
    // back is ordered t = 2, 1.
    expect(result.back.map((s) => s.t)).toEqual([2, 1]);
    expect(result.back[0].delta[0]).toBeCloseTo(-1, 12); // δ_2 (seed)
    expect(result.back[1].transport[0]).toBeCloseTo(-0.5, 12); // W_hhᵀ·δ_2
    expect(result.back[1].delta[0]).toBeCloseTo(-0.5, 12); // δ_1
  });

  it("computes the summed gradients exactly", () => {
    expect(result.grads.Whh[0][0]).toBeCloseTo(0, 12);
    expect(result.grads.Wxh[0][0]).toBeCloseTo(0, 12);
    expect(result.grads.bh[0]).toBeCloseTo(-1.5, 12);
    expect(result.grads.by).toBeCloseTo(-0.5, 12);
  });
});

describe("runRnn — accumulator invariants the widget steps through", () => {
  const { params, xs } = RNN_PRESET;
  const T = xs.length;
  const result = runRnn(params, xs);

  it("visits every step once, ordered from T down to 1", () => {
    expect(result.back).toHaveLength(T);
    expect(result.back.map((s) => s.t)).toEqual(
      Array.from({ length: T }, (_, k) => T - k),
    );
  });

  it("counts terms 1 … T as the sweep proceeds", () => {
    expect(result.back.map((s) => s.termsSummed)).toEqual(
      Array.from({ length: T }, (_, k) => k + 1),
    );
  });

  it("running accumulator on the last step equals the final gradient", () => {
    const last = result.back[result.back.length - 1];
    expect(last.runWhh).toEqual(result.grads.Whh);
    expect(last.runWxh).toEqual(result.grads.Wxh);
    expect(last.runBh).toEqual(result.grads.bh);
  });

  it("adds the zero matrix to ∇W_hh at t = 1 (h_0 = 0), leaving the sum unchanged", () => {
    const stepT1 = result.back[result.back.length - 1];
    const prev = result.back[result.back.length - 2];
    const isZero = (m: Matrix) => m.every((row) => row.every((v: number) => v === 0));
    expect(isZero(stepT1.whhTerm)).toBe(true);
    expect(stepT1.runWhh).toEqual(prev.runWhh); // the accumulator does not move
  });

  it("starts the forward pass from the zero state (W_hh·h_0 = 0 at t = 1)", () => {
    const first = result.forward.steps[0];
    const isZeroVec = (v: Vector) => v.every((x) => x === 0);
    expect(isZeroVec(first.hPrev)).toBe(true);
    expect(isZeroVec(first.recurrent)).toBe(true);
  });
});

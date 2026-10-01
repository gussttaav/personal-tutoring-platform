/*
 * COURSE-C2-P1-01 — `math/scaling-laws.ts`, checked two independent ways, as AUTHORING §7 asks
 * of a widget's maths:
 *
 *   1. THE CLOSED FORMS AGAINST A SEARCH — the bottom of the fixed-budget valley (Hoffmann et
 *      al.'s eq. 4, which the lesson derives from a balance of the two terms) against a brute
 *      minimisation of L(N, C/6N) over a fine grid of N; the balance itself at the optimum; and
 *      Kaplan's constant factor per multiplication against a direct ratio at many points.
 *   2. THE LESSON'S NUMBERS — every figure the prose and the widget quote: the 0.949 per
 *      doubling and the ×4 for a tenth less, the 2.9 × 10¹² FLOPs and 26 tokens per parameter of
 *      the checkpoint, the optimum at Gopher's budget with Chinchilla on its floor, and the ~20
 *      tokens per parameter of the re-fit where the paper printed ~70. The lesson's cell fits
 *      Chinchilla's Table 3 instead; its numbers (Pyodide) are reproduced here by the same least
 *      squares, so the header's «~160 000 against ~118 000» is pinned too.
 */

import {
  CHINCHILLA,
  CHINCHILLA_AS_PRINTED,
  CHINCHILLA_MEASURED_C,
  GOPHER_BUDGET,
  KAPLAN,
  MODELS,
  PF_DAY,
  chinchillaAlong,
  chinchillaLoss,
  factorPer,
  fixedBudgetLoss,
  kaplanLoss,
  optimum,
  optimumExponents,
  trainingCompute,
  type LawAxis,
} from "../scaling-laws";

const logspace = (a: number, b: number, n: number) =>
  Array.from({ length: n }, (_, i) => 10 ** (Math.log10(a) + ((Math.log10(b) - Math.log10(a)) * i) / (n - 1)));

/** The N that minimises the valley at budget c, searched on a grid 10⁻⁴ decades wide. */
function searchOptimum(c: number): number {
  const centre = optimum(c).n;
  let best = centre / 100;
  let bestLoss = Infinity;
  for (const n of logspace(centre / 100, centre * 100, 40_001)) {
    const loss = fixedBudgetLoss(c, n);
    if (loss < bestLoss) {
      bestLoss = loss;
      best = n;
    }
  }
  return best;
}

/** Ordinary least squares y = slope · x + intercept, as `np.polyfit(x, y, 1)`. */
function polyfit(x: readonly number[], y: readonly number[]): { slope: number; intercept: number } {
  const mx = x.reduce((a, b) => a + b, 0) / x.length;
  const my = y.reduce((a, b) => a + b, 0) / y.length;
  const sxy = x.reduce((a, xi, i) => a + (xi - mx) * (y[i] - my), 0);
  const sxx = x.reduce((a, xi) => a + (xi - mx) ** 2, 0);
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx };
}

describe("scaling-laws — Kaplan's laws are straight lines", () => {
  const axes: LawAxis[] = ["n", "d", "c"];

  it("multiplies the loss by k^−α whatever the point", () => {
    for (const axis of axes) {
      const { alpha, measured } = KAPLAN[axis];
      for (const x of logspace(measured[0], measured[1], 9)) {
        expect(kaplanLoss(axis, 2 * x) / kaplanLoss(axis, x)).toBeCloseTo(2 ** -alpha, 12);
        expect(factorPer(axis, x, 10).kaplan).toBeCloseTo(10 ** -alpha, 12);
      }
    }
  });

  it("has log L linear in log x with slope −α", () => {
    for (const axis of axes) {
      const xs = logspace(KAPLAN[axis].measured[0], KAPLAN[axis].measured[1], 7);
      const fit = polyfit(
        xs.map(Math.log),
        xs.map((x) => Math.log(kaplanLoss(axis, x))),
      );
      expect(fit.slope).toBeCloseTo(-KAPLAN[axis].alpha, 10);
      expect(fit.intercept).toBeCloseTo(KAPLAN[axis].alpha * Math.log(KAPLAN[axis].scale), 8);
    }
  });

  it("gives the lesson's per-doubling and per-tenfold factors for N", () => {
    expect(2 ** -KAPLAN.n.alpha).toBeCloseTo(0.949, 3);
    expect(10 ** -KAPLAN.n.alpha).toBeCloseTo(0.839, 3);
    // A tenth less loss: 0.9 = k^−0.076 → k ≈ 4.0 (the first quiz question).
    expect(0.9 ** (-1 / KAPLAN.n.alpha)).toBeCloseTo(4.0, 2);
    // Half the loss would take ~9 000 times the parameters.
    expect(2 ** (1 / KAPLAN.n.alpha)).toBeGreaterThan(9_000);
    expect(2 ** (1 / KAPLAN.n.alpha)).toBeLessThan(9_200);
  });

  it("converts C_c from PF-days", () => {
    expect(KAPLAN.c.scale).toBeCloseTo(3.1e8 * 8.64e19, -20);
    expect(PF_DAY).toBe(1e15 * 24 * 3600);
  });
});

describe("scaling-laws — Chinchilla's curve has a floor", () => {
  it("buys less with every tenfold as it nears L∞, unlike Kaplan's line", () => {
    const along = [1e8, 1e9, 1e10, 1e11].map((n) => factorPer("n", n, 10).chinchilla);
    for (let i = 1; i < along.length; i++) expect(along[i]).toBeGreaterThan(along[i - 1]);
    expect(along[along.length - 1]).toBeGreaterThan(0.97);
    for (const n of [1e8, 1e11]) expect(factorPer("n", n, 10).kaplan).toBeCloseTo(0.839, 3);
    // It never crosses its floor.
    expect(chinchillaAlong("n", 1e15)).toBeGreaterThan(CHINCHILLA.lInf);
    expect(chinchillaAlong("d", 1e15)).toBeGreaterThan(CHINCHILLA.lInf);
  });

  it("reads along C at the bottom of each valley", () => {
    for (const c of [1e19, 1e21, 1e23]) {
      expect(chinchillaAlong("c", c)).toBeCloseTo(optimum(c).loss, 12);
    }
  });
});

describe("scaling-laws — the bottom of the valley", () => {
  const budgets = [1e17, 6e18, 1e20, 3e21, GOPHER_BUDGET, 1e25];

  it("is where a grid search finds it", () => {
    for (const c of budgets) {
      const searched = searchOptimum(c);
      expect(Math.abs(Math.log10(searched / optimum(c).n))).toBeLessThan(2e-4);
    }
  });

  it("balances the two terms: α_N A_N N^−α_N = α_D A_D D^−α_D", () => {
    const { aN, alphaN, aD, alphaD } = CHINCHILLA;
    for (const c of budgets) {
      const { n, d } = optimum(c);
      const left = (alphaN * aN) / n ** alphaN;
      const right = (alphaD * aD) / d ** alphaD;
      expect(left / right).toBeCloseTo(1, 10);
      expect(trainingCompute(n, d)).toBeCloseTo(c, -Math.floor(Math.log10(c)) + 10);
    }
  });

  it("grows N* and D* as powers of C that add up to 1", () => {
    const e = optimumExponents();
    expect(e.n + e.d).toBeCloseTo(1, 12);
    expect(e.n).toBeCloseTo(0.5126, 4); // Besiroglu et al., Table 1
    const lo = optimum(1e18);
    const hi = optimum(1e24);
    expect(Math.log(hi.n / lo.n) / Math.log(1e6)).toBeCloseTo(e.n, 10);
    expect(Math.log(hi.d / lo.d) / Math.log(1e6)).toBeCloseTo(e.d, 10);
  });

  it("puts ~20 tokens per parameter where the paper measured, as the paper's other methods do", () => {
    const [lo, hi] = CHINCHILLA_MEASURED_C;
    expect(optimum(lo).ratio).toBeCloseTo(24.6, 1);
    expect(optimum(hi).ratio).toBeCloseTo(21.0, 1);
    expect(optimum(GOPHER_BUDGET).ratio).toBeCloseTo(18.4, 1);
  });

  it("would put ~70, not 20, with the constants the paper printed — why the widget uses the re-fit", () => {
    expect(optimum(1e21, CHINCHILLA_AS_PRINTED).ratio).toBeGreaterThan(45);
    expect(optimum(GOPHER_BUDGET, CHINCHILLA_AS_PRINTED).ratio).toBeGreaterThan(85);
    // And a smaller model at Gopher's budget: the paper's own «40B» for approach 3, roughly.
    expect(optimum(GOPHER_BUDGET, CHINCHILLA_AS_PRINTED).n).toBeLessThan(4e10);
  });
});

describe("scaling-laws — the models on the frontier", () => {
  const byId = Object.fromEntries(MODELS.map((m) => [m.id, m]));

  it("counts the checkpoint's budget", () => {
    const mini = byId.miniGpt;
    expect(mini.n).toBe(136_448);
    expect(mini.d).toBe(3_584_000);
    expect(trainingCompute(mini.n, mini.d)).toBe(2_934_177_792_000);
    expect(mini.d / mini.n).toBeCloseTo(26.3, 1);
    // 125 789 distinct training tokens (139 765 minus the reserved 13 976), read ~28.5 times.
    expect(mini.d / 125_789).toBeCloseTo(28.5, 1);
  });

  it("gives the large models' budgets and ratios", () => {
    expect(trainingCompute(byId.gpt3.n, byId.gpt3.d)).toBeCloseTo(3.15e23, -21);
    expect(byId.gpt3.d / byId.gpt3.n).toBeCloseTo(1.71, 2);
    expect(byId.gopher.d / byId.gopher.n).toBeCloseTo(1.07, 2);
    expect(byId.chinchilla.d / byId.chinchilla.n).toBe(20);
    // Eleven orders of magnitude between the checkpoint and GPT-3.
    const orders = Math.log10(
      trainingCompute(byId.gpt3.n, byId.gpt3.d) / trainingCompute(byId.miniGpt.n, byId.miniGpt.d),
    );
    expect(orders).toBeGreaterThan(11);
    expect(orders).toBeLessThan(11.1);
  });

  it("puts Chinchilla at the bottom of Gopher's valley and Gopher up its wall", () => {
    const best = optimum(GOPHER_BUDGET);
    expect(best.n / 1e9).toBeCloseTo(72.2, 1);
    expect(best.d / 1e12).toBeCloseTo(1.33, 2);
    const chinchilla = fixedBudgetLoss(GOPHER_BUDGET, byId.chinchilla.n);
    const gopher = fixedBudgetLoss(GOPHER_BUDGET, byId.gopher.n);
    expect(chinchilla - best.loss).toBeLessThan(1e-4);
    expect(gopher - best.loss).toBeCloseTo(0.019, 3);
    expect(best.loss).toBeCloseTo(1.974, 3);
  });

  it("puts the checkpoint near the extrapolated frontier, and the cell's Table 3 fit near it too", () => {
    const c = trainingCompute(byId.miniGpt.n, byId.miniGpt.d);
    expect(optimum(c).n).toBeGreaterThan(115_000);
    expect(optimum(c).n).toBeLessThan(120_000);
    // Hoffmann et al., Table 3 (approach 1): the nine rows the lesson's cell fits.
    const n = [0.4, 1, 10, 67, 175, 280, 520, 1_000, 10_000].map((v) => v * 1e9);
    const d = [8.0, 20.2, 205.1, 1_500, 3_700, 5_900, 11_000, 21_200, 216_200].map((v) => v * 1e9);
    const logC = n.map((ni, i) => Math.log(trainingCompute(ni, d[i])));
    const fitN = polyfit(logC, n.map(Math.log));
    const fitD = polyfit(logC, d.map(Math.log));
    expect(fitN.slope).toBeCloseTo(0.498, 3);
    expect(fitD.slope).toBeCloseTo(0.502, 3);
    expect(fitN.slope + fitD.slope).toBeCloseTo(1, 12);
    const cellN = Math.exp(fitN.intercept + fitN.slope * Math.log(c));
    const cellD = Math.exp(fitD.intercept + fitD.slope * Math.log(c));
    expect(Math.round(cellN / 100) * 100).toBe(160_200);
    expect(cellD / cellN).toBeCloseTo(19.0, 1);
    // Both put the checkpoint's 136 448 within a factor of 1.2 of the optimum.
    expect(byId.miniGpt.n / optimum(c).n).toBeLessThan(1.2);
    expect(cellN / byId.miniGpt.n).toBeLessThan(1.2);
  });

  it("keeps Chinchilla's measured losses where its figures draw them", () => {
    // A sanity bound, not a quoted number: nats per token of a 32 000-entry vocabulary.
    for (const c of logspace(CHINCHILLA_MEASURED_C[0], CHINCHILLA_MEASURED_C[1], 5)) {
      const l = optimum(c).loss;
      expect(l).toBeGreaterThan(2);
      expect(l).toBeLessThan(3.2);
    }
    expect(chinchillaLoss(1e9, 2e10)).toBeLessThan(chinchillaLoss(1e9, 2e9));
  });
});

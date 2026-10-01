/*
 * COURSE-C2-P1-01 — The two fitted scaling laws behind `scaling-laws` (llm-agents Block 1
 * lesson 7, «Leyes de escala: Kaplan y Chinchilla»).
 *
 * Nothing here is trained or measured by the course: every constant is published, and the
 * header of each block says where. The lesson writes the loss $\mathcal{L}$ (the papers' L is
 * the course's layer count) and Chinchilla's constants with the subscript of the quantity they
 * go with ($A_N$, $A_D$, $\mathcal{L}_\infty$ for the paper's A, B, E), because B is the batch
 * size and β is reserved platform-wide. The code keeps the same names.
 *
 *   - KAPLAN — Kaplan et al. (2020), Table 5 / eqs. 1.1–1.3: L(N) = (N_c/N)^α_N,
 *     L(D) = (D_c/D)^α_D, L(C_min) = (C_c/C_min)^α_C. N counts NON-embedding parameters, D is the
 *     dataset size (early-stopped), C_min is in PF-days in the paper and in FLOPs here
 *     (1 PF-day = 8.64 × 10¹⁹). The scales are tokeniser-dependent, which the paper says itself.
 *   - CHINCHILLA — Hoffmann et al. (2022), approach 3, L(N, D) = L∞ + A_N/N^α_N + A_D/D^α_D,
 *     with the constants of its 2024 re-fit by Besiroglu, Erdil, Barnett and You («Chinchilla
 *     Scaling: A replication attempt», arXiv:2404.10102, eq. 3). The constants the paper printed
 *     (1.69, 406.4, 410.7, 0.34, 0.28) come from an optimizer that stopped early, and they put the
 *     optimum at ~50–90 tokens per parameter, against the 20 of the paper's other two methods and
 *     of Chinchilla itself; the re-fit gives ~20 across the range the paper measured, which is why
 *     the widget uses it. N counts ALL parameters (the paper's appendix F), as the mini-GPT's
 *     136 448 does.
 *   - `optimum(C)` — the paper's eq. 4, the bottom of the fixed-budget valley in closed form:
 *     N* = G (C/6)^{α_D/(α_N+α_D)}, D* = C/(6 N*), G = (α_N A_N / (α_D A_D))^{1/(α_N+α_D)}.
 *     The lesson derives it from the balance α_N A_N N^{−α_N} = α_D A_D D^{−α_D}.
 *   - MODELS — the checkpoint and three large models as (N, D), with C = 6ND. Chinchilla's Table 1
 *     for the three; for the mini-GPT, `CONFIG` and the training script (1 750 steps of 32
 *     windows of 64 tokens: the step the checkpoint was saved at).
 *
 * The lesson's one cell fits Chinchilla's Table 3 (approach 1) instead and gets ~160 000 for the
 * mini-GPT's budget where `optimum` gives ~118 000: two fits of the same experiments, extrapolated
 * seven orders of magnitude below them. The widget draws the mini-GPT on the frontier and quotes
 * no number there; the prose quotes the cell's.
 */

/** One PF-day in floating-point operations: 10¹⁵ · 24 · 3600. */
export const PF_DAY = 8.64e19;

export type LawAxis = "n" | "d" | "c";

export interface KaplanLaw {
  /** The scale X_c in L(X) = (X_c / X)^α; for C, in FLOPs. */
  readonly scale: number;
  readonly alpha: number;
  /** The range the paper measured the law over (its Figure 1), in the axis's own unit. */
  readonly measured: readonly [number, number];
}

/** Kaplan et al. (2020), Table 5. C is C_min, converted from PF-days to FLOPs. */
export const KAPLAN: Readonly<Record<LawAxis, KaplanLaw>> = {
  // 768 to 1.5 × 10⁹ non-embedding parameters (§2.3, Figure 1).
  n: { scale: 8.8e13, alpha: 0.076, measured: [768, 1.5e9] },
  // Subsets of WebText2 from 22M to its 22B tokens (Figures 1 and 9).
  d: { scale: 5.4e13, alpha: 0.095, measured: [2.1e7, 2.2e10] },
  // 10⁻⁸ to 1 PF-day (Figure 13).
  c: { scale: 3.1e8 * PF_DAY, alpha: 0.05, measured: [1e-8 * PF_DAY, PF_DAY] },
};

/** Kaplan's law along one axis: the whole loss is a power of x, with no floor. */
export function kaplanLoss(axis: LawAxis, x: number): number {
  const { scale, alpha } = KAPLAN[axis];
  return (scale / x) ** alpha;
}

export interface ChinchillaFit {
  /** L∞ — the paper's E: the loss no N and no D go below. */
  readonly lInf: number;
  /** A_N and its exponent α_N (the paper's A and α). */
  readonly aN: number;
  readonly alphaN: number;
  /** A_D and its exponent α_D (the paper's B and β). */
  readonly aD: number;
  readonly alphaD: number;
}

/** Besiroglu et al. (2024), eq. 3: Chinchilla's approach 3, re-fitted. */
export const CHINCHILLA: ChinchillaFit = {
  lInf: 1.8172,
  aN: 482.01,
  alphaN: 0.3478,
  aD: 2085.43,
  alphaD: 0.3658,
};

/** What Hoffmann et al. printed (§D.2, eq. 10). Kept for the test that says why it is not used. */
export const CHINCHILLA_AS_PRINTED: ChinchillaFit = {
  lInf: 1.69,
  aN: 406.4,
  alphaN: 0.34,
  aD: 410.7,
  alphaD: 0.28,
};

/**
 * The budgets Chinchilla trained its fixed-budget curves at (approach 2): 6 × 10¹⁸ to
 * 3 × 10²¹ FLOPs. The frontier is drawn solid over this range and dashed outside it.
 */
export const CHINCHILLA_MEASURED_C: readonly [number, number] = [6e18, 3e21];

/** Chinchilla's model sizes, 70M to 16B (its §1): the range its loss curve is drawn solid over. */
export const CHINCHILLA_MEASURED_N: readonly [number, number] = [7e7, 1.6e10];

/** Its token counts, 5B to 500B (the abstract): the same, for D. */
export const CHINCHILLA_MEASURED_D: readonly [number, number] = [5e9, 5e11];

/** L(N, D) = L∞ + A_N / N^α_N + A_D / D^α_D. */
export function chinchillaLoss(n: number, d: number, fit: ChinchillaFit = CHINCHILLA): number {
  return fit.lInf + fit.aN / n ** fit.alphaN + fit.aD / d ** fit.alphaD;
}

/** C ≈ 6ND: two operations per multiplication, three products per matrix (one out, two back). */
export function trainingCompute(n: number, d: number): number {
  return 6 * n * d;
}

/** The valley: the loss of a model of n parameters when the budget c fixes D = c / (6n). */
export function fixedBudgetLoss(c: number, n: number, fit: ChinchillaFit = CHINCHILLA): number {
  return chinchillaLoss(n, c / (6 * n), fit);
}

export interface Optimum {
  /** N*. */
  readonly n: number;
  /** D* = C / (6 N*). */
  readonly d: number;
  /** D* / N*: tokens per parameter. */
  readonly ratio: number;
  /** L(N*, D*): the bottom of the valley. */
  readonly loss: number;
}

/** The bottom of the fixed-budget valley, in closed form (Hoffmann et al., eq. 4). */
export function optimum(c: number, fit: ChinchillaFit = CHINCHILLA): Optimum {
  const { aN, alphaN, aD, alphaD } = fit;
  const g = ((alphaN * aN) / (alphaD * aD)) ** (1 / (alphaN + alphaD));
  const n = g * (c / 6) ** (alphaD / (alphaN + alphaD));
  const d = c / (6 * n);
  return { n, d, ratio: d / n, loss: chinchillaLoss(n, d, fit) };
}

/** The exponents of C in N* and D*: α_D/(α_N+α_D) and α_N/(α_N+α_D). They add up to 1. */
export function optimumExponents(fit: ChinchillaFit = CHINCHILLA): { n: number; d: number } {
  const s = fit.alphaN + fit.alphaD;
  return { n: fit.alphaD / s, d: fit.alphaN / s };
}

/**
 * Chinchilla's loss along one axis, the other quantity unlimited — the curve the widget sets
 * beside Kaplan's line: along N with D → ∞, along D with N → ∞, and along C at the optimum.
 */
export function chinchillaAlong(axis: LawAxis, x: number, fit: ChinchillaFit = CHINCHILLA): number {
  if (axis === "n") return fit.lInf + fit.aN / x ** fit.alphaN;
  if (axis === "d") return fit.lInf + fit.aD / x ** fit.alphaD;
  return optimum(x, fit).loss;
}

/** How much multiplying x by k multiplies each law's loss, at x. Kaplan's is k^−α everywhere. */
export function factorPer(axis: LawAxis, x: number, k: number): { kaplan: number; chinchilla: number } {
  return {
    kaplan: kaplanLoss(axis, k * x) / kaplanLoss(axis, x),
    chinchilla: chinchillaAlong(axis, k * x) / chinchillaAlong(axis, x),
  };
}

export type ModelId = "miniGpt" | "gpt3" | "gopher" | "chinchilla";

export interface ModelPoint {
  readonly id: ModelId;
  /** Parameters, embeddings included. */
  readonly n: number;
  /** Training tokens read, repetitions included. */
  readonly d: number;
}

/**
 * The frontier's points. The three large models are Chinchilla's Table 1; the mini-GPT is
 * public/courses/llm-agents/minigpt.py's 136 448 parameters and the 1 750 × 32 × 64 tokens the
 * checkpoint had read when it was saved.
 */
export const MODELS: readonly ModelPoint[] = [
  { id: "miniGpt", n: 136_448, d: 1_750 * 32 * 64 },
  { id: "gpt3", n: 175e9, d: 300e9 },
  { id: "gopher", n: 280e9, d: 300e9 },
  { id: "chinchilla", n: 70e9, d: 1.4e12 },
];

/** Gopher's training budget as Chinchilla's paper counts it, which it also gave Chinchilla. */
export const GOPHER_BUDGET = 5.76e23;

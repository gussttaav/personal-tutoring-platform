/*
 * COURSE-C2-P1-01 — What one generated token costs, with the key–value cache and without it,
 * for `kv-cache` (llm-agents Block 1 lesson 5, «La caché de claves y valores: cuánto cuesta
 * cada token»).
 *
 * The lesson counts MULTIPLICATIONS in matrix products, the first course's unit («multiplicar
 * una matriz por un vector cuesta una multiplicación por casilla»), and ignores the O(d) work
 * of the layer norms, the softmax and the ReLU. With that unit:
 *
 *   - `rowCost` — c_fila: one row through every matrix of the network. Per layer the fused
 *     Q/K/V projection (3d²), the output projection (d²) and the two FFN matrices (2·d·d_ff);
 *     then the output layer tied to E (d·|V|). One multiplication per weight of a matrix, so
 *     it is the mini-GPT's parameter count minus what never multiplies a row: P (a lookup),
 *     the biases and the layer norms' gains and shifts;
 *   - `attentionCost(t)` — the attention of ONE query row against t keys, all layers: per
 *     head t·d_k for the scores and t·d_k for the mix, h heads, so 2·t·d per layer;
 *   - `stepCost(t, true)` — c(t) = c_fila + 2·L·t·d: the token at position t with the cache,
 *     one new row whose query reads the t keys stored so far;
 *   - `stepCost(t, false)` — t · c(t): the same token with no cache, which is `adelante` on
 *     all t rows — t rows through the matrices, plus the full t × t grid of scores and mix
 *     that `minigpt.py` computes and then masks. The identity is exact under this unit,
 *     which is the lesson's first result;
 *   - `totalCost(T, …)` — the sums over t = 1..T, in closed form;
 *   - `cacheNumbers(t)` — 2·L·t·d: a key and a value of d numbers per position and layer.
 *
 * `forwardMultiplications` and `cachedStepMultiplications` recount the same two costs product
 * by product, in the order `adelante` and the lesson's `paso` run them — the independent
 * derivation the tests set against the closed forms.
 */

export interface KvConfig {
  /** L, the number of layers. */
  readonly layers: number;
  /** d_model. */
  readonly dModel: number;
  /** h, the number of heads; d_k = d_model / h. */
  readonly heads: number;
  /** d_ff, the width inside the FFN. */
  readonly dFF: number;
  /** |V|. */
  readonly vocab: number;
  /** T_ctx: the most positions the network has a row of P for. */
  readonly tCtx: number;
}

/** `CONFIG` in public/courses/llm-agents/minigpt.py. */
export const MINI_GPT: KvConfig = { layers: 2, dModel: 64, heads: 4, dFF: 256, vocab: 512, tCtx: 64 };

/**
 * The lesson's large model: 32 layers and d_model = 4 096, the shape of the open models of
 * about seven billion parameters. Only its cache size is quoted, and that needs L and d_model
 * alone; d_ff and |V| are the usual 4·d_model and 32 000, there so the type is complete.
 */
export const LARGE_MODEL: KvConfig = {
  layers: 32,
  dModel: 4096,
  heads: 32,
  dFF: 16384,
  vocab: 32000,
  tCtx: 4096,
};

/** c_fila: multiplications to take one row through every matrix of the network. */
export function rowCost(cfg: KvConfig): number {
  const d = cfg.dModel;
  return cfg.layers * (4 * d * d + 2 * d * cfg.dFF) + d * cfg.vocab;
}

/** The attention of one query row against t keys, summed over the layers: 2·L·t·d. */
export function attentionCost(t: number, cfg: KvConfig): number {
  return 2 * cfg.layers * t * cfg.dModel;
}

/** The token at position t (1-based): c(t) with the cache, t · c(t) without it. */
export function stepCost(t: number, cfg: KvConfig, cached: boolean): number {
  const c = rowCost(cfg) + attentionCost(t, cfg);
  return cached ? c : t * c;
}

/**
 * Σ_{t=1}^{T} of `stepCost`, closed form.
 *   with the cache:  T·c_fila + L·d·T(T+1)
 *   without it:      c_fila·T(T+1)/2 + L·d·T(T+1)(2T+1)/3
 */
export function totalCost(T: number, cfg: KvConfig, cached: boolean): number {
  const a = rowCost(cfg);
  const ld = cfg.layers * cfg.dModel;
  if (cached) return T * a + ld * T * (T + 1);
  return (a * T * (T + 1)) / 2 + (ld * T * (T + 1) * (2 * T + 1)) / 3;
}

/** Numbers the cache holds after t positions: a key and a value of d_model per layer. */
export function cacheNumbers(t: number, cfg: KvConfig): number {
  return 2 * cfg.layers * t * cfg.dModel;
}

/** Multiplications of an (m × k) · (k × n) product. */
const product = (m: number, k: number, n: number) => m * k * n;

/**
 * `adelante` on t rows, product by product, as minigpt.py runs it: the independent count of
 * the no-cache token. The scores are the full t × t grid per head (`Q @ K.T`, masked after),
 * and the output layer turns every row into logits, though `generar` keeps only the last.
 */
export function forwardMultiplications(t: number, cfg: KvConfig): number {
  const { dModel: d, heads: h, dFF } = cfg;
  const dk = d / h;
  let n = 0;
  for (let l = 0; l < cfg.layers; l++) {
    n += product(t, d, 3 * d); // Hn @ Wqkv
    n += h * product(t, dk, t); // Q @ K.T, per head
    n += h * product(t, t, dk); // A @ V, per head
    n += product(t, d, d); // O @ Wo
    n += product(t, d, dFF); // Hn @ W1
    n += product(t, dFF, d); // R @ W2
  }
  return n + product(t, d, cfg.vocab); // Hn @ E.T
}

/** The lesson's `paso` for the token at position t, product by product: one row, t keys. */
export function cachedStepMultiplications(t: number, cfg: KvConfig): number {
  const { dModel: d, heads: h, dFF } = cfg;
  const dk = d / h;
  let n = 0;
  for (let l = 0; l < cfg.layers; l++) {
    n += product(1, d, 3 * d); // the new row's q, k, v
    n += h * product(1, dk, t); // q against the t cached keys, per head
    n += h * product(1, t, dk); // the mix of the t cached values, per head
    n += product(1, d, d); // Wo
    n += product(1, d, dFF) + product(1, dFF, d); // FFN
  }
  return n + product(1, d, cfg.vocab); // logits of the new row only
}

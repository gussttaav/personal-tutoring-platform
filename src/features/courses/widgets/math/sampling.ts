/*
 * COURSE-C2-P1-01 — Sampling from a logit vector, for `sampling-explorer` (llm-agents
 * Block 1 lesson 4, «Muestreo: temperatura, top-k y top-p»), and shared with Block 3's
 * `logit-mask`, which is the same truncation onto a set a grammar allows.
 *
 * A TypeScript port of `muestrear` in `public/courses/llm-agents/minigpt.py`, the function
 * the lesson's cells call, split into the pieces the lesson states one by one:
 *
 *   - `temperedSoftmax(z, τ)` — softmax(z/τ), max subtracted so a small τ cannot overflow;
 *     τ = 0 is the limit the lesson derives, a one-hot on the argmax (`temperatura == 0`
 *     returns `argmax(z)` in the Python);
 *   - `rankOrder(q)` — the entries from most to least probable. Temperature never changes
 *     it, which is why the widget's bars never move when τ does;
 *   - `topKSet` / `nucleusSize` / `topPSet` — the two cut-offs, both a prefix of that order:
 *     top-k keeps the first k, top-p the first k_p, the smallest prefix whose mass reaches p;
 *   - `restrict(q, keep)` — cut and renormalise: the operation both cut-offs share, and the
 *     one `logit-mask` reuses with a grammar's allowed set as `keep`;
 *   - `samplingDistribution` — the pipeline in `muestrear`'s order: temperature, then
 *     top-k, then top-p, then renormalise once.
 *
 * Two conventions follow the Python exactly, because the lesson's numbers come from it:
 *
 *   - top-p measures p against the TEMPERED mass, before any renormalisation, and when both
 *     cut-offs are on it runs after top-k on the unrenormalised vector — which makes the
 *     combination the intersection of the two sets;
 *   - an entry is inside the nucleus when the mass BEFORE it, in rank order, is below p
 *     (`acumulada - p[orden] >= top_p` drops the rest), so the entry that crosses p stays.
 *
 * One deliberate difference: `muestrear`'s top-k keeps every entry tied with the k-th
 * (`p >= sort(p)[-k]`); here ties are broken by id and exactly k survive. Real logits have
 * no ties, so the two agree on everything the lesson shows; a widget whose count read
 * «k = 10 · 11 entries» would not.
 */

/** softmax(z / τ). τ = 0 is the limit: all the mass on the argmax, split evenly on a tie. */
export function temperedSoftmax(z: readonly number[], tau: number): number[] {
  if (z.length === 0) return [];
  const max = Math.max(...z);
  if (tau <= 0) {
    const winners = z.filter((v) => v === max).length;
    return z.map((v) => (v === max ? 1 / winners : 0));
  }
  // Subtracting the max first: z/τ with τ = 0.01 and z ≈ 10 is e^1000 otherwise.
  const e = z.map((v) => Math.exp((v - max) / tau));
  const sum = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / sum);
}

/** Entry ids from most to least probable; ties go to the smaller id. */
export function rankOrder(q: readonly number[]): number[] {
  return q.map((_, i) => i).sort((a, b) => q[b] - q[a] || a - b);
}

/** The k most probable entries, as a keep-mask. `k` is clamped to [1, |V|]. */
export function topKSet(q: readonly number[], k: number): boolean[] {
  const keep = q.map(() => false);
  const n = Math.max(1, Math.min(q.length, Math.floor(k)));
  for (const id of rankOrder(q).slice(0, n)) keep[id] = true;
  return keep;
}

/**
 * k_p: how many entries the nucleus holds — the length of the smallest prefix of the rank
 * order whose mass reaches p. An entry stays while the mass before it is below p, exactly
 * `minigpt.py`'s test, so the one that crosses p is inside. Always at least 1.
 */
export function nucleusSize(q: readonly number[], p: number): number {
  const order = rankOrder(q);
  let before = 0;
  let size = 0;
  for (const id of order) {
    if (size > 0 && before >= p) break;
    before += q[id];
    size += 1;
  }
  return size;
}

/** The nucleus as a keep-mask: the first `nucleusSize(q, p)` entries of the rank order. */
export function topPSet(q: readonly number[], p: number): boolean[] {
  return topKSet(q, nucleusSize(q, p));
}

export interface Restricted {
  /** The renormalised distribution: q on the kept entries divided by their mass, else 0. */
  dist: number[];
  /** The mass the kept entries held before renormalising; 1 − keptMass is what was cut. */
  keptMass: number;
}

/**
 * Cut and renormalise: zero every entry outside `keep` and divide the rest by the mass they
 * held. The step top-k and top-p share, and the one a logit mask is (`logit-mask`, Block 3).
 */
export function restrict(q: readonly number[], keep: readonly boolean[]): Restricted {
  const keptMass = q.reduce((acc, v, i) => (keep[i] ? acc + v : acc), 0);
  return { dist: q.map((v, i) => (keep[i] ? v / keptMass : 0)), keptMass };
}

export interface SamplingOptions {
  /** Temperature; 0 is greedy. */
  tau: number;
  /** Keep the k most probable; `null` for no top-k cut. */
  topK?: number | null;
  /** Keep the nucleus of mass p; `null` (or p ≥ 1 with no effect) for no top-p cut. */
  topP?: number | null;
}

export interface SamplingResult {
  /** softmax(z/τ): the distribution before any cut. */
  tempered: number[];
  /** Which entries survive the cut-offs. */
  keep: boolean[];
  /** What the sampler draws from: `tempered` cut and renormalised. */
  dist: number[];
  /** Mass of the kept entries under `tempered`; the discarded mass is 1 − keptMass. */
  keptMass: number;
  /** How many entries the draw is between: kept, and with mass above zero (at τ = 0, one). */
  keptCount: number;
}

/** `muestrear`'s distribution: temperature, then top-k, then top-p, renormalised once. */
export function samplingDistribution(z: readonly number[], options: SamplingOptions): SamplingResult {
  const tempered = temperedSoftmax(z, options.tau);
  let keep = tempered.map(() => true);
  if (options.topK != null) keep = topKSet(tempered, options.topK);
  if (options.topP != null) {
    // After top-k, on the unrenormalised vector: entries top-k dropped count as zero mass,
    // so the nucleus of what is left is the nucleus of `tempered` intersected with it.
    const nucleus = topPSet(
      tempered.map((v, i) => (keep[i] ? v : 0)),
      options.topP,
    );
    keep = keep.map((k, i) => k && nucleus[i]);
  }
  const { dist, keptMass } = restrict(tempered, keep);
  return { tempered, keep, dist, keptMass, keptCount: dist.filter((v) => v > 0).length };
}

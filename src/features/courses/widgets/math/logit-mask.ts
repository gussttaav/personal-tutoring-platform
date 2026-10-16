/*
 * COURSE-C2-P1-03 — A logit mask, for `logit-mask` (llm-agents Block 3 lesson 3, «Salida
 * estructurada: generación restringida»).
 *
 * The lesson's one line: setting the logits outside the allowed set A_j to −∞ and taking the
 * softmax gives, on A_j, the model's distribution renormalised there,
 *
 *   e^{z_v} / Σ_{u∈A_j} e^{z_u}  =  p_θ(v | x, y_<j) / p_θ(A_j | x, y_<j),
 *
 * which is Block 1 lesson 4's corte with A_j for the núcleo. So nothing new is computed here:
 * `maskView` hands the step's probabilities to `restrict` from ./sampling, the same function
 * `sampling-explorer` cuts with, and reads back the renormalised entries and the kept mass.
 *
 *   - `allowedIds` — A_j from its definition: the entries whose BYTES, after the bytes written
 *     so far, are still the beginning of a text of the grammar. Bytes, not characters: a
 *     token can be half of `í`. The presets' allowed sets are asserted against it;
 *   - `maskView` — one position: the rows the widget draws (the model's most probable entries
 *     and every allowed one), each with its probability before and after the mask, the rest
 *     of the vocabulary as one aggregated row, and p_θ(A_j | x, y_<j);
 *   - `pathTotals` — a path up to a position: the probability of its tokens without the mask,
 *     with it, and the product of the masses kept. The second is the first divided by the
 *     third, the lesson's q̃(y | x) = p_θ(y | x) / Π_j p_θ(A_j | x, y_<j).
 */

import type { MaskEntry, MaskStep } from "./logit-mask-presets";
import { restrict } from "./sampling";

/** |V| of the mini-GPT: 256 bytes and 256 fusiones. */
export const VOCAB_SIZE = 512;

/** UTF-8 bytes of a string. */
export const utf8Bytes = (text: string): number[] => Array.from(new TextEncoder().encode(text));

const startsWith = (whole: readonly number[], start: readonly number[]) =>
  start.length <= whole.length && start.every((b, i) => whole[i] === b);

/**
 * A_j: the ids whose bytes, appended to `written`, leave the beginning of some text in
 * `texts` (every text as its bytes). In id order. A text written whole allows nothing more,
 * which is where the harness stops.
 */
export function allowedIds(
  written: readonly number[],
  texts: readonly (readonly number[])[],
  vocab: readonly (readonly number[])[],
): number[] {
  const out: number[] = [];
  vocab.forEach((bytes, id) => {
    const next = [...written, ...bytes];
    if (bytes.length > 0 && texts.some((t) => startsWith(t, next))) out.push(id);
  });
  return out;
}

export interface MaskRow {
  readonly id: number;
  readonly label: string;
  /** p_θ(v | x, y_<j): before the mask. */
  readonly before: number;
  /** After the mask: renormalised on A_j, 0 outside it. */
  readonly after: number;
  readonly allowed: boolean;
}

export interface MaskView {
  /** The model's most probable entries and every allowed one, by probability before the mask. */
  readonly rows: readonly MaskRow[];
  /** Everything else in the vocabulary, as one row: how many entries, and their mass. */
  readonly rest: { readonly count: number; readonly mass: number };
  /** p_θ(A_j | x, y_<j): the mass the mask keeps. */
  readonly keptMass: number;
  /** |A_j|. */
  readonly allowedCount: number;
}

/** One position, masked: the rows, the aggregated rest, and the mass kept. */
export function maskView(step: MaskStep, vocabSize = VOCAB_SIZE): MaskView {
  const allowedIdSet = new Set(step.allowed.map((e) => e.id));
  const byId = new Map<number, MaskEntry>();
  for (const e of [...step.top, ...step.allowed]) byId.set(e.id, e);
  const entries = [...byId.values()].sort((a, b) => b.p - a.p || a.id - b.id);
  const listedMass = entries.reduce((s, e) => s + e.p, 0);
  const restMass = Math.max(0, 1 - listedMass);
  // The distribution over [listed entries…, the rest], cut to A_j and renormalised: the mask.
  const q = [...entries.map((e) => e.p), restMass];
  const keep = [...entries.map((e) => allowedIdSet.has(e.id)), false];
  const { dist, keptMass } = restrict(q, keep);
  return {
    rows: entries.map((e, i) => ({
      id: e.id,
      label: e.label,
      before: e.p,
      after: dist[i],
      allowed: keep[i],
    })),
    rest: { count: vocabSize - entries.length, mass: restMass },
    keptMass,
    allowedCount: step.allowed.length,
  };
}

export interface PathTotals {
  /** p_θ of the path's tokens up to the position: the product of their probabilities. */
  readonly raw: number;
  /** The same tokens under the mask: the product of their renormalised probabilities. */
  readonly masked: number;
  /** Π_j p_θ(A_j | x, y_<j) over the same positions: `raw` / `masked`. */
  readonly kept: number;
}

/** The first `upto` steps of a path: its probability without the mask, with it, and the ratio. */
export function pathTotals(steps: readonly MaskStep[], upto: number): PathTotals {
  let raw = 1;
  let masked = 1;
  let kept = 1;
  for (const step of steps.slice(0, upto)) {
    const mass = step.allowed.reduce((s, e) => s + e.p, 0);
    const p = step.allowed.find((e) => e.id === step.chosen)?.p ?? 0;
    raw *= p;
    masked *= p / mass;
    kept *= mass;
  }
  return { raw, masked, kept };
}

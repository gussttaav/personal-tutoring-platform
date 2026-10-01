/*
 * COURSE-C2-P1-01 — `math/sampling.ts` and the frozen vectors in `math/sampling-presets.ts`,
 * checked two independent ways, as AUTHORING §7 asks of a widget's maths:
 *
 *   1. HAND AND LIMIT CASES — distributions small enough to work out on paper: the ratio
 *      law q_u/q_v = (e^{z_u − z_v})^{1/τ}, the two limits the lesson derives (τ → 0 is a
 *      one-hot on the argmax, τ → ∞ the uniform), a nucleus whose crossing entry stays, and
 *      the monotonicity the lesson's quiz leans on (the nucleus never shrinks as τ grows).
 *   2. THE LESSON'S NUMBERS — the two presets are the logits of `adelante` on «La Nela» and
 *      «La Nela bajó la cabe», and the lesson's first cell prints their top entries, top-10
 *      mass, nucleus size and the mass the nucleus leaves out at τ = 0.5, 1 and 2, from
 *      Pyodide. Those printed numbers are asserted here, so the widget and the cell cannot
 *      disagree; and every label is re-decoded from `bpe-merges.json`.
 */

import fs from "node:fs";
import path from "node:path";

import { N_BYTES, tokenLabel, vocabulary } from "../bpe-merges";
import {
  nucleusSize,
  rankOrder,
  restrict,
  samplingDistribution,
  temperedSoftmax,
  topKSet,
  topPSet,
} from "../sampling";
import { SAMPLING_PRESETS } from "../sampling-presets";

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
/** Mass of the j most probable entries: the lesson's M_j. */
const topMass = (q: readonly number[], j: number) => sum(rankOrder(q).slice(0, j).map((i) => q[i]));

describe("sampling — temperature", () => {
  const z = [2.0, 1.0, 0.5, -1.0];

  it("is the softmax at τ = 1, and every τ gives a distribution", () => {
    const e = z.map(Math.exp);
    const q = temperedSoftmax(z, 1);
    q.forEach((v, i) => expect(v).toBeCloseTo(e[i] / sum(e), 12));
    for (const tau of [0.05, 0.5, 2, 10]) expect(sum(temperedSoftmax(z, tau))).toBeCloseTo(1, 12);
  });

  it("raises every ratio to the power 1/τ", () => {
    for (const tau of [0.25, 0.5, 2, 3]) {
      const q = temperedSoftmax(z, tau);
      // q_u / q_v = (e^{z_u − z_v})^{1/τ}: the lesson's one-line law.
      expect(q[0] / q[2]).toBeCloseTo(Math.exp(z[0] - z[2]) ** (1 / tau), 9);
      expect(q[1] / q[3]).toBeCloseTo(Math.exp(z[1] - z[3]) ** (1 / tau), 9);
    }
  });

  it("never changes the order of the entries", () => {
    const order = rankOrder(temperedSoftmax(z, 1));
    for (const tau of [0.05, 0.3, 2, 50]) expect(rankOrder(temperedSoftmax(z, tau))).toEqual(order);
  });

  it("tends to a one-hot on the argmax as τ → 0, and τ = 0 is that limit", () => {
    const q = temperedSoftmax(z, 0.01);
    expect(q[0]).toBeGreaterThan(1 - 1e-12);
    expect(temperedSoftmax(z, 0)).toEqual([1, 0, 0, 0]);
    // A tie splits the limit evenly between the tied maxima.
    expect(temperedSoftmax([3, 1, 3], 0)).toEqual([0.5, 0, 0.5]);
  });

  it("tends to the uniform as τ → ∞", () => {
    temperedSoftmax(z, 1e6).forEach((v) => expect(v).toBeCloseTo(1 / z.length, 5));
  });

  it("does not overflow when z/τ is huge", () => {
    const q = temperedSoftmax([1000, 999, 0], 0.01);
    expect(q.every(Number.isFinite)).toBe(true);
    expect(q[0]).toBeCloseTo(1, 12);
  });

  it("lowers the favourite's probability as τ grows", () => {
    let last = 1;
    for (const tau of [0.1, 0.5, 1, 2, 5]) {
      const top = temperedSoftmax(z, tau)[0];
      expect(top).toBeLessThan(last);
      last = top;
    }
  });
});

describe("sampling — the cut-offs", () => {
  // Probabilities 0.15, 0.5, 0.05, 0.3 — in id order, so rank order and id order differ.
  const q = [0.15, 0.5, 0.05, 0.3];

  it("top-k keeps exactly the k most probable", () => {
    expect(topKSet(q, 2)).toEqual([false, true, false, true]);
    expect(topKSet(q, 1)).toEqual([false, true, false, false]);
    expect(topKSet(q, 99).every(Boolean)).toBe(true);
    // Ties go to the smaller id, so exactly k survive.
    expect(topKSet([0.4, 0.3, 0.3], 2)).toEqual([true, true, false]);
  });

  it("the nucleus is the smallest prefix whose mass reaches p, crossing entry included", () => {
    expect(nucleusSize(q, 0.4)).toBe(1); // 0.5 already reaches 0.4
    expect(nucleusSize(q, 0.6)).toBe(2); // 0.5 < 0.6, so the 0.3 that crosses stays
    expect(nucleusSize(q, 0.85)).toBe(3); // 0.8 < 0.85 ≤ 0.95
    expect(nucleusSize(q, 1)).toBe(4);
    expect(nucleusSize(q, 0)).toBe(1); // never empty
    expect(topPSet(q, 0.85)).toEqual([true, true, false, true]);
  });

  it("restrict renormalises what it keeps and reports the mass it cut", () => {
    const { dist, keptMass } = restrict(q, topPSet(q, 0.6));
    expect(keptMass).toBeCloseTo(0.8, 12);
    expect(dist[1]).toBeCloseTo(0.625, 12);
    expect(dist[3]).toBeCloseTo(0.375, 12);
    expect(dist[0] + dist[2]).toBe(0);
  });

  it("chains temperature, top-k and top-p the way minigpt.py's muestrear does", () => {
    const z = q.map(Math.log);
    const none = samplingDistribution(z, { tau: 1 });
    none.dist.forEach((v, i) => expect(v).toBeCloseTo(q[i], 12));
    expect(none.keptCount).toBe(4);
    // top-k 3 then top-p 0.6 on the UNRENORMALISED tempered vector: the intersection.
    const both = samplingDistribution(z, { tau: 1, topK: 3, topP: 0.6 });
    expect(both.keep).toEqual([false, true, false, true]);
    expect(both.keptMass).toBeCloseTo(0.8, 12);
    // τ = 0 draws from one entry whatever the cut-offs say.
    const greedy = samplingDistribution(z, { tau: 0, topK: 3 });
    expect(greedy.dist).toEqual([0, 1, 0, 0]);
    expect(greedy.keptCount).toBe(1);
  });

  it("the top-k set does not depend on τ, and the nucleus never shrinks as τ grows", () => {
    const z = SAMPLING_PRESETS[0].logits;
    const k10 = topKSet(temperedSoftmax(z, 1), 10);
    let last = 0;
    for (const tau of [0.2, 0.5, 0.8, 1, 1.5, 2, 3]) {
      const tq = temperedSoftmax(z, tau);
      expect(topKSet(tq, 10)).toEqual(k10);
      const size = nucleusSize(tq, 0.9);
      expect(size).toBeGreaterThanOrEqual(last);
      last = size;
    }
  });
});

describe("sampling — the frozen vectors are the checkpoint's", () => {
  const merges = (
    JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "public", "courses", "llm-agents", "bpe-merges.json"), "utf8"),
    ) as [number, number][]
  ).map((pair, i) => ({ pair, id: N_BYTES + i }) as const);
  const vocab = vocabulary(merges);
  const preset = (id: string) => SAMPLING_PRESETS.find((p) => p.id === id)!;

  it("has one logit per vocabulary entry, and every label spells its id", () => {
    for (const p of SAMPLING_PRESETS) {
      expect(p.logits).toHaveLength(N_BYTES + merges.length);
      const labelled = Object.keys(p.labels).map(Number);
      // The labels are exactly the most probable entries, in any order.
      expect(new Set(labelled)).toEqual(new Set(rankOrder(temperedSoftmax(p.logits, 1)).slice(0, labelled.length)));
      for (const id of labelled) expect(p.labels[id]).toBe(tokenLabel(vocab[id]).text);
    }
  });

  /*
   * The lesson's first cell, from Pyodide 0.29.3 on the full-precision logits (the presets
   * are rounded to 4 decimals, which moves none of these at the printed precision):
   *
   *   'La Nela'
   *     tau = 0.5   ' no' 0.342  ',' 0.259   top-10 guarda 0.852   núcleo(0.9) =  15, deja fuera 0.093
   *     tau = 1.0   ' no' 0.118  ',' 0.102   top-10 guarda 0.502   núcleo(0.9) =  44, deja fuera 0.096
   *     tau = 2.0   ' no' 0.040  ',' 0.037   top-10 guarda 0.252   núcleo(0.9) =  92, deja fuera 0.098
   *   'La Nela bajó la cabe'
   *     tau = 0.5   'za' 1.000  'da' 0.000   top-10 guarda 1.000   núcleo(0.9) =   1, deja fuera 0.000
   *     tau = 1.0   'za' 0.974  'da' 0.005   top-10 guarda 0.989   núcleo(0.9) =   1, deja fuera 0.026
   *     tau = 2.0   'za' 0.387  'da' 0.028   top-10 guarda 0.521   núcleo(0.9) = 133, deja fuera 0.099
   */
  const printed: Record<string, [number, [string, number], [string, number], number, number, number][]> = {
    open: [
      [0.5, [" no", 0.342], [",", 0.259], 0.852, 15, 0.093],
      [1.0, [" no", 0.118], [",", 0.102], 0.502, 44, 0.096],
      [2.0, [" no", 0.04], [",", 0.037], 0.252, 92, 0.098],
    ],
    peaked: [
      [0.5, ["za", 1.0], ["da", 0.0], 1.0, 1, 0.0],
      [1.0, ["za", 0.974], ["da", 0.005], 0.989, 1, 0.026],
      [2.0, ["za", 0.387], ["da", 0.028], 0.521, 133, 0.099],
    ],
  };

  it.each(Object.keys(printed))("reproduces what the lesson prints for the %s context", (id) => {
    const p = preset(id);
    for (const [tau, first, second, top10, nucleus, outside] of printed[id]) {
      const q = temperedSoftmax(p.logits, tau);
      const [a, b] = rankOrder(q);
      expect([p.labels[a], p.labels[b]]).toEqual([first[0], second[0]]);
      expect(q[a]).toBeCloseTo(first[1], 3);
      expect(q[b]).toBeCloseTo(second[1], 3);
      expect(topMass(q, 10)).toBeCloseTo(top10, 3);
      expect(nucleusSize(q, 0.9)).toBe(nucleus);
      expect(1 - topMass(q, nucleus)).toBeCloseTo(outside, 3);
    }
  });

  it("gives the ratio the quiz asks for: « no» over « es» at τ = 0.5", () => {
    const p = preset("open");
    const id = (text: string) => Number(Object.keys(p.labels).find((k) => p.labels[Number(k)] === text));
    const q1 = temperedSoftmax(p.logits, 1);
    const q05 = temperedSoftmax(p.logits, 0.5);
    expect(q1[id(" no")]).toBeCloseTo(0.118, 3);
    expect(q1[id(" es")]).toBeCloseTo(0.045, 3);
    expect(q05[id(" no")] / q05[id(" es")]).toBeCloseTo(6.82, 2);
  });

  it("in the decided context top-10 keeps nine entries holding under 2 % between them", () => {
    const q = temperedSoftmax(preset("peaked").logits, 1);
    expect(topMass(q, 10) - topMass(q, 1)).toBeCloseTo(0.015, 3);
  });
});

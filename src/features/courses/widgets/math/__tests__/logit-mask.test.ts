/*
 * COURSE-C2-P1-03 — `math/logit-mask.ts` and the frozen paths in `math/logit-mask-presets.ts`,
 * checked two independent ways, as AUTHORING §7 asks of a widget's maths:
 *
 *   1. HAND CASES — `allowedIds` on a three-text grammar, in bytes; and the path totals obey
 *      q̃(y | x) = p_θ(y | x) / Π_j p_θ(A_j | x, y_<j). That the masked softmax is `restrict`
 *      onto A_j, the lesson's one line, is asserted with the rest of `restrict`, in
 *      sampling.test.ts.
 *   2. THE PRESETS AND THE LESSON — every allowed set is rebuilt from the grammar and
 *      `bpe-merges.json` with `allowedIds`, independently of the Python that wrote it; every
 *      label is re-decoded; every path spells its text; and the numbers the lesson's
 *      intuition quotes from the widget are asserted.
 */

import fs from "node:fs";
import path from "node:path";

import { N_BYTES, tokenLabel, vocabulary } from "../bpe-merges";
import { allowedIds, maskView, pathTotals, utf8Bytes, VOCAB_SIZE } from "../logit-mask";
import {
  LOGIT_MASK_NAMES,
  LOGIT_MASK_PATHS,
  LOGIT_MASK_SHARED,
  LOGIT_MASK_TEMPLATE,
  type MaskStep,
} from "../logit-mask-presets";
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

describe("logit-mask — allowedIds is A_j's definition", () => {
  const texts = ["ab", "ac", "b"].map(utf8Bytes);
  const vocab = [[97], [98], [99], [97, 98], [98, 98]]; // a b c ab bb

  it("allows an entry exactly when the text with it is still the start of one", () => {
    expect(allowedIds([], texts, vocab)).toEqual([0, 1, 3]);
    expect(allowedIds(utf8Bytes("a"), texts, vocab)).toEqual([1, 2]);
    expect(allowedIds(utf8Bytes("b"), texts, vocab)).toEqual([]); // complete: the harness stops
  });

  it("works in bytes: half a character is a beginning", () => {
    const i = utf8Bytes("í"); // C3 AD
    expect(allowedIds([], [i], [[0xc3], i, [0xad]])).toEqual([0, 1]);
  });
});

describe("logit-mask — path totals", () => {
  const steps: MaskStep[] = [
    { chosen: 1, allowed: [{ id: 1, label: "P", p: 0.3 }, { id: 2, label: "Nela", p: 0.1 }], top: [] },
    { chosen: 3, allowed: [{ id: 3, label: "ablo", p: 0.1 }], top: [] },
  ];

  it("multiply the raw and the renormalised probabilities, and their ratio is the kept mass", () => {
    const t = pathTotals(steps, 2);
    expect(t.raw).toBeCloseTo(0.03, 12);
    expect(t.masked).toBeCloseTo(0.75, 12); // 0.3 / 0.4, then a lone entry: the quiz's case
    expect(t.kept).toBeCloseTo(0.04, 12);
    expect(t.raw / t.masked).toBeCloseTo(t.kept, 12);
    expect(pathTotals(steps, 0)).toEqual({ raw: 1, masked: 1, kept: 1 });
  });
});

describe("logit-mask — the presets are the checkpoint under the lesson's grammar", () => {
  const merges = (
    JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "public", "courses", "llm-agents", "bpe-merges.json"), "utf8"),
    ) as [number, number][]
  ).map((pair, i) => ({ pair, id: N_BYTES + i }));
  const vocab = vocabulary(merges);
  const texts = LOGIT_MASK_NAMES.map((n) => utf8Bytes(LOGIT_MASK_TEMPLATE.replace("{name}", n)));
  const fullPath = (n: (typeof LOGIT_MASK_NAMES)[number]) => [...LOGIT_MASK_SHARED, ...LOGIT_MASK_PATHS[n]];

  it("has the mini-GPT's vocabulary", () => {
    expect(vocab).toHaveLength(VOCAB_SIZE);
  });

  it.each(LOGIT_MASK_NAMES)("spells «%s», with every allowed set rebuilt from the grammar", (name) => {
    const written: number[] = [];
    for (const step of fullPath(name)) {
      expect(step.allowed.map((e) => e.id)).toEqual(allowedIds(written, texts, vocab));
      expect(step.allowed.map((e) => e.id)).toContain(step.chosen);
      for (const e of [...step.allowed, ...step.top]) {
        const { text, valid } = tokenLabel(vocab[e.id]);
        expect(e.label).toBe(text);
        expect(Boolean(e.partial)).toBe(!valid);
      }
      // The top rows are in rank order and are the model's probabilities, not the mask's.
      step.top.slice(1).forEach((e, i) => expect(e.p).toBeLessThanOrEqual(step.top[i].p));
      expect(sum(step.top.map((e) => e.p))).toBeLessThan(1);
      written.push(...vocab[step.chosen]);
    }
    expect(written).toEqual(utf8Bytes(LOGIT_MASK_TEMPLATE.replace("{name}", name)));
    expect(allowedIds(written, texts, vocab)).toEqual([]);
  });

  it("shares exactly the steps up to the quote that opens the value", () => {
    const shared = LOGIT_MASK_SHARED.flatMap((s) => vocab[s.chosen]);
    expect(new TextDecoder().decode(new Uint8Array(shared))).toBe('{"personaje": "');
  });

  // The numbers the lesson's intuition reads off the widget.
  it("leaves «{» alone at the first position, with 1.2 × 10⁻⁷ of the mass", () => {
    const v = maskView(LOGIT_MASK_SHARED[0]);
    expect(v.allowedCount).toBe(1);
    expect(v.keptMass).toBeCloseTo(1.244e-7, 10);
    expect(v.rows[0]).toMatchObject({ label: "\n", allowed: false });
    expect(v.rows[0].before).toBeCloseTo(0.343, 3);
    expect(v.rows.find((r) => r.label === "{")?.after).toBe(1);
  });

  it("splits the value's first letter 61 / 22 / 15 / 1.6 % between P, C, T and N", () => {
    const v = maskView(LOGIT_MASK_PATHS.Nela[0]);
    const after = Object.fromEntries(v.rows.filter((r) => r.allowed).map((r) => [r.label, r.after]));
    expect(Object.keys(after).sort()).toEqual(["C", "N", "P", "T"]);
    expect(after.P).toBeCloseTo(0.614, 3);
    expect(after.C).toBeCloseTo(0.219, 3);
    expect(after.T).toBeCloseTo(0.151, 3);
    expect(after.N).toBeCloseTo(0.016, 3);
    expect(v.keptMass).toBeCloseTo(4.124e-5, 8);
  });

  it("after «P», bets on «or» and leaves 4.6 % to the two entries that continue Pablo", () => {
    const v = maskView(LOGIT_MASK_PATHS.Pablo[1]);
    expect(v.rows[0]).toMatchObject({ label: "or", allowed: false });
    expect(v.rows[0].before).toBeCloseTo(0.518, 3);
    expect(v.keptMass).toBeCloseTo(0.0459, 4);
    const ab = v.rows.find((r) => r.label === "ab");
    expect(ab?.before).toBeCloseTo(0.00385, 5);
    expect(ab?.after).toBeCloseTo(0.084, 3);
  });

  it("after «N», writes «ela» as the model would, 99 % with or without the mask", () => {
    const v = maskView(LOGIT_MASK_PATHS.Nela[1]);
    const ela = v.rows.find((r) => r.label === "ela");
    expect(ela?.before).toBeCloseTo(0.585, 3);
    expect(ela?.after).toBeCloseTo(0.991, 3);
  });

  it("makes the Pablo path 35 times the Nela path, which is 10⁹ times likelier without it", () => {
    const nela = pathTotals(fullPath("Nela"), fullPath("Nela").length);
    const pablo = pathTotals(fullPath("Pablo"), fullPath("Pablo").length);
    expect(nela.raw / pablo.raw).toBeGreaterThan(1e9);
    expect(nela.raw / pablo.raw).toBeLessThan(1e10);
    expect(pablo.masked / nela.masked).toBeCloseTo(34.9, 0);
    for (const t of [nela, pablo]) expect(t.raw / t.masked / t.kept).toBeCloseTo(1, 10);
  });
});

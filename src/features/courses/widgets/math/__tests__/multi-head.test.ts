/*
 * COURSE-P5-05 — multi-head tests: the claims Block 5 lesson 4 rests on, checked apart
 * from the code that draws them.
 *
 * 1. Every row of every head is a distribution. h maps instead of one changes nothing
 *    about that, and a row summing to 0.97 looks exactly like a row summing to 1.
 * 2. THE IDENTITY the lesson is built on. Lesson 2's single head adds the four rules
 *    inside one softmax; this module gives each rule its own head. Same numbers, and the
 *    only difference is where the softmax goes:
 *
 *        e_ij(una cabeza) = (1/2) · Σ_r e_ij(cabeza r),
 *
 *    the 1/2 being lesson 2's √4 against a head's √1. If this ever stops holding, the
 *    lesson's whole argument stops being about the same numbers.
 * 3. The maps genuinely differ, and they differ in the two ways the lesson quotes by
 *    name: the verb head cannot tell «llaves» from «coche» (an exact tie), the agreement
 *    head separates them by a factor of sixty, and the noun→modifier head's answer for
 *    «llaves» is REVERSED once the four scores are summed before the softmax.
 *
 * 4. COURSE-P11-08 — the English sentence of the English lesson, "this small mouse which
 *    the cats chase sleeps", read through lesson 2's English lexicon, keeps the properties
 *    the lesson argues from, and the weights its prose quotes are pinned here.
 *
 * The scores are also recomputed here by an independent route — explicit loops over the
 * lexicon, no matmul, no shared kernel — so a bug inside either could not pass both.
 */

import {
  D_MODEL,
  LEXICON,
  MAX_TOKENS,
  PRESETS,
  RULES,
  embedTokens,
} from "../self-attention";
import {
  H,
  HEADS,
  MH_DEFAULT,
  MH_PRESETS,
  MH_PRESETS_EN,
  isFlatRow,
  multiHeadMaps,
  rowPeak,
} from "../multi-head";

const FLAGSHIP = PRESETS[0]; // «las llaves del coche están ahí»

const total = (row: number[]) => row.reduce((acc, w) => acc + w, 0);
const dot = (u: number[], v: number[]) => u.reduce((acc, x, i) => acc + x * v[i], 0);

/** Which column of the flagship sentence a token sits in. */
const at = (tokens: string[], word: string) => {
  const i = tokens.indexOf(word);
  if (i < 0) throw new Error(`«${word}» no está en la frase`);
  return i;
};

describe("the heads", () => {
  it("is one head per rule, each with a full name and a short one", () => {
    expect(H).toBe(RULES.length);
    expect(H).toBe(4);
    expect(HEADS).toHaveLength(H);
    for (const [r, head] of HEADS.entries()) {
      expect(head.name).toBe(RULES[r].name);
      expect(head.short.length).toBeGreaterThan(0);
      expect(head.short.length).toBeLessThan(26);
    }
  });

  it("gives every row of every head a distribution, on every preset", () => {
    for (const preset of MH_PRESETS) {
      const map = multiHeadMaps(preset);
      const t = map.tokens.length;
      expect(t).toBeGreaterThan(3);
      expect(map.heads).toHaveLength(H);
      for (const head of map.heads) {
        expect(head.weights).toHaveLength(t);
        for (const row of head.weights) {
          expect(row).toHaveLength(t);
          expect(total(row)).toBeCloseTo(1, 12);
          expect(row.every((w) => w >= 0)).toBe(true);
        }
      }
      for (const row of map.single.weights) {
        expect(total(row)).toBeCloseTo(1, 12);
      }
    }
  });
});

describe("the same numbers, a different place to normalise", () => {
  it("sums the h head scores back into lesson 2's single head, on every preset", () => {
    const sweep = [
      ...MH_PRESETS.map((p) => [p, "es"] as const),
      ...MH_PRESETS_EN.map((p) => [p, "en"] as const),
    ];
    for (const [preset, locale] of sweep) {
      const { tokens, heads, single } = multiHeadMaps(preset, locale);
      for (let i = 0; i < tokens.length; i++) {
        for (let j = 0; j < tokens.length; j++) {
          const summed = heads.reduce((acc, head) => acc + head.scores[i][j], 0) / Math.sqrt(H);
          expect(summed).toBeCloseTo(single.scores[i][j], 12);
        }
      }
    }
  });

  it("does NOT sum back once the softmax has been taken — that is the whole point", () => {
    const { tokens, heads, single } = multiHeadMaps(FLAGSHIP);
    const row = at(tokens, "llaves");
    const averaged = tokens.map(
      (_, j) => heads.reduce((acc, head) => acc + head.weights[row][j], 0) / H,
    );
    // Both are distributions, and they are not the same distribution.
    expect(total(averaged)).toBeCloseTo(1, 12);
    const gap = Math.max(...averaged.map((w, j) => Math.abs(w - single.weights[row][j])));
    expect(gap).toBeGreaterThan(0.1);
  });
});

describe("recomputed without the kernel", () => {
  it("matches (x_i·u_r)(x_j·w_r) and its softmax, by explicit loops", () => {
    const map = multiHeadMaps(FLAGSHIP);
    const x = embedTokens(map.tokens);
    const t = map.tokens.length;

    for (const [r, rule] of RULES.entries()) {
      for (let i = 0; i < t; i++) {
        const raw = Array.from({ length: t }, (_, j) => dot(x[i], rule.query) * dot(x[j], rule.key));
        raw.forEach((e, j) => expect(map.heads[r].scores[i][j]).toBeCloseTo(e, 12));

        const top = Math.max(...raw);
        const exps = raw.map((e) => Math.exp(e - top));
        const denom = exps.reduce((a, b) => a + b, 0);
        exps.forEach((z, j) => expect(map.heads[r].weights[i][j]).toBeCloseTo(z / denom, 12));
      }
    }
  });

  it("keeps every lexicon vector at d_model coordinates, which is what makes the columns legal", () => {
    for (const rule of RULES) {
      expect(rule.query).toHaveLength(D_MODEL);
      expect(rule.key).toHaveLength(D_MODEL);
    }
    expect(LEXICON["llaves"]).toHaveLength(D_MODEL);
  });
});

describe("the four maps say four different things", () => {
  const map = multiHeadMaps(FLAGSHIP);
  const { tokens, heads, single } = map;

  it("is a different map in every head", () => {
    for (let a = 0; a < H; a++) {
      for (let b = a + 1; b < H; b++) {
        const gap = Math.max(
          ...tokens.flatMap((_, i) =>
            tokens.map((__, j) => Math.abs(heads[a].weights[i][j] - heads[b].weights[i][j])),
          ),
        );
        expect(gap).toBeGreaterThan(0.05);
      }
    }
  });

  it("cannot tell «llaves» from «coche» in the verb head, and ties them exactly", () => {
    const row = heads[0].weights[at(tokens, "están")];
    const llaves = row[at(tokens, "llaves")];
    const coche = row[at(tokens, "coche")];
    expect(llaves).toBeCloseTo(coche, 12);
    expect(rowPeak(row).tied).toHaveLength(2);
    expect(llaves).toBeGreaterThan(0.3);
  });

  it("separates them in the agreement head by more than a factor of fifty", () => {
    const row = heads[1].weights[at(tokens, "están")];
    expect(row[at(tokens, "llaves")] / row[at(tokens, "coche")]).toBeGreaterThan(50);
  });

  it("reverses the noun head's answer for «llaves» once the scores are summed first", () => {
    const row = at(tokens, "llaves");
    const alone = heads[2].weights[row];
    const together = single.weights[row];
    expect(tokens[rowPeak(alone).index]).toBe("ahí");
    expect(tokens[rowPeak(together).index]).toBe("las");
    // The displaced answer is not merely reordered, it loses more than half its weight.
    expect(together[at(tokens, "ahí")]).toBeLessThan(alone[at(tokens, "ahí")] / 2);
  });

  it("still lands «están» on «llaves» in the single head — one row can combine, once", () => {
    expect(tokens[rowPeak(single.weights[at(tokens, "están")]).index]).toBe("llaves");
  });
});

describe("the two-verb sentence the lesson opens on", () => {
  const { tokens, heads, single } = multiHeadMaps(MH_PRESETS[3]);

  it("hands the two verbs the very same row in the verb→noun head", () => {
    const duerme = heads[0].weights[at(tokens, "duerme")];
    const persiguen = heads[0].weights[at(tokens, "persiguen")];
    expect(duerme).toEqual(persiguen);
    // …and inside that row the two nouns are tied, so no rule of head 1 separates them.
    expect(rowPeak(duerme).tied.map((j) => tokens[j]).sort()).toEqual(["gatos", "ratón"]);
  });

  it("separates them only once the rules are combined", () => {
    expect(tokens[rowPeak(single.weights[at(tokens, "duerme")]).index]).toBe("ratón");
    expect(tokens[rowPeak(single.weights[at(tokens, "persiguen")]).index]).toBe("gatos");
  });
});

describe("the English sentence (COURSE-P11-08)", () => {
  const map = multiHeadMaps(MH_DEFAULT.en, "en");
  const { tokens, known, heads, single } = map;
  const w = (m: number[][], row: string, col: string) => m[at(tokens, row)][at(tokens, col)];

  it("is the default, eight known tokens, with `sleeps` at the Spanish focus row", () => {
    expect(MH_DEFAULT.en).toBe(MH_PRESETS_EN[3]);
    expect(tokens).toEqual(["this", "small", "mouse", "which", "the", "cats", "chase", "sleeps"]);
    expect(known.every(Boolean)).toBe(true);
    expect(at(tokens, "sleeps")).toBe(7);
  });

  it("repeats no vector (AUTHORING.en.md §3)", () => {
    const x = embedTokens(tokens, "en");
    for (let a = 0; a < x.length; a++) {
      for (let b = a + 1; b < x.length; b++) {
        expect(Math.max(...x[a].map((v, f) => Math.abs(v - x[b][f])))).toBeGreaterThan(0.1);
      }
    }
  });

  it("gives every row of every head a distribution, on every English preset", () => {
    for (const preset of MH_PRESETS_EN) {
      const m = multiHeadMaps(preset, "en");
      expect(m.known.every(Boolean)).toBe(true);
      for (const head of m.heads) for (const row of head.weights) expect(total(row)).toBeCloseTo(1, 12);
    }
  });

  it("finds the subject of `sleeps` in no head, and in the single one", () => {
    // Head 1 ties the two nouns, 0.30 each.
    expect(rowPeak(heads[0].weights[at(tokens, "sleeps")]).tied.map((j) => tokens[j]).sort()).toEqual([
      "cats",
      "mouse",
    ]);
    expect(w(heads[0].weights, "sleeps", "mouse")).toBeCloseTo(0.296, 3);
    // Head 2 prefers `this` and `sleeps` itself, 0.32 each, over `mouse`.
    expect(rowPeak(heads[1].weights[at(tokens, "sleeps")]).tied.map((j) => tokens[j]).sort()).toEqual([
      "sleeps",
      "this",
    ]);
    expect(w(heads[1].weights, "sleeps", "this")).toBeCloseTo(0.32, 2);
    expect(w(heads[1].weights, "sleeps", "mouse")).toBeLessThan(w(heads[1].weights, "sleeps", "this"));
    // Heads 3 and 4 say nothing about a verb.
    expect(isFlatRow(heads[2].weights[at(tokens, "sleeps")])).toBe(true);
    expect(isFlatRow(heads[3].weights[at(tokens, "sleeps")])).toBe(true);
    // The rules summed answer `mouse`, 0.33.
    expect(tokens[rowPeak(single.weights[at(tokens, "sleeps")]).index]).toBe("mouse");
    expect(w(single.weights, "sleeps", "mouse")).toBeCloseTo(0.33, 2);
  });

  it("nearly drops `mouse` from the row of `chase` once the rules are summed", () => {
    expect(tokens[rowPeak(single.weights[at(tokens, "chase")]).index]).toBe("cats");
    expect(w(single.weights, "chase", "cats")).toBeCloseTo(0.4, 2);
    expect(w(single.weights, "chase", "mouse")).toBeCloseTo(0.07, 2);
    // …while head 1 still gives it 0.30.
    expect(w(heads[0].weights, "chase", "mouse")).toBeCloseTo(0.296, 3);
  });
});

describe("a head with nothing to say about a position", () => {
  const { tokens, heads } = multiHeadMaps(FLAGSHIP);

  it("leaves that row exactly uniform, and the verb head does it in five rows of six", () => {
    const flat = heads[0].weights.filter((row) => isFlatRow(row));
    expect(flat).toHaveLength(tokens.length - 1);
    expect(isFlatRow(heads[0].weights[at(tokens, "están")])).toBe(false);
  });

  it("is not what the agreement head does to the verb's row", () => {
    expect(isFlatRow(heads[1].weights[at(tokens, "están")])).toBe(false);
  });

  it("reports a flat row as flat and an empty one as neither", () => {
    expect(isFlatRow([0.25, 0.25, 0.25, 0.25])).toBe(true);
    expect(isFlatRow([0.3, 0.25, 0.25, 0.2])).toBe(false);
    expect(isFlatRow([])).toBe(false);
  });

  it("reports ties instead of breaking them", () => {
    expect(rowPeak([0.1, 0.4, 0.4, 0.1])).toEqual({ index: 1, weight: 0.4, tied: [1, 2] });
    expect(rowPeak([0.1, 0.7, 0.2])).toEqual({ index: 1, weight: 0.7, tied: [1] });
  });
});

describe("the input the reader can actually type", () => {
  it("returns h empty maps for an empty sentence rather than throwing", () => {
    const map = multiHeadMaps("   ");
    expect(map.tokens).toHaveLength(0);
    expect(map.heads).toHaveLength(H);
    for (const head of map.heads) expect(head.weights).toHaveLength(0);
    expect(map.single.weights).toHaveLength(0);
  });

  it("still gives a distribution when the sentence is all unknown words", () => {
    const map = multiHeadMaps("criptomoneda hodl criptomoneda");
    expect(map.known).toEqual([false, false, false]);
    for (const head of map.heads) {
      for (const row of head.weights) expect(total(row)).toBeCloseTo(1, 12);
    }
  });

  it("cuts a long sentence at MAX_TOKENS and says so", () => {
    const map = multiHeadMaps(Array.from({ length: MAX_TOKENS + 4 }, () => "gato").join(" "));
    expect(map.truncated).toBe(true);
    expect(map.tokens).toHaveLength(MAX_TOKENS);
    for (const head of map.heads) expect(head.weights).toHaveLength(MAX_TOKENS);
  });
});

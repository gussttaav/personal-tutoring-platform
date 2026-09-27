/*
 * COURSE-C2-P1-01 — `math/kv-cache.ts` and the frozen text in `math/kv-cache-presets.ts`,
 * checked two independent ways, as AUTHORING §7 asks of a widget's maths:
 *
 *   1. THE DERIVATION AGAINST A RECOUNT — the closed forms (c_fila, c(t), t · c(t), the two
 *      totals, 2·L·t·d) against the products `adelante` and the lesson's `paso` actually run,
 *      counted one by one from their shapes; and c_fila against the mini-GPT's parameter count
 *      minus what never multiplies a row.
 *   2. THE LESSON'S NUMBERS — every figure the prose and the widget quote for the mini-GPT and
 *      for the 32-layer model, and the 64 tokens the lesson's first cell generates (Pyodide
 *      0.29.3, top-p 0.9, seed 0 after «La Nela»), re-decoded from bpe-merges.json.
 */

import fs from "node:fs";
import path from "node:path";

import { N_BYTES, tokenLabel, vocabulary } from "../bpe-merges";
import {
  LARGE_MODEL,
  MINI_GPT,
  attentionCost,
  cacheNumbers,
  cachedStepMultiplications,
  forwardMultiplications,
  rowCost,
  stepCost,
  totalCost,
} from "../kv-cache";
import { KV_PROMPT_TOKENS, KV_TOKENS } from "../kv-cache-presets";

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

describe("kv-cache — the cost of one row", () => {
  it("is one multiplication per weight of a matrix", () => {
    const { layers: L, dModel: d, dFF, vocab } = MINI_GPT;
    // Wqkv, Wo, W1, W2 per layer, and E read backwards as the output layer.
    const matrixWeights = L * (d * 3 * d + d * d + d * dFF + dFF * d) + vocab * d;
    expect(rowCost(MINI_GPT)).toBe(matrixWeights);
    expect(rowCost(MINI_GPT)).toBe(131_072);
  });

  it("is the checkpoint's 136 448 parameters minus what never multiplies a row", () => {
    const { layers: L, dModel: d, dFF, tCtx } = MINI_GPT;
    const positions = tCtx * d; // P: a lookup
    const biases = L * (dFF + d); // b1, b2
    const norms = L * 2 * (2 * d) + 2 * d; // ln1, ln2 per layer (g and b), lnf
    expect(rowCost(MINI_GPT) + positions + biases + norms).toBe(136_448);
  });
});

describe("kv-cache — with the cache and without it", () => {
  it("matches the products adelante runs on t rows, for every t in the window", () => {
    for (const t of range(1, MINI_GPT.tCtx)) {
      expect(forwardMultiplications(t, MINI_GPT)).toBe(stepCost(t, MINI_GPT, false));
    }
  });

  it("matches the products paso runs for one row against t keys", () => {
    for (const t of range(1, MINI_GPT.tCtx)) {
      expect(cachedStepMultiplications(t, MINI_GPT)).toBe(stepCost(t, MINI_GPT, true));
    }
  });

  it("costs exactly t times more without the cache, whatever the model", () => {
    for (const cfg of [MINI_GPT, LARGE_MODEL]) {
      for (const t of [1, 2, 7, 40, 64, 1000]) {
        expect(stepCost(t, cfg, false)).toBe(t * stepCost(t, cfg, true));
      }
    }
  });

  it("sums to the closed forms", () => {
    for (const T of range(1, MINI_GPT.tCtx)) {
      const ts = range(1, T);
      expect(totalCost(T, MINI_GPT, true)).toBe(sum(ts.map((t) => stepCost(t, MINI_GPT, true))));
      expect(totalCost(T, MINI_GPT, false)).toBe(sum(ts.map((t) => stepCost(t, MINI_GPT, false))));
    }
  });

  it("leaves the mini-GPT's attention below its matrices until t = 512, far past T_ctx", () => {
    expect(attentionCost(512, MINI_GPT)).toBe(rowCost(MINI_GPT));
    expect(attentionCost(MINI_GPT.tCtx, MINI_GPT) / stepCost(MINI_GPT.tCtx, MINI_GPT, true)).toBeCloseTo(1 / 9, 12);
  });
});

describe("kv-cache — the numbers the lesson quotes", () => {
  it("prices the mini-GPT's tokens", () => {
    expect(stepCost(1, MINI_GPT, true)).toBe(131_328);
    expect(stepCost(64, MINI_GPT, true)).toBe(147_456);
    expect(stepCost(64, MINI_GPT, false)).toBe(9_437_184);
    // c(t) grows 12 % across the whole window with the cache.
    expect(stepCost(64, MINI_GPT, true) / stepCost(1, MINI_GPT, true)).toBeCloseTo(1.123, 3);
  });

  it("totals a full window of 64 tokens", () => {
    expect(totalCost(64, MINI_GPT, true)).toBe(8_921_088);
    expect(totalCost(64, MINI_GPT, false)).toBe(295_526_400);
    expect(totalCost(64, MINI_GPT, false) / totalCost(64, MINI_GPT, true)).toBeCloseTo(33.13, 2);
  });

  it("sizes the cache: 2·L·t·d numbers", () => {
    expect(cacheNumbers(64, MINI_GPT)).toBe(16_384);
    expect((cacheNumbers(64, MINI_GPT) * 8) / 1024).toBe(128); // KiB, float64 as NumPy keeps it
    const GiB = 2 ** 30;
    // The 32-layer model at 2 bytes per number.
    expect((cacheNumbers(4096, LARGE_MODEL) * 2) / GiB).toBe(2);
    expect((cacheNumbers(8192, LARGE_MODEL) * 2) / GiB).toBe(4);
    expect((cacheNumbers(32_768, LARGE_MODEL) * 2) / GiB).toBe(16);
  });
});

describe("kv-cache — the frozen text is the checkpoint's", () => {
  const merges = (
    JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "public", "courses", "llm-agents", "bpe-merges.json"), "utf8"),
    ) as [number, number][]
  ).map((pair, i) => ({ pair, id: N_BYTES + i }) as const);
  const vocab = vocabulary(merges);

  it("fills the context window exactly, after a two-token prompt", () => {
    expect(KV_TOKENS).toHaveLength(MINI_GPT.tCtx);
    expect(KV_PROMPT_TOKENS).toBe(2);
  });

  it("spells every id from the merge table", () => {
    for (const [id, label] of KV_TOKENS) expect(label).toBe(tokenLabel(vocab[id]).text);
  });

  it("is the text the lesson's first cell prints", () => {
    expect(KV_TOKENS.map(([, label]) => label).join("")).toBe(
      "La Nela no trafá como me dijo lo le jo. Dechase quedar más estrelas entre las personas de la " +
        "almadas de su callarse. Se me ingenerar se ha decía s",
    );
  });
});

/*
 * COURSE-C2-P0-03 — The llm-agents course assets: the mini-GPT checkpoint, its BPE merge
 * table and the corpus they were made from.
 *
 * The assets are COMMITTED, produced offline by scripts/courses/llm-agents/train-minigpt.py
 * (never in CI). This test is what CI checks instead: that what sits under
 * public/courses/llm-agents/ is the shape the cells will `open_url` — config keys, every
 * weight matrix the size the config implies, exactly as many merges as the vocabulary
 * promises, and a checkpoint inside the size budget a mid-range phone can load in one cell.
 *
 * It reads the files from disk rather than importing them: the point is the bytes served.
 */

import fs from "node:fs";
import path from "node:path";

const ASSETS = path.join(process.cwd(), "public", "courses", "llm-agents");
const read = (name: string) => fs.readFileSync(path.join(ASSETS, name), "utf8");
const bytes = (name: string) => fs.statSync(path.join(ASSETS, name)).size;

/** The ceiling the task sets on the checkpoint: ≈1 MB expected, 1.5 MB is the wall. */
const CHECKPOINT_MAX_BYTES = 1.5 * 1024 * 1024;
/** Byte-level BPE: 256 byte tokens plus one token per merge. */
const N_BYTES = 256;

interface Config {
  n_v: number;
  T_ctx: number;
  d_model: number;
  h: number;
  d_ff: number;
  n_capas: number;
}

interface Checkpoint {
  config: Config;
  pesos: Record<string, unknown>;
}

/** Shape of a nested number array, `[]` for a scalar; throws on a ragged one. */
function shapeOf(value: unknown): number[] {
  if (!Array.isArray(value)) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`not a finite number: ${String(value)}`);
    }
    return [];
  }
  if (value.length === 0) throw new Error("empty axis");
  const inner = shapeOf(value[0]);
  for (const row of value) {
    const s = shapeOf(row);
    if (s.length !== inner.length || s.some((n, i) => n !== inner[i])) {
      throw new Error("ragged array");
    }
  }
  return [value.length, ...inner];
}

describe("llm-agents assets — the corpus", () => {
  const raw = read("corpus.txt");
  const [header, ...rest] = raw.split("\n");
  const body = rest.join("\n").trimStart();

  it("opens on a header line naming the source and the licence, which the loader strips", () => {
    expect(header.startsWith("#")).toBe(true);
    expect(header).toMatch(/Dominio público/);
    expect(header).toMatch(/gutenberg\.org/);
    expect(header).toMatch(/quitar_cabecera/);
    expect(body.startsWith("#")).toBe(false);
  });

  it("is Spanish prose in the size window, not code and not a wordlist", () => {
    const size = Buffer.byteLength(body, "utf8");
    expect(size).toBeGreaterThanOrEqual(200 * 1024);
    expect(size).toBeLessThanOrEqual(500 * 1024);
    // Prose: sentences, not one token per line.
    const lines = body.split("\n").filter((l) => l.length > 0);
    const avgWordsPerLine = body.split(/\s+/).length / lines.length;
    expect(avgWordsPerLine).toBeGreaterThan(20);
    // Spanish: the function words a wordlist or code would not repeat.
    for (const w of [" de ", " la ", " que ", " el ", " y "]) {
      expect((body.match(new RegExp(w, "g")) ?? []).length).toBeGreaterThan(500);
    }
    expect(body).toMatch(/[áéíóúñ¿¡]/);
  });
});

describe("llm-agents assets — the BPE merge table", () => {
  const merges = JSON.parse(read("bpe-merges.json")) as unknown;
  const checkpoint = JSON.parse(read("minigpt.json")) as Checkpoint;

  it("is an ordered list of [a, b] pairs, one per non-byte vocabulary entry", () => {
    expect(Array.isArray(merges)).toBe(true);
    const list = merges as unknown[];
    expect(list.length).toBe(checkpoint.config.n_v - N_BYTES);
    list.forEach((pair, i) => {
      expect(Array.isArray(pair)).toBe(true);
      const [a, b] = pair as unknown[];
      // A merge may only combine tokens that exist when it is learned: bytes or earlier merges.
      for (const t of [a, b]) {
        expect(Number.isInteger(t)).toBe(true);
        expect(t as number).toBeGreaterThanOrEqual(0);
        expect(t as number).toBeLessThan(N_BYTES + i);
      }
    });
  });
});

describe("llm-agents assets — the checkpoint", () => {
  const checkpoint = JSON.parse(read("minigpt.json")) as Checkpoint;
  const { config, pesos } = checkpoint;

  it("carries the config the lessons quote", () => {
    expect(Object.keys(config).sort()).toEqual(
      ["T_ctx", "d_ff", "d_model", "h", "n_capas", "n_v"].sort(),
    );
    expect(config.n_v).toBe(512);
    expect(config.T_ctx).toBe(64);
    expect(config.d_model % config.h).toBe(0);
    expect(config.n_capas).toBeGreaterThanOrEqual(1);
  });

  it("holds every weight the config implies, at the shape the config implies, and nothing else", () => {
    const { n_v, T_ctx, d_model, d_ff, n_capas } = config;
    const expected: Record<string, number[]> = {
      E: [n_v, d_model],
      P: [T_ctx, d_model],
      lnf_g: [d_model],
      lnf_b: [d_model],
    };
    for (let l = 0; l < n_capas; l++) {
      Object.assign(expected, {
        [`${l}.ln1_g`]: [d_model],
        [`${l}.ln1_b`]: [d_model],
        [`${l}.Wqkv`]: [d_model, 3 * d_model],
        [`${l}.Wo`]: [d_model, d_model],
        [`${l}.ln2_g`]: [d_model],
        [`${l}.ln2_b`]: [d_model],
        [`${l}.W1`]: [d_model, d_ff],
        [`${l}.b1`]: [d_ff],
        [`${l}.W2`]: [d_ff, d_model],
        [`${l}.b2`]: [d_model],
      });
    }
    expect(Object.keys(pesos).sort()).toEqual(Object.keys(expected).sort());
    for (const [name, shape] of Object.entries(expected)) {
      expect({ name, shape: shapeOf(pesos[name]) }).toEqual({ name, shape });
    }
  });

  it("is rounded to at most 4 decimals — the cells load THESE numbers, not the float64 ones", () => {
    const text = read("minigpt.json");
    // A longer mantissa means the script wrote unrounded weights, which the teaching
    // properties were not asserted on.
    expect(text).not.toMatch(/\.\d{5,}/);
  });

  it("fits the size budget", () => {
    expect(bytes("minigpt.json")).toBeLessThanOrEqual(CHECKPOINT_MAX_BYTES);
  });
});

describe("llm-agents assets — the model file the cells exec", () => {
  it("is NumPy-only Python, under the length the task budgets, and defines what the cells call", () => {
    const src = read("minigpt.py");
    expect(src.split("\n").length).toBeLessThanOrEqual(250);
    expect(src).toMatch(/^import numpy as np$/m);
    for (const forbidden of ["torch", "numba", "scipy", "matplotlib"]) {
      expect(src).not.toMatch(new RegExp(`^\\s*(import|from)\\s+${forbidden}\\b`, "m"));
    }
    for (const name of ["class MiniGPT", "def adelante", "def perdida", "def generar", "def guardar", "def cargar"]) {
      expect(src).toContain(name);
    }
    const bpe = read("bpe.py");
    for (const name of ["def entrenar", "def codificar", "def decodificar", "def quitar_cabecera"]) {
      expect(bpe).toContain(name);
    }
  });
});

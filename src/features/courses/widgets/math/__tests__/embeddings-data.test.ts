/*
 * COURSE-P2-02 — Guards the COMMITTED embeddings dataset (not just the geometry
 * helpers): the file parses, is within budget, and its analogies actually land.
 * A wrong dataset would silently break the most persuasive demo in the course.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { analogy, nearestNeighbours, type EmbeddingPoint } from "../embeddings";

function load(name: string): { raw: string; data: EmbeddingPoint[] } {
  const raw = readFileSync(path.join(process.cwd(), "public", "courses", "dl-nlp", name), "utf8");
  return { raw, data: (JSON.parse(raw) as { words: EmbeddingPoint[] }).words };
}

const { raw, data } = load("embeddings-sample.json");

describe("embeddings-sample.json", () => {
  it("parses into a reasonable, unique, in-budget vocabulary", () => {
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(150);
    expect(new Set(data.map((p) => p.word)).size).toBe(data.length); // no duplicates
    expect(Buffer.byteLength(raw)).toBeLessThanOrEqual(50 * 1024); // ≤ 50 KB
    for (const p of data) {
      expect(typeof p.word).toBe("string");
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });

  it("resolves rey − hombre + mujer → reina (the headline analogy)", () => {
    const res = analogy("rey", "hombre", "mujer", data, 1);
    expect(res).not.toBeNull();
    expect(res!.results[0].word).toBe("reina");
  });

  it("puts reina among rey's nearest neighbours", () => {
    expect(nearestNeighbours("rey", data, 3).map((p) => p.word)).toContain("reina");
  });
});

// COURSE-P11-04 — the English scatter for the locale-aware widget: the Spanish 218-word
// list translated 1:1 onto the same coordinates, so it guards the same properties as its
// sibling — the file is sane, the headline analogy lands, and the three points the en/06
// lesson names cluster with their own kind.
describe("embeddings-sample.en.json", () => {
  const { raw: rawEn, data: dataEn } = load("embeddings-sample.en.json");
  const byWord = new Map(dataEn.map((p) => [p.word, p]));

  it("parses into a reasonable, unique, in-budget vocabulary", () => {
    expect(Array.isArray(dataEn)).toBe(true);
    expect(dataEn.length).toBeGreaterThanOrEqual(150);
    expect(new Set(dataEn.map((p) => p.word)).size).toBe(dataEn.length); // no duplicates
    expect(Buffer.byteLength(rawEn)).toBeLessThanOrEqual(50 * 1024); // ≤ 50 KB
    for (const p of dataEn) {
      expect(typeof p.word).toBe("string");
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });

  it("resolves king − man + woman → queen (the headline analogy)", () => {
    const res = analogy("king", "man", "woman", dataEn, 1);
    expect(res).not.toBeNull();
    expect(res!.results[0].word).toBe("queen");
  });

  it("puts queen among king's nearest neighbours", () => {
    expect(nearestNeighbours("king", dataEn, 3).map((p) => p.word)).toContain("queen");
  });

  // The three points en/06 names must land among their own kind. Asserted by category
  // rather than a word list, so it holds whatever the cluster's exact membership is.
  it.each(["car", "apple", "cat"])("%s's three nearest share its category", (word) => {
    const own = byWord.get(word)?.category;
    expect(own).toBeTruthy();
    for (const n of nearestNeighbours(word, dataEn, 3)) {
      expect(n.category).toBe(own);
    }
  });
});

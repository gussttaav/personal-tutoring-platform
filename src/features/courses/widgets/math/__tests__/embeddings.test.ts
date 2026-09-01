/*
 * COURSE-P2-02 — Embedding-geometry tests on a tiny controlled layout: nearest
 * neighbours, the a − b + c analogy, and missing-word handling. (The COMMITTED
 * dataset's analogies are verified separately in embeddings-data.test.ts.)
 */

import {
  findWord,
  nearestNeighbours,
  analogy,
  type EmbeddingPoint,
} from "../embeddings";

// A deliberately simple layout: a "royal/gender" parallelogram plus a far outlier.
const DATA: EmbeddingPoint[] = [
  { word: "rey", x: 1, y: 1 },
  { word: "reina", x: 1, y: 0 },
  { word: "hombre", x: 0, y: 1 },
  { word: "mujer", x: 0, y: 0 },
  { word: "coche", x: 9, y: 9 },
];

describe("findWord", () => {
  it("returns the point or undefined", () => {
    expect(findWord("rey", DATA)?.x).toBe(1);
    expect(findWord("dragon", DATA)).toBeUndefined();
  });
});

describe("nearestNeighbours", () => {
  it("returns the k closest words, excluding the query itself", () => {
    const nn = nearestNeighbours("rey", DATA, 2).map((p) => p.word);
    expect(nn).not.toContain("rey");
    expect(nn).toEqual(["reina", "hombre"]); // both at distance 1; coche is far
  });

  it("returns [] for an unknown word", () => {
    expect(nearestNeighbours("dragon", DATA, 3)).toEqual([]);
  });
});

describe("analogy", () => {
  it("resolves rey − hombre + mujer → reina", () => {
    const res = analogy("rey", "hombre", "mujer", DATA, 1);
    expect(res).not.toBeNull();
    // (1,1) − (0,1) + (0,0) = (1,0) = reina exactly.
    expect(res!.target).toEqual([1, 0]);
    expect(res!.results[0].word).toBe("reina");
  });

  it("excludes the three input words from the results", () => {
    const res = analogy("rey", "hombre", "mujer", DATA, 5);
    const words = res!.results.map((p) => p.word);
    expect(words).not.toContain("rey");
    expect(words).not.toContain("hombre");
    expect(words).not.toContain("mujer");
  });

  it("returns null when any input word is missing", () => {
    expect(analogy("rey", "hombre", "dragon", DATA)).toBeNull();
  });
});

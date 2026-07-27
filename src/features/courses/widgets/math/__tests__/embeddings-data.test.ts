/*
 * COURSE-P2-02 — Guards the COMMITTED embeddings dataset (not just the geometry
 * helpers): the file parses, is within budget, and its analogies actually land.
 * A wrong dataset would silently break the most persuasive demo in the course.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { analogy, nearestNeighbours, type EmbeddingPoint } from "../embeddings";

const file = path.join(process.cwd(), "public", "courses", "dl-nlp", "embeddings-sample.json");
const raw = readFileSync(file, "utf8");
const parsed = JSON.parse(raw) as { words: EmbeddingPoint[] };
const data = parsed.words;

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

/*
 * COURSE-P2-02 — Pure geometry over the precomputed 2D word layout for
 * `embedding-projection`. The widget fetches a small committed JSON (see
 * `public/courses/dl-nlp/embeddings-sample.json`); these helpers find nearest
 * neighbours and resolve the analogy vector a − b + c. No DOM, no model.
 */

export type Coord = [number, number];

export interface EmbeddingPoint {
  word: string;
  x: number;
  y: number;
  /** Optional semantic group, used only to colour the scatter. */
  category?: string;
}

export interface AnalogyResult {
  /** The a − b + c point in the 2D space. */
  target: Coord;
  /** Nearest actual words to `target`, closest first (inputs excluded). */
  results: EmbeddingPoint[];
}

function dist2(p: { x: number; y: number }, c: Coord): number {
  const dx = p.x - c[0];
  const dy = p.y - c[1];
  return dx * dx + dy * dy;
}

/** The point for `word`, or `undefined` if it is not in the layout. */
export function findWord(word: string, data: readonly EmbeddingPoint[]): EmbeddingPoint | undefined {
  return data.find((p) => p.word === word);
}

/** The `k` nearest words to `word` by Euclidean distance (excluding `word`). */
export function nearestNeighbours(
  word: string,
  data: readonly EmbeddingPoint[],
  k: number,
): EmbeddingPoint[] {
  const self = findWord(word, data);
  if (!self) return [];
  const origin: Coord = [self.x, self.y];
  return data
    .filter((p) => p.word !== word)
    .map((p) => ({ p, d: dist2(p, origin) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, k)
    .map((entry) => entry.p);
}

/**
 * Resolve the classic word analogy a − b + c (e.g. rey − hombre + mujer). Returns
 * the target point and the nearest real words to it, with a, b and c excluded so
 * the answer is a genuinely different word. `null` if any input word is missing.
 */
export function analogy(
  a: string,
  b: string,
  c: string,
  data: readonly EmbeddingPoint[],
  k = 3,
): AnalogyResult | null {
  const pa = findWord(a, data);
  const pb = findWord(b, data);
  const pc = findWord(c, data);
  if (!pa || !pb || !pc) return null;

  const target: Coord = [pa.x - pb.x + pc.x, pa.y - pb.y + pc.y];
  const exclude = new Set([a, b, c]);
  const results = data
    .filter((p) => !exclude.has(p.word))
    .map((p) => ({ p, d: dist2(p, target) }))
    .sort((x, y) => x.d - y.d)
    .slice(0, k)
    .map((entry) => entry.p);

  return { target, results };
}

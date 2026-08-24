/*
 * COURSE-P2-01 — Small, pure linear-algebra helpers.
 *
 * Just enough for the course's widgets (softmax curves, attention heat maps):
 * dense matmul, transpose and a numerically stable row-wise softmax. No DOM,
 * no dependency — fully unit-tested.
 *
 * Convention: a matrix is `number[][]` in row-major order (`M[i][j]` = row i,
 * column j); a vector is `number[]`.
 */

export type Vector = number[];
export type Matrix = number[][];

/** Matrix product A·B. Throws on a shape mismatch (inner dimensions differ). */
export function matmul(a: Matrix, b: Matrix): Matrix {
  const n = a.length;
  const k = a[0]?.length ?? 0;
  const m = b[0]?.length ?? 0;
  if (b.length !== k) {
    throw new Error(`matmul: shape mismatch — A is ${n}×${k}, B is ${b.length}×${m}`);
  }

  const out: Matrix = [];
  for (let i = 0; i < n; i++) {
    const row = new Array<number>(m).fill(0);
    for (let p = 0; p < k; p++) {
      const aip = a[i][p];
      const bp = b[p];
      for (let j = 0; j < m; j++) {
        row[j] += aip * bp[j];
      }
    }
    out.push(row);
  }
  return out;
}

/** Transpose: (Aᵀ)[j][i] = A[i][j]. */
export function transpose(a: Matrix): Matrix {
  const n = a.length;
  const m = a[0]?.length ?? 0;
  const out: Matrix = [];
  for (let j = 0; j < m; j++) {
    const row = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      row[i] = a[i][j];
    }
    out.push(row);
  }
  return out;
}

/**
 * Numerically stable softmax of a vector: subtract the max before exponentiating
 * so large inputs (e.g. [1000, 1001]) don't overflow to Infinity/NaN. The result
 * is a probability distribution that sums to 1.
 */
export function softmax(v: Vector): Vector {
  if (v.length === 0) return [];
  const max = Math.max(...v);
  const exps = v.map((x) => Math.exp(x - max));
  const sum = exps.reduce((acc, e) => acc + e, 0);
  return exps.map((e) => e / sum);
}

/** Row-wise softmax: apply `softmax` to each row of a matrix independently. */
export function softmaxRows(m: Matrix): Matrix {
  return m.map((row) => softmax(row));
}

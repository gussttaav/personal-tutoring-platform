/*
 * COURSE-P5-05 — positional-encoding tests: the claims Block 5 lesson 5 rests on,
 * checked apart from the code that draws them.
 *
 * Two independent routes, because a bug in the shared helper could otherwise pass both
 * halves of the lesson. `positionalEncoding` is checked against sin/cos recomputed here
 * from an explicitly written-out ladder of frequencies, and the two identities are
 * checked against the matrix and the sum the lesson derives rather than against
 * themselves.
 *
 * What is pinned, and why each one matters:
 *   1. The exact rows. Position 0 is (0, 1, 0, 1, …) — every angle is zero — and pair 0
 *      turns at ω = 1 exactly, so column 0 is plain sin(pos). Those are the two anchors
 *      the lesson quotes without rounding.
 *   2. Bounded in [−1, 1] whatever T. That is the whole argument against feeding the
 *      raw position number in, so it is worth a test rather than a remark.
 *   3. PE[pos+k] = M_k · PE[pos] AT EVERY pos — the relative-position property, which the
 *      block's acceptance criteria require shown rather than stated.
 *   4. PE[pos] · PE[pos+k] = Σ_i cos(ω_i k), also at every pos. The widget prints this
 *      from three positions to show it does not move; if it ever moved, that panel would
 *      be lying.
 *   5. The reference numbers the lesson's prose and code cell quote, so prose and widget
 *      cannot drift apart.
 */

import {
  BASE,
  DEFAULT_D,
  angularFrequency,
  apply,
  dot,
  isSine,
  overlap,
  pairOf,
  positionalEncoding,
  shiftMatrix,
  wavelength,
} from "../positional-encoding";

const D = DEFAULT_D; // 32 — the widget's default and the lesson's
const T = 40;

/** The encoding again, by hand: no shared helper beyond Math.sin/Math.cos. */
function reference(rows: number, d: number): number[][] {
  const out: number[][] = [];
  for (let pos = 0; pos < rows; pos++) {
    const row: number[] = [];
    for (let i = 0; i < d / 2; i++) {
      const omega = Math.pow(BASE, (-2 * i) / d);
      row.push(Math.sin(pos * omega), Math.cos(pos * omega));
    }
    out.push(row);
  }
  return out;
}

describe("positional encoding — the object", () => {
  it("has one row per position and one column per coordinate", () => {
    const pe = positionalEncoding(T, D);
    expect(pe).toHaveLength(T);
    expect(pe.every((row) => row.length === D)).toBe(true);
  });

  it("refuses an odd width — the pairs would not close", () => {
    expect(() => positionalEncoding(4, 7)).toThrow(/even/);
    expect(() => shiftMatrix(1, 7)).toThrow(/even/);
  });

  it("puts sines in the even coordinates and cosines in the odd ones", () => {
    expect(pairOf(0)).toBe(0);
    expect(pairOf(1)).toBe(0);
    expect(pairOf(2)).toBe(1);
    expect(isSine(0)).toBe(true);
    expect(isSine(1)).toBe(false);
  });

  it("starts at (0, 1, 0, 1, …): every angle at position 0 is zero", () => {
    const row = positionalEncoding(1, D)[0];
    row.forEach((value, col) => {
      expect(value).toBeCloseTo(isSine(col) ? 0 : 1, 12);
    });
  });

  it("turns pair 0 at exactly one radian per position, so column 0 is sin(pos)", () => {
    expect(angularFrequency(0, D)).toBe(1);
    const pe = positionalEncoding(T, D);
    for (let pos = 0; pos < T; pos++) {
      expect(pe[pos][0]).toBeCloseTo(Math.sin(pos), 12);
      expect(pe[pos][1]).toBeCloseTo(Math.cos(pos), 12);
    }
  });

  it("agrees with the formula recomputed independently", () => {
    const pe = positionalEncoding(T, D);
    const ref = reference(T, D);
    for (let pos = 0; pos < T; pos++) {
      for (let col = 0; col < D; col++) {
        expect(pe[pos][col]).toBeCloseTo(ref[pos][col], 12);
      }
    }
  });

  it("stays inside [-1, 1] however far along the text goes", () => {
    const far = positionalEncoding(5000, D);
    const worst = far.reduce(
      (acc, row) => row.reduce((best, v) => Math.max(best, Math.abs(v)), acc),
      0,
    );
    expect(worst).toBeLessThanOrEqual(1);
  });

  it("spreads the wavelengths from 2π up to nearly 10000 · 2π", () => {
    expect(wavelength(0, D)).toBeCloseTo(2 * Math.PI, 12);
    // The last pair is i = d/2 − 1, so its exponent is (d−2)/d, not 1.
    expect(wavelength(D / 2 - 1, D)).toBeCloseTo(2 * Math.PI * Math.pow(BASE, (D - 2) / D), 6);
    // Geometric: each pair's wavelength is the previous one times a fixed ratio.
    const ratio = wavelength(1, D) / wavelength(0, D);
    for (let i = 1; i < D / 2; i++) {
      expect(wavelength(i, D) / wavelength(i - 1, D)).toBeCloseTo(ratio, 9);
    }
  });
});

describe("positional encoding — moving k positions is a fixed rotation", () => {
  it("sends PE[pos] to PE[pos + k] with the same matrix at every pos", () => {
    const pe = positionalEncoding(T, D);
    for (const k of [1, 2, 5, 8, 17]) {
      const m = shiftMatrix(k, D);
      for (let pos = 0; pos + k < T; pos++) {
        const moved = apply(m, pe[pos]);
        moved.forEach((value, col) => {
          expect(Math.abs(value - pe[pos + k][col])).toBeLessThan(1e-12);
        });
      }
    }
  });

  it("is the identity at k = 0 and undoes itself at −k", () => {
    const pe = positionalEncoding(T, D);
    expect(apply(shiftMatrix(0, D), pe[9])).toEqual(pe[9]);
    const there = apply(shiftMatrix(6, D), pe[3]);
    const back = apply(shiftMatrix(-6, D), there);
    back.forEach((value, col) => expect(Math.abs(value - pe[3][col])).toBeLessThan(1e-12));
  });

  it("is block-diagonal: nothing outside a pair's own two coordinates", () => {
    const m = shiftMatrix(3, D);
    for (let r = 0; r < D; r++) {
      for (let c = 0; c < D; c++) {
        if (pairOf(r) !== pairOf(c)) expect(m[r][c]).toBe(0);
      }
    }
  });

  it("keeps every block a rotation, so lengths survive the shift", () => {
    const m = shiftMatrix(4, D);
    for (let i = 0; i < D / 2; i++) {
      const [c, s] = [m[2 * i][2 * i], m[2 * i][2 * i + 1]];
      expect(c * c + s * s).toBeCloseTo(1, 12);
      expect(m[2 * i + 1][2 * i]).toBeCloseTo(-s, 12);
      expect(m[2 * i + 1][2 * i + 1]).toBeCloseTo(c, 12);
    }
  });
});

describe("positional encoding — what two rows k apart score", () => {
  it("gives the same dot product from any starting position", () => {
    const pe = positionalEncoding(T, D);
    for (const k of [0, 1, 3, 7]) {
      const expected = overlap(k, D);
      for (let pos = 0; pos + k < T; pos++) {
        expect(Math.abs(dot(pe[pos], pe[pos + k]) - expected)).toBeLessThan(1e-12);
      }
    }
  });

  it("scores d/2 against itself, and no more against anything else", () => {
    expect(overlap(0, D)).toBeCloseTo(D / 2, 12);
    for (let k = 1; k <= 20; k++) {
      expect(overlap(k, D)).toBeLessThan(D / 2);
    }
  });

  it("does not care about the sign of the offset", () => {
    for (const k of [1, 4, 9]) {
      expect(overlap(-k, D)).toBeCloseTo(overlap(k, D), 12);
    }
  });

  it("matches the numbers the lesson and the widget both quote", () => {
    // Pinned so prose, code cell and panel cannot drift apart. Recompute if D changes.
    expect(wavelength(0, D)).toBeCloseTo(6.283, 3);
    expect(wavelength(1, D)).toBeCloseTo(11.173, 3);
    expect(wavelength(D / 2 - 1, D)).toBeCloseTo(35332.9, 1);
    expect(overlap(1, D)).toBeCloseTo(15.314, 3);
    expect(overlap(5, D)).toBeCloseTo(11.777, 3);
  });
});

// COURSE-P9-01 — Offset-preserving folding.
//
// The length guarantee is the load-bearing property: match offsets are computed in
// normalized space and used to slice the ORIGINAL text for snippets. One character that
// folds to a different width shifts every highlight after it.

import { normalizeAligned } from "@/lib/courses/search/normalize";

describe("normalizeAligned", () => {
  it("folds Spanish accents and case", () => {
    expect(normalizeAligned("Atención")).toBe("atencion");
    expect(normalizeAligned("NIÑO")).toBe("nino");
    expect(normalizeAligned("Á É Í Ó Ú ü")).toBe("a e i o u u");
  });

  it("preserves length for accented text", () => {
    for (const s of ["café", "atención", "ÑOÑO", "codificación posicional", "sin acentos"]) {
      expect(normalizeAligned(s)).toHaveLength(s.length);
    }
  });

  it("preserves length for the ligatures and locale-special cases the fast path misses", () => {
    // `ﬁ` lowercases to itself but NFD-decomposes to nothing useful; `İ` lowercases to
    // two code points. Both would silently shift offsets without the per-char fallback.
    for (const s of ["ﬁn", "İstanbul", "ﬂor ﬁja"]) {
      expect(normalizeAligned(s)).toHaveLength(s.length);
    }
  });

  it("leaves already-plain text untouched", () => {
    expect(normalizeAligned("softmax")).toBe("softmax");
  });
});

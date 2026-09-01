// COURSE-P9-01 — Snippet windowing and highlight offsets.

import { buildSnippet, splitByMarks } from "@/lib/courses/search/snippet";

const LOREM =
  "La atencion escalada divide entre la raiz de d para que la varianza del producto " +
  "escalar no crezca con la dimension. Sin ese factor el softmax se satura y los " +
  "gradientes se apagan, que es justo lo que la normalizacion pretende evitar aqui.";

describe("buildSnippet", () => {
  it("returns the whole text when it is short and unmatched", () => {
    const s = buildSnippet("corto", [], 180);
    expect(s).toEqual({ text: "corto", marks: [], leadingEllipsis: false, trailingEllipsis: false });
  });

  it("falls back to the head of the text when there are no matches", () => {
    const s = buildSnippet(LOREM, [], 60);
    expect(s.leadingEllipsis).toBe(false);
    expect(s.trailingEllipsis).toBe(true);
    expect(LOREM.startsWith(s.text)).toBe(true);
  });

  it("centres the window on the match and highlights it", () => {
    const at = LOREM.indexOf("softmax");
    const s = buildSnippet(LOREM, [{ start: at, end: at + 7 }], 80);
    expect(s.text.slice(s.marks[0].start, s.marks[0].end)).toBe("softmax");
    expect(s.leadingEllipsis).toBe(true);
  });

  it("never cuts through its own first highlight", () => {
    for (const word of ["atencion", "softmax", "evitar", "aqui", "La"]) {
      const at = LOREM.indexOf(word);
      const s = buildSnippet(LOREM, [{ start: at, end: at + word.length }], 60);
      expect(s.marks.length).toBeGreaterThan(0);
      expect(s.text.slice(s.marks[0].start, s.marks[0].end)).toBe(word);
    }
  });

  it("prefers the densest cluster over the first match", () => {
    // "escalada" sits alone at the top; "softmax", "gradientes" and "apagan" cluster
    // together later. The window must follow the cluster, not the first hit.
    const at = (w: string) => ({ start: LOREM.indexOf(w), end: LOREM.indexOf(w) + w.length });
    const s = buildSnippet(LOREM, [at("escalada"), at("softmax"), at("gradientes"), at("apagan")], 80);

    expect(s.text).toContain("softmax");
    expect(s.text).toContain("gradientes");
    expect(s.text).not.toContain("escalada");
    expect(s.marks.length).toBeGreaterThanOrEqual(2);
  });

  it("breaks a density tie in favour of the earlier cluster", () => {
    const at = (w: string) => ({ start: LOREM.indexOf(w), end: LOREM.indexOf(w) + w.length });
    // Two clusters of two; the earlier one is the predictable choice.
    const s = buildSnippet(LOREM, [at("escalada"), at("escalar"), at("softmax")], 80);
    expect(s.text).toContain("escalada");
  });

  it("keeps every mark inside the returned text", () => {
    const at = LOREM.indexOf("varianza");
    const s = buildSnippet(LOREM, [{ start: at, end: at + 8 }], 70);
    for (const m of s.marks) {
      expect(m.start).toBeGreaterThanOrEqual(0);
      expect(m.end).toBeLessThanOrEqual(s.text.length);
      expect(m.end).toBeGreaterThan(m.start);
    }
  });

  it("cuts on word boundaries", () => {
    const at = LOREM.indexOf("gradientes");
    const s = buildSnippet(LOREM, [{ start: at, end: at + 10 }], 70);
    expect(s.text).toBe(s.text.trim());
    // The character just before the window in the source must be a space, not mid-word.
    const origin = LOREM.indexOf(s.text);
    expect(origin === 0 || LOREM[origin - 1] === " ").toBe(true);
  });
});

describe("splitByMarks", () => {
  it("produces alternating runs", () => {
    expect(splitByMarks("abcdef", [{ start: 2, end: 4 }])).toEqual([
      { text: "ab", mark: false },
      { text: "cd", mark: true },
      { text: "ef", mark: false },
    ]);
  });

  it("handles a mark at the very start and at the very end", () => {
    expect(splitByMarks("abc", [{ start: 0, end: 1 }])).toEqual([
      { text: "a", mark: true },
      { text: "bc", mark: false },
    ]);
    expect(splitByMarks("abc", [{ start: 2, end: 3 }])).toEqual([
      { text: "ab", mark: false },
      { text: "c", mark: true },
    ]);
  });

  it("returns one plain run with no marks, and nothing for empty text", () => {
    expect(splitByMarks("abc", [])).toEqual([{ text: "abc", mark: false }]);
    expect(splitByMarks("", [])).toEqual([]);
  });

  it("clamps out-of-range marks rather than throwing", () => {
    expect(splitByMarks("abc", [{ start: 1, end: 99 }])).toEqual([
      { text: "a", mark: false },
      { text: "bc", mark: true },
    ]);
  });
});

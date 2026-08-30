// COURSE-P9-01 — Word-start prefix matching.

import { extendToWordEnd, findTerm, isWholeWord, mergeRanges } from "@/lib/courses/search/match";

describe("findTerm", () => {
  it("matches a prefix at a word start", () => {
    expect(findTerm("la atencion escalada", "aten")).toEqual([{ start: 3, end: 7 }]);
  });

  it("does NOT match mid-word", () => {
    // The whole reason for left anchoring: naive includes() would match here.
    expect(findTerm("resolver el problema", "sol")).toEqual([]);
    expect(findTerm("prediccion", "red")).toEqual([]);
  });

  it("matches after punctuation and at the start of the string", () => {
    expect(findTerm("softmax, softmax", "softmax")).toEqual([
      { start: 0, end: 7 },
      { start: 9, end: 16 },
    ]);
  });

  it("matches a multi-word phrase", () => {
    expect(findTerm("la self attention aqui", "self attention")).toEqual([{ start: 3, end: 17 }]);
  });

  it("returns nothing for an empty needle", () => {
    expect(findTerm("cualquier cosa", "")).toEqual([]);
  });
});

describe("isWholeWord", () => {
  it("distinguishes a whole word from a prefix of a longer one", () => {
    expect(isWholeWord("la red neuronal", { start: 3, end: 6 })).toBe(true);
    expect(isWholeWord("la redes neuronales", { start: 3, end: 6 })).toBe(false);
  });
});

describe("mergeRanges", () => {
  it("sorts and merges overlaps", () => {
    expect(mergeRanges([{ start: 10, end: 15 }, { start: 0, end: 5 }, { start: 3, end: 8 }])).toEqual([
      { start: 0, end: 8 },
      { start: 10, end: 15 },
    ]);
  });

  it("does not mutate the caller's ranges", () => {
    const input = [{ start: 0, end: 5 }, { start: 3, end: 9 }];
    mergeRanges(input);
    expect(input[0]).toEqual({ start: 0, end: 5 });
  });

  it("handles zero and one range", () => {
    expect(mergeRanges([])).toEqual([]);
    expect(mergeRanges([{ start: 1, end: 2 }])).toEqual([{ start: 1, end: 2 }]);
  });
});

describe("extendToWordEnd", () => {
  it("grows a prefix hit to the end of its word", () => {
    // "atencion" matching inside "atenciones" must highlight the whole word, not
    // "atencion|es", which reads as a rendering bug.
    expect(extendToWordEnd("las dos atenciones aqui", { start: 8, end: 16 })).toEqual({
      start: 8,
      end: 18,
    });
  });

  it("leaves a whole-word match alone", () => {
    expect(extendToWordEnd("la red neuronal", { start: 3, end: 6 })).toEqual({ start: 3, end: 6 });
  });

  it("stops at the end of the string", () => {
    expect(extendToWordEnd("softmax", { start: 0, end: 4 })).toEqual({ start: 0, end: 7 });
  });
});

// COURSE-P9-01 — Input box string → needles.

import { parseQuery, MIN_QUERY_LENGTH } from "@/lib/courses/search/query";

describe("parseQuery", () => {
  it("splits on whitespace and folds accents", () => {
    expect(parseQuery("Atención Escalada")).toMatchObject({
      // Equal lengths, so the sort is stable and input order survives.
      terms: ["atencion", "escalada"],
      phrases: [],
      empty: false,
    });
  });

  it("puts the most selective (longest) term first", () => {
    expect(parseQuery("de retropropagacion").terms).toEqual(["retropropagacion", "de"]);
  });

  it("extracts a quoted phrase", () => {
    const q = parseQuery('"self attention" escalada');
    expect(q.phrases).toEqual(["self attention"]);
    expect(q.terms).toEqual(["escalada"]);
  });

  it("treats an unterminated quote as an open phrase, so typing never blanks the list", () => {
    expect(parseQuery('"self att').phrases).toEqual(["self att"]);
  });

  it("collapses whitespace inside a phrase", () => {
    expect(parseQuery('"self   attention"').phrases).toEqual(["self attention"]);
  });

  it("is empty below the minimum length, counting all signal together", () => {
    expect(parseQuery("").empty).toBe(true);
    expect(parseQuery("a").empty).toBe(true);
    expect(parseQuery("   ").empty).toBe(true);
    expect(parseQuery("at").empty).toBe(false);
    expect(MIN_QUERY_LENGTH).toBe(2);
  });

  it("drops empty quotes without crashing", () => {
    expect(parseQuery('"" atencion')).toMatchObject({ phrases: [], terms: ["atencion"] });
  });
});

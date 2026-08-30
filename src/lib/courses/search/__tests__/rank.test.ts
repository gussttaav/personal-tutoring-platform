// COURSE-P9-01 — Scoring and ordering.

import {
  prepareIndex,
  search,
  SearchIndexVersionError,
  MAX_SECTIONS_PER_LESSON,
} from "@/lib/courses/search/rank";
import { SEARCH_INDEX_VERSION, type SearchIndex } from "@/lib/courses/search/types";

interface LessonSpec {
  slug: string;
  title?: string;
  summary?: string;
  block?: number;
  order?: number;
  contentLocale?: string;
  sections: { heading?: string; text: string }[];
}

function makeIndex(lessons: LessonSpec[], course = "dl-nlp", locale = "es"): SearchIndex {
  const index: SearchIndex = {
    version: SEARCH_INDEX_VERSION,
    course,
    locale,
    hash: "abcd1234",
    lessons: [],
    chunks: [],
  };
  lessons.forEach((spec, li) => {
    index.lessons.push({
      slug: spec.slug,
      title: spec.title ?? spec.slug,
      summary: spec.summary ?? "",
      block: spec.block ?? 1,
      order: spec.order ?? li + 1,
      contentLocale: spec.contentLocale ?? locale,
    });
    for (const s of spec.sections) {
      index.chunks.push({
        lesson: li,
        headingId: s.heading ? s.heading.toLowerCase().replace(/\s+/g, "-") : "",
        headingText: s.heading ?? "",
        text: s.text,
      });
    }
  });
  return index;
}

const prep = (lessons: LessonSpec[], course?: string, locale?: string) =>
  prepareIndex(makeIndex(lessons, course, locale));

describe("prepareIndex", () => {
  it("rejects an index shape this build does not understand", () => {
    const bad = { ...makeIndex([]), version: 99 } as unknown as SearchIndex;
    expect(() => prepareIndex(bad)).toThrow(SearchIndexVersionError);
  });
});

describe("search", () => {
  it("returns nothing for a query below the minimum length", () => {
    const i = prep([{ slug: "a", sections: [{ text: "atencion escalada" }] }]);
    expect(search(i, "a")).toEqual([]);
    expect(search(i, "")).toEqual([]);
  });

  it("matches accent-insensitively in both directions", () => {
    const i = prep([{ slug: "a", title: "Atención", sections: [{ text: "la atención escalada" }] }]);
    expect(search(i, "atencion")).toHaveLength(1);
    expect(search(i, "ATENCIÓN")).toHaveLength(1);
  });

  it("matches a prefix at a word start but never mid-word", () => {
    const i = prep([{ slug: "a", title: "x", sections: [{ text: "resolver el problema" }] }]);
    expect(search(i, "resol")).toHaveLength(1);
    expect(search(i, "solver")).toHaveLength(0);
  });

  it("requires every term (AND) within one section", () => {
    const i = prep([
      {
        slug: "a",
        title: "x",
        summary: "",
        sections: [{ text: "habla de gradientes" }, { text: "habla de tokens" }],
      },
    ]);
    expect(search(i, "gradientes")).toHaveLength(1);
    // Both words exist in the lesson, but never together in one section.
    expect(search(i, "gradientes tokens")).toHaveLength(0);
  });

  it("lets the lesson title satisfy a term for all of its sections", () => {
    const i = prep([
      { slug: "backprop", title: "Retropropagación", sections: [{ text: "la regla de la cadena" }] },
    ]);
    expect(search(i, "retropropagacion cadena")).toHaveLength(1);
  });

  it("ranks a title hit above a body hit", () => {
    const i = prep([
      { slug: "body", title: "Otra cosa", block: 1, order: 1, sections: [{ text: "menciona softmax aqui" }] },
      { slug: "title", title: "Softmax", block: 1, order: 2, sections: [{ text: "sin la palabra" }] },
    ]);
    expect(search(i, "softmax").map((r) => r.lesson.slug)).toEqual(["title", "body"]);
  });

  it("ranks a heading hit above a plain body hit", () => {
    const i = prep([
      { slug: "body", title: "A", block: 1, order: 1, sections: [{ text: "menciona softmax de pasada" }] },
      { slug: "head", title: "B", block: 1, order: 2, sections: [{ heading: "El softmax", text: "cuerpo" }] },
    ]);
    expect(search(i, "softmax").map((r) => r.lesson.slug)).toEqual(["head", "body"]);
  });

  it("collapses a title-only match to a single row instead of every section", () => {
    const i = prep([
      {
        slug: "a",
        title: "Softmax",
        sections: [{ text: "uno" }, { text: "dos" }, { text: "tres" }, { text: "cuatro" }],
      },
    ]);
    const [r] = search(i, "softmax");
    expect(r.matches).toHaveLength(1);
    expect(r.extraSections).toBe(0);
  });

  it("never surfaces a section that has nothing of its own to highlight", () => {
    // Every section passes the AND gate on the lesson title alone; only one contains the
    // second term. A row with no highlight in it is unexplainable to the reader.
    const i = prep([
      {
        slug: "a",
        title: "Auto-atención",
        sections: [
          { text: "una seccion sobre otra cosa" },
          { text: "aqui si aparece la mascara causal" },
          { text: "y esta tampoco dice nada" },
        ],
      },
    ]);
    const [r] = search(i, "atencion mascara");
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0].ranges.length).toBeGreaterThan(0);
  });

  it("reports title and heading offsets so both can be highlighted", () => {
    const i = prep([
      { slug: "a", title: "La atención escalada", sections: [{ heading: "El softmax", text: "cuerpo" }] },
    ]);
    const [r] = search(i, "atencion");
    expect(r.lesson.title.slice(r.titleRanges[0].start, r.titleRanges[0].end)).toBe("atención");

    const [s2] = search(i, "softmax");
    const m = s2.matches[0];
    expect(m.headingText.slice(m.headingRanges[0].start, m.headingRanges[0].end)).toBe("softmax");
  });

  it("caps sections per lesson and reports the overflow", () => {
    const i = prep([
      {
        slug: "a",
        title: "x",
        sections: Array.from({ length: 6 }, (_, n) => ({ text: `seccion ${n} sobre softmax` })),
      },
    ]);
    const [r] = search(i, "softmax");
    expect(r.matches).toHaveLength(MAX_SECTIONS_PER_LESSON);
    expect(r.extraSections).toBe(3);
  });

  it("breaks score ties on (block, order) — course order, not arbitrary", () => {
    const i = prep([
      { slug: "later", title: "x", block: 3, order: 1, sections: [{ text: "sobre softmax" }] },
      { slug: "early", title: "x", block: 1, order: 9, sections: [{ text: "sobre softmax" }] },
      { slug: "mid", title: "x", block: 1, order: 2, sections: [{ text: "sobre softmax" }] },
    ]);
    expect(search(i, "softmax").map((r) => r.lesson.slug)).toEqual(["mid", "early", "later"]);
  });

  it("honours maxLessons", () => {
    const i = prep(
      Array.from({ length: 8 }, (_, n) => ({
        slug: `l${n}`,
        title: "x",
        order: n,
        sections: [{ text: "sobre softmax" }],
      })),
    );
    expect(search(i, "softmax", { maxLessons: 3 })).toHaveLength(3);
  });

  it("returns ranges that point into the chunk's ORIGINAL text", () => {
    const i = prep([{ slug: "a", title: "x", sections: [{ text: "la atención escalada" }] }]);
    const [r] = search(i, "atencion");
    const chunk = i.chunks[r.matches[0].chunk];
    const { start, end } = r.matches[0].ranges[0];
    expect(chunk.text.slice(start, end)).toBe("atención");
  });

  it("scores a quoted phrase above the same words apart", () => {
    const i = prep([
      { slug: "apart", title: "x", block: 1, order: 1, sections: [{ text: "self y luego attention" }] },
      { slug: "together", title: "x", block: 1, order: 2, sections: [{ text: "la self attention aqui" }] },
    ]);
    expect(search(i, '"self attention"').map((r) => r.lesson.slug)).toEqual(["together"]);
  });

  it("carries the course slug through, so hrefs work for any course", () => {
    const i = prep([{ slug: "a", title: "Softmax", sections: [{ text: "cuerpo" }] }], "otro-curso");
    expect(search(i, "softmax")[0].course).toBe("otro-curso");
  });
});

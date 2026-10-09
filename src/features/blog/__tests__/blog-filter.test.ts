/*
 * BLOG-13 — the decisions behind the index's and the archive pane's filters and pages.
 */

import type { BlogArea, BlogTopic } from "@/domain/types";
import {
  archivePage,
  areaCounts,
  filterEntries,
  indexPage,
  indexSearch,
  isFiltered,
  normalizeFilter,
  pageNumbers,
  parseIndexParams,
  shownArea,
  topicCounts,
} from "../blog-filter";

interface E {
  slug:  string;
  areas: BlogArea[];
  tags:  BlogTopic[];
}

const e = (slug: string, areas: BlogArea[], tags: BlogTopic[] = []): E => ({ slug, areas, tags });

// Newest first, as the lists arrive. Shaped like the real blog: one post in two areas.
const ENTRIES: E[] = [
  e("vectoriales", ["bases-de-datos", "ia"], ["indices", "embeddings"]),
  e("coseno", ["ia", "matematicas"], ["embeddings", "nlp", "llm"]),
  e("arboles", ["bases-de-datos", "programacion"], ["indices", "estructuras-de-datos"]),
  e("join", ["bases-de-datos"], ["sql", "rendimiento"]),
  e("graphrag", ["ia"], ["rag", "grafos", "llm"]),
  e("rag", ["ia"], ["rag", "agentes", "llm"]),
  e("adamw", ["ia", "matematicas"], ["optimizacion", "deep-learning", "llm"]),
  e("tokenizador", ["ia"], ["tokenizacion", "nlp", "llm"]),
];

const slugs = (list: readonly { slug: string }[]) => list.map((x) => x.slug);

describe("normalizeFilter", () => {
  it("keeps an area and a topic that exist together", () => {
    expect(normalizeFilter(ENTRIES, { area: "ia", topic: "rag" })).toEqual({ area: "ia", topic: "rag" });
  });

  it("drops an unknown area, and one no post names, to all", () => {
    expect(normalizeFilter(ENTRIES, { area: "fisica" }).area).toBe("all");
    expect(normalizeFilter([e("x", ["ia"])], { area: "matematicas" }).area).toBe("all");
    expect(normalizeFilter(ENTRIES, { area: 42 }).area).toBe("all");
  });

  it("drops a topic no post in the area carries", () => {
    // `sql` exists, but only under bases-de-datos.
    expect(normalizeFilter(ENTRIES, { area: "ia", topic: "sql" })).toEqual({ area: "ia", topic: null });
    expect(normalizeFilter(ENTRIES, { area: "all", topic: "sql" })).toEqual({ area: "all", topic: "sql" });
    expect(normalizeFilter(ENTRIES, { topic: "cocina" }).topic).toBeNull();
  });

  it("reads missing values as no filter", () => {
    expect(normalizeFilter(ENTRIES, {})).toEqual({ area: "all", topic: null });
    expect(isFiltered(normalizeFilter(ENTRIES, {}))).toBe(false);
  });
});

describe("filterEntries", () => {
  it("keeps every post naming the area, in either position, in order", () => {
    expect(slugs(filterEntries(ENTRIES, { area: "bases-de-datos", topic: null }))).toEqual([
      "vectoriales", "arboles", "join",
    ]);
    expect(slugs(filterEntries(ENTRIES, { area: "matematicas", topic: null }))).toEqual(["coseno", "adamw"]);
  });

  it("narrows by topic inside the area", () => {
    expect(slugs(filterEntries(ENTRIES, { area: "bases-de-datos", topic: "indices" }))).toEqual([
      "vectoriales", "arboles",
    ]);
    expect(slugs(filterEntries(ENTRIES, { area: "all", topic: "rag" }))).toEqual(["graphrag", "rag"]);
  });
});

describe("shownArea", () => {
  it("labels a two-area post with the filtered area, else its first", () => {
    const coseno = ENTRIES[1]; // ia, matematicas
    expect(shownArea(coseno, { area: "matematicas", topic: null })).toBe("matematicas");
    expect(shownArea(coseno, { area: "all", topic: null })).toBe("ia");
    expect(shownArea(coseno, { area: "bases-de-datos", topic: null })).toBe("ia");
  });
});

describe("areaCounts", () => {
  it("counts a two-area post under both, in BLOG_AREAS order", () => {
    expect(areaCounts(ENTRIES)).toEqual([
      { area: "ia", count: 6 },
      { area: "bases-de-datos", count: 3 },
      { area: "matematicas", count: 2 },
      { area: "programacion", count: 1 },
    ]);
  });

  it("leaves out an area no post names", () => {
    expect(areaCounts([e("x", ["ia"])]).map((a) => a.area)).toEqual(["ia"]);
  });
});

describe("topicCounts", () => {
  it("counts the area's topics, most-used first", () => {
    const counts = topicCounts(ENTRIES, "bases-de-datos");
    expect(counts[0]).toEqual({ topic: "indices", count: 2 });
    expect(counts.map((c) => c.topic).sort()).toEqual(
      ["embeddings", "estructuras-de-datos", "indices", "rendimiento", "sql"],
    );
  });

  it("breaks ties by the locale's label when given one", () => {
    const labels: Partial<Record<BlogTopic, string>> = { sql: "A", rendimiento: "B", "estructuras-de-datos": "C", embeddings: "D" };
    const counts = topicCounts(ENTRIES, "bases-de-datos", (t) => labels[t] ?? t);
    expect(counts.map((c) => c.topic)).toEqual(["indices", "sql", "rendimiento", "estructuras-de-datos", "embeddings"]);
  });
});

describe("indexPage", () => {
  const list = ["a", "b", "c", "d", "e", "f", "g", "h"];

  it("features the newest post on page 1 of the unfiltered view, and pages the rest", () => {
    const p1 = indexPage(list, false, 1, 6);
    expect(p1).toMatchObject({ featured: "a", items: ["b", "c", "d", "e", "f", "g"], page: 1, pageCount: 2 });
    expect([p1.first, p1.last, p1.total]).toEqual([1, 7, 8]);

    const p2 = indexPage(list, false, 2, 6);
    expect(p2).toMatchObject({ featured: null, items: ["h"], page: 2, pageCount: 2 });
    expect([p2.first, p2.last]).toEqual([8, 8]);
  });

  it("features nothing in a filtered view: the newest match is its first card", () => {
    const p = indexPage(["a", "b", "c"], true, 1, 6);
    expect(p).toMatchObject({ featured: null, items: ["a", "b", "c"], pageCount: 1, first: 1, last: 3 });
  });

  it("clamps a page past the end, or below 1, into range", () => {
    expect(indexPage(list, false, 99, 6).page).toBe(2);
    expect(indexPage(list, false, 0, 6).page).toBe(1);
    expect(indexPage(list, false, Number.NaN, 6).page).toBe(1);
  });

  it("is one empty page for an empty list", () => {
    expect(indexPage([], false, 1, 6)).toEqual({
      featured: null, items: [], page: 1, pageCount: 1, total: 0, first: 0, last: 0,
    });
  });
});

describe("archivePage", () => {
  const list = ["a", "b", "c", "d", "e", "f", "g", "h"].map((slug) => ({ slug }));

  it("opens on the page holding the post being read", () => {
    expect(archivePage(list, "b", null, 6)).toMatchObject({ page: 1, pageCount: 2 });
    expect(archivePage(list, "h", null, 6)).toMatchObject({ page: 2, items: [{ slug: "g" }, { slug: "h" }] });
  });

  it("opens on page 1 when the filter hides the post being read", () => {
    expect(archivePage(list, "zzz", null, 6).page).toBe(1);
  });

  it("follows an explicit page, clamped", () => {
    expect(archivePage(list, "a", 2, 6).page).toBe(2);
    expect(archivePage(list, "a", 9, 6).page).toBe(2);
  });
});

describe("pageNumbers", () => {
  it("lists every page up to seven", () => {
    expect(pageNumbers(1, 2)).toEqual([1, 2]);
    expect(pageNumbers(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("keeps the ends and the current page's neighbours beyond seven", () => {
    expect(pageNumbers(1, 12)).toEqual([1, 2, "gap", 12]);
    expect(pageNumbers(6, 12)).toEqual([1, "gap", 5, 6, 7, "gap", 12]);
    expect(pageNumbers(12, 12)).toEqual([1, "gap", 11, 12]);
    expect(pageNumbers(3, 12)).toEqual([1, 2, 3, 4, "gap", 12]);
  });
});

describe("the index URL", () => {
  const params = (qs: string) => new URLSearchParams(qs);

  it("parses area, topic and page, defaulting a bad page to 1", () => {
    expect(parseIndexParams(params("area=ia&topic=rag&page=3"))).toEqual({ area: "ia", topic: "rag", page: 3 });
    expect(parseIndexParams(params("page=abc")).page).toBe(1);
    expect(parseIndexParams(params("page=-2")).page).toBe(1);
    expect(parseIndexParams(params(""))).toEqual({ area: null, topic: null, page: 1 });
  });

  it("writes only what differs from the plain index", () => {
    expect(indexSearch({ area: "all", topic: null }, 1)).toBe("");
    expect(indexSearch({ area: "bases-de-datos", topic: null }, 1)).toBe("?area=bases-de-datos");
    expect(indexSearch({ area: "ia", topic: "rag" }, 2)).toBe("?area=ia&topic=rag&page=2");
    expect(indexSearch({ area: "all", topic: "sql" }, 1)).toBe("?topic=sql");
  });

  it("round-trips through parse + normalize", () => {
    const qs = indexSearch({ area: "matematicas", topic: "llm" }, 1);
    const raw = parseIndexParams(params(qs.slice(1)));
    expect(normalizeFilter(ENTRIES, raw)).toEqual({ area: "matematicas", topic: "llm" });
  });
});

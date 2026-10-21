// CHAT-CONTENT-01 — the content facts handed to the chat assistant's prompt.
//
// The registries are mocked: what is under test is the mapping from the catalog and blog
// selectors to `ChatPromptContent` — which locale's URL goes where, that the English link
// only appears where an English page exists, that the FAQ's dynamic entry (which has no
// static answer) is dropped, and that every manifest block survives, the unwritten ones too.
// Publication itself (drafts, the «soon» course) is the selectors' job and tested with them.

import type { CatalogEntry } from "@/lib/courses/catalog-view";
import type { Lesson, Post } from "@/domain/types";

jest.mock("@/lib/courses/catalog-view", () => ({
  listCatalogEntries:            jest.fn(),
  courseLocales:                 jest.fn(),
  getEnglishTranslationCoverage: jest.fn(),
}));
jest.mock("@/lib/blog/registry", () => ({ listPosts: jest.fn() }));
jest.mock("@/lib/blog/locales", () => ({ postLocales: jest.fn() }));

import {
  courseLocales,
  getEnglishTranslationCoverage,
  listCatalogEntries,
} from "@/lib/courses/catalog-view";
import { listPosts } from "@/lib/blog/registry";
import { postLocales } from "@/lib/blog/locales";
import { getChatPromptContent } from "@/lib/chat-content";

const SITE = process.env.NEXT_PUBLIC_BASE_URL ?? "https://gustavoai.dev";

function lesson(slug: string, block: number): Lesson {
  return { slug, title: `Lección ${slug}`, block } as Lesson;
}

function entry(): CatalogEntry {
  const blocks = [
    { id: 1, title: "Uno", summary: "S1.", lessons: 2 },
    { id: 2, title: "Dos", summary: "S2.", lessons: 3 },
  ];
  const lessons = [lesson("a", 1), lesson("b", 1)];
  return {
    course: {
      slug:    "llm-agents",
      title:   "Modelos de Lenguaje",
      tagline: "Del Transformer al agente.",
      level:   "avanzado",
      prerequisites: {
        intro: "Necesitas:",
        items: [{ title: "Python", detail: "NumPy." }, { title: "Una terminal" }],
      },
      cta: { heading: "", body: "" },
      faq: [
        { q: "¿Cuánto cuesta?", a: "Nada." },
        { q: "¿Está en inglés?", dynamic: "english-translation-status" },
      ],
      blocks,
    },
    contentLocale:   "es",
    lessons,
    views:           lessons.map((l) => ({ lesson: l, contentLocale: "es" })),
    fullyTranslated: true,
    translatedCount: 2,
    build: {
      blocks: [
        { block: blocks[0], lessons, totalMinutes: 20, published: 2, planned: 2, state: "complete" },
        { block: blocks[1], lessons: [], totalMinutes: 0, published: 0, planned: 3, state: "upcoming" },
      ],
      publishedBlocks:  1,
      totalBlocks:      2,
      publishedLessons: 2,
      plannedLessons:   5,
      complete:         false,
    },
  };
}

function postMeta(slug: string): Post {
  return {
    slug, title: `Post ${slug}`, date: "2026-10-01", minutes: 10, summary: "Resumen.",
    draft: false, reading: [], areas: ["ia"], tags: ["llm"], aiImages: false,
  };
}

beforeEach(() => {
  jest.mocked(listCatalogEntries).mockReturnValue([entry()]);
  jest.mocked(courseLocales).mockReturnValue(["es"]);
  jest.mocked(getEnglishTranslationCoverage).mockReturnValue({ translated: 0, total: 2, fullyTranslated: false });
  jest.mocked(listPosts).mockReturnValue([postMeta("nuevo"), postMeta("viejo")]);
  jest.mocked(postLocales).mockImplementation((slug) => (slug === "nuevo" ? ["es"] : ["es", "en"]));
});

describe("getChatPromptContent", () => {
  it("reads the Spanish catalog and blog", () => {
    getChatPromptContent();
    expect(listCatalogEntries).toHaveBeenCalledWith("es");
    expect(listPosts).toHaveBeenCalledWith("es");
  });

  it("gives the site origin with no trailing slash", () => {
    expect(getChatPromptContent().siteUrl).toBe(SITE);
  });

  it("maps a course: URLs, prerequisites, static FAQ, build status and English coverage", () => {
    const [c] = getChatPromptContent().courses;
    expect(c.url).toBe(`${SITE}/cursos/llm-agents`);
    expect(c.urlEn).toBeNull();
    expect(c.prerequisites).toEqual({ intro: "Necesitas:", items: ["Python: NumPy.", "Una terminal"] });
    expect(c.faq).toEqual([{ q: "¿Cuánto cuesta?", a: "Nada." }]);
    expect(c.complete).toBe(false);
    expect(c.publishedLessons).toBe(2);
    expect(c.plannedLessons).toBe(5);
    expect(c.english).toEqual({ translated: 0, total: 2 });
    expect(getEnglishTranslationCoverage).toHaveBeenCalledWith("llm-agents");
  });

  it("keeps every manifest block, with the lessons of the written ones", () => {
    const [c] = getChatPromptContent().courses;
    expect(c.blocks).toEqual([
      { id: 1, title: "Uno", summary: "S1.", planned: 2, lessons: [
        { slug: "a", title: "Lección a" },
        { slug: "b", title: "Lección b" },
      ] },
      { id: 2, title: "Dos", summary: "S2.", planned: 3, lessons: [] },
    ]);
  });

  it("links the English landing only when the course has one", () => {
    jest.mocked(courseLocales).mockReturnValue(["es", "en"]);
    expect(getChatPromptContent().courses[0].urlEn).toBe(`${SITE}/en/cursos/llm-agents`);
  });

  it("maps posts in the registry's order, with the English link only for translated ones", () => {
    const { posts } = getChatPromptContent();
    expect(posts.map((p) => p.title)).toEqual(["Post nuevo", "Post viejo"]);
    expect(posts[0]).toEqual({
      title: "Post nuevo", date: "2026-10-01", summary: "Resumen.", areas: ["ia"], tags: ["llm"],
      url: `${SITE}/blog/nuevo`, urlEn: null,
    });
    expect(posts[1].urlEn).toBe(`${SITE}/en/blog/viejo`);
  });
});

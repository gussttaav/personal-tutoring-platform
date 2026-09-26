// COURSE-P6-03 — catalog/landing locale resolution, against a temp fixture tree.
//
// Same fs-fixture approach as registry.test.ts: build a throwaway content root and point
// the registry's public API at it with `__setContentRoot`. Each `it` builds its own tree,
// so there is no memo leakage between cases.
//
// The case that matters is the middle one: a course whose MANIFEST is translated but whose
// LESSONS are not. That is the whole state this module exists to represent.
//
// COURSE-BUILD-01 adds the other axis: `translatedCount` (how much of this locale exists) and
// `build` (how much of the CANONICAL course exists). The load-bearing case there is the planned
// lesson count, which is locale-invariant and must be read off the canonical manifest even when
// the prose comes from another one.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { __resetRegistry, __setContentRoot, getCourse } from "@/lib/courses/registry";
import {
  catalogLocales,
  courseLocales,
  getCatalogEntry,
  getCourseBuild,
  getEnglishTranslationCoverage,
  getLessonView,
  lessonViewNeighbours,
  listCatalogEntries,
  listLessonViews,
} from "@/lib/courses/catalog-view";

/** One block, no declared plan — what every case that does not care about the plan uses. */
const DEFAULT_BLOCKS = `blocks:
  - id: 1
    title: "Bloque 1"
    summary: "..."
`;

function manifest(title: string, blocks: string = DEFAULT_BLOCKS): string {
  return `
slug: dl-nlp
title: ${JSON.stringify(title)}
tagline: "..."
level: intermedio
prerequisites:
  intro: "..."
  items: []
cta:
  heading: "..."
  body: "..."
faq: []
${blocks}`;
}

function lessonFile(slug: string, order: number, draft = false, block = 1): string {
  const fm = {
    slug, title: `Lección ${slug}`, block, order, minutes: 10,
    summary: "...", draft, hasCode: false, hasQuiz: false, quiz: [], challenges: [], reading: [],
  };
  const yaml = Object.entries(fm).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join("\n");
  return `---\n${yaml}\n---\n\nCuerpo.\n`;
}

/** Content root with a `dl-nlp` course: manifests per locale, lesson dirs per locale.
 *  `blocks` overrides a locale's block YAML — needed to give the two manifests DIFFERENT
 *  planned lesson counts and pin which one wins. */
function makeTree(opts: {
  manifests: Record<string, string>;
  blocks?:   Record<string, string>;
  lessons?:  Record<string, { slug: string; order: number; draft?: boolean; block?: number }[]>;
}): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-view-"));
  const courseDir = path.join(root, "dl-nlp");
  fs.mkdirSync(courseDir, { recursive: true });

  for (const [locale, title] of Object.entries(opts.manifests)) {
    fs.writeFileSync(
      path.join(courseDir, `course.${locale}.yml`),
      manifest(title, opts.blocks?.[locale]),
    );
  }
  for (const [locale, lessons] of Object.entries(opts.lessons ?? {})) {
    const dir = path.join(courseDir, locale);
    fs.mkdirSync(dir, { recursive: true });
    for (const l of lessons) {
      fs.writeFileSync(
        path.join(dir, `0${l.order}-${l.slug}.mdx`),
        lessonFile(l.slug, l.order, l.draft, l.block),
      );
    }
  }
  return root;
}

afterEach(() => __resetRegistry());

describe("fully translated course", () => {
  it("resolves each locale against its own lessons", () => {
    __setContentRoot(makeTree({
      manifests: { es: "Curso", en: "Course" },
      lessons: {
        es: [{ slug: "intro", order: 1 }],
        en: [{ slug: "intro", order: 1 }],
      },
    }));

    const es = getCatalogEntry("dl-nlp", "es");
    const en = getCatalogEntry("dl-nlp", "en");

    expect(es).toMatchObject({ contentLocale: "es" });
    expect(es?.course.title).toBe("Curso");
    expect(en).toMatchObject({ contentLocale: "en" });
    expect(en?.course.title).toBe("Course");

    expect(catalogLocales()).toEqual(["es", "en"]);
    expect(courseLocales("dl-nlp")).toEqual(["es", "en"]);
  });
});

describe("manifest translated, lessons not — the state at launch", () => {
  it("pairs the English manifest with the Spanish lessons", () => {
    __setContentRoot(makeTree({
      manifests: { es: "Curso", en: "Course" },
      lessons: { es: [{ slug: "intro", order: 1 }, { slug: "dos", order: 2 }] },
    }));

    const en = getCatalogEntry("dl-nlp", "en");

    // English metadata…
    expect(en?.course.title).toBe("Course");
    // …backed by Spanish lessons, and saying so.
    expect(en?.contentLocale).toBe("es");
    expect(en?.lessons.map((l) => l.slug)).toEqual(["intro", "dos"]);

    // Both catalogs show the course; both landings render; hreflang pairs them.
    expect(listCatalogEntries("en")).toHaveLength(1);
    expect(catalogLocales()).toEqual(["es", "en"]);
    expect(courseLocales("dl-nlp")).toEqual(["es", "en"]);
  });

  it("counts only PUBLISHED lessons from the fallback locale", () => {
    __setContentRoot(makeTree({
      manifests: { es: "Curso", en: "Course" },
      lessons: { es: [{ slug: "intro", order: 1 }, { slug: "borrador", order: 2, draft: true }] },
    }));

    expect(getCatalogEntry("dl-nlp", "en")?.lessons.map((l) => l.slug)).toEqual(["intro"]);
  });
});

describe("untranslated course", () => {
  it("is absent from the English catalog when there is no English manifest", () => {
    __setContentRoot(makeTree({
      manifests: { es: "Curso" },
      lessons:   { es: [{ slug: "intro", order: 1 }] },
    }));

    expect(getCatalogEntry("dl-nlp", "en")).toBeNull();
    expect(listCatalogEntries("en")).toEqual([]);
    expect(catalogLocales()).toEqual(["es"]);
    expect(courseLocales("dl-nlp")).toEqual(["es"]);
  });
});

describe("course with no published lessons in any locale", () => {
  it("is excluded from the catalog — there is nothing to put on a card", () => {
    __setContentRoot(makeTree({
      manifests: { es: "Curso", en: "Course" },
      lessons:   { es: [{ slug: "borrador", order: 1, draft: true }] },
    }));

    expect(getCatalogEntry("dl-nlp", "es")).toBeNull();
    expect(getCatalogEntry("dl-nlp", "en")).toBeNull();
    expect(listCatalogEntries("es")).toEqual([]);
    expect(catalogLocales()).toEqual([]);
  });

  // COURSE-C2-P0-01 — a manifest with NO lesson directory at all: the state a second course
  // is in from its first PR until its first `draft: false` lesson. The landing route still
  // resolves the course (it renders the "soon" page and marks it noindex on this very
  // predicate); the catalog, sitemap and hreflang set all omit it.
  it("manifest without lessons: listCatalogEntries omits it, getCourse still resolves", () => {
    __setContentRoot(makeTree({ manifests: { es: "Curso", en: "Course" } }));

    expect(getCourse("dl-nlp", "es")?.title).toBe("Curso");
    expect(getCourse("dl-nlp", "en")?.title).toBe("Course");

    expect(getCatalogEntry("dl-nlp", "es")).toBeNull();
    expect(getCatalogEntry("dl-nlp", "en")).toBeNull();
    expect(listCatalogEntries("es")).toEqual([]);
    expect(listCatalogEntries("en")).toEqual([]);
    expect(courseLocales("dl-nlp")).toEqual([]);
    expect(catalogLocales()).toEqual([]);
  });
});

// COURSE-P6-03b — translating one lesson at a time must not break the other 42.
describe("partial translation", () => {
  /** es: uno, dos, tres. en: only `dos` translated. */
  function partialTree() {
    return makeTree({
      manifests: { es: "Curso", en: "Course" },
      lessons: {
        es: [{ slug: "uno", order: 1 }, { slug: "dos", order: 2 }, { slug: "tres", order: 3 }],
        en: [{ slug: "dos", order: 2 }],
      },
    });
  }

  it("keeps the full spine, resolving each lesson independently", () => {
    __setContentRoot(partialTree());

    const views = listLessonViews("dl-nlp", "en");

    // All three lessons are still there, in canonical order — NOT collapsed to the one
    // that happens to be translated. This is the regression that made lesson-by-lesson
    // publishing impossible: course-level resolution returned a 1-lesson course here.
    expect(views.map((v) => v.lesson.slug)).toEqual(["uno", "dos", "tres"]);
    expect(views.map((v) => v.contentLocale)).toEqual(["es", "en", "es"]);
  });

  it("reports the course as not fully translated, so the card still says so", () => {
    __setContentRoot(partialTree());

    const en = getCatalogEntry("dl-nlp", "en")!;
    expect(en.lessons).toHaveLength(3);
    expect(en.fullyTranslated).toBe(false);
    // The hero links at the FIRST lesson, which is still Spanish.
    expect(en.contentLocale).toBe("es");
    // COURSE-BUILD-01: "how far did it get" — the number the notice quotes. Note this case is
    // exactly the one the old `contentLocale`-keyed badge got right and the NEXT one got wrong.
    expect(en.translatedCount).toBe(1);
  });

  it("counts the translated lessons even when the FIRST one is among them", () => {
    // The trap the language notice used to fall into: lesson 1 translated, lesson 2 not, so
    // `contentLocale` is "en" and the page looked fully English. `fullyTranslated` is the honest
    // answer, and `translatedCount` says how far off it is.
    __setContentRoot(makeTree({
      manifests: { es: "Curso", en: "Course" },
      lessons: {
        es: [{ slug: "uno", order: 1 }, { slug: "dos", order: 2 }, { slug: "tres", order: 3 }],
        en: [{ slug: "uno", order: 1 }],
      },
    }));

    const en = getCatalogEntry("dl-nlp", "en")!;
    expect(en.contentLocale).toBe("en");
    expect(en.fullyTranslated).toBe(false);
    expect(en.translatedCount).toBe(1);
  });

  it("flips to fully translated once every lesson exists in the locale", () => {
    __setContentRoot(makeTree({
      manifests: { es: "Curso", en: "Course" },
      lessons: {
        es: [{ slug: "uno", order: 1 }, { slug: "dos", order: 2 }],
        en: [{ slug: "uno", order: 1 }, { slug: "dos", order: 2 }],
      },
    }));

    const en = getCatalogEntry("dl-nlp", "en")!;
    expect(en.fullyTranslated).toBe(true);
    expect(en.contentLocale).toBe("en");
    expect(en.translatedCount).toBe(2);
  });

  it("walks prev/next along the spine, so a reader is never stranded", () => {
    __setContentRoot(partialTree());

    // Before the fix, `dos` was the only published English lesson and had no neighbours.
    expect(lessonViewNeighbours("dl-nlp", "dos", "en")).toEqual({
      prev: { slug: "uno",  title: "Lección uno" },
      next: { slug: "tres", title: "Lección tres" },
    });
    expect(lessonViewNeighbours("dl-nlp", "uno",  "en").prev).toBeNull();
    expect(lessonViewNeighbours("dl-nlp", "tres", "en").next).toBeNull();
  });

  it("resolves a single lesson's content locale — what decides noindex on the route", () => {
    __setContentRoot(partialTree());

    // Untranslated → served from canonical → the route marks it noindex + canonical to es.
    expect(getLessonView("dl-nlp", "uno", "en")?.contentLocale).toBe("es");
    // Translated → a first-class English page.
    expect(getLessonView("dl-nlp", "dos", "en")?.contentLocale).toBe("en");
    expect(getLessonView("dl-nlp", "nope", "en")).toBeNull();
  });

  it("uses the requested locale as the spine when there is no canonical tree", () => {
    __setContentRoot(makeTree({
      manifests: { es: "Curso", en: "Course" },
      lessons:   { en: [{ slug: "solo", order: 1 }] },
    }));

    const views = listLessonViews("dl-nlp", "en");
    expect(views.map((v) => v.contentLocale)).toEqual(["en"]);
    expect(getCatalogEntry("dl-nlp", "es")).toBeNull();
  });
});

describe("COURSE-BUILD-01 — authoring progress", () => {
  /** Two blocks, each with a declared plan. The English manifest deliberately DISAGREES about
   *  block 1's size, so we can pin which manifest owns that number. */
  const ES_BLOCKS = `blocks:
  - id: 1
    title: "Bloque 1"
    summary: "Resumen 1"
    lessons: 3
  - id: 2
    title: "Bloque 2"
    summary: "Resumen 2"
    lessons: 2
`;
  const EN_BLOCKS = `blocks:
  - id: 1
    title: "Block 1"
    summary: "Summary 1"
    lessons: 9
  - id: 2
    title: "Block 2"
    summary: "Summary 2"
    lessons: 2
`;

  function buildTree() {
    return makeTree({
      manifests: { es: "Curso", en: "Course" },
      blocks:    { es: ES_BLOCKS, en: EN_BLOCKS },
      // Block 1 half written, block 2 not started — a course being written in public.
      lessons: {
        es: [{ slug: "uno", order: 1, block: 1 }, { slug: "dos", order: 2, block: 1 }],
      },
    });
  }

  it("carries the manifest's blocks and their progress on the catalog entry", () => {
    __setContentRoot(buildTree());

    const build = getCatalogEntry("dl-nlp", "es")!.build;

    expect(build.blocks.map((b) => b.block.id)).toEqual([1, 2]);
    expect(build.blocks.map((b) => b.state)).toEqual(["partial", "upcoming"]);
    expect(build.publishedBlocks).toBe(1);
    expect(build.totalBlocks).toBe(2);
    expect(build.publishedLessons).toBe(2);
    expect(build.plannedLessons).toBe(5);
    expect(build.complete).toBe(false);
  });

  it("takes the planned counts from the CANONICAL manifest and the prose from the requested one", () => {
    __setContentRoot(buildTree());

    const en = getCatalogEntry("dl-nlp", "en")!.build;

    // English titles…
    expect(en.blocks.map((b) => b.block.title)).toEqual(["Block 1", "Block 2"]);
    // …and Spanish plans. A block's size is locale-invariant, like its id: the `en` manifest
    // says 9 here, and it does not get to. Otherwise "is the course finished?" would have a
    // different answer per locale, which is not a thing it can have.
    expect(en.blocks.map((b) => b.planned)).toEqual([3, 2]);
    expect(en.plannedLessons).toBe(5);
    // The published counts are the canonical spine's, so both locales agree on progress.
    expect(en.publishedLessons).toBe(2);
    expect(en.blocks.map((b) => b.state)).toEqual(["partial", "upcoming"]);
  });

  it("reports a finished course as complete, with no plan declared anywhere", () => {
    // dl-nlp's own shape: manifests that predate `lessons:` entirely.
    __setContentRoot(makeTree({
      manifests: { es: "Curso" },
      lessons: { es: [{ slug: "uno", order: 1 }] },
    }));

    const build = getCatalogEntry("dl-nlp", "es")!.build;
    expect(build.complete).toBe(true);
    expect(build.plannedLessons).toBeNull();
    expect(build.publishedBlocks).toBe(build.totalBlocks);
  });

  describe("getCourseBuild", () => {
    it("still answers for a course with NO published lessons — the «soon» landing", () => {
      // `getCatalogEntry` is null here by design (nothing to put on a card), but the landing
      // page renders, and listing the blocks it WILL have is most of the point of that page.
      __setContentRoot(makeTree({
        manifests: { es: "Curso", en: "Course" },
        blocks:    { es: ES_BLOCKS, en: EN_BLOCKS },
      }));

      expect(getCatalogEntry("dl-nlp", "es")).toBeNull();

      const build = getCourseBuild("dl-nlp", "es")!;
      expect(build.blocks.map((b) => b.block.title)).toEqual(["Bloque 1", "Bloque 2"]);
      expect(build.blocks.every((b) => b.state === "upcoming")).toBe(true);
      expect(build.plannedLessons).toBe(5);
      expect(build.complete).toBe(false);

      // And in English, with the canonical plan.
      const en = getCourseBuild("dl-nlp", "en")!;
      expect(en.blocks.map((b) => b.block.title)).toEqual(["Block 1", "Block 2"]);
      expect(en.blocks.map((b) => b.planned)).toEqual([3, 2]);
    });

    it("is null for a locale with no manifest", () => {
      __setContentRoot(makeTree({
        manifests: { es: "Curso" },
        lessons: { es: [{ slug: "uno", order: 1 }] },
      }));

      expect(getCourseBuild("dl-nlp", "en")).toBeNull();
      expect(getCourseBuild("nope", "es")).toBeNull();
    });
  });
});

describe("getEnglishTranslationCoverage", () => {
  it("counts the Spanish spine as the total when there is no English manifest at all", () => {
    __setContentRoot(makeTree({
      manifests: { es: "Curso" },
      lessons:   { es: [{ slug: "uno", order: 1 }, { slug: "dos", order: 2 }] },
    }));

    expect(getEnglishTranslationCoverage("dl-nlp")).toEqual({
      translated: 0, total: 2, fullyTranslated: false,
    });
  });

  it("reports the translated/total split for a partially translated course", () => {
    __setContentRoot(makeTree({
      manifests: { es: "Curso", en: "Course" },
      lessons: {
        es: [{ slug: "uno", order: 1 }, { slug: "dos", order: 2 }, { slug: "tres", order: 3 }],
        en: [{ slug: "dos", order: 2 }],
      },
    }));

    expect(getEnglishTranslationCoverage("dl-nlp")).toEqual({
      translated: 1, total: 3, fullyTranslated: false,
    });
  });

  it("reports fullyTranslated once every lesson exists in English", () => {
    __setContentRoot(makeTree({
      manifests: { es: "Curso", en: "Course" },
      lessons: {
        es: [{ slug: "uno", order: 1 }, { slug: "dos", order: 2 }],
        en: [{ slug: "uno", order: 1 }, { slug: "dos", order: 2 }],
      },
    }));

    expect(getEnglishTranslationCoverage("dl-nlp")).toEqual({
      translated: 2, total: 2, fullyTranslated: true,
    });
  });
});

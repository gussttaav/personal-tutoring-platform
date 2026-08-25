// COURSE-P6-03 — catalog/landing locale resolution, against a temp fixture tree.
//
// Same fs-fixture approach as registry.test.ts: build a throwaway content root and point
// the registry's public API at it with `__setContentRoot`. Each `it` builds its own tree,
// so there is no memo leakage between cases.
//
// The case that matters is the middle one: a course whose MANIFEST is translated but whose
// LESSONS are not. That is the whole state this module exists to represent.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { __resetRegistry, __setContentRoot } from "@/lib/courses/registry";
import {
  catalogLocales,
  courseLocales,
  getCatalogEntry,
  getLessonView,
  lessonViewNeighbours,
  listCatalogEntries,
  listLessonViews,
} from "@/lib/courses/catalog-view";

function manifest(title: string): string {
  return `
slug: dl-nlp
title: ${JSON.stringify(title)}
tagline: "..."
level: intermedio
estimatedHours: 40
prerequisites: []
blocks:
  - id: 1
    title: "Bloque 1"
    summary: "..."
`;
}

function lessonFile(slug: string, order: number, draft = false): string {
  const fm = {
    slug, title: `Lección ${slug}`, block: 1, order, minutes: 10,
    summary: "...", draft, hasCode: false, hasQuiz: false, quiz: [], challenges: [],
  };
  const yaml = Object.entries(fm).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join("\n");
  return `---\n${yaml}\n---\n\nCuerpo.\n`;
}

/** Content root with a `dl-nlp` course: manifests per locale, lesson dirs per locale. */
function makeTree(opts: {
  manifests: Record<string, string>;
  lessons?:  Record<string, { slug: string; order: number; draft?: boolean }[]>;
}): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-view-"));
  const courseDir = path.join(root, "dl-nlp");
  fs.mkdirSync(courseDir, { recursive: true });

  for (const [locale, title] of Object.entries(opts.manifests)) {
    fs.writeFileSync(path.join(courseDir, `course.${locale}.yml`), manifest(title));
  }
  for (const [locale, lessons] of Object.entries(opts.lessons ?? {})) {
    const dir = path.join(courseDir, locale);
    fs.mkdirSync(dir, { recursive: true });
    for (const l of lessons) {
      fs.writeFileSync(path.join(dir, `0${l.order}-${l.slug}.mdx`), lessonFile(l.slug, l.order, l.draft));
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

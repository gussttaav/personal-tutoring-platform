// COURSE-P9-01 — Index assembly against a temp fixture tree.
//
// `getLessonSource` resolves against its own `process.cwd()`-derived root and does not
// honour the registry's `__setContentRoot`, so the source reader is injected here. The
// registry itself is still redirected, because that is what supplies the spine.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildSearchIndex } from "@/lib/courses/search/build-index";
import { __setContentRoot, __resetRegistry } from "@/lib/courses/registry";
import { SEARCH_INDEX_VERSION } from "@/lib/courses/search/types";

const MANIFEST = (locale: string) => `
slug: dl-nlp
title: "Curso ${locale}"
tagline: "..."
level: intermedio
estimatedHours: 40
prerequisites: []
blocks:
  - id: 1
    title: "Bloque 1"
    summary: "..."
`;

function lessonFile(slug: string, opts: { order?: number; draft?: boolean; body?: string } = {}) {
  const fm = {
    slug,
    title: `Lección ${slug}`,
    block: 1,
    order: opts.order ?? 1,
    minutes: 10,
    summary: `Resumen de ${slug}`,
    draft: opts.draft ?? false,
    hasCode: false,
    hasQuiz: false,
    quiz: [],
    challenges: [],
    reading: [],
  };
  const yaml = Object.entries(fm).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join("\n");
  return `---\n${yaml}\n---\n\n${opts.body ?? "Prosa introductoria.\n\n## Una seccion\n\nCuerpo."}\n`;
}

/** Content root with a `dl-nlp` course; `locales` get a manifest, `dirs` get lesson files. */
function makeTree(opts: {
  locales: string[];
  dirs: Record<string, { filename: string; slug: string; order?: number; draft?: boolean; body?: string }[]>;
}): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "p9-search-"));
  const courseDir = path.join(root, "dl-nlp");
  fs.mkdirSync(courseDir, { recursive: true });
  for (const l of opts.locales) fs.writeFileSync(path.join(courseDir, `course.${l}.yml`), MANIFEST(l));
  for (const [locale, lessons] of Object.entries(opts.dirs)) {
    const dir = path.join(courseDir, locale);
    fs.mkdirSync(dir, { recursive: true });
    for (const l of lessons) {
      fs.writeFileSync(path.join(dir, l.filename), lessonFile(l.slug, l));
    }
  }
  return root;
}

/** The injected reader, mirroring getLessonSource's "stem minus NN- prefix" rule. */
function readerFor(root: string) {
  return (courseSlug: string, lessonSlug: string, locale: string): string | null => {
    const dir = path.join(root, courseSlug, locale);
    if (!fs.existsSync(dir)) return null;
    const hit = fs.readdirSync(dir).find(
      (f) => f.endsWith(".mdx") && f.replace(/\.mdx$/, "").replace(/^\d+-/, "") === lessonSlug,
    );
    return hit ? fs.readFileSync(path.join(dir, hit), "utf8") : null;
  };
}

afterEach(() => __resetRegistry());

describe("buildSearchIndex", () => {
  it("indexes published lessons as sections", () => {
    const root = makeTree({
      locales: ["es"],
      dirs: { es: [{ filename: "01-uno.mdx", slug: "uno" }, { filename: "02-dos.mdx", slug: "dos", order: 2 }] },
    });
    __setContentRoot(root);

    const index = buildSearchIndex("dl-nlp", "es", { readSource: readerFor(root) });
    expect(index.version).toBe(SEARCH_INDEX_VERSION);
    expect(index.lessons.map((l) => l.slug)).toEqual(["uno", "dos"]);
    // Head section + one h2 section per lesson.
    expect(index.chunks).toHaveLength(4);
    expect(index.chunks[0]).toMatchObject({ lesson: 0, headingId: "", text: "Prosa introductoria." });
    expect(index.chunks[1]).toMatchObject({ lesson: 0, headingId: "una-seccion", headingText: "Una seccion" });
  });

  it("excludes drafts", () => {
    const root = makeTree({
      locales: ["es"],
      dirs: { es: [{ filename: "01-uno.mdx", slug: "uno" }, { filename: "02-borrador.mdx", slug: "borrador", order: 2, draft: true }] },
    });
    __setContentRoot(root);
    expect(buildSearchIndex("dl-nlp", "es", { readSource: readerFor(root) }).lessons.map((l) => l.slug)).toEqual(["uno"]);
  });

  it("builds the English index from the Spanish spine, reporting contentLocale", () => {
    const root = makeTree({
      locales: ["es", "en"],
      dirs: { es: [{ filename: "01-uno.mdx", slug: "uno" }] },
    });
    __setContentRoot(root);

    const index = buildSearchIndex("dl-nlp", "en", { readSource: readerFor(root) });
    expect(index.locale).toBe("en");
    expect(index.lessons).toHaveLength(1);
    // The prose is the Spanish prose the /en reader actually renders.
    expect(index.lessons[0].contentLocale).toBe("es");
    expect(index.chunks[0].text).toBe("Prosa introductoria.");
  });

  it("returns an empty index — never throws — for an unknown course or locale", () => {
    const root = makeTree({ locales: ["es"], dirs: { es: [{ filename: "01-uno.mdx", slug: "uno" }] } });
    __setContentRoot(root);
    const reader = readerFor(root);
    expect(buildSearchIndex("no-existe", "es", { readSource: reader }).lessons).toEqual([]);
    expect(buildSearchIndex("dl-nlp", "de", { readSource: reader }).lessons).toEqual([]);
  });

  it("hashes the content: stable across calls, different when a body changes", () => {
    const root = makeTree({ locales: ["es"], dirs: { es: [{ filename: "01-uno.mdx", slug: "uno" }] } });
    __setContentRoot(root);
    const reader = readerFor(root);

    const a = buildSearchIndex("dl-nlp", "es", { readSource: reader }).hash;
    const b = buildSearchIndex("dl-nlp", "es", { readSource: reader }).hash;
    expect(a).toBe(b);
    expect(a).toHaveLength(8);

    fs.writeFileSync(
      path.join(root, "dl-nlp", "es", "01-uno.mdx"),
      lessonFile("uno", { body: "Prosa distinta del todo." }),
    );
    __resetRegistry();
    __setContentRoot(root);
    expect(buildSearchIndex("dl-nlp", "es", { readSource: reader }).hash).not.toBe(a);
  });
});

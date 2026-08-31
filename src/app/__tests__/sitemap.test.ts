// COURSE-P6-01 — registry-driven sitemap.
//
// The sitemap reads the content registry, so this points the registry's public API at
// a throwaway fixture tree (one published + one draft lesson, Spanish only) and asserts
// that only published content appears and no `/en/cursos/...` URL is advertised while it
// 404s. URLs are matched by suffix so the assertions do not depend on NEXT_PUBLIC_BASE_URL.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import sitemap from "@/app/sitemap";
import { __setContentRoot, __resetRegistry } from "@/lib/courses/registry";

const MANIFEST = `
slug: dl-nlp
title: "Curso"
tagline: "..."
level: intermedio
prerequisites: []
blocks:
  - id: 1
    title: "Bloque 1"
    summary: "..."
`;

function lessonFile(fm: { slug: string; order: number; draft?: boolean }): string {
  const full = {
    title: `Lección ${fm.slug}`,
    block: 1,
    order: fm.order,
    minutes: 10,
    summary: "...",
    draft: fm.draft ?? false,
    hasCode: false,
    hasQuiz: false,
    quiz: [],
    challenges: [],
    reading: [],
    slug: fm.slug,
  };
  const yaml = Object.entries(full)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join("\n");
  return `---\n${yaml}\n---\n\nCuerpo.\n`;
}

const MANIFEST_EN = MANIFEST.replace('title: "Curso"', 'title: "Course"');

/** Temp content root: one `dl-nlp` course (es) with a published + a draft lesson.
 *  `withEnManifest` adds the sibling `course.en.yml` WITHOUT an `en/` lesson dir — the
 *  COURSE-P6-03 state where the landing is translated but the lessons are not. */
function makeTree(withEnManifest = false): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sitemap-"));
  const esDir = path.join(root, "dl-nlp", "es");
  fs.mkdirSync(esDir, { recursive: true });
  fs.writeFileSync(path.join(root, "dl-nlp", "course.es.yml"), MANIFEST);
  fs.writeFileSync(path.join(esDir, "00-intro.mdx"), lessonFile({ slug: "intro", order: 1 }));
  fs.writeFileSync(
    path.join(esDir, "01-borrador.mdx"),
    lessonFile({ slug: "borrador", order: 2, draft: true }),
  );
  if (withEnManifest) {
    fs.writeFileSync(path.join(root, "dl-nlp", "course.en.yml"), MANIFEST_EN);
  }
  return root;
}

afterEach(() => __resetRegistry());

describe("sitemap course routes", () => {
  it("includes /cursos, the course landing and the published lesson — draft excluded", () => {
    __setContentRoot(makeTree());
    const entries = sitemap();
    const urls = entries.map((e) => e.url);

    expect(urls.some((u) => u.endsWith("/cursos"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/cursos/dl-nlp"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/cursos/dl-nlp/intro"))).toBe(true);

    // The draft lesson never appears.
    expect(urls.some((u) => u.includes("/borrador"))).toBe(false);
  });

  it("advertises no /en course URL while English content is absent", () => {
    __setContentRoot(makeTree());
    const entries = sitemap();

    // No English course URL anywhere (static /en/privacidad etc. are unaffected).
    expect(entries.some((e) => e.url.includes("/en/cursos"))).toBe(false);

    // Each course entry's x-default is the Spanish URL, with no `en` key.
    const landing = entries.find((e) => e.url.endsWith("/cursos/dl-nlp"))!;
    const languages = landing.alternates!.languages as Record<string, string>;
    expect(languages).not.toHaveProperty("en");
    expect(languages["x-default"]).toBe(languages.es);
    expect(languages["x-default"]).toMatch(/\/cursos\/dl-nlp$/);
    expect(languages["x-default"]).not.toContain("/en/");
  });
});

// COURSE-P6-03 — the catalog and the landing are bilingual; the lessons are not.
describe("sitemap with a manifest-translated course", () => {
  it("lists /en/cursos and the English landing, paired by hreflang", () => {
    __setContentRoot(makeTree(true));
    const entries = sitemap();
    const urls = entries.map((e) => e.url);

    expect(urls.some((u) => u.endsWith("/en/cursos"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/en/cursos/dl-nlp"))).toBe(true);

    const landing = entries.find((e) => e.url.endsWith("/en/cursos/dl-nlp"))!;
    const languages = landing.alternates!.languages as Record<string, string>;
    expect(languages.es).toMatch(/\/cursos\/dl-nlp$/);
    expect(languages.en).toMatch(/\/en\/cursos\/dl-nlp$/);
    expect(languages["x-default"]).toBe(languages.en);
  });

  it("still lists NO English lesson URL and no `en` lesson alternate", () => {
    __setContentRoot(makeTree(true));
    const entries = sitemap();

    // The lesson loop is deliberately NOT locale-resolving: /en/cursos/dl-nlp/intro 404s.
    expect(entries.some((e) => e.url.endsWith("/en/cursos/dl-nlp/intro"))).toBe(false);

    const lesson = entries.find((e) => e.url.endsWith("/cursos/dl-nlp/intro"))!;
    const languages = lesson.alternates!.languages as Record<string, string>;
    expect(languages).not.toHaveProperty("en");
    expect(languages["x-default"]).toBe(languages.es);
  });
});

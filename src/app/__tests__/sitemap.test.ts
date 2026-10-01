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
import {
  __resetBlogRegistry,
  __setBlogContentRoot,
} from "@/lib/blog/registry";

const MANIFEST = `
slug: dl-nlp
title: "Curso"
tagline: "..."
level: intermedio
prerequisites:
  intro: "..."
  items: []
cta:
  heading: "..."
  body: "..."
faq: []
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

afterEach(() => {
  __resetRegistry();
  __resetBlogRegistry();
});

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

// BLOG-01 — the blog block of the sitemap, same rules as the course block: published
// only, and a locale is listed only where the content actually exists.
//
// These point the BLOG registry at a fixture and leave the course one on the real tree
// (and vice versa in the describes above). That is safe because every assertion here
// matches by URL suffix rather than counting entries, so the other feature's real
// content cannot make a case pass or fail.

function blogFile(fm: { slug: string; date: string; draft?: boolean }): string {
  const full = {
    slug:    fm.slug,
    title:   `Artículo ${fm.slug}`,
    date:    fm.date,
    minutes: 5,
    summary: "Resumen.",
    draft:   fm.draft ?? false,
    reading: [] as unknown[],
    tags:    [] as string[],
    aiImages: false,
  };
  const yaml = Object.entries(full)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join("\n");
  return `---\n${yaml}\n---\n\nCuerpo.\n`;
}

/** Temp blog root: one published + one draft Spanish post. `bilingual` adds the English
 *  sibling of the published one — the state where a post exists in both locales. */
function makeBlogTree(bilingual = false): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sitemap-blog-"));
  const esDir = path.join(root, "es");
  fs.mkdirSync(esDir, { recursive: true });
  fs.writeFileSync(path.join(esDir, "hola.mdx"), blogFile({ slug: "hola", date: "2026-01-10" }));
  fs.writeFileSync(
    path.join(esDir, "borrador.mdx"),
    blogFile({ slug: "borrador", date: "2026-02-01", draft: true }),
  );
  if (bilingual) {
    const enDir = path.join(root, "en");
    fs.mkdirSync(enDir, { recursive: true });
    fs.writeFileSync(path.join(enDir, "hola.mdx"), blogFile({ slug: "hola", date: "2026-01-10" }));
  }
  return root;
}

describe("sitemap blog routes", () => {
  it("includes /blog and the published post — draft excluded", () => {
    __setBlogContentRoot(makeBlogTree());
    const urls = sitemap().map((e) => e.url);

    expect(urls.some((u) => u.endsWith("/blog"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/blog/hola"))).toBe(true);

    expect(urls.some((u) => u.includes("/blog/borrador"))).toBe(false);
  });

  it("advertises no /en blog URL while English content is absent", () => {
    __setBlogContentRoot(makeBlogTree());
    const entries = sitemap();

    expect(entries.some((e) => e.url.includes("/en/blog"))).toBe(false);

    const post = entries.find((e) => e.url.endsWith("/blog/hola"))!;
    const languages = post.alternates!.languages as Record<string, string>;
    expect(languages).not.toHaveProperty("en");
    expect(languages["x-default"]).toBe(languages.es);
    expect(languages["x-default"]).not.toContain("/en/");
  });

  it("lists both locales, paired by hreflang, once the post is translated", () => {
    __setBlogContentRoot(makeBlogTree(true));
    const entries = sitemap();
    const urls = entries.map((e) => e.url);

    expect(urls.some((u) => u.endsWith("/en/blog"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/en/blog/hola"))).toBe(true);

    const post = entries.find((e) => e.url.endsWith("/en/blog/hola"))!;
    const languages = post.alternates!.languages as Record<string, string>;
    expect(languages.es).toMatch(/\/blog\/hola$/);
    expect(languages.en).toMatch(/\/en\/blog\/hola$/);
    // SEO-05: x-default is English whenever English exists.
    expect(languages["x-default"]).toBe(languages.en);
  });

  it("stamps lastModified from the post's own date", () => {
    __setBlogContentRoot(makeBlogTree());
    const post = sitemap().find((e) => e.url.endsWith("/blog/hola"))!;

    expect(post.lastModified).toBe("2026-01-10");
  });
});

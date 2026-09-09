// BLOG-01 — the blog content registry.
//
// The registry is the only thing standing between a typo in frontmatter and a page that
// 404s or renders wrong, so the tests are about its refusals as much as its selectors.
// Each case builds a throwaway content tree and points the public API at it with
// `__setBlogContentRoot`, the same fixture technique src/app/__tests__/sitemap.test.ts uses.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  __resetBlogRegistry,
  __setBlogContentRoot,
  buildRegistry,
  getPost,
  listPosts,
  postNeighbours,
  validateAllBlogContent,
} from "@/lib/blog/registry";

interface Frontmatter {
  slug: string;
  date: string;
  draft?: boolean;
  minutes?: number;
  tags?: string[];
  updated?: string;
}

function postFile(fm: Frontmatter): string {
  const full = {
    slug:    fm.slug,
    title:   `Artículo ${fm.slug}`,
    date:    fm.date,
    ...(fm.updated ? { updated: fm.updated } : null),
    minutes: fm.minutes ?? 5,
    summary: "Resumen.",
    draft:   fm.draft ?? false,
    tags:    fm.tags ?? [],
  };
  const yaml = Object.entries(full)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join("\n");
  return `---\n${yaml}\n---\n\nCuerpo.\n`;
}

/** Temp content root. Each entry is `[locale, filename, frontmatter]` so a test can
 *  write a file whose NAME disagrees with its slug — the orphan case. */
function makeTree(files: Array<[string, string, Frontmatter]>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "blog-registry-"));
  for (const [locale, filename, fm] of files) {
    const dir = path.join(root, locale);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, filename), postFile(fm));
  }
  return root;
}

/** The common shape: three Spanish posts, one of them a draft. */
function makeStandardTree(): string {
  return makeTree([
    ["es", "primero.mdx", { slug: "primero", date: "2026-01-10" }],
    ["es", "segundo.mdx", { slug: "segundo", date: "2026-03-04" }],
    ["es", "borrador.mdx", { slug: "borrador", date: "2026-05-01", draft: true }],
  ]);
}

afterEach(() => __resetBlogRegistry());

describe("listPosts", () => {
  it("returns published posts newest first and excludes drafts", () => {
    __setBlogContentRoot(makeStandardTree());

    expect(listPosts("es").map((p) => p.slug)).toEqual(["segundo", "primero"]);
  });

  it("returns [] for a locale with no directory at all", () => {
    __setBlogContentRoot(makeStandardTree());

    // A locale with no content is NORMAL (English, before the first translation).
    expect(listPosts("en")).toEqual([]);
  });

  it("orders same-day posts by slug, so the list is stable across builds", () => {
    __setBlogContentRoot(
      makeTree([
        ["es", "bravo.mdx", { slug: "bravo", date: "2026-02-02" }],
        ["es", "alfa.mdx", { slug: "alfa", date: "2026-02-02" }],
      ]),
    );

    expect(listPosts("es").map((p) => p.slug)).toEqual(["alfa", "bravo"]);
  });

  it("ignores `_`-prefixed files, so a template never has to be publishable", () => {
    const root = makeStandardTree();
    fs.writeFileSync(path.join(root, "es", "_template.mdx"), "---\nnot: valid\n---\n");
    __setBlogContentRoot(root);

    expect(listPosts("es").map((p) => p.slug)).toEqual(["segundo", "primero"]);
  });
});

describe("getPost", () => {
  it("returns a draft when asked by slug — the route decides, not the lookup", () => {
    __setBlogContentRoot(makeStandardTree());

    expect(getPost("borrador", "es")?.draft).toBe(true);
    expect(getPost("no-existe", "es")).toBeNull();
  });
});

describe("postNeighbours", () => {
  it("walks the published list, and is null at either end", () => {
    __setBlogContentRoot(makeStandardTree());

    // Published order is [segundo, primero]: newest first.
    expect(postNeighbours("segundo", "es")).toEqual({
      newer: null,
      older: { slug: "primero", title: "Artículo primero" },
    });
    expect(postNeighbours("primero", "es")).toEqual({
      newer: { slug: "segundo", title: "Artículo segundo" },
      older: null,
    });
  });

  it("returns nulls for a draft, because a draft is not in the published list", () => {
    __setBlogContentRoot(makeStandardTree());

    expect(postNeighbours("borrador", "es")).toEqual({ newer: null, older: null });
  });
});

describe("buildRegistry validation", () => {
  it("rejects a filename whose stem does not match the frontmatter slug", () => {
    // The orphan case: a renamed file whose slug was never updated. Without this the
    // post would simply 404 at the URL its frontmatter advertises.
    const root = makeTree([["es", "nombre-viejo.mdx", { slug: "slug-nuevo", date: "2026-01-01" }]]);

    expect(() => buildRegistry(root, "es")).toThrow(/does not match filename stem "nombre-viejo"/);
  });

  it("rejects an unknown frontmatter key, so a typo is not silently ignored", () => {
    // `minutos` instead of `minutes`. `PostFrontmatterSchema` is a strictObject precisely
    // so this fails the build rather than shipping a post with a default reading time.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "blog-registry-"));
    fs.mkdirSync(path.join(root, "es"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "es", "post.mdx"),
      [
        "---",
        'slug: "post"',
        'title: "Artículo"',
        'date: "2026-01-01"',
        "minutos: 5",
        'summary: "Resumen."',
        "draft: false",
        "tags: []",
        "---",
        "",
        "Cuerpo.",
        "",
      ].join("\n"),
    );

    expect(() => buildRegistry(root, "es")).toThrow(/invalid frontmatter/);
  });

  it("rejects a date that is not a real calendar day", () => {
    const root = makeTree([["es", "post.mdx", { slug: "post", date: "2026-02-31" }]]);

    expect(() => buildRegistry(root, "es")).toThrow(/is not a real calendar date/);
  });

  it("names the offending file in the error", () => {
    const root = makeTree([["es", "post.mdx", { slug: "post", date: "01-01-2026" }]]);

    expect(() => buildRegistry(root, "es")).toThrow(/es[/\\]post\.mdx/);
  });

  it("treats a missing content root as empty rather than throwing", () => {
    expect(buildRegistry(path.join(os.tmpdir(), "blog-registry-does-not-exist"), "es").size).toBe(0);
  });
});

describe("validateAllBlogContent", () => {
  it("walks every locale directory present, not just the default one", () => {
    const root = makeTree([
      ["es", "post.mdx", { slug: "post", date: "2026-01-01" }],
      ["en", "otro.mdx", { slug: "distinto", date: "2026-01-01" }],
    ]);

    expect(() => validateAllBlogContent(root)).toThrow(/en[/\\]otro\.mdx/);
  });

  it("passes on the real content tree", () => {
    // Guards the shipped posts: this is what `pnpm lint:content` runs in CI.
    expect(() => validateAllBlogContent()).not.toThrow();
  });
});

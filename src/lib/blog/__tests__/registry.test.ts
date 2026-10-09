// BLOG-01 — the blog content registry.
//
// The registry is the only thing standing between a typo in frontmatter and a page that
// 404s or renders wrong, so the tests are about its refusals as much as its selectors.
// Each case builds a throwaway content tree and points the public API at it with
// `__setBlogContentRoot`, the same fixture technique src/app/__tests__/sitemap.test.ts uses.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { READING_MAX_POST } from "@/lib/schemas";
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
  /** BLOG-13. `null` omits the key; default `["ia"]`. */
  areas?: string[] | null;
  cover?: string;
  updated?: string;
  reading?: unknown[];
  /** `null` omits the key, for the BLOG-AI-NOTE-01 "required" case. */
  aiImages?: boolean | null;
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
    reading: fm.reading ?? [],
    ...(fm.areas === null ? null : { areas: fm.areas ?? ["ia"] }),
    ...(fm.cover ? { cover: fm.cover } : null),
    tags:    fm.tags ?? [],
    ...(fm.aiImages === null ? null : { aiImages: fm.aiImages ?? false }),
  };
  const yaml = Object.entries(full)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join("\n");
  return `---\n${yaml}\n---\n\nCuerpo.\n`;
}

/** One well-formed `reading` entry, spread by the BLOG-02 cases below. */
const READING_ENTRY = {
  kind:    "paper",
  title:   "Neural Machine Translation of Rare Words with Subword Units",
  authors: "Sennrich, Haddow y Birch",
  year:    "2016",
  venue:   "arXiv:1508.07909",
  lang:    "en",
  url:     "https://arxiv.org/abs/1508.07909",
  note:    "El artículo que saca BPE de la compresión y lo pone a tokenizar.",
};

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
        "reading: []",
        'areas: ["ia"]',
        "tags: []",
        "aiImages: false",
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

  // BLOG-AI-NOTE-01 — `aiImages` picks the wording of the AI-use note, so every post
  // has to state it: an omitted key fails the build instead of defaulting either way.
  it("carries aiImages through to the post", () => {
    const root = makeTree([["es", "post.mdx", { slug: "post", date: "2026-01-01", aiImages: true }]]);

    expect(buildRegistry(root, "es").get("post")?.aiImages).toBe(true);
  });

  it("rejects a post that does not declare aiImages", () => {
    const root = makeTree([["es", "post.mdx", { slug: "post", date: "2026-01-01", aiImages: null }]]);

    expect(() => buildRegistry(root, "es")).toThrow(/aiImages/);
  });

  // BLOG-02 — `reading`, the post's bibliography. Validated here rather than at render
  // time: `PostReading` receives whatever the frontmatter said, so a malformed entry
  // has to fail the build, not ship a card with an empty author line.
  it("carries a valid reading entry through to the post", () => {
    const root = makeTree([
      ["es", "post.mdx", { slug: "post", date: "2026-01-01", reading: [READING_ENTRY] }],
    ]);

    const post = buildRegistry(root, "es").get("post");
    expect(post?.reading).toHaveLength(1);
    expect(post?.reading[0]).toMatchObject({ kind: "paper", lang: "en" });
  });

  it("rejects a reading url that is not https, which would be mixed content", () => {
    const root = makeTree([
      [
        "es",
        "post.mdx",
        {
          slug:    "post",
          date:    "2026-01-01",
          reading: [{ ...READING_ENTRY, url: "http://arxiv.org/abs/1508.07909" }],
        },
      ],
    ]);

    expect(() => buildRegistry(root, "es")).toThrow(/url must start with https/);
  });

  it("rejects more reading entries than the post cap allows", () => {
    const tooMany = Array.from({ length: READING_MAX_POST + 1 }, (_, i) => ({
      ...READING_ENTRY,
      url: `https://example.com/${i}`,
    }));
    const root = makeTree([
      ["es", "post.mdx", { slug: "post", date: "2026-01-01", reading: tooMany }],
    ]);

    expect(() => buildRegistry(root, "es")).toThrow(/invalid frontmatter/);
  });
});

// BLOG-13 — areas, closed-list topics and covers feed the index and pane filters.
describe("buildRegistry taxonomy (BLOG-13)", () => {
  it("carries areas, tags and cover through to the post", () => {
    const root = makeTree([
      [
        "es",
        "post.mdx",
        {
          slug:  "post",
          date:  "2026-01-01",
          areas: ["bases-de-datos", "ia"],
          tags:  ["indices", "embeddings"],
          cover: "/blog/post/figura.svg",
        },
      ],
    ]);

    expect(buildRegistry(root, "es").get("post")).toMatchObject({
      areas: ["bases-de-datos", "ia"],
      tags:  ["indices", "embeddings"],
      cover: "/blog/post/figura.svg",
    });
  });

  it("rejects a published post without areas, so it would sit under no filter", () => {
    const root = makeTree([["es", "post.mdx", { slug: "post", date: "2026-01-01", areas: [] }]]);

    expect(() => buildRegistry(root, "es")).toThrow(/areas: a published post needs at least one area/);
  });

  it("lets a draft leave its areas empty", () => {
    const root = makeTree([
      ["es", "post.mdx", { slug: "post", date: "2026-01-01", draft: true, areas: [] }],
    ]);

    expect(buildRegistry(root, "es").get("post")?.areas).toEqual([]);
  });

  it("rejects a post that does not declare areas at all", () => {
    const root = makeTree([["es", "post.mdx", { slug: "post", date: "2026-01-01", areas: null }]]);

    expect(() => buildRegistry(root, "es")).toThrow(/areas/);
  });

  it("rejects an unknown area, a third area and a repeated one", () => {
    const unknown = makeTree([["es", "post.mdx", { slug: "post", date: "2026-01-01", areas: ["fisica"] }]]);
    const three = makeTree([
      ["es", "post.mdx", { slug: "post", date: "2026-01-01", areas: ["ia", "matematicas", "programacion"] }],
    ]);
    const twice = makeTree([["es", "post.mdx", { slug: "post", date: "2026-01-01", areas: ["ia", "ia"] }]]);

    expect(() => buildRegistry(unknown, "es")).toThrow(/invalid frontmatter — areas\.0/);
    expect(() => buildRegistry(three, "es")).toThrow(/invalid frontmatter — areas/);
    expect(() => buildRegistry(twice, "es")).toThrow(/duplicate area "ia"/);
  });

  it("rejects a tag outside the topic list, which would have no label to show", () => {
    const root = makeTree([["es", "post.mdx", { slug: "post", date: "2026-01-01", tags: ["cocina"] }]]);

    expect(() => buildRegistry(root, "es")).toThrow(/invalid frontmatter — tags\.0/);
  });

  it("rejects a cover that is another post's figure", () => {
    const root = makeTree([
      ["es", "post.mdx", { slug: "post", date: "2026-01-01", cover: "/blog/otro/figura.svg" }],
    ]);

    expect(() => buildRegistry(root, "es")).toThrow(/is not one of this post's figures/);
  });

  it("rejects a cover outside /blog/<slug>/", () => {
    const root = makeTree([["es", "post.mdx", { slug: "post", date: "2026-01-01", cover: "/og.png" }]]);

    expect(() => buildRegistry(root, "es")).toThrow(/invalid frontmatter — cover/);
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

  it("rejects a cover that is not under public/ (BLOG-13)", () => {
    const root = makeTree([
      ["es", "post.mdx", { slug: "post", date: "2026-01-01", cover: "/blog/post/figura.svg" }],
    ]);
    const publicRoot = fs.mkdtempSync(path.join(os.tmpdir(), "blog-public-"));

    expect(() => validateAllBlogContent(root, publicRoot)).toThrow(/does not exist under public/);

    fs.mkdirSync(path.join(publicRoot, "blog", "post"), { recursive: true });
    fs.writeFileSync(path.join(publicRoot, "blog", "post", "figura.svg"), "<svg/>");
    expect(() => validateAllBlogContent(root, publicRoot)).not.toThrow();
  });

  it("passes on the real content tree", () => {
    // Guards the shipped posts: this is what `pnpm lint:content` runs in CI.
    expect(() => validateAllBlogContent()).not.toThrow();
  });
});

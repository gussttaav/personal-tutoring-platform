/*
 * COURSE-P1-01 — Guards the MDX plugin-chain ORDER.
 *
 * Math only renders if `remark-math` runs before `rehype-katex`, and highlighting
 * only if `rehype-pretty-code` runs after KaTeX. A dependency bump or careless
 * edit that reorders the chain would break rendering silently at runtime; this
 * test makes it fail loudly at CI instead.
 *
 * The remark/rehype packages are ESM-only and are NOT in jest.config.js's
 * `ESM_PACKAGES` allowlist, so we `jest.mock` each to a string sentinel — the
 * plugin identity is all this test needs, and mocking avoids transpiling ESM.
 *
 * COURSE-C2-P0-05 — + `<RepoLink>`: that it is in the per-lesson component map, and the
 * two href forms (`tag`, `tag + path`) it builds on `LLM_AGENTS_REPO_BASE`. The component
 * is an async Server Component that reads next-intl's request context for its kicker, so
 * `next-intl/server` is replaced the way `leccion.test.ts` replaces it — reading the real
 * message files, so the kicker asserted is the one the reader sees.
 */

jest.mock("remark-gfm", () => ({ __esModule: true, default: "remark-gfm" }));
jest.mock("remark-math", () => ({ __esModule: true, default: "remark-math" }));
jest.mock("rehype-slug", () => ({ __esModule: true, default: "rehype-slug" }));
jest.mock("rehype-katex", () => ({ __esModule: true, default: "rehype-katex" }));
jest.mock("rehype-pretty-code", () => ({ __esModule: true, default: "rehype-pretty-code" }));

jest.mock("next-intl/server", () => {
  const messages: Record<string, Record<string, unknown>> = {
    es: jest.requireActual("../../../../messages/es.json"),
    en: jest.requireActual("../../../../messages/en.json"),
  };
  return {
    getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) => {
      const ns = namespace
        .split(".")
        .reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], messages[locale]);
      return (key: string) => (ns as Record<string, string>)[key];
    },
  };
});

import { renderToStaticMarkup } from "react-dom/server";

import { LLM_AGENTS_REPO_BASE } from "@/constants/courses";
import { SHIKI_THEME } from "@/constants/shiki-theme";

import type { LeccionCtx } from "../Leccion";
import { remarkPlugins, rehypePlugins } from "../mdx";
import { lessonMdxComponents, makeRepoLink, repoLinkHref, type RepoLinkProps } from "../mdx-components";

/** First element of a `[plugin, options]` tuple, or the bare plugin. */
function pluginId(entry: unknown): unknown {
  return Array.isArray(entry) ? entry[0] : entry;
}

describe("courses MDX plugin chain", () => {
  it("runs GFM before math in the remark chain", () => {
    expect(remarkPlugins.map(pluginId)).toEqual(["remark-gfm", "remark-math"]);
  });

  it("runs slug before KaTeX before pretty-code in the rehype chain", () => {
    // rehype-slug (COURSE-P1-04) must run before KaTeX rewrites heading contents,
    // so the heading id derives from its text.
    expect(rehypePlugins.map(pluginId)).toEqual([
      "rehype-slug",
      "rehype-katex",
      "rehype-pretty-code",
    ]);
  });

  it("configures pretty-code with the shared Shiki theme and no forced background", () => {
    // Plugins are string sentinels at runtime (see jest.mock above), though the
    // static type is `Plugin`; compare through `unknown` to satisfy tsc.
    const prettyCode = rehypePlugins.find(
      (entry) => Array.isArray(entry) && (entry[0] as unknown) === "rehype-pretty-code",
    ) as unknown as [unknown, Record<string, unknown>];

    expect(prettyCode).toBeDefined();
    expect(prettyCode[1]).toMatchObject({ theme: SHIKI_THEME, keepBackground: false });
  });
});

/* ── COURSE-C2-P0-05 — `<RepoLink>` ───────────────────────────────────────── */

const ctx: LeccionCtx = {
  courseSlug: "llm-agents",
  locale: "es",
  contentLocale: "es",
  current: { block: 5, order: 3 },
};

async function renderRepoLink(props: RepoLinkProps, locale = "es"): Promise<string> {
  const RepoLink = makeRepoLink(locale);
  return renderToStaticMarkup(await RepoLink(props));
}

describe("RepoLink", () => {
  it("is bound into the per-lesson component map, from the lesson's ctx", () => {
    expect(lessonMdxComponents([], [], ctx).RepoLink).toBeDefined();
    // Like `Leccion`: without a ctx there is no locale for the kicker, so the map has no
    // `RepoLink` and MDX reports the missing component instead of guessing a language.
    expect(lessonMdxComponents([], [])).not.toHaveProperty("RepoLink");
  });

  it("builds the href from the one constant, on /tree/<tag>", () => {
    expect(repoLinkHref("b5-l3")).toBe(`${LLM_AGENTS_REPO_BASE}/tree/b5-l3`);
    expect(LLM_AGENTS_REPO_BASE).toMatch(/^https:\/\/[^/]+\/[^/]+\/[^/]+$/);
  });

  it("appends a path inside the tag", () => {
    expect(repoLinkHref("b5-l3", "herramientas/editar.py")).toBe(
      `${LLM_AGENTS_REPO_BASE}/tree/b5-l3/herramientas/editar.py`,
    );
  });

  it("renders a link out of the course: new tab, no opener, the given label", async () => {
    const html = await renderRepoLink({ tag: "b5-l3", children: "parte de aquí" });
    expect(html).toContain(`href="${LLM_AGENTS_REPO_BASE}/tree/b5-l3"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("parte de aquí");
  });

  it("renders the path form with the tag and path standing in for a missing label", async () => {
    const html = await renderRepoLink({ tag: "b5-l3", path: "herramientas/editar.py" });
    expect(html).toContain(`href="${LLM_AGENTS_REPO_BASE}/tree/b5-l3/herramientas/editar.py"`);
    expect(html).toContain("b5-l3 · herramientas/editar.py");
  });

  it("carries the «checkpoint» kicker in the request locale", async () => {
    expect(await renderRepoLink({ tag: "b5-l1" }, "es")).toContain("Punto de control");
    expect(await renderRepoLink({ tag: "b5-l1" }, "en")).toContain("Checkpoint");
  });
});

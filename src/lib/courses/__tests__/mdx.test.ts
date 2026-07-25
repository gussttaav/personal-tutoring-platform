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
 */

jest.mock("remark-gfm", () => ({ __esModule: true, default: "remark-gfm" }));
jest.mock("remark-math", () => ({ __esModule: true, default: "remark-math" }));
jest.mock("rehype-katex", () => ({ __esModule: true, default: "rehype-katex" }));
jest.mock("rehype-pretty-code", () => ({ __esModule: true, default: "rehype-pretty-code" }));

import { remarkPlugins, rehypePlugins } from "../mdx";
import { SHIKI_THEME } from "@/constants/shiki-theme";

/** First element of a `[plugin, options]` tuple, or the bare plugin. */
function pluginId(entry: unknown): unknown {
  return Array.isArray(entry) ? entry[0] : entry;
}

describe("courses MDX plugin chain", () => {
  it("runs GFM before math in the remark chain", () => {
    expect(remarkPlugins.map(pluginId)).toEqual(["remark-gfm", "remark-math"]);
  });

  it("runs KaTeX before pretty-code in the rehype chain", () => {
    expect(rehypePlugins.map(pluginId)).toEqual(["rehype-katex", "rehype-pretty-code"]);
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

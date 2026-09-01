/*
 * COURSE-P1-04 — Unit tests for the on-this-page heading extractor.
 */

import { extractHeadings } from "../headings";

describe("extractHeadings", () => {
  it("returns an empty outline for prose with no headings", () => {
    expect(extractHeadings("Just a paragraph.\n\nAnd another.")).toEqual([]);
  });

  it("collects h2 and h3 in document order with slugged ids", () => {
    const src = [
      "# Lesson title",           // h1 — excluded (it's the chrome title)
      "",
      "## First Section",
      "text",
      "### A Subsection",
      "#### Too deep",            // h4 — excluded
      "",
      "## Second Section",
    ].join("\n");

    expect(extractHeadings(src)).toEqual([
      { depth: 2, text: "First Section", id: "first-section" },
      { depth: 3, text: "A Subsection", id: "a-subsection" },
      { depth: 2, text: "Second Section", id: "second-section" },
    ]);
  });

  it("de-duplicates colliding slugs the way github-slugger / rehype-slug do", () => {
    const src = "## Setup\n\n## Setup\n\n## Setup";
    expect(extractHeadings(src).map((h) => h.id)).toEqual([
      "setup",
      "setup-1",
      "setup-2",
    ]);
  });

  it("ignores '#' lines inside fenced code blocks", () => {
    const src = [
      "## Real Heading",
      "",
      "```python",
      "# this is a python comment, not a heading",
      "## also not a heading",
      "```",
      "",
      "### After Code",
    ].join("\n");

    expect(extractHeadings(src)).toEqual([
      { depth: 2, text: "Real Heading", id: "real-heading" },
      { depth: 3, text: "After Code", id: "after-code" },
    ]);
  });

  it("strips inline markdown from the outline label but keeps a clean slug", () => {
    const src = "## The **bold** and `code` and [a link](/x)";
    expect(extractHeadings(src)).toEqual([
      { depth: 2, text: "The bold and code and a link", id: "the-bold-and-code-and-a-link" },
    ]);
  });
});

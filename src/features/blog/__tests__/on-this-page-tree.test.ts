/*
 * BLOG — tests for the collapsible "On this page" rail's pure shaping logic.
 */

import type { HeadingOutline } from "@/lib/courses/headings";
import { groupHeadings, activeGroupIndex } from "../on-this-page-tree";

const h2 = (id: string): HeadingOutline => ({ depth: 2, text: id, id });
const h3 = (id: string): HeadingOutline => ({ depth: 3, text: id, id });

describe("groupHeadings", () => {
  it("returns one group per h2 with its h3s nested", () => {
    const groups = groupHeadings([h2("a"), h3("a1"), h3("a2"), h2("b"), h3("b1")]);
    expect(groups).toEqual([
      { h2: h2("a"), children: [h3("a1"), h3("a2")] },
      { h2: h2("b"), children: [h3("b1")] },
    ]);
  });

  it("keeps h2s with no subsections as empty groups", () => {
    const groups = groupHeadings([h2("a"), h2("b"), h3("b1")]);
    expect(groups).toEqual([
      { h2: h2("a"), children: [] },
      { h2: h2("b"), children: [h3("b1")] },
    ]);
  });

  it("puts h3s before the first h2 in a leading null group", () => {
    const groups = groupHeadings([h3("x"), h3("y"), h2("a"), h3("a1")]);
    expect(groups).toEqual([
      { h2: null, children: [h3("x"), h3("y")] },
      { h2: h2("a"), children: [h3("a1")] },
    ]);
  });

  it("returns [] for no headings", () => {
    expect(groupHeadings([])).toEqual([]);
  });
});

describe("activeGroupIndex", () => {
  const groups = groupHeadings([h2("a"), h3("a1"), h2("b"), h3("b1"), h3("b2"), h2("c")]);

  it("is -1 when nothing is active", () => {
    expect(activeGroupIndex(groups, null)).toBe(-1);
  });

  it("finds the group whose h2 is active", () => {
    expect(activeGroupIndex(groups, "b")).toBe(1);
  });

  it("finds the group whose h3 is active", () => {
    expect(activeGroupIndex(groups, "b2")).toBe(1);
    expect(activeGroupIndex(groups, "a1")).toBe(0);
  });

  it("is -1 when the active id is not in the outline", () => {
    expect(activeGroupIndex(groups, "ghost")).toBe(-1);
  });
});

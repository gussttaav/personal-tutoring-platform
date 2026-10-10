/*
 * BLOG-15 — the one rule deciding which blog subscribers hear about a post, and how a
 * reader's area selection is stored.
 */

import {
  expandBlogAreas,
  normalizeBlogAreas,
  sameBlogAreas,
  subscriptionMatchesPost,
} from "../subscription-areas";

describe("normalizeBlogAreas", () => {
  it("keeps a subset, ordered as BLOG_AREAS and without duplicates", () => {
    expect(normalizeBlogAreas(["programacion", "ia", "ia"])).toEqual(["ia", "programacion"]);
  });

  it("stores every area as null, so a future area is included too", () => {
    expect(normalizeBlogAreas(["programacion", "matematicas", "bases-de-datos", "ia"])).toBeNull();
  });

  it("treats a missing selection as every area", () => {
    expect(normalizeBlogAreas(undefined)).toBeNull();
    expect(normalizeBlogAreas(null)).toBeNull();
  });
});

describe("expandBlogAreas", () => {
  it("expands null to every area, in display order", () => {
    expect(expandBlogAreas(null)).toEqual(["ia", "bases-de-datos", "matematicas", "programacion"]);
  });

  it("returns an explicit selection in display order", () => {
    expect(expandBlogAreas(["matematicas", "ia"])).toEqual(["ia", "matematicas"]);
  });
});

describe("sameBlogAreas", () => {
  it("ignores order", () => {
    expect(sameBlogAreas(["matematicas", "ia"], ["ia", "matematicas"])).toBe(true);
  });

  it("treats null (every area) as the full list", () => {
    expect(sameBlogAreas(null, ["programacion", "matematicas", "bases-de-datos", "ia"])).toBe(true);
  });

  it("tells a different selection apart", () => {
    expect(sameBlogAreas(["ia"], ["ia", "matematicas"])).toBe(false);
    expect(sameBlogAreas(null, ["ia"])).toBe(false);
  });
});

describe("subscriptionMatchesPost", () => {
  it("reaches a subscriber of every area whatever the post's areas", () => {
    expect(subscriptionMatchesPost(null, ["bases-de-datos"])).toBe(true);
  });

  it("reaches a subscriber sharing at least one area", () => {
    expect(subscriptionMatchesPost(["ia"], ["bases-de-datos", "ia"])).toBe(true);
  });

  it("skips a subscriber with no area in common", () => {
    expect(subscriptionMatchesPost(["ia", "matematicas"], ["bases-de-datos", "programacion"])).toBe(false);
  });

  it("reaches everyone with a post that names no area", () => {
    expect(subscriptionMatchesPost(["matematicas"], [])).toBe(true);
  });
});

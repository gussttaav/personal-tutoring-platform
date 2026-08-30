// COURSE-P9-01 — Active-option movement.

import { isNavigationKey, nextActiveIndex } from "@/features/courses/search/keyboard";

describe("isNavigationKey", () => {
  it("recognises only the four movement keys", () => {
    expect(isNavigationKey("ArrowDown")).toBe(true);
    expect(isNavigationKey("End")).toBe(true);
    expect(isNavigationKey("Enter")).toBe(false);
    expect(isNavigationKey("a")).toBe(false);
  });
});

describe("nextActiveIndex", () => {
  it("moves down and up", () => {
    expect(nextActiveIndex(0, 5, "ArrowDown")).toBe(1);
    expect(nextActiveIndex(3, 5, "ArrowUp")).toBe(2);
  });

  it("wraps at both ends", () => {
    expect(nextActiveIndex(4, 5, "ArrowDown")).toBe(0);
    expect(nextActiveIndex(0, 5, "ArrowUp")).toBe(4);
  });

  it("jumps with Home and End", () => {
    expect(nextActiveIndex(3, 5, "Home")).toBe(0);
    expect(nextActiveIndex(1, 5, "End")).toBe(4);
  });

  it("returns -1 when there is nothing to select", () => {
    for (const key of ["ArrowDown", "ArrowUp", "Home", "End"] as const) {
      expect(nextActiveIndex(0, 0, key)).toBe(-1);
    }
  });

  it("moves down from an unset (-1) selection to the first option", () => {
    expect(nextActiveIndex(-1, 3, "ArrowDown")).toBe(0);
    expect(nextActiveIndex(-1, 3, "ArrowUp")).toBe(2);
  });
});

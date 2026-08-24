/*
 * COURSE-P2-02 — Tests the pure snapshot behind useReducedMotion by stubbing
 * `window.matchMedia` (the unit project runs in Node, so there is no window by
 * default — which is itself the SSR case we assert first).
 */

import { reducedMotionSnapshot } from "../useReducedMotion";

describe("reducedMotionSnapshot", () => {
  const original = (globalThis as { window?: unknown }).window;

  afterEach(() => {
    if (original === undefined) delete (globalThis as { window?: unknown }).window;
    else (globalThis as { window?: unknown }).window = original;
  });

  const stubMatchMedia = (matches: boolean | undefined) => {
    (globalThis as { window?: unknown }).window =
      matches === undefined ? {} : { matchMedia: () => ({ matches }) };
  };

  it("is false when there is no window (SSR / Node)", () => {
    delete (globalThis as { window?: unknown }).window;
    expect(reducedMotionSnapshot()).toBe(false);
  });

  it("is false when matchMedia is unavailable", () => {
    stubMatchMedia(undefined);
    expect(reducedMotionSnapshot()).toBe(false);
  });

  it("reflects the media query when reduce is requested", () => {
    stubMatchMedia(true);
    expect(reducedMotionSnapshot()).toBe(true);
  });

  it("reflects the media query when motion is allowed", () => {
    stubMatchMedia(false);
    expect(reducedMotionSnapshot()).toBe(false);
  });
});

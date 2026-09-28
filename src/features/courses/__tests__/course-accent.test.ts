/*
 * COURSE-ACCENT-01 — the per-course accent palette.
 *
 * The one behaviour worth pinning: ABSENT must stay a first-class case. If this ever returns
 * an object for `undefined`, every accent-less course silently starts overriding the card's
 * `--green` fallbacks with whatever the default happened to be.
 */

import { courseAccentVars } from "../course-accent";

describe("courseAccentVars", () => {
  it("returns nothing for a course that declares no accent", () => {
    expect(courseAccentVars(undefined)).toBeUndefined();
  });

  it("emits the four custom properties the stylesheet reads", () => {
    expect(courseAccentVars("cyan")).toEqual({
      "--course-accent":      "#4ec8de",
      "--course-accent-dim":  "rgba(78, 200, 222, 0.12)",
      "--course-accent-mid":  "rgba(78, 200, 222, 0.25)",
      "--course-accent-glow": "rgba(78, 200, 222, 0.38)",
    });
  });

  it("keeps `emerald` identical to the site's own --green tokens", () => {
    // --green #4edea3, --green-dim 0.12, --green-mid 0.25 (src/app/globals.css). An emerald
    // course must render byte-identically to one with no accent at all.
    expect(courseAccentVars("emerald")).toMatchObject({
      "--course-accent":     "#4edea3",
      "--course-accent-dim": "rgba(78, 222, 163, 0.12)",
      "--course-accent-mid": "rgba(78, 222, 163, 0.25)",
    });
  });
});

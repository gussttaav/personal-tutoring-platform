/*
 * COURSE-ACCENT-01 — per-course accent palette.
 *
 * The catalog shipped every course in the site's one emerald: the level badge, the title's
 * after-the-colon tail, the CTA, the progress bar and the hover bloom were identical hue to
 * hue, so two cards side by side were told apart only by their prose — the slowest channel
 * the eye has. The manifest's `accent` picks a hue per course instead.
 *
 * Same contract as `heroMotif` (see `CourseHeroMotif` in src/domain/types.ts): an optional,
 * manifest-selected, Zod-validated key resolved through a `Record` lookup, where ABSENT is a
 * first-class case — `courseAccentVars(undefined)` returns undefined, the card sets no custom
 * properties, and `catalog.css` falls back to `--green`/`--green-dim`/`--green-mid`. A course
 * with no `accent` therefore renders byte-identically to what shipped before this change.
 *
 * One rgb triple per hue, the three tints derived from it, so adding a course's hue is one
 * line here plus one in the schema enum and `CourseAccent`. The tint stops match the site's
 * own emerald tokens exactly (--green-dim 0.12, --green-mid 0.25) so "emerald" is a no-op.
 *
 * SCOPE: the catalog card only. The course LANDING and the lesson reader still paint in
 * `--green` throughout (~90 call sites), and tinting only part of that page would make it
 * inconsistent with itself — a deliberately separate decision, not an oversight.
 *
 * Contrast: every hue below clears 8.8:1 against `--surface-low` (#1c1b1d), the card's
 * surface, so accented text stays well past WCAG AA at the card's type sizes.
 */

import type { CSSProperties } from "react";
import type { CourseAccent } from "@/domain/types";

/** Base hex plus its "r, g, b" triple — the tints below are derived from the triple. */
const PALETTE: Record<CourseAccent, { base: string; rgb: string }> = {
  // The site's own --green. The flagship course keeps the brand hue.
  emerald: { base: "#4edea3", rgb: "78, 222, 163" },
  // The conservative sibling: same family, ~35° of hue away, matched chroma and lightness.
  cyan:    { base: "#4ec8de", rgb: "78, 200, 222" },
  // Separates hardest, but reads warm against the site's cool palette — use deliberately.
  amber:   { base: "#e8b04b", rgb: "232, 176, 75" },
};

/**
 * The custom properties a card sets on itself for `accent`, or `undefined` when the course
 * declares none (the caller then sets no inline style at all and the stylesheet's `--green`
 * fallbacks apply).
 */
export function courseAccentVars(accent?: CourseAccent): CSSProperties | undefined {
  if (!accent) return undefined;

  const { base, rgb } = PALETTE[accent];
  // Custom properties are not part of React's CSSProperties, hence the cast.
  return {
    "--course-accent":      base,
    "--course-accent-dim":  `rgba(${rgb}, 0.12)`,
    "--course-accent-mid":  `rgba(${rgb}, 0.25)`,
    "--course-accent-glow": `rgba(${rgb}, 0.38)`,
  } as CSSProperties;
}

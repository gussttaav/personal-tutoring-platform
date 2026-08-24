/*
 * COURSE-P1-01 — Shiki syntax-highlighting theme for course lessons.
 *
 * Single source of truth for the code-block theme used by `rehype-pretty-code`
 * (see src/lib/courses/mdx.ts). Dark-only — the site is dark-only. Kept next to
 * the design tokens in constants/index.ts so a future theme change is one edit.
 *
 * A bundled Shiki theme name (highlighting runs at BUILD time, so this pulls no
 * client JS). "github-dark-default" is neutral and high-contrast, pairing
 * cleanly with the Emerald Nocturne brand without competing for attention.
 */

export const SHIKI_THEME = "github-dark-default" as const;

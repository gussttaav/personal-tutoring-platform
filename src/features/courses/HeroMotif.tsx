/*
 * COURSE landing-refinements — decorative course motif.
 *
 * Purely presentational SVG selected per course by the manifest's `heroMotif` field (see
 * CourseHeroMotif in src/domain/types.ts). `attention-matrix` evokes a self-attention heatmap —
 * apt for an NLP/Transformer course; a future course picks its own key or omits the field
 * entirely. `aria-hidden`: it carries no meaning. An absent or unknown key renders nothing, so a
 * motif-less course costs zero.
 *
 * Shared: the landing hero renders it large and faint behind the title; the catalog card bleeds
 * it off the top-right corner (and animates its opacity on hover). `size`/`opacity` parameterize
 * those two uses — the caller still positions it. Lives in `features/courses/` (not `landing/`)
 * because both surfaces import it.
 *
 * COURSE-C2-P0-01: `agent-loop`, the second course's motif. Every motif is a list of tiles on
 * the same 8×8 grid (same cell and pitch), so the two read as one family at 232 px in
 * the catalog and at 360 px behind a title; only the tile layout differs. This one is the
 * agent loop: a ring of tiles whose opacity ramps clockwise — the loop in motion, head just
 * short of the top-left corner — around a 2×2 core whose diagonal is brighter (the model at
 * the centre, a nod to the attention matrix it grew from), inside a faint outer frame.
 *
 * COURSE-ACCENT-01: the tiles are filled from `--course-accent` with the site's `--green` as
 * the fallback, set as a CSS property on the <svg> and INHERITED by the rects (the `fill`
 * presentation attribute does not accept `var()`, the property does). A caller that sets no
 * such custom property — the landing hero — is unchanged; the catalog card sets it per course.
 */

import type { CourseHeroMotif } from "@/domain/types";

/** One tile on the 8×8 grid: row/col in cells, fill opacity 0–1. */
interface Tile {
  row: number;
  col: number;
  opacity: number;
}

// An 8×8 self-attention-style matrix: a strong diagonal with soft off-diagonal decay.
// Values are fixed (not random) so the render is deterministic across builds.
const ATTENTION_OPACITIES: readonly (readonly number[])[] = [
  [0.66, 0.07, 0.09, 0.06, 0.09, 0.08, 0.06, 0.09],
  [0.31, 0.70, 0.06, 0.06, 0.08, 0.10, 0.07, 0.07],
  [0.45, 0.62, 0.75, 0.08, 0.11, 0.06, 0.10, 0.07],
  [0.27, 0.30, 0.40, 0.84, 0.07, 0.09, 0.09, 0.08],
  [0.32, 0.25, 0.28, 0.37, 0.79, 0.08, 0.08, 0.09],
  [0.25, 0.26, 0.44, 0.48, 0.38, 0.75, 0.09, 0.10],
  [0.24, 0.22, 0.42, 0.26, 0.39, 0.56, 0.60, 0.08],
  [0.10, 0.23, 0.31, 0.33, 0.46, 0.36, 0.54, 0.76],
];

const ATTENTION_TILES: readonly Tile[] = ATTENTION_OPACITIES.flatMap((line, row) =>
  line.map((opacity, col) => ({ row, col, opacity })),
);

/** The perimeter of the square of side `n` whose top-left cell is (`r0`, `c0`), walked
 *  clockwise from that corner. Pure geometry; the order is what the opacity ramp rides. */
function ringCells(r0: number, c0: number, n: number): { row: number; col: number }[] {
  const last = n - 1;
  const cells: { row: number; col: number }[] = [];
  for (let i = 0; i < last; i++) cells.push({ row: r0,        col: c0 + i    }); // top, →
  for (let i = 0; i < last; i++) cells.push({ row: r0 + i,    col: c0 + last }); // right, ↓
  for (let i = 0; i < last; i++) cells.push({ row: r0 + last, col: c0 + last - i }); // bottom, ←
  for (let i = 0; i < last; i++) cells.push({ row: r0 + last - i, col: c0    }); // left, ↑
  return cells;
}

// The loop: 20 tiles around the inner 6×6 ring, tail → head clockwise from the top-left.
// An eased ramp (not linear) so the tail fades quickly and the head stays bright — reads as
// motion, not as a gradient. Fixed values, same reason as the matrix above.
const LOOP_OPACITIES: readonly number[] = [
  0.08, 0.09, 0.10, 0.12, 0.14, 0.17, 0.20, 0.23, 0.27, 0.31,
  0.35, 0.40, 0.44, 0.49, 0.55, 0.60, 0.66, 0.72, 0.78, 0.84,
];

const AGENT_LOOP_TILES: readonly Tile[] = [
  // Outer frame — faint, the same texture as the matrix's off-diagonal.
  ...ringCells(0, 0, 8).map((c) => ({ ...c, opacity: 0.07 })),
  // The loop itself.
  ...ringCells(1, 1, 6).map((c, k) => ({ ...c, opacity: LOOP_OPACITIES[k] })),
  // The core: a 2×2 with the brighter diagonal.
  { row: 3, col: 3, opacity: 0.84 },
  { row: 3, col: 4, opacity: 0.34 },
  { row: 4, col: 3, opacity: 0.34 },
  { row: 4, col: 4, opacity: 0.84 },
];

const MOTIF_TILES: Record<CourseHeroMotif, readonly Tile[]> = {
  "attention-matrix": ATTENTION_TILES,
  "agent-loop":       AGENT_LOOP_TILES,
};

const CELL = 15;
const GAP = 3;
const PITCH = CELL + GAP;
const SIZE = 8 * CELL + 7 * GAP; // 141

export default function HeroMotif({
  kind,
  size = 360,
  opacity = 1,
}: {
  kind?: CourseHeroMotif;
  /** Rendered width/height in px. Landing hero uses 360; the catalog card ~150. */
  size?: number;
  /** SVG opacity. The landing hero bakes its fade here; the card leaves it 1 and fades via CSS. */
  opacity?: number;
}) {
  const tiles = kind ? MOTIF_TILES[kind] : undefined;
  if (!tiles) return null;

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={size}
      height={size}
      opacity={opacity}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ fill: "var(--course-accent, var(--green))" }}
    >
      {tiles.map((tile) => (
        <rect
          key={`${tile.row}-${tile.col}`}
          x={tile.col * PITCH}
          y={tile.row * PITCH}
          width={CELL}
          height={CELL}
          rx={2.5}
          fillOpacity={tile.opacity}
        />
      ))}
    </svg>
  );
}

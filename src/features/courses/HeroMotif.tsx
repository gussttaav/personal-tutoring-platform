/*
 * COURSE landing-refinements — decorative course motif.
 *
 * Purely presentational SVG selected per course by the manifest's `heroMotif` field (see
 * CourseHeroMotif in src/domain/types.ts). `attention-matrix` evokes a self-attention heatmap —
 * apt for an NLP/Transformer course; a future course picks its own key or omits the field
 * entirely. `aria-hidden`: it carries no meaning. An absent or unknown key renders nothing, so a
 * motif-less course costs zero.
 *
 * Shared: the landing hero renders it large and faint behind the title; the catalog card renders
 * it small in the corner (and animates its opacity on hover). `size`/`opacity` parameterize those
 * two uses — the caller still positions it. Lives in `features/courses/` (not `landing/`) because
 * both surfaces import it.
 */

import type { CourseHeroMotif } from "@/domain/types";

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
  if (kind !== "attention-matrix") return null;

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={size}
      height={size}
      opacity={opacity}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {ATTENTION_OPACITIES.flatMap((row, i) =>
        row.map((opacity, j) => (
          <rect
            key={`${i}-${j}`}
            x={j * PITCH}
            y={i * PITCH}
            width={CELL}
            height={CELL}
            rx={2.5}
            fill="#4edea3"
            fillOpacity={opacity}
          />
        )),
      )}
    </svg>
  );
}

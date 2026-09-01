/*
 * COURSE-P2-02 — Hand-rolled SVG heatmap for 2D scalar fields (loss surfaces).
 *
 * The `Plot2D` sibling draws curves; this draws a filled field: one <rect> per grid
 * cell, shaded dark→emerald by value, with optional iso-contours and a data-space
 * overlay (the optimiser's path/points) so callers plot on the SAME scales. Same
 * philosophy as Plot2D — d3-scale for the axes, plain SVG we control, no chart
 * library, and identical markup on server and client for stable hydration.
 *
 * The fill is a computed HSL ramp (a continuous field can't come from the discrete
 * CSS tokens), kept inside the app's emerald hue so it sits with the rest of the UI.
 * Deferred from P2-01, built here because the optimisation widgets are its first use.
 */

"use client";

import { scaleLinear, type ScaleLinear } from "d3-scale";
import type { ReactNode } from "react";

import { contourSegments, type FieldGrid } from "../math/contour";

export interface HeatmapProps {
  field: FieldGrid;
  xDomain: [number, number];
  yDomain: [number, number];
  /** Iso-levels to outline over the field. */
  levels?: number[];
  width?: number;
  height?: number;
  ariaLabel?: string;
  /** Draw extra marks (path, points) on the heatmap's own data scales. */
  renderOverlay?: (
    sx: ScaleLinear<number, number>,
    sy: ScaleLinear<number, number>,
  ) => ReactNode;
}

const MARGIN = { top: 12, right: 12, bottom: 24, left: 32 };

export function Heatmap({
  field,
  xDomain,
  yDomain,
  levels,
  width = 480,
  height = 320,
  ariaLabel,
  renderOverlay,
}: HeatmapProps) {
  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = height - MARGIN.top - MARGIN.bottom;

  const sx = scaleLinear().domain(xDomain).range([0, innerW]);
  const sy = scaleLinear().domain(yDomain).range([innerH, 0]); // SVG y grows downward

  const { grid, xs, ys, min, max } = field;
  const span = max - min || 1;
  // Dark (low value) → emerald (high value), within the app's hue.
  const fill = (v: number) => `hsl(162 55% ${8 + ((v - min) / span) * 46}%)`;

  // Cell size in px (+1 to overlap seams); xs/ys are evenly spaced.
  const cw = Math.abs(sx(xs[1]) - sx(xs[0])) + 1;
  const ch = Math.abs(sy(ys[1]) - sy(ys[0])) + 1;

  const contours = (levels ?? []).flatMap((level) => contourSegments(field, level));

  const xTicks = sx.ticks(5);
  const yTicks = sy.ticks(4);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label={ariaLabel}
      style={{ display: "block", maxWidth: "100%" }}
    >
      <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
        {/* Field */}
        {grid.map((row, iy) =>
          row.map((v, ix) => (
            <rect
              key={`${ix}-${iy}`}
              x={sx(xs[ix]) - cw / 2}
              y={sy(ys[iy]) - ch / 2}
              width={cw}
              height={ch}
              fill={fill(v)}
              shapeRendering="crispEdges"
            />
          )),
        )}

        {/* Iso-contours */}
        {contours.map(([p, q], i) => (
          <line
            key={`c${i}`}
            x1={sx(p[0])}
            y1={sy(p[1])}
            x2={sx(q[0])}
            y2={sy(q[1])}
            stroke="var(--border-variant)"
            strokeWidth={1}
            opacity={0.6}
          />
        ))}

        {/* Axis ticks */}
        {xTicks.map((t) => (
          <text key={`x${t}`} x={sx(t)} y={innerH + 16} textAnchor="middle" fontSize={10} fill="var(--text-dim)">
            {t}
          </text>
        ))}
        {yTicks.map((t) => (
          <text key={`y${t}`} x={-8} y={sy(t)} dy="0.32em" textAnchor="end" fontSize={10} fill="var(--text-dim)">
            {t}
          </text>
        ))}

        {renderOverlay?.(sx, sy)}
      </g>
    </svg>
  );
}

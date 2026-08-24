/*
 * COURSE-P2-01 — Hand-rolled 2D line plot.
 *
 * Curves, not dashboards. We use `d3-scale` for the axes and `d3-shape` for the
 * path string, then render plain SVG ourselves — smaller and far more controllable
 * than a chart library, and no library opinions to fight. Deliberately NOT
 * Recharts/Plotly/Chart.js.
 *
 * Renders identically on the server and client (no browser globals), so it is safe
 * inside any widget and produces stable markup for hydration.
 */

"use client";

import { scaleLinear } from "d3-scale";
import { line as d3line } from "d3-shape";

export interface Series {
  points: [number, number][];
  /** Stroke colour (default: brand green). */
  color?: string;
  /** Stroke width in px (default 2). */
  width?: number;
}

export interface Plot2DProps {
  series: Series[];
  xDomain: [number, number];
  yDomain: [number, number];
  width?: number;
  height?: number;
  /** SVG label describing the plot for assistive tech. */
  ariaLabel?: string;
}

const MARGIN = { top: 12, right: 12, bottom: 24, left: 36 };

export function Plot2D({
  series,
  xDomain,
  yDomain,
  width = 480,
  height = 280,
  ariaLabel,
}: Plot2DProps) {
  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = height - MARGIN.top - MARGIN.bottom;

  const x = scaleLinear().domain(xDomain).range([0, innerW]);
  const y = scaleLinear().domain(yDomain).range([innerH, 0]); // SVG y grows downward

  const path = d3line<[number, number]>()
    .x((p) => x(p[0]))
    .y((p) => y(p[1]));

  const xTicks = x.ticks(5);
  const yTicks = y.ticks(4);

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
        {/* Grid + axis ticks */}
        {yTicks.map((t) => (
          <g key={`y${t}`} transform={`translate(0,${y(t)})`}>
            <line x1={0} x2={innerW} stroke="var(--border)" strokeWidth={1} />
            <text x={-8} dy="0.32em" textAnchor="end" fontSize={10} fill="var(--text-dim)">
              {t}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <g key={`x${t}`} transform={`translate(${x(t)},0)`}>
            <line y1={0} y2={innerH} stroke="var(--border)" strokeWidth={1} />
            <text y={innerH + 16} textAnchor="middle" fontSize={10} fill="var(--text-dim)">
              {t}
            </text>
          </g>
        ))}

        {/* Zero axes, if they fall inside the domain */}
        {yDomain[0] <= 0 && yDomain[1] >= 0 && (
          <line x1={0} x2={innerW} y1={y(0)} y2={y(0)} stroke="var(--border-variant)" strokeWidth={1} />
        )}
        {xDomain[0] <= 0 && xDomain[1] >= 0 && (
          <line x1={x(0)} x2={x(0)} y1={0} y2={innerH} stroke="var(--border-variant)" strokeWidth={1} />
        )}

        {/* Series */}
        {series.map((s, i) => (
          <path
            key={i}
            d={path(s.points) ?? undefined}
            fill="none"
            stroke={s.color ?? "var(--green)"}
            strokeWidth={s.width ?? 2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </g>
    </svg>
  );
}

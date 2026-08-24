/*
 * COURSE-P2-03 — The output half of a code cell: stdout, stderr, tracebacks, plots.
 *
 * Two rules drive the design:
 *
 *   1. A Python exception must render a READABLE traceback, never a blank panel. The
 *      worker returns Pyodide's message verbatim (line numbers included), and it is
 *      shown as-is in the error colour — a tidied-up summary would remove exactly the
 *      information the student needs.
 *   2. Nothing widens the page. Long lines scroll inside this box, per the same
 *      containment rule the MDX `pre`/`table` overrides follow (P1-01).
 *
 * Plots come from the `plot()` preamble helper rather than matplotlib (a ~15 MB
 * wheel), and are drawn with the P2-01 `Plot2D` primitive, so they match every other
 * figure in the course instead of looking like a screenshot from a different site.
 *
 * Copy is hardcoded Spanish, consistent with the rest of the widget layer.
 */

"use client";

import dynamic from "next/dynamic";

import type { Plot2DProps } from "@/features/courses/widgets/primitives/Plot2D";

import type { OutputBufferState } from "./output";

// Lazy for the same reason the widget registry is (see widgets/registry.ts): `Plot2D`
// pulls d3-scale and d3-shape, and most cells only ever print. This keeps d3 out of
// the cell's chunk until a `plot()` call actually produces something to draw.
const Plot2D = dynamic<Plot2DProps>(
  () => import("@/features/courses/widgets/primitives/Plot2D").then((mod) => mod.Plot2D),
  { ssr: false },
);

export interface CellPlot {
  xs: number[];
  ys: number[];
  label?: string;
}

export interface CodeOutputProps {
  output: OutputBufferState;
  plots: CellPlot[];
  /** Full Python traceback, when the last run raised. */
  error: string | null;
  /** Rendered above the output — timeout / stopped / crashed explanations. */
  notice: string | null;
  running: boolean;
}

const mono =
  'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

export function CodeOutput({ output, plots, error, notice, running }: CodeOutputProps) {
  const hasOutput = output.lines.length > 0;
  const hasAnything = hasOutput || plots.length > 0 || error !== null || notice !== null;

  if (!hasAnything) {
    return running ? (
      <p style={{ margin: "0.75rem 0 0", fontSize: "0.85rem", color: "var(--text-dim)" }}>
        Ejecutando…
      </p>
    ) : null;
  }

  return (
    <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.75rem" }}>
      {notice ? (
        <p
          role="status"
          style={{
            margin: 0,
            padding: "0.6rem 0.8rem",
            borderRadius: "var(--radius)",
            border: "1px solid var(--warning)",
            background: "var(--warning-bg)",
            color: "var(--text)",
            fontSize: "0.85rem",
          }}
        >
          {notice}
        </p>
      ) : null}

      {output.dropped > 0 ? (
        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-dim)" }}>
          Se ocultaron las primeras {output.dropped} líneas; solo se muestran las últimas.
        </p>
      ) : null}

      {hasOutput ? (
        <pre
          aria-live="polite"
          style={{
            margin: 0,
            padding: "0.75rem 0.9rem",
            maxHeight: 320,
            overflow: "auto",
            maxWidth: "100%",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
            background: "var(--surface-lowest)",
            fontFamily: mono,
            fontSize: "0.82rem",
            lineHeight: 1.55,
            whiteSpace: "pre",
          }}
        >
          {output.lines.map((line, index) => (
            <div
              key={index}
              style={{ color: line.stream === "stderr" ? "var(--error)" : "var(--text-muted)" }}
            >
              {line.text === "" ? " " : line.text}
            </div>
          ))}
        </pre>
      ) : null}

      {plots.map((plot, index) => (
        <figure key={index} style={{ margin: 0 }}>
          <Plot2D
            series={[{ points: plot.xs.map((x, i) => [x, plot.ys[i]] as [number, number]) }]}
            xDomain={domainOf(plot.xs)}
            yDomain={domainOf(plot.ys)}
            ariaLabel={plot.label ?? `Gráfica ${index + 1} generada por el código`}
          />
          {plot.label ? (
            <figcaption
              style={{ marginTop: "0.3rem", fontSize: "0.8rem", color: "var(--text-dim)" }}
            >
              {plot.label}
            </figcaption>
          ) : null}
        </figure>
      ))}

      {error ? (
        <pre
          style={{
            margin: 0,
            padding: "0.75rem 0.9rem",
            maxHeight: 320,
            overflow: "auto",
            maxWidth: "100%",
            borderRadius: "var(--radius)",
            border: "1px solid var(--error)",
            background: "var(--error-bg)",
            color: "var(--error)",
            fontFamily: mono,
            fontSize: "0.82rem",
            lineHeight: 1.55,
            whiteSpace: "pre",
          }}
        >
          {error}
        </pre>
      ) : null}
    </div>
  );
}

/** Pad a degenerate (all-equal) axis so the curve doesn't collapse onto the border. */
function domainOf(values: number[]): [number, number] {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return [0, 1];
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  if (min === max) return [min - 1, max + 1];
  const pad = (max - min) * 0.05;
  return [min - pad, max + pad];
}

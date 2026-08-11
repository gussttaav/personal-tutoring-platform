/*
 * COURSE-P2-01 — Reference widget: the ONE explorable this task ships to prove the
 * whole path (registry → dynamic → WidgetFrame → Slider + Plot2D → pure math).
 *
 * A weight `w` and bias `b` reshape σ(w·x + b); the curve redraws live. State is
 * purely local (design principle: a widget must be droppable anywhere with no
 * context/global store). No animation, so `prefers-reduced-motion` is a non-issue
 * here; the slider is keyboard-operable via the native range input.
 *
 * The full Block 1/2 widget set is P2-02; this file just establishes the pattern.
 *
 * COURSE-P5-02 — control labels and aria-label in Spanish. AUTHORING.md §5 fixes `peso`
 * and `sesgo` as Spanish outright, and every sibling widget already names its controls
 * and describes its plot that way; this one predates the table.
 */

"use client";

import { useState } from "react";

import { sigmoid } from "../math/activations";
import { Plot2D, type Series } from "../primitives/Plot2D";
import { Slider } from "../primitives/Slider";

const X_MIN = -8;
const X_MAX = 8;
const SAMPLES = 120;

function curve(w: number, b: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const x = X_MIN + ((X_MAX - X_MIN) * i) / SAMPLES;
    pts.push([x, sigmoid(w * x + b)]);
  }
  return pts;
}

export default function SigmoidExplorer() {
  const [w, setW] = useState(1);
  const [b, setB] = useState(0);

  const series: Series[] = [{ points: curve(w, b) }];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "100%" }}>
      <Plot2D
        series={series}
        xDomain={[X_MIN, X_MAX]}
        yDomain={[0, 1]}
        ariaLabel={`Curva de la sigmoide con peso ${w} y sesgo ${b}`}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: 420 }}>
        <Slider
          label="Peso (w)"
          value={w}
          min={-5}
          max={5}
          step={0.1}
          onChange={setW}
          format={(v) => v.toFixed(1)}
        />
        <Slider
          label="Sesgo (b)"
          value={b}
          min={-5}
          max={5}
          step={0.1}
          onChange={setB}
          format={(v) => v.toFixed(1)}
        />
      </div>
    </div>
  );
}

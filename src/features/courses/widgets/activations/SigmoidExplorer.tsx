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
 *
 * COURSE-P11-02 — those labels now come from `courses.widgets.sigmoid-explorer`; the
 * Spanish values are the same words §5 fixed, and `weight` / `bias` are their English
 * terms. The symbols (w, b) are notation and do not move between locales.
 */

"use client";

import { useTranslations } from "next-intl";
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
  const t = useTranslations("courses.widgets.sigmoid-explorer");
  const [w, setW] = useState(1);
  const [b, setB] = useState(0);

  const series: Series[] = [{ points: curve(w, b) }];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "100%" }}>
      <Plot2D
        series={series}
        xDomain={[X_MIN, X_MAX]}
        yDomain={[0, 1]}
        // Numbers go in as strings on purpose: an ICU number argument would be
        // formatted for the locale (`2,5` in Spanish), and this label reproduces the
        // value the slider shows, not a localised rendering of it.
        ariaLabel={t("plotAria", { w: String(w), b: String(b) })}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: 420 }}>
        <Slider
          label={t("weight")}
          value={w}
          min={-5}
          max={5}
          step={0.1}
          onChange={setW}
          format={(v) => v.toFixed(1)}
        />
        <Slider
          label={t("bias")}
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

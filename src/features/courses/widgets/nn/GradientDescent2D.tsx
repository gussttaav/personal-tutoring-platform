/*
 * COURSE-P2-02 — `gradient-descent-2d`: a contour map with the optimiser's path
 * traced across it. Adjust the learning rate and step through or animate; a too-high
 * rate makes the path VISIBLY diverge (a red badge + an outward arrow) instead of
 * silently clipping off-screen. Pure maths: contour fields + gradientDescentPath.
 * Animation is `prefers-reduced-motion` aware (step-only when reduce is requested).
 */

"use client";

import { useEffect, useMemo, useState } from "react";

import { useReducedMotion } from "@/hooks/useReducedMotion";
import { evalField, BOWL, RAVINE, type Field2D } from "../math/contour";
import { gradientDescentPath, type Point } from "../math/optimisation";
import { Heatmap } from "../primitives/Heatmap";
import { Slider } from "../primitives/Slider";
import { WidgetButton } from "../primitives/WidgetButton";

const STEPS = 50;
const RES = 44;

const FIELDS: Record<string, { field: Field2D; start: Point; label: string }> = {
  Convexo: { field: BOWL, start: [-2.6, 1.3], label: "Convexo (x² + 3y²)" },
  Cañón: { field: RAVINE, start: [-2.6, 1.2], label: "Mal condicionado (x² + 20y²)" },
};
type FieldName = keyof typeof FIELDS;

const outside = (p: Point, f: Field2D) =>
  p[0] < f.xDomain[0] || p[0] > f.xDomain[1] || p[1] < f.yDomain[0] || p[1] > f.yDomain[1];

export default function GradientDescent2D() {
  const [fieldName, setFieldName] = useState<FieldName>("Cañón");
  const [lr, setLr] = useState(0.05);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const reduced = useReducedMotion();

  const { field, start } = FIELDS[fieldName];

  const grid = useMemo(() => evalField(field.f, field.xDomain, field.yDomain, RES, RES), [field]);
  const levels = useMemo(() => {
    const lv: number[] = [];
    for (let i = 1; i <= 6; i++) lv.push(grid.min + ((grid.max - grid.min) * i) / 7);
    return lv;
  }, [grid]);

  const path = useMemo(
    () => gradientDescentPath((p) => field.grad(p[0], p[1]), start, lr, STEPS),
    [field, start, lr],
  );
  const escapeIndex = useMemo(() => path.findIndex((p) => outside(p, field)), [path, field]);
  const diverged = escapeIndex !== -1;
  const maxStep = diverged ? escapeIndex : STEPS;

  // Auto-advance one step at a time while playing (never under reduce-motion). The
  // setState is in an async timeout, and the effect re-runs per step; the guard halts
  // it at the end. Field/lr changes call reset(), so step stays ≤ maxStep.
  useEffect(() => {
    if (!playing || reduced || step >= maxStep) return;
    const id = setTimeout(() => setStep((s) => Math.min(s + 1, maxStep)), 140);
    return () => clearTimeout(id);
  }, [playing, reduced, step, maxStep]);

  const animating = playing && step < maxStep;

  const visible = path.slice(0, step + 1);
  const current = visible[visible.length - 1];
  const loss = field.f(current[0], current[1]);

  const reset = () => {
    setStep(0);
    setPlaying(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
        {(Object.keys(FIELDS) as FieldName[]).map((n) => (
          <WidgetButton
            key={n}
            active={n === fieldName}
            onClick={() => {
              setFieldName(n);
              reset();
            }}
          >
            {n}
          </WidgetButton>
        ))}
      </div>

      <Heatmap
        field={grid}
        xDomain={field.xDomain}
        yDomain={field.yDomain}
        levels={levels}
        ariaLabel={`Descenso de gradiente sobre un campo ${fieldName}`}
        renderOverlay={(sx, sy) => (
          <g>
            <path
              d={visible.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p[0])},${sy(p[1])}`).join(" ")}
              fill="none"
              stroke="var(--green)"
              strokeWidth={2}
            />
            {visible.map((p, i) => (
              <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r={i === visible.length - 1 ? 5 : 2.5} fill="var(--green)" />
            ))}
            {diverged && step >= maxStep && current && (
              <text x={sx(current[0])} y={sy(current[1]) - 10} textAnchor="middle" fontSize={16} fill="var(--error)">
                ↗
              </text>
            )}
          </g>
        )}
      />

      <Slider
        label="Learning rate (η)"
        value={lr}
        min={0.01}
        max={0.3}
        step={0.005}
        onChange={(v) => {
          setLr(v);
          reset();
        }}
        format={(v) => v.toFixed(3)}
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
        <WidgetButton onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          ◀ paso
        </WidgetButton>
        <WidgetButton onClick={() => setStep((s) => Math.min(maxStep, s + 1))} disabled={step >= maxStep}>
          paso ▶
        </WidgetButton>
        {!reduced && (
          <WidgetButton
            active={animating}
            onClick={() => {
              if (step >= maxStep) {
                setStep(0);
                setPlaying(true);
              } else {
                setPlaying((p) => !p);
              }
            }}
          >
            {animating ? "Pausa" : "Animar"}
          </WidgetButton>
        )}
        <WidgetButton onClick={reset}>Reset</WidgetButton>
        <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", fontVariantNumeric: "tabular-nums" }}>
          paso {step}/{maxStep} · pérdida {loss.toFixed(3)}
        </span>
      </div>

      {diverged && (
        <p style={{ fontSize: "0.85rem", margin: 0, color: "var(--error)", fontWeight: 600 }}>
          Diverge — la tasa de aprendizaje es demasiado alta; la trayectoria se sale del gráfico.
        </p>
      )}
    </div>
  );
}

/*
 * COURSE-P2-02 — `loss-landscape`: a loss surface with two basins (f = (x²−1)² + y²)
 * and the optimiser's path traced on it. Move the start point and watch which minimum
 * it rolls into — tying "gradient descent" to what the loss surface actually is. Pure
 * maths (contour field + gradientDescentPath); animation respects prefers-reduced-motion.
 * Local state only.
 */

"use client";

import { useEffect, useMemo, useState } from "react";

import { useReducedMotion } from "@/hooks/useReducedMotion";
import { evalField, DOUBLE_WELL } from "../math/contour";
import { gradientDescentPath } from "../math/optimisation";
import { Heatmap } from "../primitives/Heatmap";
import { Slider } from "../primitives/Slider";
import { WidgetButton } from "../primitives/WidgetButton";

const STEPS = 60;
const RES = 46;
const START_Y = 1.1;
const MINIMA: [number, number][] = [
  [-1, 0],
  [1, 0],
];

export default function LossLandscape() {
  const field = DOUBLE_WELL;
  const [startX, setStartX] = useState(-1.6);
  const [lr, setLr] = useState(0.06);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const reduced = useReducedMotion();

  const grid = useMemo(() => evalField(field.f, field.xDomain, field.yDomain, RES, RES), [field]);
  const levels = useMemo(() => {
    const lv: number[] = [];
    for (let i = 1; i <= 6; i++) lv.push(grid.min + ((grid.max - grid.min) * i) / 7);
    return lv;
  }, [grid]);

  const path = useMemo(
    () => gradientDescentPath((p) => field.grad(p[0], p[1]), [startX, START_Y], lr, STEPS),
    [field, startX, lr],
  );

  // Auto-advance one step at a time (async timeout, re-runs per step; the guard halts
  // it at the end). start-x/lr changes call reset(), so step stays ≤ STEPS.
  useEffect(() => {
    if (!playing || reduced || step >= STEPS) return;
    const id = setTimeout(() => setStep((s) => Math.min(s + 1, STEPS)), 120);
    return () => clearTimeout(id);
  }, [playing, reduced, step]);

  const animating = playing && step < STEPS;

  const visible = path.slice(0, step + 1);
  const current = visible[visible.length - 1];
  const finalX = path[path.length - 1][0];
  const basin = finalX < 0 ? "izquierda (−1, 0)" : "derecha (+1, 0)";

  const reset = () => {
    setStep(0);
    setPlaying(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%" }}>
      <Heatmap
        field={grid}
        xDomain={field.xDomain}
        yDomain={field.yDomain}
        levels={levels}
        ariaLabel="Superficie de pérdida con dos mínimos y la trayectoria del descenso"
        renderOverlay={(sx, sy) => (
          <g>
            {MINIMA.map(([mx, my], i) => (
              <circle key={i} cx={sx(mx)} cy={sy(my)} r={4} fill="none" stroke="var(--text)" strokeWidth={1.5} />
            ))}
            <path
              d={visible.map((p, k) => `${k === 0 ? "M" : "L"}${sx(p[0])},${sy(p[1])}`).join(" ")}
              fill="none"
              stroke="var(--green)"
              strokeWidth={2}
            />
            {current && <circle cx={sx(current[0])} cy={sy(current[1])} r={5} fill="var(--green)" />}
          </g>
        )}
      />

      <Slider label="Inicio x₀" value={startX} min={-1.9} max={1.9} step={0.1} onChange={(v) => { setStartX(v); reset(); }} format={(v) => v.toFixed(1)} />
      <Slider label="Learning rate (η)" value={lr} min={0.01} max={0.2} step={0.005} onChange={(v) => { setLr(v); reset(); }} format={(v) => v.toFixed(3)} />

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
        <WidgetButton onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          ◀ paso
        </WidgetButton>
        <WidgetButton onClick={() => setStep((s) => Math.min(STEPS, s + 1))} disabled={step >= STEPS}>
          paso ▶
        </WidgetButton>
        {!reduced && (
          <WidgetButton
            active={animating}
            onClick={() => {
              if (step >= STEPS) {
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
          paso {step}/{STEPS}
        </span>
      </div>

      <p style={{ fontSize: "0.85rem", margin: 0, color: "var(--text-muted)" }}>
        Cae en el mínimo de la <strong style={{ color: "var(--green)" }}>{basin}</strong> — el punto de
        partida decide la cuenca.
      </p>
    </div>
  );
}

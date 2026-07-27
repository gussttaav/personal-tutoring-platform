/*
 * COURSE-P2-02 — `activation-explorer`: overlay an activation and its derivative,
 * and SHADE the saturation regions where the derivative ≈ 0. Seeing saturation is
 * the whole point — it sets up vanishing gradients in Block 2. Pure activations from
 * math/activations (all derivative-checked vs finite differences). Local state only.
 */

"use client";

import { useMemo, useState } from "react";
import { scaleLinear } from "d3-scale";
import { line as d3line } from "d3-shape";

import {
  sigmoid,
  sigmoidPrime,
  tanh,
  tanhPrime,
  relu,
  reluPrime,
  gelu,
  geluPrime,
} from "../math/activations";
import { WidgetButton } from "../primitives/WidgetButton";

const ACTS = {
  "σ": { f: sigmoid, d: sigmoidPrime },
  "tanh": { f: tanh, d: tanhPrime },
  "ReLU": { f: relu, d: reluPrime },
  "GELU": { f: gelu, d: geluPrime },
} as const;

type ActName = keyof typeof ACTS;

const X_MIN = -5;
const X_MAX = 5;
const SAMPLES = 200;
const SATURATION_EPS = 0.02; // |f'| below this counts as saturated
const W = 480;
const H = 280;
const MARGIN = { top: 12, right: 12, bottom: 24, left: 34 };

export default function ActivationExplorer() {
  const [name, setName] = useState<ActName>("σ");
  const [showDeriv, setShowDeriv] = useState(true);

  const { f, d } = ACTS[name];

  const { fPts, dPts, bands, yDomain } = useMemo(() => {
    const fPts: [number, number][] = [];
    const dPts: [number, number][] = [];
    const bands: [number, number][] = [];
    let bandStart: number | null = null;
    let lo = Infinity;
    let hi = -Infinity;

    for (let i = 0; i <= SAMPLES; i++) {
      const x = X_MIN + ((X_MAX - X_MIN) * i) / SAMPLES;
      const fv = f(x);
      const dv = d(x);
      fPts.push([x, fv]);
      dPts.push([x, dv]);
      lo = Math.min(lo, fv, dv);
      hi = Math.max(hi, fv, dv);

      if (Math.abs(dv) < SATURATION_EPS) {
        if (bandStart === null) bandStart = x;
      } else if (bandStart !== null) {
        bands.push([bandStart, x]);
        bandStart = null;
      }
    }
    if (bandStart !== null) bands.push([bandStart, X_MAX]);

    const pad = (hi - lo) * 0.08 || 0.1;
    return { fPts, dPts, bands, yDomain: [lo - pad, hi + pad] as [number, number] };
  }, [f, d]);

  const innerW = W - MARGIN.left - MARGIN.right;
  const innerH = H - MARGIN.top - MARGIN.bottom;
  const sx = scaleLinear().domain([X_MIN, X_MAX]).range([0, innerW]);
  const sy = scaleLinear().domain(yDomain).range([innerH, 0]);
  const path = d3line<[number, number]>()
    .x((p) => sx(p[0]))
    .y((p) => sy(p[1]));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", width: "100%" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
        {(Object.keys(ACTS) as ActName[]).map((a) => (
          <WidgetButton key={a} active={a === name} onClick={() => setName(a)}>
            {a}
          </WidgetButton>
        ))}
        <span style={{ width: 12 }} />
        <WidgetButton active={showDeriv} onClick={() => setShowDeriv((v) => !v)}>
          derivada f′
        </WidgetButton>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label={`Activación ${name} y su derivada, con regiones de saturación sombreadas`}
        style={{ display: "block", maxWidth: "100%" }}
      >
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {/* Saturation bands (f' ≈ 0) */}
          {bands.map(([x0, x1], i) => (
            <rect key={i} x={sx(x0)} y={0} width={Math.max(0, sx(x1) - sx(x0))} height={innerH} fill="var(--error)" opacity={0.12} />
          ))}

          {/* Zero axes */}
          {yDomain[0] <= 0 && yDomain[1] >= 0 && (
            <line x1={0} x2={innerW} y1={sy(0)} y2={sy(0)} stroke="var(--border-variant)" strokeWidth={1} />
          )}
          <line x1={sx(0)} x2={sx(0)} y1={0} y2={innerH} stroke="var(--border)" strokeWidth={1} />

          {/* Derivative then activation */}
          {showDeriv && <path d={path(dPts) ?? undefined} fill="none" stroke="var(--text-dim)" strokeWidth={1.5} strokeDasharray="4 3" />}
          <path d={path(fPts) ?? undefined} fill="none" stroke="var(--green)" strokeWidth={2} strokeLinejoin="round" />

          {/* Ticks */}
          {sx.ticks(5).map((t) => (
            <text key={`x${t}`} x={sx(t)} y={innerH + 16} textAnchor="middle" fontSize={10} fill="var(--text-dim)">
              {t}
            </text>
          ))}
        </g>
      </svg>

      <p style={{ fontSize: "0.8rem", color: "var(--text-dim)", margin: 0 }}>
        Zonas rojas: la derivada ≈ 0 (saturación) — ahí el gradiente casi no fluye.
      </p>
    </div>
  );
}

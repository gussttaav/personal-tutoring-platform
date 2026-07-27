/*
 * COURSE-P2-02 — `backprop-trace`: THE centrepiece. A tiny 2-2-1 network; step
 * through the backward pass and watch each chain-rule factor appear with its numeric
 * value ("this × this = that"), highlighting the edge/node it belongs to. Steps go
 * both directions (◀ ▶ or arrow keys). Every number comes from math/backprop, which
 * is verified against finite differences AND a hand-computed example. Local state only.
 */

"use client";

import { useMemo, useState } from "react";

import { runBackprop, BACKPROP_PRESET, type TraceStep } from "../math/backprop";
import { WidgetButton } from "../primitives/WidgetButton";

const W = 460;
const H = 240;

const NODES: Record<string, { x: number; y: number; label: string }> = {
  x0: { x: 40, y: 70, label: "x₀" },
  x1: { x: 40, y: 170, label: "x₁" },
  h0: { x: 180, y: 70, label: "h₀" },
  h1: { x: 180, y: 170, label: "h₁" },
  o: { x: 320, y: 120, label: "o" },
  L: { x: 420, y: 120, label: "L" },
};

const EDGES: { id: string; from: string; to: string }[] = [
  { id: "W1_0_0", from: "x0", to: "h0" },
  { id: "W1_0_1", from: "x1", to: "h0" },
  { id: "W1_1_0", from: "x0", to: "h1" },
  { id: "W1_1_1", from: "x1", to: "h1" },
  { id: "w2_0", from: "h0", to: "o" },
  { id: "w2_1", from: "h1", to: "o" },
  { id: "o_L", from: "o", to: "L" },
];

// Which nodes/edges a step lights up.
function highlight(step: TraceStep): { nodes: Set<string>; edges: Set<string> } {
  const nodes = new Set<string>();
  const edges = new Set<string>();
  const id = step.id;
  let m: RegExpMatchArray | null;
  if ((m = id.match(/^dL_dW1_(\d)_(\d)$/))) {
    edges.add(`W1_${m[1]}_${m[2]}`);
    nodes.add(`x${m[2]}`).add(`h${m[1]}`);
  } else if ((m = id.match(/^dL_dw2_(\d)$/))) {
    edges.add(`w2_${m[1]}`);
    nodes.add(`h${m[1]}`).add("o");
  } else if ((m = id.match(/^dL_d(?:a1|z1)_(\d)$/))) {
    nodes.add(`h${m[1]}`);
  } else if (id === "dL_db2" || id.startsWith("dL_dz2") || id === "do_dz2" || id === "dL_do") {
    nodes.add("o").add("L");
    edges.add("o_L");
  }
  return { nodes, edges };
}

const fmt = (n: number) => (Object.is(n, -0) ? "0.000" : n.toFixed(3));

export default function BackpropTrace() {
  const { forward, steps } = useMemo(() => runBackprop(BACKPROP_PRESET.params, BACKPROP_PRESET.x), []);
  const [i, setI] = useState(0);

  const step = steps[i];
  const hi = highlight(step);

  const go = (delta: number) => setI((v) => Math.max(0, Math.min(steps.length - 1, v + delta)));

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%", outlineOffset: 3 }}
      tabIndex={0}
      role="group"
      aria-label="Traza de retropropagación; usa las flechas para avanzar y retroceder"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          go(1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          go(-1);
        }
      }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Diagrama de la red 2-2-1" style={{ display: "block", maxWidth: "100%" }}>
        {EDGES.map((e) => {
          const a = NODES[e.from];
          const b = NODES[e.to];
          const on = hi.edges.has(e.id);
          return <line key={e.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={on ? "var(--green)" : "var(--border-variant)"} strokeWidth={on ? 3 : 1.5} />;
        })}
        {Object.entries(NODES).map(([id, n]) => {
          const on = hi.nodes.has(id);
          return (
            <g key={id}>
              <circle cx={n.x} cy={n.y} r={18} fill={on ? "var(--green-container)" : "var(--surface-lowest)"} stroke={on ? "var(--green)" : "var(--border-variant)"} strokeWidth={on ? 2.5 : 1.5} />
              <text x={n.x} y={n.y} dy="0.32em" textAnchor="middle" fontSize={13} fill={on ? "#04140d" : "var(--text)"} fontWeight={600}>
                {n.label}
              </text>
            </g>
          );
        })}
        {/* forward readouts */}
        <text x={NODES.o.x} y={NODES.o.y + 34} textAnchor="middle" fontSize={10} fill="var(--text-dim)">
          o = {fmt(forward.o)}
        </text>
        <text x={NODES.L.x} y={NODES.L.y + 34} textAnchor="middle" fontSize={10} fill="var(--text-dim)">
          L = {fmt(forward.loss)}
        </text>
      </svg>

      {/* Chain-rule panel */}
      <div style={{ padding: "0.7rem 0.85rem", borderRadius: "var(--radius)", border: "1px solid var(--border-variant)", background: "var(--surface-lowest)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap", fontVariantNumeric: "tabular-nums" }}>
          <span style={{ fontWeight: 700, color: "var(--green)", fontSize: "0.95rem" }}>{step.target}</span>
          <span style={{ color: "var(--text-dim)" }}>=</span>
          {step.factors.map((f, k) => (
            <span key={k} style={{ color: "var(--text)", fontSize: "0.9rem" }}>
              {k > 0 && <span style={{ color: "var(--text-dim)" }}> × </span>}
              {f.label}
              <span style={{ color: "var(--text-dim)" }}> ({fmt(f.value)})</span>
            </span>
          ))}
          <span style={{ color: "var(--text-dim)" }}>=</span>
          <span style={{ fontWeight: 700, color: "var(--text)", fontSize: "0.95rem" }}>{fmt(step.value)}</span>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
        <WidgetButton onClick={() => go(-1)} disabled={i === 0}>
          ◀ atrás
        </WidgetButton>
        <WidgetButton onClick={() => go(1)} disabled={i === steps.length - 1}>
          adelante ▶
        </WidgetButton>
        <WidgetButton onClick={() => setI(0)}>Reset</WidgetButton>
        <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", fontVariantNumeric: "tabular-nums" }}>
          paso {i + 1}/{steps.length}
        </span>
      </div>
    </div>
  );
}

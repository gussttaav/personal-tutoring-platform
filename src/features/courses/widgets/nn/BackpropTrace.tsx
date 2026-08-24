/*
 * COURSE-P2-02 — `backprop-trace`: THE centrepiece. A tiny 2-2-1 network; step
 * through the backward pass and watch each chain-rule factor appear with its numeric
 * value ("this × this = that"), highlighting the edge/node it belongs to. Steps go
 * both directions (◀ ▶ or arrow keys). Every number comes from math/backprop, which
 * is verified against finite differences AND a hand-computed example. Local state only.
 *
 * COURSE-P5-02 — Labels rewritten in the course's notation. Block 2 lesson 8 prints
 * these same numbers, so the diagram may not carry a second naming scheme; see the
 * header of math/backprop.ts for the internal-vs-displayed split.
 */

"use client";

import { useMemo, useState } from "react";

import { runBackprop, BACKPROP_PRESET, type TraceStep } from "../math/backprop";
import { WidgetButton } from "../primitives/WidgetButton";

const W = 460;
const H = 240;

// Keys are internal — `highlight()` builds them from the 0-indexed step ids. The
// `label` is what the student reads, and it is 1-indexed course notation.
const NODES: Record<string, { x: number; y: number; label: string }> = {
  x0: { x: 40, y: 70, label: "x₁" },
  x1: { x: 40, y: 170, label: "x₂" },
  h0: { x: 180, y: 70, label: "h(1)₁" },
  h1: { x: 180, y: 170, label: "h(1)₂" },
  o: { x: 320, y: 120, label: "ŷ" },
  L: { x: 420, y: 120, label: "ℓ" },
};

/*
 * ONE radius for every node, set by the widest label. `h(1)₁` is ~29px at 13px/600,
 * so r=24 clears it with ~9px of padding a side. Two rejected alternatives: sizing
 * each node to its own label makes the hidden pair ellipses among circles, which
 * reads as a distinction the network does not have; and shrinking the font to fit
 * a smaller disc is worse still, since the drawing scales to ~0.78 on a 360px
 * phone and 10px in the source lands at ~8px on the device.
 */
const NODE_R = 24;

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
      {/*
        `height: auto` rather than a fixed H: with a pinned pixel height the default
        preserveAspectRatio letterboxes the drawing — it renders at its intrinsic
        460px and pads the sides — so the diagram stayed small in a wider column.
        Scaling with the width instead makes the labels grow with the container;
        maxWidth stops it ballooning past the measure of the prose.
      */}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Diagrama de la red 2-2-1" style={{ display: "block", width: "100%", height: "auto", maxWidth: 560, margin: "0 auto" }}>
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
              <circle cx={n.x} cy={n.y} r={NODE_R} fill={on ? "var(--green-container)" : "var(--surface-lowest)"} stroke={on ? "var(--green)" : "var(--border-variant)"} strokeWidth={on ? 2.5 : 1.5} />
              <text x={n.x} y={n.y} dy="0.32em" textAnchor="middle" fontSize={13} fill={on ? "#04140d" : "var(--text)"} fontWeight={600}>
                {n.label}
              </text>
            </g>
          );
        })}
        {/* Forward readouts. The offset clears NODE_R plus a gap — a baseline is not
            a top edge, so `+ 34` left these sitting 2px under a radius-24 circle. */}
        <text x={NODES.o.x} y={NODES.o.y + NODE_R + 18} textAnchor="middle" fontSize={11} fill="var(--text-dim)">
          ŷ = {fmt(forward.o)}
        </text>
        <text x={NODES.L.x} y={NODES.L.y + NODE_R + 18} textAnchor="middle" fontSize={11} fill="var(--text-dim)">
          ℓ = {fmt(forward.loss)}
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
          ◀ anterior
        </WidgetButton>
        <WidgetButton onClick={() => go(1)} disabled={i === steps.length - 1}>
          siguiente ▶
        </WidgetButton>
        <WidgetButton onClick={() => setI(0)}>Reset</WidgetButton>
        <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", fontVariantNumeric: "tabular-nums" }}>
          paso {i + 1}/{steps.length}
        </span>
      </div>
    </div>
  );
}

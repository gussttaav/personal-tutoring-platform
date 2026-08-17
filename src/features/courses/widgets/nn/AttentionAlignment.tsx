/*
 * COURSE-P5-04 — `attention-alignment`: the alignment map of one translation pair
 * (Block 4 lessons 3 and 4). Rows are output steps, columns are source positions, and
 * cell (i, j) is α_ij — how much of the encoder state at j goes into the context vector
 * that step i reads. Pick a row (hover, tap, Tab or arrow keys) and the widget says
 * which source token that step leans on and draws the c_i it builds.
 *
 * The toggle is the teaching move, and it is why this is a widget rather than a figure:
 * «resumen fijo» swaps α for the frozen alignment — all the mass on the last source
 * position, at every step — which is EXACTLY the encoder-decoder of lesson 1. Flip it
 * and the map goes from a scatter that follows the sentence to one lit column, while
 * the c_i strip below stops moving: eight steps, one vector, which is the bottleneck
 * seen from the inside. The old architecture is not a different mechanism, it is this
 * one with its weights frozen and blind to i.
 *
 * Every row prints its own sum next to it. That is not decoration — a row summing to
 * 0.97 looks exactly like a row summing to 1, and the claim that c_i is a MIXTURE (a
 * convex combination of states, never bigger than the biggest of them) is the one thing
 * a reader cannot check by eye. The numbers all come from math/attention-alignment,
 * which is unit-tested against the exact one-hot/uniform/frozen cases. Local state only.
 */

"use client";

import { useRef, useState } from "react";

import {
  ALIGNMENT_SOURCE,
  ALIGNMENT_TARGET,
  ATTENTION_ALIGNMENT,
  ENCODER_STATES,
  frozenAlignment,
  mixture,
  rowSums,
  topSource,
} from "../math/attention-alignment";
import { WidgetButton } from "../primitives/WidgetButton";

type Mode = "atencion" | "fijo";

const T_X = ALIGNMENT_SOURCE.length;
const T_Y = ALIGNMENT_TARGET.length;
const D_H = ENCODER_STATES[0].length;

const FROZEN = frozenAlignment(T_Y, T_X);
const ALPHA: Record<Mode, number[][]> = { atencion: ATTENTION_ALIGNMENT, fijo: FROZEN };

// Cells stretch to fill the column and stop at CELL_MAX, so the map is a readable block
// on a laptop without stretching. At the minimum the row totals 326px, which clears a
// 360px phone inside the frame's padding; below that the frame scrolls rather than
// shrinking the labels.
const LABEL_W = 70;
const CELL_MIN = 34;
const CELL_MAX = 56;
const SUM_W = 34;
const GAP = 2;
const COLUMNS = `${LABEL_W}px repeat(${T_X}, minmax(${CELL_MIN}px, ${CELL_MAX}px)) ${SUM_W}px`;
/** The gaps count too — leaving them out is what made the row overflow its own box. */
const gridWidth = (cell: number) => LABEL_W + T_X * cell + SUM_W + (T_X + 1) * GAP;

/*
 * Dark → emerald by weight. The exponent is the whole point and a linear ramp is wrong
 * here: a row of six weights summing to 1 puts almost everything below 0.1, so mapping
 * lightness straight off w crushes 0.02 and 0.15 into the same near-black and the map
 * reads as a hard pick — which is precisely the misreading the lesson exists to prevent.
 * c_i is a MIXTURE, and the secondary weights are what show it. Raising w to 0.55 spreads
 * that crowded low end (0.02 → 16%, 0.15 → 25%, 0.76 → 47%) while keeping the order
 * intact, so the peak still dominates and the rest stops being invisible.
 */
const shade = (w: number) =>
  `hsl(162 55% ${8 + Math.pow(Math.max(0, Math.min(1, w)), 0.55) * 44}%)`;

const fmt2 = (v: number) => v.toFixed(2);

export default function AttentionAlignment() {
  const [mode, setMode] = useState<Mode>("atencion");
  const [step, setStep] = useState(6); // «book», the row where the lines cross
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const alpha = ALPHA[mode];
  const sums = rowSums(alpha);
  const row = alpha[step];
  const peak = topSource(row);
  const context = mixture(row, ENCODER_STATES);

  // Counted from the row that received the key, not from `step`: the two agree in normal
  // use, but reading state here would make the jump depend on whether React had already
  // committed the focus that preceded it.
  const move = (from: number, delta: number) => {
    const next = (from + delta + T_Y) % T_Y;
    setStep(next);
    rowRefs.current[next]?.focus();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem", width: "100%" }}>
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
        <WidgetButton
          active={mode === "atencion"}
          aria-pressed={mode === "atencion"}
          onClick={() => setMode("atencion")}
        >
          Atención
        </WidgetButton>
        <WidgetButton
          active={mode === "fijo"}
          aria-pressed={mode === "fijo"}
          onClick={() => setMode("fijo")}
        >
          Resumen fijo
        </WidgetButton>
      </div>

      <div style={{ overflowX: "auto" }}>
        <div
          style={{ minWidth: gridWidth(CELL_MIN), maxWidth: gridWidth(CELL_MAX) }}
        >
          {/* Column headings: the source sentence, left to right as the encoder read it. */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: COLUMNS,
              gap: 2,
              paddingBottom: 4,
              fontSize: "0.62rem",
              color: "var(--text-dim)",
            }}
          >
            <span />
            {ALIGNMENT_SOURCE.map((token) => (
              <span key={token} style={{ textAlign: "center" }}>
                {token}
              </span>
            ))}
            <span style={{ textAlign: "center" }}>suma</span>
          </div>

          <div
            role="group"
            aria-label="Mapa de alineación: elige un paso de la salida para ver de qué parte de la entrada tira"
            style={{ display: "flex", flexDirection: "column", gap: 2 }}
          >
            {ALIGNMENT_TARGET.map((token, i) => {
              const selected = i === step;
              return (
                <button
                  key={token}
                  type="button"
                  ref={(el) => {
                    rowRefs.current[i] = el;
                  }}
                  aria-pressed={selected}
                  onClick={() => setStep(i)}
                  onFocus={() => setStep(i)}
                  onMouseEnter={() => setStep(i)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
                      e.preventDefault();
                      move(i, 1);
                    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
                      e.preventDefault();
                      move(i, -1);
                    }
                  }}
                  style={{
                    display: "grid",
                    gridTemplateColumns: COLUMNS,
                    gap: 2,
                    alignItems: "stretch",
                    padding: 0,
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    opacity: selected ? 1 : 0.62,
                    transition: "opacity .2s",
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      paddingLeft: 4,
                      fontSize: "0.68rem",
                      color: selected ? "var(--text)" : "var(--text-muted)",
                      fontWeight: selected ? 600 : 400,
                    }}
                  >
                    {token}
                  </span>
                  {alpha[i].map((w, j) => (
                    <span
                      key={ALIGNMENT_SOURCE[j]}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: 28,
                        borderRadius: 3,
                        background: shade(w),
                        color: "#e6fff4",
                        fontSize: "0.66rem",
                        fontVariantNumeric: "tabular-nums",
                        boxShadow: selected ? "inset 0 0 0 1px rgba(78,222,163,0.55)" : "none",
                      }}
                    >
                      {fmt2(w)}
                    </span>
                  ))}
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.66rem",
                      fontVariantNumeric: "tabular-nums",
                      color: "var(--green)",
                    }}
                  >
                    {fmt2(sums[i])}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <ContextStrip step={step} context={context} />

      <div
        aria-live="polite"
        style={{
          padding: "0.7rem 0.8rem",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border-variant)",
          background: "var(--surface-lowest)",
        }}
      >
        <p style={{ fontSize: "0.85rem", color: "var(--text-dim)", margin: 0, lineHeight: 1.6 }}>
          {mode === "atencion" ? (
            <>
              El paso {step + 1} escribe{" "}
              <strong style={{ color: "var(--text)" }}>{ALIGNMENT_TARGET[step]}</strong> y tira
              sobre todo de{" "}
              <strong style={{ color: "var(--text)" }}>{ALIGNMENT_SOURCE[peak.index]}</strong>, con
              un peso de {fmt2(peak.weight)}. Cambia de paso: la fila se mueve, y su suma sigue
              valiendo {fmt2(sums[step])}.
            </>
          ) : (
            <>
              Con el resumen fijo, el paso {step + 1} recibe el estado de{" "}
              <strong style={{ color: "var(--text)" }}>{ALIGNMENT_SOURCE[T_X - 1]}</strong> con peso{" "}
              {fmt2(peak.weight)} — y también lo reciben los otros {T_Y - 1} pasos. Recorre las
              filas y mira las barras de abajo: no se mueven.
            </>
          )}
        </p>
      </div>
    </div>
  );
}

/** The d_h coordinates of c_i, as bars above and below zero. It is what the selected row
 *  builds, and under «resumen fijo» it is the same drawing for every row — which is the
 *  whole comparison. */
function ContextStrip({ step, context }: { step: number; context: number[] }) {
  const W = 236;
  const H = 54;
  const mid = H / 2;
  const slot = W / D_H;
  const barW = slot * 0.5;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", flexWrap: "wrap" }}>
      <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
        c<sub>{step + 1}</sub>
      </span>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        role="img"
        aria-label={`Las ${D_H} coordenadas del vector de contexto del paso ${step + 1}: ${context
          .map((v) => fmt2(v))
          .join(", ")}.`}
        style={{ maxWidth: "100%" }}
      >
        <line x1={0} y1={mid} x2={W} y2={mid} stroke="var(--border-variant)" strokeWidth={1} />
        {context.map((v, k) => {
          const h = Math.abs(v) * (mid - 4);
          return (
            <rect
              key={k}
              x={k * slot + (slot - barW) / 2}
              y={v >= 0 ? mid - h : mid}
              width={barW}
              height={h}
              rx={2}
              fill="var(--green)"
              opacity={v >= 0 ? 0.85 : 0.45}
            />
          );
        })}
      </svg>
      <span style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>
        {D_H} coordenadas, las mismas que tenía el resumen
      </span>
    </div>
  );
}

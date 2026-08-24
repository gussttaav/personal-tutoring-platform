/*
 * COURSE-P5-03 — `rnn-unrolled`: one widget, two directions. It draws a small vanilla
 * RNN unrolled into a row of states h₁…h_T with the loss at the end, and can be
 * traversed BOTH ways via an internal toggle:
 *
 *   • FORWARD (serves lesson 2) — step t = 1…T, watching h_t built from h_{t-1} and
 *     x_t, with the SAME W_hh / W_xh highlighted at every position.
 *   • BACKWARD (serves lesson 3 — the payoff) — step t = T…1, watching the two
 *     movements (transport W_hhᵀ·δ_{t+1}, then the tanh mask 1 − h_t²) produce δ_t,
 *     then δ_t·h_{t-1}ᵀ DROP INTO a running ∇W_hh accumulator drawn as a d_h×d_h grid.
 *
 * The teaching move is STRUCTURAL, not about magnitude: raise T and the accumulator
 * sums more terms while its SHAPE stays d_h×d_h — that dismantles "longer text →
 * bigger gradient". At t = 1 the ∇W_hh contribution is the zero matrix (h_0 = 0) so
 * the accumulator does not move; a toggle switches the accumulator to ∇W_xh, whose
 * t = 1 term IS nonzero, as the contrast. The one bridge to lesson 4 is that the same
 * W_hhᵀ is applied at every backward step — we let that plant the question without
 * answering it (no magnitude bars, no spectral-radius knob; that is `vanishing-gradient`).
 *
 * `Explorable` passes only `id` + `caption`, so the widget self-contains both modes
 * and defaults to FORWARD; each lesson's caption points the student at its mode. All
 * numbers come from math/rnn (verified against finite differences). Local state only.
 */

"use client";

import { useMemo, useState } from "react";

import { runRnn, RNN_PRESET } from "../math/rnn";
import type { Matrix, Vector } from "../math/linalg";
import { Slider } from "../primitives/Slider";
import { WidgetButton } from "../primitives/WidgetButton";

type Mode = "forward" | "backward";
type Accum = "Whh" | "Wxh";

const DH = RNN_PRESET.params.bh.length; // 2
const D_MODEL = RNN_PRESET.params.Wxh[0].length; // 3
// The weights and bias are FIXED — the same at every step. Shown to the student so the
// "one set of parameters, reused each position" idea is concrete, not just asserted.
const WHH = RNN_PRESET.params.Whh;
const WXH = RNN_PRESET.params.Wxh;
const BH = RNN_PRESET.params.bh;
const T_MIN = 3;
const T_MAX = 8;

// ── SVG geometry (viewBox units; the drawing scales to the column width) ────────────
const PITCH = 72; //           centre-to-centre spacing of the state boxes
const BOX_W = 46;
const BOX_H = 30;
const ROW_Y = 56; //           vertical centre of the row
const LEFT = 88; //            centre x of h₁
const START_X = 40; //         where the h₀ arrow begins
const LOSS_R = 16;
const X_ARROW_Y = 98; //       bottom of the x_t up-arrows
const X_LABEL_Y = 113;
const VB_H = 126;

const boxCx = (t: number) => LEFT + (t - 1) * PITCH;
const lossCx = (T: number) => boxCx(T) + BOX_W / 2 + 46 + LOSS_R;

const fmt = (n: number) => (Object.is(n, -0) || n === 0 ? "0.00" : n.toFixed(2));
const vec = (v: Vector) => `(${v.map(fmt).join(", ")})`;

/** A small labeled matrix, cells shaded dark→emerald by magnitude within the matrix. */
function MatrixGrid({
  m,
  cellSize = 46,
  ariaLabel,
  faded = false,
}: {
  m: Matrix;
  cellSize?: number;
  ariaLabel?: string;
  faded?: boolean;
}) {
  const cols = m[0].length;
  const maxAbs = Math.max(1e-9, ...m.flat().map((v) => Math.abs(v)));
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
        gap: 2,
        opacity: faded ? 0.55 : 1,
        transition: "opacity .25s",
      }}
    >
      {m.map((row, i) =>
        row.map((v, j) => (
          <div
            key={`${i}-${j}`}
            style={{
              height: cellSize * 0.66,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 3,
              fontSize: "0.72rem",
              fontVariantNumeric: "tabular-nums",
              color: "#e6fff4",
              background: `hsl(162 55% ${10 + (Math.abs(v) / maxAbs) * 32}%)`,
              transition: "background-color .3s ease",
            }}
          >
            {fmt(v)}
          </div>
        )),
      )}
    </div>
  );
}

export default function RnnUnrolled(props: Record<string, unknown>) {
  // Optional presentational props forwarded from MDX by `Explorable` (untyped there,
  // so validate/default here). `direction` picks the mode the widget opens in;
  // `lockDirection` hides the Adelante/Atrás toggle and pins it — lesson 2 embeds it
  // forward-only, lesson 3 opens it in backward with the toggle available.
  const initialMode: Mode = props.direction === "backward" ? "backward" : "forward";
  const locked = props.lockDirection === true;

  const [mode, setMode] = useState<Mode>(initialMode);
  const [T, setTState] = useState(5);
  const [i, setI] = useState(0); // step index into the current mode's ordered steps
  const [accum, setAccumState] = useState<Accum>("Whh");

  const result = useMemo(() => runRnn(RNN_PRESET.params, RNN_PRESET.xs.slice(0, T)), [T]);

  // Resetting the step index keeps `i` valid whenever the traversal changes.
  const changeMode = (m: Mode) => {
    setMode(m);
    setI(0);
  };
  const setT = (v: number) => {
    setTState(v);
    setI(0);
  };
  const setAccum = (a: Accum) => {
    setAccumState(a);
  };

  const go = (delta: number) => setI((v) => Math.max(0, Math.min(T - 1, v + delta)));

  // Current step, per mode. Forward index i → time i+1; backward → result.back[i] (t = T−i).
  const fStep = result.forward.steps[i];
  const bStep = result.back[i];
  const activeT = mode === "forward" ? i + 1 : T - i;

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%", outlineOffset: 3 }}
      tabIndex={0}
      role="group"
      aria-label="RNN desplegada; usa las flechas para avanzar y retroceder por los pasos"
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
      {/* Mode toggle — hidden when the lesson locks the direction */}
      {!locked && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>Dirección:</span>
          <WidgetButton role="switch" active={mode === "forward"} onClick={() => changeMode("forward")}>
            Adelante ▶
          </WidgetButton>
          <WidgetButton role="switch" active={mode === "backward"} onClick={() => changeMode("backward")}>
            ◀ Atrás (BPTT)
          </WidgetButton>
        </div>
      )}

      {/* The unrolled row. Forward mode is only about the recurrence, so it stops at h_T;
          the loss node and W_hy live in backward mode, where they seed the sweep. */}
      <svg
        viewBox={`0 0 ${mode === "backward" ? lossCx(T) + LOSS_R + 12 : boxCx(T) + BOX_W / 2 + 16} ${VB_H}`}
        role="img"
        aria-label={`RNN desplegada con ${T} pasos, en modo ${mode === "forward" ? "hacia adelante" : "hacia atrás"}`}
        style={{ display: "block", width: "100%", height: "auto", maxWidth: 640, margin: "0 auto" }}
      >
        <defs>
          <marker id="rnn-arr-on" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0 0 L8 4 L0 8 z" fill="var(--green)" />
          </marker>
          <marker id="rnn-arr-off" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0 0 L8 4 L0 8 z" fill="var(--border-variant)" />
          </marker>
        </defs>

        {/* h₀ = 0 start marker */}
        <text x={START_X - 6} y={ROW_Y + 3} textAnchor="end" fontSize={11} fill="var(--text-dim)">
          h<tspan dy="3" fontSize="8">0</tspan>
          <tspan dy="-3">=0</tspan>
        </text>

        {/* Recurrent connectors between consecutive states (label W_hh / W_hhᵀ) */}
        {Array.from({ length: T }, (_, k) => k + 1).map((k) => {
          const leftPt = k === 1 ? START_X : boxCx(k - 1) + BOX_W / 2;
          const rightPt = boxCx(k) - BOX_W / 2;
          // Forward: the connector INTO box k is highlighted at step k.
          // Backward: transport into box t=k−1 travels this connector (from h_k), so it
          //           is highlighted when the active step is k−1, i.e. k = activeT + 1.
          const on = mode === "forward" ? activeT === k : activeT === k - 1 && k > 1;
          const stroke = on ? "var(--green)" : "var(--border-variant)";
          const marker = on ? "url(#rnn-arr-on)" : "url(#rnn-arr-off)";
          const line =
            mode === "forward" ? (
              <line x1={leftPt} y1={ROW_Y} x2={rightPt} y2={ROW_Y} stroke={stroke} strokeWidth={on ? 2.4 : 1.3} markerEnd={marker} />
            ) : (
              <line x1={rightPt} y1={ROW_Y} x2={leftPt} y2={ROW_Y} stroke={stroke} strokeWidth={on ? 2.4 : 1.3} markerEnd={marker} />
            );
          return (
            <g key={`c${k}`}>
              {line}
              <text x={(leftPt + rightPt) / 2} y={ROW_Y - 15} textAnchor="middle" fontSize={11} fill={on ? "var(--green)" : "var(--text-dim)"} fontWeight={on ? 700 : 400}>
                W<tspan dy="3" fontSize="8">hh</tspan>
                {mode === "backward" && <tspan dy="-3">ᵀ</tspan>}
              </text>
            </g>
          );
        })}

        {/* x_t up-arrows (label W_xh). Live in forward; greyed in backward. */}
        {Array.from({ length: T }, (_, k) => k + 1).map((t) => {
          const on = mode === "forward" && activeT === t;
          return (
            <g key={`x${t}`}>
              <line
                x1={boxCx(t)}
                y1={X_ARROW_Y}
                x2={boxCx(t)}
                y2={ROW_Y + BOX_H / 2 + 2}
                stroke={on ? "var(--green)" : "var(--border-variant)"}
                strokeWidth={on ? 2.4 : 1.3}
                markerEnd={on ? "url(#rnn-arr-on)" : "url(#rnn-arr-off)"}
              />
              {mode === "forward" && (
                <text x={boxCx(t) + 15} y={(X_ARROW_Y + ROW_Y + BOX_H / 2) / 2} textAnchor="start" fontSize={9.5} fill={on ? "var(--green)" : "var(--text-dim)"} fontWeight={on ? 700 : 400}>
                  W<tspan dy="3" fontSize="7">xh</tspan>
                </text>
              )}
              <text x={boxCx(t)} y={X_LABEL_Y} textAnchor="middle" fontSize={11} fill="var(--text-dim)">
                x<tspan dy="3" fontSize="8">{t}</tspan>
              </text>
            </g>
          );
        })}

        {/* Loss connector — backward mode only (this is where the sweep is seeded) */}
        {mode === "backward" &&
          (() => {
            const on = activeT === T;
            const hR = boxCx(T) + BOX_W / 2;
            const lL = lossCx(T) - LOSS_R;
            const stroke = on ? "var(--green)" : "var(--border-variant)";
            const marker = on ? "url(#rnn-arr-on)" : "url(#rnn-arr-off)";
            return (
              <g>
                <line x1={lL} y1={ROW_Y} x2={hR} y2={ROW_Y} stroke={stroke} strokeWidth={on ? 2.4 : 1.3} markerEnd={marker} />
                <text x={(hR + lL) / 2} y={ROW_Y - 15} textAnchor="middle" fontSize={11} fill={on ? "var(--green)" : "var(--text-dim)"} fontWeight={on ? 700 : 400}>
                  W<tspan dy="3" fontSize="8">hy</tspan>
                  <tspan dy="-3">ᵀ</tspan>
                </text>
              </g>
            );
          })()}

        {/* State boxes */}
        {Array.from({ length: T }, (_, k) => k + 1).map((t) => {
          const on = activeT === t;
          return (
            <g key={`b${t}`}>
              <rect
                x={boxCx(t) - BOX_W / 2}
                y={ROW_Y - BOX_H / 2}
                width={BOX_W}
                height={BOX_H}
                rx={4}
                fill={on ? "var(--green-container)" : "var(--surface-lowest)"}
                stroke={on ? "var(--green)" : "var(--border-variant)"}
                strokeWidth={on ? 2.4 : 1.3}
              />
              <text x={boxCx(t)} y={ROW_Y} dy="0.32em" textAnchor="middle" fontSize={13} fill={on ? "#04140d" : "var(--text)"} fontWeight={600}>
                h<tspan dy="3" fontSize="9">{t}</tspan>
              </text>
            </g>
          );
        })}

        {/* Loss node — backward mode only */}
        {mode === "backward" && (
          <>
            <circle cx={lossCx(T)} cy={ROW_Y} r={LOSS_R} fill="var(--surface-lowest)" stroke="var(--border-variant)" strokeWidth={1.3} />
            <text x={lossCx(T)} y={ROW_Y} dy="0.32em" textAnchor="middle" fontSize={14} fill="var(--text)" fontWeight={600}>
              ℓ
            </text>
          </>
        )}
      </svg>

      {/* The sequence is a fixed, invented example — one vector per token. */}
      <div style={{ fontSize: "0.78rem", color: "var(--text-dim)", textAlign: "center", marginTop: "-0.15rem" }}>
        Los xₜ son una secuencia de ejemplo fija: un vector inventado por cada token.
      </div>

      {/* Fixed parameters (forward mode) — the same W_hh, W_xh, b_h reused at every step */}
      {mode === "forward" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", padding: "0.7rem 0.85rem", borderRadius: "var(--radius)", border: "1px solid var(--border-variant)", background: "var(--surface-container)" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
            Pesos y sesgo, los mismos en cada paso:
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.9rem", alignItems: "flex-start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text)" }}>
                W<sub>hh</sub> ({DH}×{DH})
              </span>
              <MatrixGrid m={WHH} cellSize={40} ariaLabel="Matriz de pesos recurrentes W_hh" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text)" }}>
                W<sub>xh</sub> ({DH}×{D_MODEL})
              </span>
              <MatrixGrid m={WXH} cellSize={40} ariaLabel="Matriz de pesos de entrada W_xh" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text)" }}>
                b<sub>h</sub> ({DH}×1)
              </span>
              <MatrixGrid m={BH.map((v) => [v])} cellSize={40} ariaLabel="Vector de sesgo b_h" />
            </div>
          </div>
        </div>
      )}

      {/* Detail panel — what this step computes, with numbers */}
      <div
        aria-live="polite"
        style={{ padding: "0.7rem 0.85rem", borderRadius: "var(--radius)", border: "1px solid var(--border-variant)", background: "var(--surface-lowest)", fontVariantNumeric: "tabular-nums" }}
      >
        {mode === "forward" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.85rem" }}>
            <div style={{ fontWeight: 700, color: "var(--green)" }}>
              Paso t = {activeT}: h<sub>{activeT}</sub> = tanh( W<sub>hh</sub>·h<sub>{activeT - 1}</sub> + W<sub>xh</sub>·x<sub>{activeT}</sub> + b<sub>h</sub> )
            </div>
            <div style={{ color: "var(--text-dim)" }}>
              entra el estado h<sub>{activeT - 1}</sub> = {vec(fStep.hPrev)} y el token x<sub>{activeT}</sub> = {vec(fStep.x)}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem", color: "var(--text)" }}>
              <span>W<sub>hh</sub>·h<sub>{activeT - 1}</sub> = {vec(fStep.recurrent)}</span>
              <span>W<sub>xh</sub>·x<sub>{activeT}</sub> = {vec(fStep.input)}</span>
              <span>b<sub>h</sub> = {vec(BH)}</span>
            </div>
            <div style={{ color: "var(--text)" }}>
              su suma es la preactivación p<sub>{activeT}</sub> = {vec(fStep.p)}
            </div>
            <div style={{ color: "var(--text)" }}>
              h<sub>{activeT}</sub> = tanh(p<sub>{activeT}</sub>) = <strong>{vec(fStep.h)}</strong>
            </div>
            {activeT === 1 && (
              <div style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>
                En t = 1 la aportación recurrente W<sub>hh</sub>·h<sub>0</sub> es 0: el primer estado sale sólo del token.
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.85rem" }}>
            <div style={{ fontWeight: 700, color: "var(--green)" }}>Paso t = {activeT}</div>
            <div style={{ color: "var(--text-dim)" }}>
              {activeT === T ? (
                <>transporte (semilla desde ℓ): (ŷ − y)·W<sub>hy</sub>ᵀ = {vec(bStep.transport)}</>
              ) : (
                <>transporte: W<sub>hh</sub>ᵀ·δ<sub>{activeT + 1}</sub> = {vec(bStep.transport)}</>
              )}
            </div>
            <div style={{ color: "var(--text-dim)" }}>
              máscara ⊙ (1 − h<sub>{activeT}</sub>²) = {vec(bStep.mask)} &nbsp;→&nbsp; <span style={{ color: "var(--text)" }}>δ<sub>{activeT}</sub> = <strong>{vec(bStep.delta)}</strong></span>
            </div>
            <div style={{ color: "var(--text)" }}>
              aporte {accum === "Whh" ? <>δ<sub>{activeT}</sub>·h<sub>{activeT - 1}</sub>ᵀ</> : <>δ<sub>{activeT}</sub>·x<sub>{activeT}</sub>ᵀ</>} → ∇W<sub>{accum === "Whh" ? "hh" : "xh"}</sub>
              {accum === "Whh" && activeT === 1 && (
                <span style={{ color: "var(--text-dim)" }}> &nbsp;— es la matriz cero, porque h<sub>0</sub> = 0.</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Backward-only: the accumulator that sums a term per step */}
      {mode === "backward" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "0.7rem 0.85rem", borderRadius: "var(--radius)", border: "1px solid var(--border-variant)", background: "var(--surface-container)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>Acumulador:</span>
            <WidgetButton role="switch" active={accum === "Whh"} onClick={() => setAccum("Whh")}>
              ∇W_hh
            </WidgetButton>
            <WidgetButton role="switch" active={accum === "Wxh"} onClick={() => setAccum("Wxh")}>
              ∇W_xh
            </WidgetButton>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.9rem", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                aporte del paso t = {activeT}
              </span>
              <MatrixGrid
                m={accum === "Whh" ? bStep.whhTerm : bStep.wxhTerm}
                faded
                ariaLabel={`Aporte del paso ${activeT} a ∇W_${accum === "Whh" ? "hh" : "xh"}`}
              />
            </div>

            <div style={{ fontSize: "1.4rem", color: "var(--green)", fontWeight: 700 }} aria-hidden>
              ⊕→
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.72rem", color: "var(--text)" }}>
                ∇W<sub>{accum === "Whh" ? "hh" : "xh"}</sub> acumulado (forma {DH}×{accum === "Whh" ? DH : D_MODEL})
              </span>
              <MatrixGrid
                m={accum === "Whh" ? bStep.runWhh : bStep.runWxh}
                ariaLabel={`∇W_${accum === "Whh" ? "hh" : "xh"} acumulado tras ${bStep.termsSummed} de ${T} términos`}
              />
            </div>
          </div>

          <div style={{ fontSize: "0.82rem", color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
            términos sumados: <strong>{bStep.termsSummed}</strong> / {T}
            {accum === "Whh" && activeT === 1 && (
              <span style={{ color: "var(--text-dim)" }}> — el último no cambió nada (h₀ = 0).</span>
            )}
          </div>
        </div>
      )}

      {/* T slider — the key move: more terms, same d_h×d_h shape */}
      <Slider
        label="Longitud de la secuencia (T)"
        value={T}
        min={T_MIN}
        max={T_MAX}
        step={1}
        onChange={(v) => setT(v)}
        format={(v) => String(v)}
      />

      {/* Step controls */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
        <WidgetButton onClick={() => go(-1)} disabled={i === 0}>
          ◀ anterior
        </WidgetButton>
        <WidgetButton onClick={() => go(1)} disabled={i === T - 1}>
          siguiente ▶
        </WidgetButton>
        <WidgetButton onClick={() => setI(0)}>Reset</WidgetButton>
        <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", fontVariantNumeric: "tabular-nums" }}>
          paso {i + 1}/{T} · {mode === "forward" ? "t = " + activeT + " (adelante)" : "t = " + activeT + " (atrás)"}
        </span>
      </div>
    </div>
  );
}

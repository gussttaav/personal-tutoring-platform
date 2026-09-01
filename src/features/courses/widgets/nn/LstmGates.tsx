/*
 * COURSE-P5-03 — `lstm-gates`: feed a fixed sequence through a small LSTM and step
 * through it, watching the three gates (forget / input / output) open and close per
 * timestep and the cell state persist along the additive path (Block 3 lesson 5).
 *
 * The one knob is the forget-gate bias b_f — the same knob the lesson's first code
 * cell turns. Raising it pushes every forget gate toward 1, and the panel that makes
 * the point is «lo que sobrevive de c₁»: the running product ∏_{s=2}^{t} f_s, per
 * coordinate. At b_f = 1 it leaks to ~20% by the end of the sequence; at b_f = 3 it
 * holds ~78% — a leaky memory becoming a persistent one, with no change to any weight.
 * That is the whole difference between the RNN's fixed W_hh power and the LSTM's
 * chosen, per-coordinate product; the widget lets the student feel it.
 *
 * All numbers come from math/lstm (unit-tested against exact saturation cases and the
 * preset reference values the prose quotes). Local state only; keyboard-operable
 * (arrows step, the slider is a native range).
 */

"use client";

import { useMemo, useState } from "react";

import {
  runLstm,
  presetParams,
  LSTM_PRESET_XS,
  DEFAULT_FORGET_BIAS,
} from "../math/lstm";
import type { Vector } from "../math/linalg";
import { Slider } from "../primitives/Slider";
import { WidgetButton } from "../primitives/WidgetButton";

const T = LSTM_PRESET_XS.length; // 6
const DH = 3;
const BF_MIN = -2;
const BF_MAX = 4;
const BF_STEP = 0.5;

const pct = (v: number) => `${Math.round(v * 100)}%`;
const comma = (v: number) => v.toFixed(1).replace(".", ",");
const num = (v: number) => (Object.is(v, -0) ? "0.00" : v.toFixed(2));

/**
 * A row of d_h bars for one gate or state. `signed` draws from a centre line (for the
 * candidate and cell, which live in (−1, 1)); otherwise the bar fills from 0 (for the
 * gates, which live in (0, 1)).
 */
function Bars({
  values,
  signed = false,
  ariaLabel,
}: {
  values: Vector;
  signed?: boolean;
  ariaLabel: string;
}) {
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      style={{ display: "flex", gap: 4, alignItems: "stretch" }}
    >
      {values.map((v, k) => {
        const mag = Math.min(1, Math.abs(v));
        return (
          <div
            key={k}
            style={{
              position: "relative",
              width: 34,
              height: 30,
              borderRadius: 3,
              border: "1px solid var(--border-variant)",
              background: "var(--surface-lowest)",
              overflow: "hidden",
            }}
          >
            <div
              aria-hidden
              style={
                signed
                  ? {
                      position: "absolute",
                      left: 2,
                      right: 2,
                      height: `${mag * 46}%`,
                      [v >= 0 ? "bottom" : "top"]: "50%",
                      background: "var(--green)",
                      opacity: 0.55,
                      transition: "height .25s, background-color .25s",
                    }
                  : {
                      position: "absolute",
                      left: 0,
                      bottom: 0,
                      width: "100%",
                      height: `${mag * 100}%`,
                      background: "var(--green)",
                      opacity: 0.28 + mag * 0.5,
                      transition: "height .25s, opacity .25s",
                    }
              }
            />
            {signed && (
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: "50%",
                  borderTop: "1px dashed var(--border-variant)",
                }}
              />
            )}
            <span
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.62rem",
                fontVariantNumeric: "tabular-nums",
                color: "var(--text)",
              }}
            >
              {num(v)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
      <div style={{ width: 116, fontSize: "0.78rem", color: "var(--text-muted)" }}>
        <div style={{ color: "var(--text)", fontWeight: 600 }}>{label}</div>
        {hint && <div style={{ fontSize: "0.68rem", color: "var(--text-dim)" }}>{hint}</div>}
      </div>
      {children}
    </div>
  );
}

export default function LstmGates() {
  const [bf, setBf] = useState(DEFAULT_FORGET_BIAS);
  const [i, setI] = useState(0); // step index into steps[0..T-1]

  const steps = useMemo(() => runLstm(presetParams(bf), LSTM_PRESET_XS).steps, [bf]);
  const step = steps[i];
  const t = step.t;
  const survEnd = steps[T - 1].survival;

  const go = (d: number) => setI((v) => Math.max(0, Math.min(T - 1, v + d)));

  return (
    <div
      tabIndex={0}
      role="group"
      aria-label="LSTM con compuertas; usa las flechas para avanzar y retroceder por los pasos"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          go(1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          go(-1);
        }
      }}
      style={{ display: "flex", flexDirection: "column", gap: "0.85rem", width: "100%", outlineOffset: 3 }}
    >
      <Slider
        label="Sesgo de la compuerta de olvido, b_f"
        value={bf}
        min={BF_MIN}
        max={BF_MAX}
        step={BF_STEP}
        onChange={(v) => setBf(v)}
        format={comma}
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
          posición t = {t} / {T}
        </span>
      </div>

      {/* The three gates and the candidate/cell for the active step */}
      <div
        aria-live="polite"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.55rem",
          padding: "0.75rem 0.85rem",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border-variant)",
          background: "var(--surface-container)",
        }}
      >
        <Row label={<>fₜ · olvido</>} hint="qué conserva">
          <Bars values={step.f} ariaLabel={`Compuerta de olvido en t=${t}`} />
        </Row>
        <Row label={<>iₜ · entrada</>} hint="qué escribe">
          <Bars values={step.i} ariaLabel={`Compuerta de entrada en t=${t}`} />
        </Row>
        <Row label={<>oₜ · salida</>} hint="qué deja ver">
          <Bars values={step.o} ariaLabel={`Compuerta de salida en t=${t}`} />
        </Row>
        <Row label={<>c̃ₜ · candidato</>} hint="(−1 … 1)">
          <Bars values={step.cand} signed ariaLabel={`Candidato en t=${t}`} />
        </Row>
        <Row label={<>cₜ · celda</>} hint="fₜ⊙cₜ₋₁ + iₜ⊙c̃ₜ">
          <Bars values={step.c} signed ariaLabel={`Estado de celda en t=${t}`} />
        </Row>
      </div>

      {/* The payoff: what survives of c₁ along the additive path, up to this step */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          padding: "0.75rem 0.85rem",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border-variant)",
          background: "var(--surface-lowest)",
        }}
      >
        <Row label={<>de c₁ sobrevive</>} hint={`∏ fₛ, s=2…${t}`}>
          <Bars values={step.survival} ariaLabel={`Fracción de c₁ que sobrevive en t=${t}`} />
        </Row>
        <p style={{ fontSize: "0.8rem", color: "var(--text-dim)", margin: 0 }}>
          Con b_f = {comma(bf)}, de lo que se escribió en c₁ llega al final de la secuencia
          entre <strong style={{ color: "var(--text)" }}>{pct(Math.min(...survEnd))}</strong> y{" "}
          <strong style={{ color: "var(--text)" }}>{pct(Math.max(...survEnd))}</strong> —sin una
          matriz de por medio: sólo el producto de las compuertas de olvido, que la red elige
          coordenada a coordenada—.
        </p>
      </div>
    </div>
  );
}

/*
 * COURSE-P5-04 — `context-bottleneck`: a flat capacity against a demand that grows one
 * token at a time (Block 4 lesson 2). The x axis is the source length T_x; the two
 * lines are how many messages fit in the context vector (a constant — it does not know
 * how long the sentence is) and how many source sentences of that length exist. They
 * cross exactly once, and past the crossing the pigeonhole principle caps what ANY
 * decoder can reconstruct exactly.
 *
 * The knobs are the two things a practitioner could actually buy: a wider state (d_h)
 * and a cleaner one (q distinguishable levels per coordinate). Neither tilts the flat
 * line — they only raise it, so the crossing moves linearly while the demand keeps its
 * slope. That is the point the lesson makes, and the reason the widget has no «train it
 * harder» control: there is nothing training could move here.
 *
 * The y axis is in ORDERS OF MAGNITUDE because both counts are astronomical; all of it
 * comes from math/context-bottleneck, unit-tested against exact power-of-two cases and
 * the reference values this readout and the lesson's prose quote. Local state only.
 */

"use client";

import { useMemo, useState } from "react";

import { bottleneckCurves, codeOrders, log10Ceiling } from "../math/context-bottleneck";
import { Plot2D } from "../primitives/Plot2D";
import { Slider } from "../primitives/Slider";

const VOCAB = 32768; // |V_x|, fijo: 2^15 entradas, un vocabulario de subpalabras corriente
const VOCAB_LABEL = "32 768";
const MAX_LENGTH = 200; // tokens de la frase de entrada — el eje horizontal
const PAST_CROSSING = 10; // a cuántos tokens del cruce se lee el techo del readout

const DH_MIN = 32;
const DH_MAX = 512;
const DH_STEP = 32;
const DEFAULT_DH = 256;

const Q_MIN = 2;
const Q_MAX = 32;
const DEFAULT_Q = 8;

/** 231.19 → «10 elevado a 231», la única precisión que un número así admite. */
const exponent = (orders: number) => Math.round(orders);
const powerLabel = (orders: number) => `10 elevado a ${exponent(orders)}`;

function Power({ orders }: { orders: number }) {
  const e = exponent(orders);
  return (
    <strong style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
      10<sup>{e < 0 ? `−${Math.abs(e)}` : e}</sup>
    </strong>
  );
}

export default function ContextBottleneck() {
  const [dh, setDh] = useState(DEFAULT_DH);
  const [q, setQ] = useState(DEFAULT_Q);

  const { capacity, demand, crossing, yDomain, codes, ceilingPast } = useMemo(() => {
    const curves = bottleneckCurves(dh, q, VOCAB, MAX_LENGTH);
    return {
      ...curves,
      codes: codeOrders(dh, q),
      ceilingPast: log10Ceiling(curves.crossing + PAST_CROSSING, dh, q, VOCAB),
    };
  }, [dh, q]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", width: "100%" }}>
      <Slider
        label="Ancho del estado, d_h"
        value={dh}
        min={DH_MIN}
        max={DH_MAX}
        step={DH_STEP}
        onChange={setDh}
        format={(v) => `${v} coordenadas`}
      />
      <Slider
        label="Niveles distinguibles por coordenada, q"
        value={q}
        min={Q_MIN}
        max={Q_MAX}
        step={1}
        onChange={setQ}
        format={(v) => `${v} niveles`}
      />

      <Plot2D
        series={[
          // El cruce, dibujado primero para que las dos rectas queden por encima.
          {
            points: [
              [crossing, 0],
              [crossing, codes],
            ],
            color: "var(--border-variant)",
            width: 1,
          },
          { points: capacity, color: "var(--green)" },
          { points: demand, color: "var(--warning)" },
        ]}
        xDomain={[0, MAX_LENGTH]}
        yDomain={yDomain}
        ariaLabel={`Dos rectas frente a la longitud de la entrada, en ordenes de magnitud. La capacidad del vector de contexto es horizontal en ${powerLabel(codes)} mensajes distintos, con ${dh} coordenadas de ${q} niveles. El numero de frases de entrada sube 4.5 ordenes por token y cruza la capacidad en ${crossing} tokens.`}
      />

      <p style={{ fontSize: "0.8rem", color: "var(--text-dim)", margin: 0, lineHeight: 1.55 }}>
        Eje vertical: órdenes de magnitud (log₁₀) de un recuento.{" "}
        <span style={{ color: "var(--green)" }}>▬</span> mensajes que caben en c ·{" "}
        <span style={{ color: "var(--warning)" }}>▬</span> frases de entrada distintas de esa
        longitud, sobre un vocabulario de {VOCAB_LABEL} entradas.
      </p>

      <div
        aria-live="polite"
        style={{
          padding: "0.75rem 0.85rem",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border-variant)",
          background: "var(--surface-lowest)",
        }}
      >
        <p style={{ fontSize: "0.85rem", color: "var(--text-dim)", margin: 0, lineHeight: 1.6 }}>
          En {dh} coordenadas de {q} niveles caben <Power orders={codes} /> mensajes distintos, y eso
          alcanza para las frases de hasta{" "}
          <strong style={{ color: "var(--text)" }}>{crossing} tokens</strong>. A partir de ahí sobran
          frases: a los {crossing + PAST_CROSSING} tokens ningún decoder —ni el mejor posible,
          entrenado sin límite— devuelve exactas más que una fracción <Power orders={ceilingPast} />{" "}
          de ellas.
        </p>
      </div>
    </div>
  );
}

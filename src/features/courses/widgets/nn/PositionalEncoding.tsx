/*
 * COURSE-P5-05 — `positional-encoding`: the paper's sinusoidal encoding drawn as a field
 * (Block 5 lesson 5). Rows are positions, columns are coordinates of d_model.
 *
 * THE MAP SHOWS THE LADDER; THE PANEL SHOWS WHY IT IS A LADDER. Left of the grid the
 * columns flicker — pair 0 comes back round every 6.28 positions — and by the right-hand
 * edge a column is one flat band, because its wavelength is some 35 000 positions and no
 * text is that long. No static picture would be worse at this; what a picture cannot do
 * is the third slider.
 *
 * That third slider is the lesson's claim, and it is the reason this is a widget at all.
 * Pick an offset k and the panel prints PE_pos · PE_{pos+k} from the chosen position AND
 * from two others: the same number, every time, wherever the pair sits in the text. A
 * student who moves the position slider and watches that number refuse to move has seen
 * «las posiciones relativas se leen igual en toda la frase» rather than been told it.
 *
 * Every number comes from math/positional-encoding, which is unit-tested; this file only
 * draws them. Unlike lessons 2 and 4, NOTHING here is hand-set — it is the paper's
 * formula and the paper's 10000, which is what the footnote says.
 *
 * The signed field needs a two-sided ramp, so it takes two hues (emerald up, blue down,
 * both dark at zero) rather than the single-hue lightness ramp the attention maps use:
 * those are distributions and never go negative. Same reasoning as `Heatmap` — a
 * continuous field cannot come from the discrete CSS tokens — and everything around it
 * (labels, borders, the panel) still reads the tokens.
 */

"use client";

import { useMemo, useState } from "react";

import {
  BASE,
  DEFAULT_D,
  DEFAULT_T,
  MAX_SHIFT,
  angularFrequency,
  dot,
  isSine,
  overlap,
  pairOf,
  positionalEncoding,
  wavelength,
} from "../math/positional-encoding";
import { Slider } from "../primitives/Slider";
import { WidgetButton } from "../primitives/WidgetButton";

const D = DEFAULT_D;
const T = DEFAULT_T;

/** Cell geometry of the SVG grid, in viewBox units. */
const CELL_W = 10;
const CELL_H = 9;
const PAD_L = 24;
const PAD_T = 16;
/** Kept under 360 so the whole map fits a phone without a second scroll bar. */
const WIDTH = PAD_L + D * CELL_W + 4;
const HEIGHT = PAD_T + T * CELL_H + 4;

/** Emerald for a positive coordinate, blue for a negative one, dark at zero. */
function shade(v: number): string {
  const hue = v >= 0 ? 162 : 205;
  const light = 8 + Math.min(1, Math.abs(v)) * 44;
  return `hsl(${hue} 55% ${light}%)`;
}

const fmt = (v: number, places = 2) => v.toFixed(places);

/** Thousands take a space in this course's prose, not the Spanish locale's full stop. */
const grouped = (v: number) => Math.round(v).toLocaleString("es-ES").replace(/\./g, "\u202f");

/** Wavelengths run from 6.28 to 35 000, so the short ones keep their decimals. */
const positions = (cycle: number) =>
  cycle < 100 ? `${fmt(cycle, 2)} posiciones` : `${grouped(cycle)} posiciones`;

export default function PositionalEncoding() {
  const [pos, setPos] = useState(4);
  const [col, setCol] = useState(0);
  const [k, setK] = useState(3);

  // A few rows past the drawn grid, so pos + k never falls off the bottom.
  const pe = useMemo(() => positionalEncoding(T + MAX_SHIFT, D), []);

  const pair = pairOf(col);
  const cycle = wavelength(pair, D);
  const together = overlap(k, D);
  // Two positions the student did not choose — the panel's whole point is that these
  // agree with theirs. Coprime strides so they never collide with each other.
  const elsewhere = [(pos + 7) % T, (pos + 13) % T];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem", width: "100%" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <Slider
          label="posición en la frase"
          value={pos}
          min={0}
          max={T - 1}
          step={1}
          onChange={setPos}
          format={(v) => `${v}`}
        />
        <Slider
          label="coordenada de d_model"
          value={col}
          min={0}
          max={D - 1}
          step={1}
          onChange={setCol}
          format={(v) => `${v} — ${isSine(v) ? "seno" : "coseno"} del par ${pairOf(v)}`}
        />
        <Slider
          label="desplazamiento k"
          value={k}
          min={1}
          max={MAX_SHIFT}
          step={1}
          onChange={setK}
          format={(v) => `${v}`}
        />
      </div>

      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
        <WidgetButton onClick={() => setCol(0)} active={col === 0}>
          el par más rápido
        </WidgetButton>
        <WidgetButton onClick={() => setCol(D - 2)} active={col === D - 2}>
          el par más lento
        </WidgetButton>
        <WidgetButton
          onClick={() => {
            setPos(4);
            setCol(0);
            setK(3);
          }}
        >
          reiniciar
        </WidgetButton>
      </div>

      <div style={{ overflowX: "auto" }}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          width="100%"
          role="img"
          aria-label={`Codificación posicional: ${T} posiciones en filas por ${D} coordenadas en columnas. Las columnas de la izquierda oscilan cada pocas posiciones y las de la derecha son casi constantes.`}
          style={{ display: "block", minWidth: WIDTH, maxWidth: 560 }}
        >
          {[0, 8, 16, 24, D - 2].map((c) => (
            <text
              key={`cl${c}`}
              x={PAD_L + c * CELL_W + CELL_W / 2}
              y={PAD_T - 5}
              textAnchor="middle"
              fontSize={9}
              fill="var(--text-dim)"
            >
              {c}
            </text>
          ))}
          {Array.from({ length: T }, (_, p) => p)
            .filter((p) => p % 4 === 0)
            .map((p) => (
              <text
                key={`rl${p}`}
                x={PAD_L - 5}
                y={PAD_T + p * CELL_H + CELL_H / 2}
                dy="0.32em"
                textAnchor="end"
                fontSize={9}
                fill="var(--text-dim)"
              >
                {p}
              </text>
            ))}

          {Array.from({ length: T }, (_, p) =>
            Array.from({ length: D }, (_, c) => (
              <rect
                key={`${p}-${c}`}
                x={PAD_L + c * CELL_W}
                y={PAD_T + p * CELL_H}
                width={CELL_W}
                height={CELL_H}
                fill={shade(pe[p][c])}
                shapeRendering="crispEdges"
              />
            )),
          )}

          <rect
            x={PAD_L + col * CELL_W - 1}
            y={PAD_T - 1}
            width={CELL_W + 2}
            height={T * CELL_H + 2}
            fill="none"
            stroke="var(--text)"
            strokeWidth={1}
            opacity={0.85}
          />
          <rect
            x={PAD_L - 1}
            y={PAD_T + pos * CELL_H - 1}
            width={D * CELL_W + 2}
            height={CELL_H + 2}
            fill="none"
            stroke="var(--green)"
            strokeWidth={1.4}
          />
          {pos + k < T ? (
            <rect
              x={PAD_L - 1}
              y={PAD_T + (pos + k) * CELL_H - 1}
              width={D * CELL_W + 2}
              height={CELL_H + 2}
              fill="none"
              stroke="var(--green)"
              strokeWidth={1.4}
              strokeDasharray="3 2"
            />
          ) : null}
        </svg>
      </div>

      <div
        aria-live="polite"
        style={{
          padding: "0.7rem 0.8rem",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border-variant)",
          background: "var(--surface-lowest)",
          display: "flex",
          flexDirection: "column",
          gap: "0.4rem",
        }}
      >
        <p style={{ fontSize: "0.78rem", color: "var(--text-dim)", margin: 0, lineHeight: 1.5 }}>
          La coordenada <strong style={{ color: "var(--text)" }}>{col}</strong> es el{" "}
          {isSine(col) ? "seno" : "coseno"} del par {pair}, que gira a{" "}
          <strong style={{ color: "var(--text)" }}>{fmt(angularFrequency(pair, D), 4)}</strong>{" "}
          radianes por posición: vuelve al mismo sitio cada {positions(cycle)}.
        </p>
        <p style={{ fontSize: "0.78rem", color: "var(--text-dim)", margin: 0, lineHeight: 1.5 }}>
          En la posición <strong style={{ color: "var(--text)" }}>{pos}</strong> esa coordenada vale{" "}
          <strong style={{ color: "var(--green)" }}>{fmt(pe[pos][col], 3)}</strong>, y {k}{" "}
          posiciones más allá vale{" "}
          <strong style={{ color: "var(--green)" }}>{fmt(pe[pos + k][col], 3)}</strong>
          {fmt(pe[pos + k][col], 3) === fmt(pe[pos][col], 3)
            ? " —el mismo número: esta pareja gira tan despacio que no separa las dos posiciones—."
            : "."}
        </p>
        <p
          style={{
            fontSize: "0.78rem",
            color: "var(--text)",
            margin: 0,
            paddingTop: "0.35rem",
            borderTop: "1px solid var(--border-variant)",
            lineHeight: 1.6,
          }}
        >
          Lo que dos posiciones a distancia {k} puntúan entre ellas:
          <br />
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            desde {pos} → <strong style={{ color: "var(--green)" }}>{fmt(dot(pe[pos], pe[pos + k]), 3)}</strong>
            {elsewhere.map((p) => (
              <span key={p}>
                {" · "}desde {p} →{" "}
                <strong style={{ color: "var(--green)" }}>{fmt(dot(pe[p], pe[p + k]), 3)}</strong>
              </span>
            ))}
          </span>
          <br />
          <span style={{ color: "var(--text-dim)" }}>
            Mueve la posición y ese número no se mueve: vale {fmt(together, 3)} en toda la frase.
            Cambia k y cambia.
          </span>
        </p>
      </div>

      <p style={{ fontSize: "0.7rem", color: "var(--text-dim)", margin: 0, lineHeight: 1.6 }}>
        {T} posiciones y {D} de las coordenadas, que es lo que cabe en una pantalla; un modelo del
        artículo tiene 512. Aquí no hay nada puesto a mano: son la fórmula del artículo y su
        constante {grouped(BASE)}, y los colores dicen el signo —verde positivo, azul negativo,
        oscuro cerca de cero—.
      </p>
    </div>
  );
}

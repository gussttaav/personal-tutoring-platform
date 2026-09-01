/*
 * COURSE-P5-05 — `self-attention-heatmap`: one Spanish sentence attending to itself
 * (Block 5 lessons 2 and 7). Rows and columns are the SAME tokens — that is the whole
 * difference from `attention-alignment`, whose grid had a source on one axis and a
 * target on the other — so cell (i, j) is how much of position j goes into what
 * position i reads. Type a sentence, pick a row (hover, tap, Tab or arrow keys), and the
 * line underneath says what that position leans on.
 *
 * THE TOGGLE IS THE TEACHING MOVE, and it is why this is a widget and not a figure.
 * «Sin proyectar» sets Q = K = V = X: the three lists become the sentence itself, and
 * the map collapses onto its own diagonal — every position mostly copying what it
 * already had, which is a layer that computes nothing. Flip the projections back on and
 * the structure appears: «están» reaches past «coche» to «llaves». The three matrices
 * are not plumbing, they are what makes «mirarse a sí misma» more than the identity.
 *
 * Every row prints its own sum, for the reason `attention-alignment` does: a row summing
 * to 0.97 looks exactly like a row summing to 1, and «cada fila reparte una unidad» is
 * the one claim on the page a reader cannot check by eye. All the numbers come from
 * math/self-attention, which is unit-tested; this file only draws them. Local state only.
 *
 * THE SECOND TOGGLE IS LESSON 7's (encoder, decoder y máscaras). «Con máscara causal»
 * blanks every cell to the right of the diagonal — position i may look at 1..i and at
 * nothing after — and the rows that survive renormalise themselves, so the sum column
 * still reads 1.00 on every row. That is the claim a static picture cannot make: the
 * mask is not a rule applied after the fact, it goes in before the softmax, which is why
 * nothing is left over. Row 1 is the degenerate case and the widget lands it for free:
 * with nowhere else to look, it gives itself 1.00.
 *
 * The vectors and the projections are hand-set — mine, not a trained model's — and the
 * component says so under the map rather than letting the reader assume otherwise. A
 * token outside the lexicon is marked with a dot and named in that same line: its vector
 * comes from a hash of its own letters, so its row means nothing.
 */

"use client";

import { useMemo, useRef, useState } from "react";

import { rowSums, topSource } from "../math/attention-alignment";
import {
  D_K,
  D_MODEL,
  D_V,
  LEXICON_WORDS,
  MAX_TOKENS,
  PRESETS,
  selfAttentionMap,
} from "../math/self-attention";
import { WidgetButton } from "../primitives/WidgetButton";

const LABEL_W = 78;
const CELL_MIN = 36;
const CELL_MAX = 54;
const SUM_W = 34;
const GAP = 2;

/** Same ramp as the alignment map: a row of T weights crowds the low end, and a linear
 *  lightness would crush 0.03 and 0.14 into the same near-black. */
const shade = (w: number) =>
  `hsl(162 55% ${8 + Math.pow(Math.max(0, Math.min(1, w)), 0.55) * 44}%)`;

const fmt2 = (v: number) => v.toFixed(2);

/** Column headings are tokens, and a long one would push the grid wider than a phone. */
const short = (token: string) => (token.length > 6 ? `${token.slice(0, 5)}·` : token);

export default function SelfAttentionHeatmap() {
  const [text, setText] = useState<string>(PRESETS[0]);
  const [project, setProject] = useState(true);
  const [causal, setCausal] = useState(false);
  // «están» in the first preset: the row the lesson's prose points at, so the widget
  // lands its claim before the reader touches anything.
  const [row, setRow] = useState(4);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const map = useMemo(() => selfAttentionMap(text, project, causal), [text, project, causal]);
  const { tokens, known, truncated, weights } = map;
  const t = tokens.length;

  // Clamped rather than synced: the sentence changes under the selection on every
  // keystroke, and an effect that chased it would fight the input for a render.
  const step = Math.min(row, Math.max(0, t - 1));
  const sums = rowSums(weights);
  const peak = t > 0 ? topSource(weights[step]) : null;
  const unknown = tokens.filter((_, i) => !known[i]);

  const columns = `${LABEL_W}px repeat(${t}, minmax(${CELL_MIN}px, ${CELL_MAX}px)) ${SUM_W}px`;
  const gridWidth = (cell: number) => LABEL_W + t * cell + SUM_W + (t + 1) * GAP;

  const move = (from: number, delta: number) => {
    const next = (from + delta + t) % t;
    setRow(next);
    rowRefs.current[next]?.focus();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem", width: "100%" }}>
      <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
        <span style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
          Escribe una frase (se queda en los primeros {MAX_TOKENS} tokens)
        </span>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          style={{
            width: "100%",
            padding: "0.45rem 0.6rem",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border-variant)",
            background: "var(--surface-lowest)",
            color: "var(--text)",
            fontSize: "0.9rem",
          }}
        />
      </label>

      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
        {PRESETS.map((preset) => (
          <WidgetButton key={preset} active={text === preset} onClick={() => setText(preset)}>
            {preset.split(" ").slice(0, 2).join(" ")}…
          </WidgetButton>
        ))}
      </div>

      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
        <WidgetButton active={project} aria-pressed={project} onClick={() => setProject(true)}>
          Con proyecciones
        </WidgetButton>
        <WidgetButton active={!project} aria-pressed={!project} onClick={() => setProject(false)}>
          Sin proyectar
        </WidgetButton>
      </div>

      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
        <WidgetButton active={!causal} aria-pressed={!causal} onClick={() => setCausal(false)}>
          Sin máscara
        </WidgetButton>
        <WidgetButton active={causal} aria-pressed={causal} onClick={() => setCausal(true)}>
          Con máscara causal
        </WidgetButton>
      </div>

      {t === 0 ? (
        <p style={{ fontSize: "0.85rem", color: "var(--text-dim)", margin: 0 }}>
          Escribe algo y aparecerá la rejilla.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: gridWidth(CELL_MIN), maxWidth: gridWidth(CELL_MAX) }}>
            {/* Columns are the same tokens as the rows: the sentence against itself. */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: columns,
                gap: GAP,
                paddingBottom: 4,
                fontSize: "0.6rem",
                color: "var(--text-dim)",
              }}
            >
              <span />
              {tokens.map((token, j) => (
                <span key={`h${j}`} style={{ textAlign: "center" }}>
                  {short(token)}
                </span>
              ))}
              <span style={{ textAlign: "center" }}>suma</span>
            </div>

            <div
              role="group"
              aria-label="Mapa de auto-atención: elige una posición para ver de qué otras tira"
              style={{ display: "flex", flexDirection: "column", gap: GAP }}
            >
              {tokens.map((token, i) => {
                const selected = i === step;
                return (
                  <button
                    key={`r${i}`}
                    type="button"
                    ref={(el) => {
                      rowRefs.current[i] = el;
                    }}
                    aria-pressed={selected}
                    onClick={() => setRow(i)}
                    onFocus={() => setRow(i)}
                    onMouseEnter={() => setRow(i)}
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
                      gridTemplateColumns: columns,
                      gap: GAP,
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
                        gap: 4,
                        paddingLeft: 4,
                        fontSize: "0.66rem",
                        color: selected ? "var(--text)" : "var(--text-muted)",
                        fontWeight: selected ? 600 : 400,
                      }}
                    >
                      {short(token)}
                      {known[i] ? null : (
                        <span aria-hidden style={{ color: "var(--text-dim)" }}>
                          •
                        </span>
                      )}
                    </span>
                    {weights[i].map((w, j) => {
                      // A masked cell is drawn as absent rather than as 0.00: the row is
                      // a distribution over what is left of it, and shade(0) is so close
                      // to shade(0.02) that the triangle would not read.
                      const tachada = causal && j > i;
                      return (
                        <span
                          key={`c${j}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            height: 26,
                            borderRadius: 3,
                            background: tachada ? "var(--surface-lowest)" : shade(w),
                            border: tachada ? "1px dashed var(--border-variant)" : "none",
                            color: "#e6fff4",
                            fontSize: "0.64rem",
                            fontVariantNumeric: "tabular-nums",
                            boxShadow:
                              selected && i === j
                                ? "inset 0 0 0 1.5px rgba(230,255,244,0.75)"
                                : selected && !tachada
                                  ? "inset 0 0 0 1px rgba(78,222,163,0.55)"
                                  : "none",
                          }}
                        >
                          {tachada ? "" : fmt2(w)}
                        </span>
                      );
                    })}
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.64rem",
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
      )}

      {t > 0 && peak !== null ? (
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
            {causal ? (
              <>
                {step === 0 ? (
                  <>
                    Con la máscara, la posición 1 no tiene nada detrás:{" "}
                    <strong style={{ color: "var(--text)" }}>{tokens[0]}</strong> se lleva{" "}
                    {fmt2(weights[0][0])} sobre sí misma y {t - 1}{" "}
                    {t - 1 === 1 ? "casilla queda tachada" : "casillas quedan tachadas"} a su
                    derecha. La fila suma {fmt2(sums[0])} igual que las demás: lo que se tacha se
                    reparte entre lo que queda, porque la máscara entra antes del softmax.
                  </>
                ) : (
                  <>
                    Con la máscara, la posición {step + 1},{" "}
                    <strong style={{ color: "var(--text)" }}>{tokens[step]}</strong>, sólo puede
                    mirar de la 1 a la {step + 1}. Su peso más alto —{fmt2(peak.weight)}— va a{" "}
                    <strong style={{ color: "var(--text)" }}>{tokens[peak.index]}</strong>, y la
                    fila sigue sumando {fmt2(sums[step])} con {t - 1 - step}{" "}
                    {t - 1 - step === 1 ? "casilla tachada" : "casillas tachadas"}.
                  </>
                )}
              </>
            ) : project ? (
              <>
                La posición {step + 1},{" "}
                <strong style={{ color: "var(--text)" }}>{tokens[step]}</strong>, le da su peso más
                alto —{fmt2(peak.weight)}— a{" "}
                <strong style={{ color: "var(--text)" }}>{tokens[peak.index]}</strong>, y{" "}
                {fmt2(weights[step][step])} a sí misma. La fila entera suma {fmt2(sums[step])}.
              </>
            ) : (
              <>
                Sin proyectar, la posición {step + 1},{" "}
                <strong style={{ color: "var(--text)" }}>{tokens[step]}</strong>, se queda con su
                propio peso más alto: {fmt2(weights[step][step])} sobre sí misma, contra{" "}
                {fmt2(Math.max(...weights[step].filter((_, j) => j !== step)))} del mejor de los
                demás. Y pasa en las {t} filas a la vez: la diagonal gana siempre. Una capa así
                devuelve lo que le entró con un tinte de lo demás, y no tiene un solo parámetro con
                el que decidir otra cosa.
              </>
            )}
          </p>
        </div>
      ) : null}

      <p style={{ fontSize: "0.7rem", color: "var(--text-dim)", margin: 0, lineHeight: 1.6 }}>
        Los vectores ({D_MODEL} coordenadas, {LEXICON_WORDS.length} palabras en el léxico) y las
        proyecciones —{D_K} coordenadas para comparar, {D_V} para mezclar— los he puesto yo a mano
        para el curso; ningún modelo entrenado hay aquí dentro.
        {causal ? " Las casillas de trazo discontinuo son las que la máscara tacha." : ""}
        {unknown.length > 0
          ? ` Fuera del léxico: ${unknown.join(", ")} — su vector sale de un hash de sus letras, así que esa fila no dice nada.`
          : ""}
        {truncated ? ` La frase se ha cortado en ${MAX_TOKENS} tokens.` : ""}
      </p>
    </div>
  );
}

/*
 * COURSE-P5-05 — `multi-head-view`: one Spanish sentence, several attention heads
 * (Block 5 lesson 4). Same grid as `self-attention-heatmap` — rows and columns are the
 * same tokens — but there are now h of them, and the fifth view is lesson 2's SINGLE
 * head, which holds the same four rules added together before one softmax.
 *
 * THE PANEL UNDER THE MAP IS THE WIDGET. Switching maps one at a time shows that they
 * differ; the panel shows WHAT they differ about, for one position, all at once: the
 * verb→noun head ties «llaves» with «coche» because it never looks at number, the
 * agreement head separates them by sixty, two heads say nothing at all about that row,
 * and the single head has to answer with one number per column. That line is the reason
 * this is a widget and not a figure — no static picture can be five maps at a chosen row.
 *
 * A flat row is reported as flat rather than dressed up with an arbitrary winner, and a
 * tie is reported as a tie, because both are things these heads genuinely do (see
 * math/multi-head). Every number comes from that module, which is unit-tested; this file
 * only draws them. Local state only, keyboard-operable, colours from the CSS tokens.
 *
 * The vectors and the rules are lesson 2's and they are mine, set by hand for the course
 * — and so is d_k = 1 per head, which is what makes a head readable and is NOT what a
 * real layer uses. The footnote says both.
 */

"use client";

import { useMemo, useRef, useState } from "react";

import { rowSums } from "../math/attention-alignment";
import {
  D_K_HEAD,
  H,
  HEADS,
  MH_PRESETS,
  isFlatRow,
  multiHeadMaps,
  rowPeak,
} from "../math/multi-head";
import { LEXICON_WORDS, MAX_TOKENS } from "../math/self-attention";
import { WidgetButton } from "../primitives/WidgetButton";

const LABEL_W = 78;
const CELL_MIN = 36;
const CELL_MAX = 54;
const SUM_W = 34;
const GAP = 2;

/** The ramp `self-attention-heatmap` uses: a row of T weights crowds the low end. */
const shade = (w: number) =>
  `hsl(162 55% ${8 + Math.pow(Math.max(0, Math.min(1, w)), 0.55) * 44}%)`;

const fmt2 = (v: number) => v.toFixed(2);
const short = (token: string) => (token.length > 6 ? `${token.slice(0, 5)}·` : token);

/** `H` is the single-head view: the same four rules through one softmax. */
const SINGLE = H;

export default function MultiHeadView() {
  const [text, setText] = useState<string>(MH_PRESETS[3]);
  // «concordancia de número», the head whose map has something to say in most rows.
  const [view, setView] = useState(1);
  // «duerme» in that sentence: the row the lesson's motivation argues from.
  const [row, setRow] = useState(7);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const map = useMemo(() => multiHeadMaps(text), [text]);
  const { tokens, known, truncated, heads, single } = map;
  const t = tokens.length;

  const shown = view === SINGLE ? single.weights : heads[view].weights;
  // Clamped rather than synced: the sentence changes under the selection on every
  // keystroke, and an effect chasing it would fight the input for a render.
  const step = Math.min(row, Math.max(0, t - 1));
  const sums = rowSums(shown);
  const unknown = tokens.filter((_, i) => !known[i]);

  const columns = `${LABEL_W}px repeat(${t}, minmax(${CELL_MIN}px, ${CELL_MAX}px)) ${SUM_W}px`;
  const gridWidth = (cell: number) => LABEL_W + t * cell + SUM_W + (t + 1) * GAP;

  const move = (from: number, delta: number) => {
    const next = (from + delta + t) % t;
    setRow(next);
    rowRefs.current[next]?.focus();
  };

  /** Where one map sends the selected row's weight, ties and silences included. */
  const verdict = (weights: number[][]) => {
    const r = weights[step];
    if (isFlatRow(r)) return "reparte por igual entre todas — esta regla no dice nada de esta posición";
    const { weight, tied } = rowPeak(r);
    const names = tied.map((j) => tokens[j]).join(", ");
    return tied.length > 1
      ? `empate entre ${names}, a ${fmt2(weight)} cada una`
      : `${names}, con ${fmt2(weight)}`;
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
        {MH_PRESETS.map((preset) => (
          <WidgetButton key={preset} active={text === preset} onClick={() => setText(preset)}>
            {preset.split(" ").slice(0, 2).join(" ")}…
          </WidgetButton>
        ))}
      </div>

      <div
        role="group"
        aria-label="Qué mapa se dibuja"
        style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}
      >
        {HEADS.map((head, r) => (
          <WidgetButton
            key={head.short}
            active={view === r}
            aria-pressed={view === r}
            onClick={() => setView(r)}
          >
            {r + 1}. {head.short}
          </WidgetButton>
        ))}
        <WidgetButton
          active={view === SINGLE}
          aria-pressed={view === SINGLE}
          onClick={() => setView(SINGLE)}
        >
          una sola cabeza
        </WidgetButton>
      </div>

      <p style={{ fontSize: "0.72rem", color: "var(--text-dim)", margin: 0, lineHeight: 1.6 }}>
        {view === SINGLE
          ? "Las cuatro reglas sumadas antes de un único softmax: una fila por posición y nada más."
          : `Cabeza ${view + 1} de ${H}: ${HEADS[view].name}.`}
      </p>

      {t === 0 ? (
        <p style={{ fontSize: "0.85rem", color: "var(--text-dim)", margin: 0 }}>
          Escribe algo y aparecerán las rejillas.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: gridWidth(CELL_MIN), maxWidth: gridWidth(CELL_MAX) }}>
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
              aria-label="Elige una posición para compararla en todas las cabezas"
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
                    {shown[i].map((w, j) => (
                      <span
                        key={`c${j}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          height: 26,
                          borderRadius: 3,
                          background: shade(w),
                          color: "#e6fff4",
                          fontSize: "0.64rem",
                          fontVariantNumeric: "tabular-nums",
                          boxShadow: selected
                            ? "inset 0 0 0 1px rgba(78,222,163,0.55)"
                            : "none",
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

      {t > 0 ? (
        <div
          aria-live="polite"
          style={{
            padding: "0.7rem 0.8rem",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border-variant)",
            background: "var(--surface-lowest)",
            display: "flex",
            flexDirection: "column",
            gap: "0.35rem",
          }}
        >
          <p style={{ fontSize: "0.78rem", color: "var(--text-dim)", margin: 0 }}>
            A qué tira la posición {step + 1},{" "}
            <strong style={{ color: "var(--text)" }}>{tokens[step]}</strong>, en cada mapa:
          </p>
          {heads.map((head, r) => (
            <p
              key={head.short}
              style={{
                fontSize: "0.78rem",
                color: r === view ? "var(--text)" : "var(--text-dim)",
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: r === view ? "var(--green)" : "var(--text-muted)" }}>
                {r + 1}. {head.short}
              </strong>{" "}
              → {verdict(head.weights)}
            </p>
          ))}
          <p
            style={{
              fontSize: "0.78rem",
              color: view === SINGLE ? "var(--text)" : "var(--text-dim)",
              margin: 0,
              paddingTop: "0.25rem",
              borderTop: "1px solid var(--border-variant)",
              lineHeight: 1.5,
            }}
          >
            <strong
              style={{ color: view === SINGLE ? "var(--green)" : "var(--text-muted)" }}
            >
              una sola cabeza
            </strong>{" "}
            → {verdict(single.weights)}
          </p>
        </div>
      ) : null}

      <p style={{ fontSize: "0.7rem", color: "var(--text-dim)", margin: 0, lineHeight: 1.6 }}>
        Las {H} cabezas son las {H} reglas del léxico ({LEXICON_WORDS.length} palabras) de la lección
        anterior, una por cabeza, y las he escrito yo a mano para el curso. Por eso aquí cada cabeza
        compara en {D_K_HEAD} coordenada: es lo que hace legible una regla, no lo que usa una capa de
        verdad, que reparte entre sus cabezas la anchura del modelo.
        {unknown.length > 0
          ? ` Fuera del léxico: ${unknown.join(", ")} — su vector sale de un hash de sus letras, así que esa fila no dice nada.`
          : ""}
        {truncated ? ` La frase se ha cortado en ${MAX_TOKENS} tokens.` : ""}
      </p>
    </div>
  );
}

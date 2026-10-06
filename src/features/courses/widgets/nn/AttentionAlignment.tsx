/*
 * COURSE-P5-04 — `attention-alignment`: the alignment map of one translation pair
 * (Block 4 lessons 3 and 4). Rows are output steps, columns are source positions, and
 * cell (i, j) is α_ij — how much of the encoder state at j goes into the context vector
 * that step i reads. Pick a row (hover, tap, Tab or arrow keys) and the widget says
 * which source token that step leans on and draws the c_i it builds.
 *
 * The frozen alignment of the fixed summary (all the mass on the last source position,
 * at every step) is NOT a mode here. It used to be a «resumen fijo» toggle, and all it
 * showed was one lit column and a c_i strip that stopped moving: a sentence's worth of
 * content, which the lesson says in a sentence, an equation, its code cell and a quiz.
 * The widget keeps the one thing prose cannot do as well: walking the rows of a real
 * alignment.
 *
 * Every row prints its own sum next to it. That is not decoration — a row summing to
 * 0.97 looks exactly like a row summing to 1, and the claim that c_i is a MIXTURE (a
 * convex combination of states, never bigger than the biggest of them) is the one thing
 * a reader cannot check by eye. The numbers all come from math/attention-alignment,
 * which is unit-tested. Local state only.
 *
 * COURSE-P11-02 — the copy is `courses.widgets.attention-alignment`. The CORPUS stays
 * where it is: it is a Spanish→English translation pair, which is the subject of Block 4
 * and reads the same way to either audience — see SPANISH_BOUND_CORPORA in ../corpora.ts.
 */

"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import {
  ALIGNMENT_SOURCE,
  ALIGNMENT_TARGET,
  ATTENTION_ALIGNMENT,
  rowSums,
  topSource,
} from "../math/attention-alignment";

const T_X = ALIGNMENT_SOURCE.length;
const T_Y = ALIGNMENT_TARGET.length;

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
  const t = useTranslations("courses.widgets.attention-alignment");
  const tc = useTranslations("courses.widgets.common");
  const [step, setStep] = useState(6); // «book», the row where the lines cross
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const alpha = ATTENTION_ALIGNMENT;
  const sums = rowSums(alpha);
  const peak = topSource(alpha[step]);

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
            <span style={{ textAlign: "center" }}>{tc("sum")}</span>
          </div>

          <div
            role="group"
            aria-label={t("mapAria")}
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
          {t.rich("attentionNote", {
            step: step + 1,
            target: ALIGNMENT_TARGET[step],
            source: ALIGNMENT_SOURCE[peak.index],
            weight: fmt2(peak.weight),
            sum: fmt2(sums[step]),
            tgt: (chunks) => <strong style={{ color: "var(--text)" }}>{chunks}</strong>,
            src: (chunks) => <strong style={{ color: "var(--text)" }}>{chunks}</strong>,
          })}
        </p>
      </div>
    </div>
  );
}

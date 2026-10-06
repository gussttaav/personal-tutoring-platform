/*
 * COURSE-C2-P1-02 — `bradley-terry` (llm-agents Block 2 lesson 4, «Preferencias y el modelo de
 * recompensa»).
 *
 * Two responses to one instruction, A and B, with a reward each. Three sliders: r_A, r_B, and a
 * constant c added to both. Three views of one comparison:
 *
 *   - the reward line: where the two rewards sit (with c added) and the margin between them;
 *   - P(A ≻ B) = σ(r_A − r_B) against the margin, with the current margin marked;
 *   - the loss of the comparison «A was chosen», −log σ(r_A − r_B), against the margin, marked.
 *
 * Moving c slides both points along the reward line and nothing else on the widget moves: the
 * probability, the loss and its slope read the margin only. That is the lesson's invariance —
 * the reward is defined up to a constant per instruction — seen before it is written.
 *
 * Every number comes from ../math/bradley-terry. The charts draw in real pixels (the
 * `scaling-laws` pattern): a fixed viewBox scaled to a 360px phone shrank labels below 7px.
 * Strings are `courses.widgets.bradley-terry`; r_A, r_B, c and σ are notation and do not move
 * between locales.
 */

"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";

import { comparisonLoss, lossSlope, preferProbability, sampleCurve } from "../math/bradley-terry";
import { Slider } from "../primitives/Slider";
import { WidgetButton } from "../primitives/WidgetButton";

const DEFAULTS = { rA: 1.5, rB: 0.5, c: 0 };
const R_RANGE: [number, number] = [-4, 4];
const C_RANGE: [number, number] = [-3, 3];
/** The reward line has to hold r + c at its extremes. */
const LINE_DOMAIN: [number, number] = [-7, 7];
/** The margin r_A − r_B spans twice the reward range. */
const MARGIN_DOMAIN: [number, number] = [-8, 8];
const LOSS_DOMAIN: [number, number] = [0, 8];

const A_COLOR = "var(--green)";
const B_COLOR = "var(--warning)";
const CURVE_COLOR = "var(--text-muted)";

const DEFAULT_W = 480;
const TICK_FONT = 10.5;
/** A number as the widget prints it: d decimals, no «-0.00», and a true minus sign. */
const fmt = (v: number, d = 2) => {
  const s = (Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).toFixed(d);
  return s.startsWith("-") ? `\u2212${s.slice(1)}` : s;
};

function useWidth(): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(DEFAULT_W);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(220, Math.round(el.clientWidth)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

const caption: CSSProperties = { fontSize: "0.8rem", color: "var(--text-dim)", marginBottom: "0.25rem" };
const readout: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
  fontSize: "0.82rem",
  fontVariantNumeric: "tabular-nums",
  color: "var(--text-muted)",
};

const sub = (chunks: ReactNode) => <sub>{chunks}</sub>;
const strong = (chunks: ReactNode) => <strong style={{ color: "var(--text)" }}>{chunks}</strong>;

// ── The reward line ──────────────────────────────────────────────────────────────────────────

function RewardLine({ a, b, label }: { a: number; b: number; label: string }) {
  const [box, W] = useWidth();
  const M = { left: 14, right: 14 };
  const H = 86;
  const axisY = 44;
  const iw = W - M.left - M.right;
  const x = (v: number) => M.left + ((v - LINE_DOMAIN[0]) / (LINE_DOMAIN[1] - LINE_DOMAIN[0])) * iw;
  const ticks = [-6, -4, -2, 0, 2, 4, 6];
  const bracketY = axisY + 22;
  return (
    <div ref={box} style={{ width: "100%" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={label} style={{ display: "block" }}>
        <line x1={M.left} x2={W - M.right} y1={axisY} y2={axisY} stroke="var(--border-variant)" strokeWidth={1.5} />
        {ticks.map((t) => (
          <g key={t} transform={`translate(${x(t)},${axisY})`}>
            <line y1={-4} y2={4} stroke="var(--border-variant)" strokeWidth={1} />
            <text y={-9} textAnchor="middle" fontSize={TICK_FONT} fill="var(--text-dim)">
              {fmt(t, 0)}
            </text>
          </g>
        ))}
        {/* The margin, as a bracket from B to A. */}
        <line x1={x(b)} x2={x(a)} y1={bracketY} y2={bracketY} stroke="var(--text-dim)" strokeWidth={1.2} />
        <line x1={x(b)} x2={x(b)} y1={bracketY - 4} y2={bracketY + 4} stroke="var(--text-dim)" strokeWidth={1.2} />
        <line x1={x(a)} x2={x(a)} y1={bracketY - 4} y2={bracketY + 4} stroke="var(--text-dim)" strokeWidth={1.2} />
        <circle cx={x(b)} cy={axisY} r={6.5} fill={B_COLOR} />
        <circle cx={x(a)} cy={axisY} r={6.5} fill={A_COLOR} fillOpacity={0.9} />
        <text x={x(a)} y={axisY - 22} textAnchor="middle" fontSize={12} fontWeight={700} fill={A_COLOR}>
          A
        </text>
        <text x={x(b)} y={bracketY + 16} textAnchor="middle" fontSize={12} fontWeight={700} fill={B_COLOR}>
          B
        </text>
      </svg>
    </div>
  );
}

// ── A curve against the margin, with the current margin marked ──────────────────────────────

function MarginChart({
  f,
  yDomain,
  yTicks,
  margin,
  title,
  ariaLabel,
}: {
  f: (m: number) => number;
  yDomain: [number, number];
  yTicks: number[];
  margin: number;
  title: ReactNode;
  ariaLabel: string;
}) {
  const [box, W] = useWidth();
  const M = { top: 10, right: 12, bottom: 24, left: 32 };
  const H = 150;
  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;
  const x = (v: number) => ((v - MARGIN_DOMAIN[0]) / (MARGIN_DOMAIN[1] - MARGIN_DOMAIN[0])) * iw;
  const y = (v: number) => ih - ((Math.min(v, yDomain[1]) - yDomain[0]) / (yDomain[1] - yDomain[0])) * ih;
  const pts = sampleCurve(f, MARGIN_DOMAIN[0], MARGIN_DOMAIN[1], 161);
  const xTicks = W < 300 ? [-8, -4, 0, 4, 8] : [-8, -6, -4, -2, 0, 2, 4, 6, 8];
  return (
    <div ref={box} style={{ flex: "1 1 240px", minWidth: 0 }}>
      <div style={caption}>{title}</div>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={ariaLabel} style={{ display: "block" }}>
        <g transform={`translate(${M.left},${M.top})`}>
          {yTicks.map((t) => (
            <g key={`y${t}`} transform={`translate(0,${y(t)})`}>
              <line x1={0} x2={iw} stroke="var(--border)" strokeWidth={1} />
              <text x={-6} dy="0.32em" textAnchor="end" fontSize={TICK_FONT} fill="var(--text-dim)">
                {String(t)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <g key={`x${t}`} transform={`translate(${x(t)},0)`}>
              <line y1={0} y2={ih} stroke={t === 0 ? "var(--border-variant)" : "var(--border)"} strokeWidth={1} />
              <text y={ih + 16} textAnchor="middle" fontSize={TICK_FONT} fill="var(--text-dim)">
                {fmt(t, 0)}
              </text>
            </g>
          ))}
          <polyline
            points={pts.map(([m, v]) => `${x(m).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}
            fill="none"
            stroke={CURVE_COLOR}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <line x1={x(margin)} x2={x(margin)} y1={0} y2={ih} stroke={A_COLOR} strokeWidth={1} strokeDasharray="3 3" />
          <circle cx={x(margin)} cy={y(f(margin))} r={5} fill={A_COLOR} />
        </g>
      </svg>
    </div>
  );
}

// ── The widget ───────────────────────────────────────────────────────────────────────────────

export default function BradleyTerry() {
  const t = useTranslations("courses.widgets.bradley-terry");
  const tc = useTranslations("courses.widgets.common");

  const [rA, setRA] = useState(DEFAULTS.rA);
  const [rB, setRB] = useState(DEFAULTS.rB);
  const [c, setC] = useState(DEFAULTS.c);

  // What the model sees: the two rewards with c added. Everything below reads these.
  const a = rA + c;
  const b = rB + c;
  const margin = a - b;
  const pA = preferProbability(a, b);
  const loss = comparisonLoss(a, b);
  const slope = lossSlope(a, b);

  const reset = () => {
    setRA(DEFAULTS.rA);
    setRB(DEFAULTS.rB);
    setC(DEFAULTS.c);
  };

  return (
    <div role="group" aria-label={t("groupAria")} style={{ display: "flex", flexDirection: "column", gap: "0.85rem", width: "100%" }}>
      <div>
        <div style={caption}>{t.rich("lineTitle", { sub })}</div>
        <RewardLine a={a} b={b} label={t("lineAria", { a: fmt(a, 1), b: fmt(b, 1), m: fmt(margin, 1) })} />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem 1rem" }}>
        <MarginChart
          f={(m) => preferProbability(m, 0)}
          yDomain={[0, 1]}
          yTicks={[0, 0.5, 1]}
          margin={margin}
          title={t.rich("probTitle", { sub })}
          ariaLabel={t("probAria", { m: fmt(margin, 1), p: fmt(pA) })}
        />
        <MarginChart
          f={(m) => comparisonLoss(m, 0)}
          yDomain={LOSS_DOMAIN}
          yTicks={[0, 2, 4, 6, 8]}
          margin={margin}
          title={t.rich("lossTitle", { sub })}
          ariaLabel={t("lossAria", { m: fmt(margin, 1), loss: fmt(loss) })}
        />
      </div>

      <div style={readout} aria-live="polite">
        <span>{t.rich("readMargin", { sub, strong, m: fmt(margin, 1) })}</span>
        <span>{t.rich("readProb", { strong, pa: fmt(pA), pb: fmt(1 - pA) })}</span>
        <span>{t.rich("readLoss", { sub, strong, loss: fmt(loss), slope: fmt(slope) })}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: 420 }}>
        <Slider label={t("sliderA")} value={rA} min={R_RANGE[0]} max={R_RANGE[1]} step={0.1} onChange={setRA} format={(v) => fmt(v, 1)} />
        <Slider label={t("sliderB")} value={rB} min={R_RANGE[0]} max={R_RANGE[1]} step={0.1} onChange={setRB} format={(v) => fmt(v, 1)} />
        <Slider label={t("sliderC")} value={c} min={C_RANGE[0]} max={C_RANGE[1]} step={0.1} onChange={setC} format={(v) => fmt(v, 1)} />
        <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>{t("shiftNote")}</span>
      </div>

      <div>
        <WidgetButton onClick={reset}>{tc("reset")}</WidgetButton>
      </div>
    </div>
  );
}

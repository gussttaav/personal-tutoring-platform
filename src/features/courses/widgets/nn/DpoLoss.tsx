/*
 * COURSE-C2-P1-02 — `dpo-loss` (llm-agents Block 2 lesson 6, «DPO: la derivación completa»).
 *
 * One comparison, seen through the only two numbers the DPO loss reads: the log ratio
 * log π_θ/π_ref of the preferred response (horizontal) and of the rejected one (vertical).
 * Three sliders: the two log ratios and β. What is drawn:
 *
 *   - the plane, coloured by the gradient factor σ(r_θ(y_l) − r_θ(y_w)): bright where the
 *     comparison still pushes, transparent where it has gone quiet. The colour depends on the
 *     difference of the two log ratios only, so it is constant along the diagonals;
 *   - three diagonals where the factor is 0.9, 0.5 and 0.1 (losses 2.30, 0.69 and 0.11). The 0.5
 *     one passes through the reference, (0, 0), where every training starts; the other two close
 *     in on it as β grows and leave the plane as β shrinks;
 *   - the current comparison as a point, with an arrow for the direction a descent step moves
 *     it (preferred up, rejected down), as long as β · factor.
 *
 * The background is one SVG linearGradient along the anti-diagonal: in a square plot its
 * parameter is exactly (ℓ_w − ℓ_l + 2R) / 4R, so no cell grid is needed. Every number comes from
 * ../math/dpo. The chart draws in real pixels (the `scaling-laws` pattern). Strings are
 * `courses.widgets.dpo-loss`; β, σ, π and r_θ are notation and do not move between locales.
 */

"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";

import { dpoLoss, gapForFactor, gradientFactor, implicitMargin, lossForFactor } from "../math/dpo";
import { Slider } from "../primitives/Slider";
import { WidgetButton } from "../primitives/WidgetButton";

const DEFAULTS = { lw: 0, ll: 0, beta: 0.5 };
/** Both log ratios run over [−R, R] nats. */
const R = 6;
const BETA_RANGE: [number, number] = [0.05, 1];
const ISOLINES = [0.9, 0.5, 0.1];
/** Stops of the background gradient: enough that the sigmoid reads as smooth. */
const STOPS = 48;
const MAX_SIDE = 340;

const FIELD = "var(--green)";
const DEFAULT_W = 420;
const TICK_FONT = 10.5;
/** A number as the widget prints it: d decimals, no «-0.00», and a true minus sign. */
const fmt = (v: number, d = 2) => {
  const s = (Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).toFixed(d);
  return s.startsWith("-") ? `−${s.slice(1)}` : s;
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
const note: CSSProperties = { fontSize: "0.8rem", color: "var(--text-dim)" };
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

// ── The plane ────────────────────────────────────────────────────────────────────────────────

function Plane({
  lw,
  ll,
  beta,
  labels,
}: {
  lw: number;
  ll: number;
  beta: number;
  labels: { aria: string; axisW: string; axisL: string; reference: string };
}) {
  const [box, W] = useWidth();
  const gradId = `dpo-field-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const M = { top: 22, right: 12, bottom: 34, left: 34 };
  const S = Math.max(160, Math.min(MAX_SIDE, W - M.left - M.right));
  const x = (v: number) => ((v + R) / (2 * R)) * S;
  const y = (v: number) => ((R - v) / (2 * R)) * S;
  const ticks = [-6, -3, 0, 3, 6];

  // The factor along the anti-diagonal: offset t ↔ gap ℓ_w − ℓ_l = −2R + 4R t.
  const stops = Array.from({ length: STOPS + 1 }, (_, k) => {
    const gap = -2 * R + (4 * R * k) / STOPS;
    return { offset: k / STOPS, opacity: 0.8 * gradientFactor(gap, 0, beta) };
  });

  // Each isoline ℓ_l = ℓ_w − gap, clipped to the square; absent when it falls outside.
  const lines = ISOLINES.flatMap((f) => {
    const gap = gapForFactor(f, beta);
    const lo = Math.max(-R, -R + gap);
    const hi = Math.min(R, R + gap);
    return hi - lo > 1e-9 ? [{ f, x1: x(lo), y1: y(lo - gap), x2: x(hi), y2: y(hi - gap), onRight: gap >= 0 }] : [];
  });

  // The descent step moves the point toward +ℓ_w and −ℓ_l: down and to the right on screen.
  const push = beta * gradientFactor(lw, ll, beta);
  const arrow = 0.3 * S * push;
  const px = x(lw);
  const py = y(ll);
  const ax = px + arrow / Math.SQRT2;
  const ay = py + arrow / Math.SQRT2;
  // An arrowhead along (1, 1)/√2: two base corners a head-length back, half a head either side.
  const head = 7;
  const corners = [
    [ax - 0.354 * head, ay - 1.061 * head],
    [ax - 1.061 * head, ay - 0.354 * head],
  ];

  return (
    <div ref={box} style={{ width: "100%" }}>
      <svg
        viewBox={`0 0 ${S + M.left + M.right} ${S + M.top + M.bottom}`}
        width={S + M.left + M.right}
        height={S + M.top + M.bottom}
        role="img"
        aria-label={labels.aria}
        style={{ display: "block" }}
      >
        <defs>
          <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={S} y2={S}>
            {stops.map((s) => (
              <stop key={s.offset} offset={s.offset} style={{ stopColor: FIELD, stopOpacity: s.opacity }} />
            ))}
          </linearGradient>
        </defs>
        <g transform={`translate(${M.left},${M.top})`}>
          <rect x={0} y={0} width={S} height={S} fill={`url(#${gradId})`} stroke="var(--border-variant)" strokeWidth={1} />
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={0} y2={S} stroke="var(--border)" strokeWidth={t === 0 ? 1 : 0.6} />
              <line x1={0} x2={S} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={t === 0 ? 1 : 0.6} />
              <text x={x(t)} y={S + 14} textAnchor="middle" fontSize={TICK_FONT} fill="var(--text-dim)">
                {fmt(t, 0)}
              </text>
              <text x={-6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={TICK_FONT} fill="var(--text-dim)">
                {fmt(t, 0)}
              </text>
            </g>
          ))}
          <text x={S} y={S + 29} textAnchor="end" fontSize={TICK_FONT} fill="var(--text-muted)">
            {labels.axisW} →
          </text>
          <text x={0} y={-9} fontSize={TICK_FONT} fill="var(--text-muted)">
            ↑ {labels.axisL}
          </text>

          {lines.map((ln) => (
            <g key={ln.f}>
              <line
                x1={ln.x1}
                y1={ln.y1}
                x2={ln.x2}
                y2={ln.y2}
                stroke="var(--text-muted)"
                strokeWidth={1.2}
                strokeDasharray={ln.f === 0.5 ? undefined : "4 3"}
              />
              <text
                x={ln.x2 - 4}
                y={ln.onRight ? ln.y2 - 5 : ln.y2 + 12}
                textAnchor="end"
                fontSize={TICK_FONT}
                fill="var(--text)"
              >
                {fmt(ln.f, 1)}
              </text>
            </g>
          ))}

          {/* The reference: π_θ = π_ref, where every training starts. */}
          <circle cx={x(0)} cy={y(0)} r={4} fill="none" stroke="var(--text-muted)" strokeWidth={1.4} />
          <text x={x(0) - 7} y={y(0) + 15} textAnchor="end" fontSize={TICK_FONT} fill="var(--text-muted)">
            {labels.reference}
          </text>

          {arrow > 2 && (
            <g stroke="var(--text)" fill="var(--text)">
              <line x1={px} y1={py} x2={ax} y2={ay} strokeWidth={1.6} />
              <polygon points={[[ax, ay], ...corners].map(([cx, cy]) => `${cx},${cy}`).join(" ")} strokeWidth={1} />
            </g>
          )}
          <circle cx={px} cy={py} r={5.5} fill="var(--text)" stroke="var(--surface-lowest)" strokeWidth={1.5} />
        </g>
      </svg>
    </div>
  );
}

// ── The widget ───────────────────────────────────────────────────────────────────────────────

export default function DpoLoss() {
  const t = useTranslations("courses.widgets.dpo-loss");
  const tc = useTranslations("courses.widgets.common");

  const [lw, setLw] = useState(DEFAULTS.lw);
  const [ll, setLl] = useState(DEFAULTS.ll);
  const [beta, setBeta] = useState(DEFAULTS.beta);

  const margin = implicitMargin(lw, ll, beta);
  const loss = dpoLoss(lw, ll, beta);
  const factor = gradientFactor(lw, ll, beta);
  const quietGap = gapForFactor(0.1, beta);

  const reset = () => {
    setLw(DEFAULTS.lw);
    setLl(DEFAULTS.ll);
    setBeta(DEFAULTS.beta);
  };

  return (
    <div role="group" aria-label={t("groupAria")} style={{ display: "flex", flexDirection: "column", gap: "0.85rem", width: "100%" }}>
      <div>
        <div style={caption}>{t.rich("planeTitle", { sub })}</div>
        <Plane
          lw={lw}
          ll={ll}
          beta={beta}
          labels={{
            aria: t("planeAria", { lw: fmt(lw, 1), ll: fmt(ll, 1), f: fmt(factor), loss: fmt(loss) }),
            axisW: t("axisW"),
            axisL: t("axisL"),
            reference: t("reference"),
          }}
        />
        <div style={{ ...note, marginTop: "0.35rem" }}>
          {t("legend", {
            l9: fmt(lossForFactor(0.9)),
            l5: fmt(lossForFactor(0.5)),
            l1: fmt(lossForFactor(0.1)),
          })}
        </div>
      </div>

      <div style={readout} aria-live="polite">
        <span>{t.rich("readRewards", { sub, strong, rw: fmt(beta * lw), rl: fmt(beta * ll), m: fmt(margin) })}</span>
        <span>{t.rich("readLoss", { sub, strong, loss: fmt(loss), f: fmt(factor) })}</span>
        <span>{t.rich("readPush", { sub, strong, push: fmt(beta * factor, 3) })}</span>
        {quietGap >= 2 * R && <span>{t("quietOutside", { gap: fmt(quietGap, 0) })}</span>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: 420 }}>
        <Slider label={t("sliderW")} value={lw} min={-R} max={R} step={0.1} onChange={setLw} format={(v) => fmt(v, 1)} />
        <Slider label={t("sliderL")} value={ll} min={-R} max={R} step={0.1} onChange={setLl} format={(v) => fmt(v, 1)} />
        <Slider
          label={t("sliderBeta")}
          value={beta}
          min={BETA_RANGE[0]}
          max={BETA_RANGE[1]}
          step={0.05}
          onChange={setBeta}
          format={(v) => fmt(v, 2)}
        />
        <span style={note}>{t("shiftNote")}</span>
      </div>

      <div>
        <WidgetButton onClick={reset}>{tc("reset")}</WidgetButton>
      </div>
    </div>
  );
}

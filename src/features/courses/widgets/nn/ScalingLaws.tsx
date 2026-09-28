/*
 * COURSE-C2-P1-01 — `scaling-laws` (llm-agents Block 1 lesson 7, «Leyes de escala: Kaplan y
 * Chinchilla»).
 *
 * Two views, one question each, and every number from ../math/scaling-laws:
 *
 *   - «Las leyes»: the loss against the parameters N, the training tokens D or the compute C,
 *     both axes logarithmic. Kaplan's fit is a straight line, and the readout says what it buys
 *     per tenfold: the same factor wherever the marker is. Chinchilla's fit bends towards its
 *     floor L∞, and the same readout shrinks towards 1. Solid where each paper measured, dashed
 *     where the curve is only extended. The two were fitted on different corpora and
 *     tokenisers, and the view says so: compare their shapes, not their heights. The mini-GPT has
 *     no point here, for the same reason (the lesson's perplexity callback).
 *   - «Un presupuesto»: C fixed by a slider, D = C/6N, and the loss against N is a valley whose
 *     bottom is the optimum (N*, D*). Under it, the frontier: N* against C on log–log axes, a
 *     straight line, with GPT-3, Gopher, Chinchilla and the checkpoint placed at C = 6ND. A
 *     button sets Gopher's budget, where the valley marks Gopher up its right wall and Chinchilla
 *     at its bottom.
 *
 * Not locale-sensitive: the curves are published constants and the only non-notation text is
 * `courses.widgets.scaling-laws`. Numbers are written in scientific notation, which reads the
 * same in both languages.
 */

"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";

import {
  CHINCHILLA_MEASURED_C,
  CHINCHILLA_MEASURED_D,
  CHINCHILLA_MEASURED_N,
  GOPHER_BUDGET,
  KAPLAN,
  MODELS,
  chinchillaAlong,
  factorPer,
  fixedBudgetLoss,
  kaplanLoss,
  optimum,
  trainingCompute,
  type LawAxis,
  type ModelId,
} from "../math/scaling-laws";
import { Slider } from "../primitives/Slider";
import { WidgetButton } from "../primitives/WidgetButton";

type View = "laws" | "budget";

/** log₁₀ of each axis's range in the laws view. */
const LAW_DOMAIN: Record<LawAxis, [number, number]> = { n: [3, 12], d: [7, 13], c: [11, 26] };
const LAW_TICK_STEP: Record<LawAxis, number> = { n: 1, d: 1, c: 2 };
const CHINCHILLA_MEASURED: Record<LawAxis, readonly [number, number]> = {
  n: CHINCHILLA_MEASURED_N,
  d: CHINCHILLA_MEASURED_D,
  c: CHINCHILLA_MEASURED_C,
};
const SYMBOL: Record<LawAxis, string> = { n: "N", d: "D", c: "C" };
/** The laws view's loss axis, log₁₀ of 1.5 to 8 nats per token. */
const LOSS_TICKS = [1.5, 2, 3, 4, 6, 8];
const LOSS_DOMAIN: [number, number] = [Math.log10(1.5), Math.log10(8)];

const BUDGET_DOMAIN: [number, number] = [17, 25];
const FRONTIER_X: [number, number] = [11, 26];
const FRONTIER_Y: [number, number] = [4, 13];
const GOPHER_LOG_C = Math.log10(GOPHER_BUDGET);

const DEFAULTS = { view: "laws" as View, axis: "n" as LawAxis, at: { n: 8, d: 10, c: 19 }, logC: 21 };

const KAPLAN_COLOR = "var(--green)";
const CHINCHILLA_COLOR = "var(--warning)";

const SUPERSCRIPT: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻",
};
const sup = (k: number) => String(k).split("").map((c) => SUPERSCRIPT[c] ?? c).join("");
/** 2.9 × 10¹² — the same in both locales, like the prose's powers of ten. */
function sci(v: number, digits = 1): string {
  const k = Math.floor(Math.log10(v));
  const m = v / 10 ** k;
  const rounded = Number(m.toFixed(digits));
  return rounded >= 10 ? `${(1).toFixed(digits)} × 10${sup(k + 1)}` : `${rounded.toFixed(digits)} × 10${sup(k)}`;
}

// ── A small chart in pre-logged units ────────────────────────────────────────────────────

/*
 * The chart draws in real pixels: it measures its box and uses that width as its viewBox, so a
 * tick label is 10.5px on a 320px phone and on a wide desktop alike. A fixed 480-unit viewBox
 * scaled to 100% shrank the labels to under 7px at 360px. Until the first measurement it draws at
 * DEFAULT_W, which is only ever seen for a frame (the widget is client-only).
 */
const DEFAULT_W = 480;
const M = { top: 12, right: 18, bottom: 24, left: 40 };
const TICK_FONT = 10.5;
/** The least room an x-axis label gets before every other one is dropped (its grid line stays). */
const MIN_TICK_GAP = 34;

function useWidth(): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(DEFAULT_W);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(240, Math.round(el.clientWidth)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

interface Scale {
  x: (v: number) => number;
  y: (v: number) => number;
}

function Chart({
  height,
  xDomain,
  yDomain,
  xTicks,
  yTicks,
  ariaLabel,
  children,
}: {
  height: number;
  xDomain: [number, number];
  yDomain: [number, number];
  xTicks: { at: number; label: string }[];
  yTicks: { at: number; label: string }[];
  ariaLabel: string;
  children: (s: Scale) => ReactNode;
}) {
  const clip = `scaling-clip-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [box, W] = useWidth();
  const iw = W - M.left - M.right;
  const ih = height - M.top - M.bottom;
  const labelEvery = Math.max(1, Math.ceil(MIN_TICK_GAP / (iw / Math.max(1, xTicks.length - 1))));
  const s: Scale = {
    x: (v) => ((v - xDomain[0]) / (xDomain[1] - xDomain[0])) * iw,
    y: (v) => ih - ((v - yDomain[0]) / (yDomain[1] - yDomain[0])) * ih,
  };
  return (
    <div ref={box} style={{ width: "100%" }}>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        width={W}
        height={height}
        role="img"
        aria-label={ariaLabel}
        style={{ display: "block" }}
      >
        <defs>
          <clipPath id={clip}>
            <rect x={0} y={0} width={iw} height={ih} />
          </clipPath>
        </defs>
        <g transform={`translate(${M.left},${M.top})`}>
          {yTicks.map((t) => (
            <g key={`y${t.at}`} transform={`translate(0,${s.y(t.at)})`}>
              <line x1={0} x2={iw} stroke="var(--border)" strokeWidth={1} />
              <text x={-6} dy="0.32em" textAnchor="end" fontSize={TICK_FONT} fill="var(--text-dim)">
                {t.label}
              </text>
            </g>
          ))}
          {xTicks.map((t, i) => (
            <g key={`x${t.at}`} transform={`translate(${s.x(t.at)},0)`}>
              <line y1={0} y2={ih} stroke="var(--border)" strokeWidth={1} />
              {i % labelEvery === 0 ? (
                <text y={ih + 16} textAnchor="middle" fontSize={TICK_FONT} fill="var(--text-dim)">
                  {t.label}
                </text>
              ) : null}
            </g>
          ))}
          <g clipPath={`url(#${clip})`}>{children(s)}</g>
        </g>
      </svg>
    </div>
  );
}

/**
 * A curve as runs of points: solid where `solid(x)` holds, dashed elsewhere, and broken where
 * the value leaves `yDomain` (Chinchilla's curve starts above the laws view's top).
 */
function runs(
  xs: number[],
  f: (x: number) => number,
  solid: (x: number) => boolean,
  yDomain: [number, number],
): { pts: [number, number][]; solid: boolean }[] {
  const out: { pts: [number, number][]; solid: boolean }[] = [];
  let open = false; // whether the last run in `out` may still grow
  for (const x of xs) {
    const y = f(x);
    const inside = Number.isFinite(y) && y >= yDomain[0] - 0.2 && y <= yDomain[1] + 0.2;
    if (!inside) {
      open = false;
      continue;
    }
    const kind = solid(x);
    const last = out[out.length - 1];
    if (open && last.solid === kind) {
      last.pts.push([x, y]);
    } else {
      // A change of style continues from the previous point, so the curve has no gap.
      out.push({ pts: open ? [last.pts[last.pts.length - 1], [x, y]] : [[x, y]], solid: kind });
      open = true;
    }
  }
  return out;
}

function Curve({ s, runs: rs, color }: { s: Scale; runs: ReturnType<typeof runs>; color: string }) {
  return (
    <>
      {rs.map((r, i) => (
        <polyline
          key={i}
          points={r.pts.map(([x, y]) => `${s.x(x).toFixed(1)},${s.y(y).toFixed(1)}`).join(" ")}
          fill="none"
          stroke={color}
          strokeWidth={r.solid ? 2.2 : 1.6}
          strokeDasharray={r.solid ? undefined : "5 4"}
          strokeLinejoin="round"
        />
      ))}
    </>
  );
}

const range = (a: number, b: number, n: number) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
const decades = (a: number, b: number, step: number) => {
  const out: { at: number; label: string }[] = [];
  for (let k = Math.ceil(a); k <= b; k += step) out.push({ at: k, label: `10${sup(k)}` });
  return out;
};
const within = (v: number, [lo, hi]: readonly [number, number]) => v >= lo && v <= hi;

const label: CSSProperties = { fontSize: "0.8rem", color: "var(--text-dim)" };
const legendItem: CSSProperties = { display: "inline-flex", alignItems: "center", gap: "0.35rem" };
const readout: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
  fontSize: "0.82rem",
  fontVariantNumeric: "tabular-nums",
};

function Swatch({ color, dashed = false }: { color: string; dashed?: boolean }) {
  return (
    <svg width={18} height={8} aria-hidden>
      <line x1={1} x2={17} y1={4} y2={4} stroke={color} strokeWidth={2} strokeDasharray={dashed ? "4 3" : undefined} />
    </svg>
  );
}

// ── The widget ───────────────────────────────────────────────────────────────────────────

export default function ScalingLaws() {
  const tr = useTranslations("courses.widgets.scaling-laws");
  const tc = useTranslations("courses.widgets.common");

  const [view, setView] = useState<View>(DEFAULTS.view);
  const [axis, setAxis] = useState<LawAxis>(DEFAULTS.axis);
  const [at, setAt] = useState<Record<LawAxis, number>>(DEFAULTS.at);
  const [logC, setLogC] = useState(DEFAULTS.logC);

  const reset = () => {
    setView(DEFAULTS.view);
    setAxis(DEFAULTS.axis);
    setAt(DEFAULTS.at);
    setLogC(DEFAULTS.logC);
  };

  return (
    <div role="group" aria-label={tr("groupAria")} style={{ display: "flex", flexDirection: "column", gap: "0.85rem", width: "100%" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
        {(["laws", "budget"] as const).map((v) => (
          <WidgetButton key={v} active={view === v} aria-pressed={view === v} onClick={() => setView(v)}>
            {tr(`views.${v}`)}
          </WidgetButton>
        ))}
      </div>

      {view === "laws" ? (
        <LawsView axis={axis} setAxis={setAxis} at={at[axis]} setAt={(v) => setAt((p) => ({ ...p, [axis]: v }))} />
      ) : (
        <BudgetView logC={logC} setLogC={setLogC} />
      )}

      <div>
        <WidgetButton onClick={reset}>{tc("reset")}</WidgetButton>
      </div>
    </div>
  );
}

function LawsView({
  axis,
  setAxis,
  at,
  setAt,
}: {
  axis: LawAxis;
  setAxis: (a: LawAxis) => void;
  at: number;
  setAt: (v: number) => void;
}) {
  const tr = useTranslations("courses.widgets.scaling-laws");
  const domain = LAW_DOMAIN[axis];
  const xs = range(domain[0], domain[1], 161);
  const kaplanRuns = runs(
    xs,
    (x) => Math.log10(kaplanLoss(axis, 10 ** x)),
    (x) => within(10 ** x, KAPLAN[axis].measured),
    LOSS_DOMAIN,
  );
  const chinchillaRuns = runs(
    xs,
    (x) => Math.log10(chinchillaAlong(axis, 10 ** x)),
    (x) => within(10 ** x, CHINCHILLA_MEASURED[axis]),
    LOSS_DOMAIN,
  );

  const x = 10 ** at;
  const lk = kaplanLoss(axis, x);
  const lc = chinchillaAlong(axis, x);
  const factor = factorPer(axis, x, 10);
  const chinchillaOnChart = Math.log10(lc) <= LOSS_DOMAIN[1];
  const q = SYMBOL[axis];

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.4rem" }}>
        <span style={label}>{tr("axisLabel")}</span>
        {(["n", "d", "c"] as const).map((a) => (
          <WidgetButton key={a} active={axis === a} aria-pressed={axis === a} onClick={() => setAxis(a)}>
            {tr(`axes.${a}`)}
          </WidgetButton>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        <span style={label}>{tr("lawsTitle", { q })}</span>
        <Chart
          height={230}
          xDomain={domain}
          yDomain={LOSS_DOMAIN}
          xTicks={decades(domain[0], domain[1], LAW_TICK_STEP[axis])}
          yTicks={LOSS_TICKS.map((v) => ({ at: Math.log10(v), label: String(v) }))}
          ariaLabel={tr("lawsAria", { q })}
        >
          {(s) => (
            <>
              <Curve s={s} runs={chinchillaRuns} color={CHINCHILLA_COLOR} />
              <Curve s={s} runs={kaplanRuns} color={KAPLAN_COLOR} />
              <line x1={s.x(at)} x2={s.x(at)} y1={0} y2={s.y(LOSS_DOMAIN[0])} stroke="var(--text-dim)" strokeDasharray="2 3" />
              <circle cx={s.x(at)} cy={s.y(Math.log10(lk))} r={4} fill={KAPLAN_COLOR} />
              {chinchillaOnChart ? <circle cx={s.x(at)} cy={s.y(Math.log10(lc))} r={4} fill={CHINCHILLA_COLOR} /> : null}
            </>
          )}
        </Chart>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem 1rem", fontSize: "0.72rem", color: "var(--text-dim)" }}>
          <span style={legendItem}>
            <Swatch color={KAPLAN_COLOR} />
            {tr("legendKaplan")}
          </span>
          <span style={legendItem}>
            <Swatch color={CHINCHILLA_COLOR} />
            {tr("legendChinchilla")}
          </span>
          <span style={legendItem}>
            <Swatch color="var(--text-dim)" dashed />
            {tr("legendExtended")}
          </span>
        </div>
      </div>

      <div aria-live="polite" style={readout}>
        <span style={{ color: "var(--text)" }}>
          {tr("readKaplan", { q, x: sci(x), loss: lk.toFixed(2), factor: factor.kaplan.toFixed(3) })}
        </span>
        <span style={{ color: "var(--text)" }}>
          {chinchillaOnChart
            ? tr("readChinchilla", { q, loss: lc.toFixed(2), factor: factor.chinchilla.toFixed(3) })
            : tr("readChinchillaOff")}
        </span>
        <span style={{ color: "var(--text-dim)", fontSize: "0.76rem" }}>{tr("heightNote")}</span>
      </div>

      <Slider
        label={tr(`slider.${axis}`)}
        value={at}
        min={domain[0]}
        max={domain[1]}
        step={0.05}
        onChange={setAt}
        format={(v) => sci(10 ** v)}
      />
    </>
  );
}

/** The three large models share a corner of the frontier: all labels to the left, stacked. */
const MODEL_LABEL_POS: Record<ModelId, { dx: number; dy: number; anchor: "start" | "end" }> = {
  miniGpt: { dx: 7, dy: -6, anchor: "start" },
  gpt3: { dx: -7, dy: 9, anchor: "end" },
  gopher: { dx: -7, dy: -5, anchor: "end" },
  chinchilla: { dx: -7, dy: 15, anchor: "end" },
};

function BudgetView({ logC, setLogC }: { logC: number; setLogC: (v: number) => void }) {
  const tr = useTranslations("courses.widgets.scaling-laws");
  const c = 10 ** logC;
  const best = optimum(c);
  const centre = Math.log10(best.n);
  const valleyX: [number, number] = [centre - 2, centre + 2];
  const valleyXs = range(valleyX[0], valleyX[1], 161);
  const valleyYs = valleyXs.map((x) => fixedBudgetLoss(c, 10 ** x));
  const top = Math.max(valleyYs[0], valleyYs[valleyYs.length - 1]);
  const valleyY: [number, number] = [best.loss - 0.06 * (top - best.loss), top];
  const valleyStep = (valleyY[1] - valleyY[0]) / 4;
  const valleyYTicks = [0, 1, 2, 3, 4].map((i) => {
    const v = valleyY[0] + valleyStep * i;
    return { at: v, label: v.toFixed(2) };
  });
  const atGopher = Math.abs(logC - GOPHER_LOG_C) < 0.03;
  const gopher = MODELS.find((m) => m.id === "gopher")!;
  const chinchilla = MODELS.find((m) => m.id === "chinchilla")!;
  const measured = within(c, CHINCHILLA_MEASURED_C);

  const frontierRuns = runs(
    range(FRONTIER_X[0], FRONTIER_X[1], 121),
    (x) => Math.log10(optimum(10 ** x).n),
    (x) => within(10 ** x, CHINCHILLA_MEASURED_C),
    FRONTIER_Y,
  );

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        <span style={label}>{tr("valleyTitle", { c: sci(c) })}</span>
        <Chart
          height={190}
          xDomain={valleyX}
          yDomain={valleyY}
          xTicks={decades(valleyX[0], valleyX[1], 1)}
          yTicks={valleyYTicks}
          ariaLabel={tr("valleyAria", { c: sci(c), n: sci(best.n) })}
        >
          {(s) => (
            <>
              <polyline
                points={valleyXs.map((x, i) => `${s.x(x).toFixed(1)},${s.y(valleyYs[i]).toFixed(1)}`).join(" ")}
                fill="none"
                stroke={CHINCHILLA_COLOR}
                strokeWidth={2.2}
              />
              <line x1={s.x(centre)} x2={s.x(centre)} y1={0} y2={s.y(valleyY[0])} stroke="var(--text-dim)" strokeDasharray="2 3" />
              <circle cx={s.x(centre)} cy={s.y(best.loss)} r={4.5} fill="var(--text)" />
              <text x={s.x(centre) + 7} y={s.y(best.loss) - 7} fontSize={11} fill="var(--text)">
                N*
              </text>
              {atGopher
                ? [gopher, chinchilla].map((m) => {
                    const mx = Math.log10(m.n);
                    const my = fixedBudgetLoss(c, m.n);
                    return (
                      <g key={m.id}>
                        <circle cx={s.x(mx)} cy={s.y(my)} r={4} fill="none" stroke="var(--text)" strokeWidth={1.5} />
                        {/* Gopher to the right of its marker; Chinchilla above-left, clear of N*. */}
                        <text
                          x={s.x(mx) + (m.id === "gopher" ? 8 : -8)}
                          y={s.y(my) + (m.id === "gopher" ? 4 : -8)}
                          textAnchor={m.id === "gopher" ? "start" : "end"}
                          fontSize={10.5}
                          fill="var(--text-muted)"
                        >
                          {tr(`models.${m.id}`)}
                        </text>
                      </g>
                    );
                  })
                : null}
            </>
          )}
        </Chart>
        <span style={{ ...label, fontSize: "0.72rem" }}>{tr("valleyAxes")}</span>
      </div>

      <div aria-live="polite" style={readout}>
        <span style={{ color: "var(--text)" }}>
          {tr("optimum", { n: sci(best.n), d: sci(best.d), ratio: best.ratio.toFixed(1), loss: best.loss.toFixed(3) })}
        </span>
        {atGopher ? (
          <span style={{ color: "var(--text)" }}>
            {tr("gopherNote", { gap: (fixedBudgetLoss(c, gopher.n) - best.loss).toFixed(3) })}
          </span>
        ) : null}
        {!measured ? <span style={{ color: "var(--text-dim)", fontSize: "0.76rem" }}>{tr("extended")}</span> : null}
      </div>

      <Slider
        label={tr("budgetSlider")}
        value={logC}
        min={BUDGET_DOMAIN[0]}
        max={BUDGET_DOMAIN[1]}
        step={0.02}
        onChange={setLogC}
        format={(v) => `${sci(10 ** v)} FLOPs`}
      />
      <div>
        <WidgetButton active={atGopher} aria-pressed={atGopher} onClick={() => setLogC(GOPHER_LOG_C)}>
          {tr("gopherButton")}
        </WidgetButton>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        <span style={label}>{tr("frontierTitle")}</span>
        <Chart
          height={210}
          xDomain={FRONTIER_X}
          yDomain={FRONTIER_Y}
          xTicks={decades(FRONTIER_X[0], FRONTIER_X[1], 3)}
          yTicks={decades(FRONTIER_Y[0], FRONTIER_Y[1], 2)}
          ariaLabel={tr("frontierAria")}
        >
          {(s) => (
            <>
              <Curve s={s} runs={frontierRuns} color={CHINCHILLA_COLOR} />
              <line x1={s.x(logC)} x2={s.x(logC)} y1={0} y2={s.y(FRONTIER_Y[0])} stroke="var(--text-dim)" strokeDasharray="2 3" />
              <circle cx={s.x(logC)} cy={s.y(Math.log10(best.n))} r={4} fill="var(--text)" />
              {MODELS.map((m) => {
                const mx = Math.log10(trainingCompute(m.n, m.d));
                const my = Math.log10(m.n);
                const pos = MODEL_LABEL_POS[m.id];
                return (
                  <g key={m.id}>
                    <circle cx={s.x(mx)} cy={s.y(my)} r={3.5} fill={m.id === "miniGpt" ? KAPLAN_COLOR : "var(--text-muted)"} />
                    <text
                      x={s.x(mx) + pos.dx}
                      y={s.y(my) + pos.dy}
                      textAnchor={pos.anchor}
                      fontSize={10.5}
                      fill={m.id === "miniGpt" ? KAPLAN_COLOR : "var(--text-muted)"}
                    >
                      {tr(`models.${m.id}`)}
                    </text>
                  </g>
                );
              })}
            </>
          )}
        </Chart>
        <span style={{ ...label, fontSize: "0.72rem" }}>{tr("frontierAxes")}</span>
      </div>
    </>
  );
}

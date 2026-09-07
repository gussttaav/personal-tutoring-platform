/*
 * COURSE-P2-02 — `activation-explorer`: overlay an activation and its derivative,
 * and SHADE the saturation regions where the derivative ≈ 0. Seeing saturation is
 * the whole point — it sets up vanishing gradients in Block 3. Pure activations from
 * math/activations (all derivative-checked vs finite differences). Local state only.
 *
 * COURSE-P11-02 — the labels come from `courses.widgets.activation-explorer`. The keys
 * of `ACTS` stay put: they are state values, not copy. `LABEL_KEYS` maps each one to its
 * message key, which is what lets `escalón` become «step» in English while σ, tanh, ReLU
 * and GELU stay the notation they are in both locales.
 */

"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { scaleLinear } from "d3-scale";
import { line as d3line } from "d3-shape";

import {
  step,
  stepPrime,
  sigmoid,
  sigmoidPrime,
  tanh,
  tanhPrime,
  relu,
  reluPrime,
  gelu,
  geluPrime,
} from "../math/activations";
import { WidgetButton } from "../primitives/WidgetButton";

/**
 * COURSE-P5-02 — `jump` describes a discontinuity, and exists so the step can be
 * drawn WITHOUT lying. Sampling 200 points and joining them lands exactly on x = 0
 * and would render the jump as a steep segment, i.e. as though the output passed
 * through every value between `from` and `value` — the precise falsehood Block 2
 * lesson 2 exists to correct. Instead the path breaks at `x` and the two limits are
 * marked the way a textbook marks them: filled dot on the value it takes, open dot
 * on the one it does not.
 */
interface Act {
  f: (x: number) => number;
  d: (x: number) => number;
  jump: { x: number; value: number; from: number } | null;
}

// Insertion order is button order. The step comes LAST: the four differentiable
// activations are what the reader is choosing between, and the step is the baseline
// they get compared against once they have been seen.
const ACTS = {
  "σ": { f: sigmoid, d: sigmoidPrime, jump: null },
  "tanh": { f: tanh, d: tanhPrime, jump: null },
  "ReLU": { f: relu, d: reluPrime, jump: null },
  "GELU": { f: gelu, d: geluPrime, jump: null },
  "escalón": { f: step, d: stepPrime, jump: { x: 0, value: 1, from: 0 } },
} satisfies Record<string, Act>;

type ActName = keyof typeof ACTS;

/** State value → message key. The four differentiable names are notation and read the
 *  same in both locales; only the step has a word to translate. */
const LABEL_KEYS: Record<ActName, string> = {
  "σ": "sigma",
  "tanh": "tanh",
  "ReLU": "relu",
  "GELU": "gelu",
  "escalón": "step",
};

const X_MIN = -5;
const X_MAX = 5;
const SAMPLES = 200;
const SATURATION_EPS = 0.02; // |f'| below this counts as saturated
const W = 480;
const H = 280;
const MARGIN = { top: 12, right: 12, bottom: 24, left: 34 };

export default function ActivationExplorer() {
  const t = useTranslations("courses.widgets.activation-explorer");
  const locale = useLocale();
  const [name, setName] = useState<ActName>("σ");
  const [showDeriv, setShowDeriv] = useState(true);

  const { f, d, jump } = ACTS[name];

  const { fPts, dPts, bands, yDomain } = useMemo(() => {
    const fPts: [number, number][] = [];
    const dPts: [number, number][] = [];
    const bands: [number, number][] = [];
    let bandStart: number | null = null;
    let lo = Infinity;
    let hi = -Infinity;

    for (let i = 0; i <= SAMPLES; i++) {
      const x = X_MIN + ((X_MAX - X_MIN) * i) / SAMPLES;
      const fv = f(x);
      const dv = d(x);
      fPts.push([x, fv]);
      dPts.push([x, dv]);
      // Guarded: an undefined derivative is NaN, and one NaN in the extent poisons
      // the whole y scale.
      if (Number.isFinite(fv)) {
        lo = Math.min(lo, fv);
        hi = Math.max(hi, fv);
      }
      if (Number.isFinite(dv)) {
        lo = Math.min(lo, dv);
        hi = Math.max(hi, dv);
      }

      if (!Number.isFinite(dv)) {
        // At a jump the derivative does not exist, so it neither opens a band nor
        // closes one: the shading runs through the gap instead of splitting into a
        // hairline that reads as a rendering artefact.
        continue;
      }
      if (Math.abs(dv) < SATURATION_EPS) {
        if (bandStart === null) bandStart = x;
      } else if (bandStart !== null) {
        bands.push([bandStart, x]);
        bandStart = null;
      }
    }
    if (bandStart !== null) bands.push([bandStart, X_MAX]);

    const pad = (hi - lo) * 0.08 || 0.1;
    return { fPts, dPts, bands, yDomain: [lo - pad, hi + pad] as [number, number] };
  }, [f, d]);

  const innerW = W - MARGIN.left - MARGIN.right;
  const innerH = H - MARGIN.top - MARGIN.bottom;
  const sx = scaleLinear().domain([X_MIN, X_MAX]).range([0, innerW]);
  const sy = scaleLinear().domain(yDomain).range([innerH, 0]);
  /*
   * Y labels earn their place because THIS scale is not fixed: it is recomputed per
   * activation, so ReLU runs to 5 while σ stops at 1 and tanh dips to −1. Without the
   * numbers, two activations look like the same curve at the same size and the reader
   * cannot see that σ' peaks at 0,25 where tanh' peaks at 1 — which is the comparison
   * the lesson is asking them to make. Spanish decimal comma, as in the prose; the
   * English column keeps the point (COURSE-P11-02).
   */
  const fmtY = sy.tickFormat(5);
  const decimal = locale === "es" ? "," : ".";
  const yLabel = (tick: number) => fmtY(tick).replace(".", decimal);

  const path = d3line<[number, number]>()
    // Breaking the path is what keeps the jump from being drawn as a near-vertical
    // segment. Both curves break: the function has no value between its two limits,
    // and its derivative has none at all there.
    .defined((p) => Number.isFinite(p[1]) && !(jump !== null && Math.abs(p[0] - jump.x) < 1e-9))
    .x((p) => sx(p[0]))
    .y((p) => sy(p[1]));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", width: "100%" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
        {(Object.keys(ACTS) as ActName[]).map((a) => (
          <WidgetButton key={a} active={a === name} onClick={() => setName(a)}>
            {t(`names.${LABEL_KEYS[a]}`)}
          </WidgetButton>
        ))}
        <span style={{ width: 12 }} />
        <WidgetButton active={showDeriv} onClick={() => setShowDeriv((v) => !v)}>
          {t("derivative")}
        </WidgetButton>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label={t("plotAria", { name: t(`names.${LABEL_KEYS[name]}`) })}
        style={{ display: "block", maxWidth: "100%" }}
      >
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {/* Saturation bands (f' ≈ 0) */}
          {bands.map(([x0, x1], i) => (
            <rect key={i} x={sx(x0)} y={0} width={Math.max(0, sx(x1) - sx(x0))} height={innerH} fill="var(--error)" opacity={0.12} />
          ))}

          {/* Zero axes */}
          {yDomain[0] <= 0 && yDomain[1] >= 0 && (
            <line x1={0} x2={innerW} y1={sy(0)} y2={sy(0)} stroke="var(--border-variant)" strokeWidth={1} />
          )}
          <line x1={sx(0)} x2={sx(0)} y1={0} y2={innerH} stroke="var(--border)" strokeWidth={1} />

          {/* Derivative then activation */}
          {showDeriv && <path d={path(dPts) ?? undefined} fill="none" stroke="var(--text-dim)" strokeWidth={1.5} strokeDasharray="4 3" />}
          <path d={path(fPts) ?? undefined} fill="none" stroke="var(--green)" strokeWidth={2} strokeLinejoin="round" />

          {/* The two limits at a jump, marked the textbook way. */}
          {jump !== null && (
            <>
              <circle cx={sx(jump.x)} cy={sy(jump.from)} r={3.5} fill="none" stroke="var(--green)" strokeWidth={1.5} />
              <circle cx={sx(jump.x)} cy={sy(jump.value)} r={3.5} fill="var(--green)" />
            </>
          )}

          {/* Ticks. The left spine anchors the y labels, which would otherwise float. */}
          {sx.ticks(5).map((tick) => (
            <text key={`x${tick}`} x={sx(tick)} y={innerH + 16} textAnchor="middle" fontSize={10} fill="var(--text-dim)">
              {tick}
            </text>
          ))}
          <line x1={0} x2={0} y1={0} y2={innerH} stroke="var(--border-variant)" strokeWidth={1} />
          {sy.ticks(5).map((tick) => (
            <g key={`y${tick}`}>
              <line x1={-4} x2={0} y1={sy(tick)} y2={sy(tick)} stroke="var(--border-variant)" strokeWidth={1} />
              <text x={-7} y={sy(tick) + 3.5} textAnchor="end" fontSize={10} fill="var(--text-dim)">
                {yLabel(tick)}
              </text>
            </g>
          ))}
        </g>
      </svg>

      <p style={{ fontSize: "0.8rem", color: "var(--text-dim)", margin: 0 }}>{t("note")}</p>
    </div>
  );
}

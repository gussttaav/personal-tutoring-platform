/*
 * COURSE-P2-02 — `perceptron-boundary`: drag 2D points and watch a single neuron's
 * decision boundary chase them. The payload is the XOR preset, which the neuron
 * can NEVER separate (it never reaches zero errors) — the classic, felt motivation
 * for hidden layers. Pure maths in math/perceptron. Points are draggable (pointer)
 * and keyboard-nudgeable (arrow keys). Local state only.
 *
 * COURSE-P5-02 — Block 2 lesson 1 (la neurona) embeds this BEFORE the words
 * «perceptrón» and «época» exist for the reader, so no user-facing string may use
 * them: the status line talks about the neuron and the line, not about convergence
 * in N epochs. Two consequences of that, both deliberate:
 *   - the presets are labelled by what the reader can SEE (Separable / No separable)
 *     rather than by the name of the function, and Separable is the default — the
 *     case with a line already drawn is the intuitive first contact;
 *   - «No separable» carries its own note explaining that the four points are XOR
 *     and what they encode, since the label alone no longer says it. The note hides
 *     as soon as a point is dragged, because then they are not XOR any more.
 * Lesson 3 (xor-y-capas-ocultas) reuses the same widget for the full argument.
 *
 * COURSE-P11-02 — the copy moved to `courses.widgets.perceptron-boundary`, the rule
 * above with it: the English strings name the neuron and the line too, never «perceptron»
 * or «epoch». `PRESETS`/`PRESET_LABELS` keep their keys (they are state), and the label
 * lookup is what changed.
 */

"use client";

import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import { scaleLinear } from "d3-scale";

import {
  trainPerceptron,
  decisionBoundaryLine,
  XOR_PRESET,
  SEPARABLE_PRESET,
  type LabeledPoint,
} from "../math/perceptron";
import { WidgetButton } from "../primitives/WidgetButton";

const DOM: [number, number] = [-2.5, 2.5];
const SIZE = 340;
const MARGIN = 20;
const INNER = SIZE - 2 * MARGIN;
const STEP = 0.15; // keyboard nudge

// Separable first: it is the default, and the order here is the order of the buttons.
const PRESETS = { Separable: SEPARABLE_PRESET, XOR: XOR_PRESET } as const;
type PresetName = keyof typeof PRESETS;

/** Buttons say what the reader can see, not the name of the function behind it — so the
 *  preset's own key never reaches the screen; this maps it to the message that does. */
const PRESET_LABEL_KEYS: Record<PresetName, string> = {
  Separable: "presetSeparable",
  XOR: "presetXor",
};

export default function PerceptronBoundary() {
  const t = useTranslations("courses.widgets.perceptron-boundary");
  const tc = useTranslations("courses.widgets.common");
  const [presetName, setPresetName] = useState<PresetName>("Separable");
  const [points, setPoints] = useState<LabeledPoint[]>(() => SEPARABLE_PRESET.map((p) => ({ ...p, point: [...p.point] })));
  const [dragging, setDragging] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const sx = scaleLinear().domain(DOM).range([0, INNER]);
  const sy = scaleLinear().domain(DOM).range([INNER, 0]);

  const { w, b, converged } = useMemo(() => trainPerceptron(points, { lr: 0.1, maxEpochs: 400 }), [points]);
  const boundary = decisionBoundaryLine(w, b, DOM, DOM);

  // The XOR note describes THESE four corners, so it goes as soon as one is moved.
  const showXorNote =
    presetName === "XOR" &&
    points.length === XOR_PRESET.length &&
    points.every((p, i) => p.point[0] === XOR_PRESET[i].point[0] && p.point[1] === XOR_PRESET[i].point[1]);

  const loadPreset = (name: PresetName) => {
    setPresetName(name);
    setPoints(PRESETS[name].map((p) => ({ ...p, point: [...p.point] as [number, number] })));
  };

  const toData = (clientX: number, clientY: number): [number, number] => {
    const rect = svgRef.current!.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * SIZE - MARGIN;
    const py = ((clientY - rect.top) / rect.height) * SIZE - MARGIN;
    const clamp = (v: number) => Math.max(DOM[0], Math.min(DOM[1], v));
    return [clamp(sx.invert(px)), clamp(sy.invert(py))];
  };

  const movePoint = (i: number, coord: [number, number]) => {
    setPoints((prev) => prev.map((p, j) => (j === i ? { ...p, point: coord } : p)));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
        {(Object.keys(PRESETS) as PresetName[]).map((n) => (
          <WidgetButton key={n} active={n === presetName} onClick={() => loadPreset(n)}>
            {t(PRESET_LABEL_KEYS[n])}
          </WidgetButton>
        ))}
        <WidgetButton onClick={() => loadPreset(presetName)}>{tc("reset")}</WidgetButton>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width="100%"
        height={SIZE}
        role="img"
        aria-label={t("plotAria")}
        style={{ display: "block", maxWidth: SIZE, background: "var(--surface-lowest)", borderRadius: "var(--radius)", touchAction: "none" }}
        onPointerMove={(e) => {
          if (dragging !== null) movePoint(dragging, toData(e.clientX, e.clientY));
        }}
        onPointerUp={() => setDragging(null)}
        onPointerLeave={() => setDragging(null)}
      >
        <g transform={`translate(${MARGIN},${MARGIN})`}>
          {/* axes */}
          <line x1={sx(0)} x2={sx(0)} y1={0} y2={INNER} stroke="var(--border)" />
          <line x1={0} x2={INNER} y1={sy(0)} y2={sy(0)} stroke="var(--border)" />

          {/* decision boundary */}
          {boundary && (
            <line
              x1={sx(boundary[0][0])}
              y1={sy(boundary[0][1])}
              x2={sx(boundary[1][0])}
              y2={sy(boundary[1][1])}
              stroke={converged ? "var(--green)" : "var(--error)"}
              strokeWidth={2}
              strokeDasharray={converged ? undefined : "6 4"}
            />
          )}

          {/* points */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={sx(p.point[0])}
              cy={sy(p.point[1])}
              r={9}
              fill={p.label === 1 ? "var(--green)" : "var(--surface-highest)"}
              stroke="var(--text)"
              strokeWidth={1.5}
              tabIndex={0}
              role="button"
              aria-label={t("pointAria", {
                n: i + 1,
                klass: p.label === 1 ? "positive" : "negative",
              })}
              style={{ cursor: "grab", outlineOffset: 2 }}
              onPointerDown={(e) => {
                (e.target as SVGCircleElement).setPointerCapture(e.pointerId);
                setDragging(i);
              }}
              onKeyDown={(e) => {
                const nudge: Record<string, [number, number]> = {
                  ArrowLeft: [-STEP, 0],
                  ArrowRight: [STEP, 0],
                  ArrowUp: [0, STEP],
                  ArrowDown: [0, -STEP],
                };
                const delta = nudge[e.key];
                if (!delta) return;
                e.preventDefault();
                const clamp = (v: number) => Math.max(DOM[0], Math.min(DOM[1], v));
                movePoint(i, [clamp(p.point[0] + delta[0]), clamp(p.point[1] + delta[1])]);
              }}
            />
          ))}
        </g>
      </svg>

      <p style={{ fontSize: "0.85rem", margin: 0, color: converged ? "var(--green)" : "var(--error)", fontWeight: 600 }}>
        {converged ? t("separable") : t("notSeparable")}
      </p>

      {showXorNote && (
        <p style={{ fontSize: "0.85rem", margin: 0, color: "var(--text-muted)", lineHeight: 1.55 }}>
          {t.rich("xorNote", { b: (chunks) => <strong>{chunks}</strong> })}
        </p>
      )}
    </div>
  );
}

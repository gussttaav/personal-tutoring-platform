/*
 * COURSE-C2-P1-03 — `context-window` (llm-agents Block 3 lesson 5, «La ventana de contexto es
 * un recurso escaso»; Block 4's lesson on state and memory and Block 5's on compaction reuse
 * it with presets of their own).
 *
 * The window as one bar. The reader moves the window's size (a slider) and picks who decides
 * what does not fit:
 *
 *   - the first bar is everything the harness has for this call, segment by segment in the
 *     order the plantilla writes them, on a fixed axis with the window marked: what falls
 *     outside the policy's choice is drawn hollow, a cut segment half hollow;
 *   - the second bar is the call itself, on the same axis, inside a frame the window's width:
 *     what the model reads, the summary where "compact" put one, and the reserve for the
 *     respuesta at the end;
 *   - the lines under them name what fell off, what was cut and by how much, what became a
 *     summary, and when the pinned segments alone do not fit.
 *
 * Every number comes from ../math/context-window (`fitWindow`), which the tests check policy
 * by policy. The preset is chosen by the `preset` prop (`<Explorable id="context-window"
 * preset="asistente" />`); its sizes are numbers, not copy. Every string is
 * `courses.widgets.context-window`.
 */

"use client";

import { useTranslations } from "next-intl";
import { useState, type CSSProperties } from "react";

import {
  CONTEXT_WINDOW_PRESETS,
  fitWindow,
  isPresetName,
  type Placed,
  type Policy,
  type Segment,
} from "../math/context-window";
import { Slider } from "../primitives/Slider";
import { WidgetButton } from "../primitives/WidgetButton";

const POLICIES: readonly Policy[] = ["front", "drop", "compact"];
/** It opens on nobody deciding: the reader sees the prompt de sistema fall off first. */
const DEFAULT_POLICY: Policy = "front";

/** One colour per kind; an unknown kind (a later preset's) falls back to the dim one. */
const KIND_FILL: Readonly<Record<string, string>> = {
  sistema: "var(--green)",
  ejemplo: "var(--green-container)",
  turno: "var(--text-muted)",
  resumen: "var(--text-dim)",
  pasaje: "var(--warning)",
  pregunta: "var(--text)",
  respuesta: "var(--green-mid)",
};
const fillOf = (kind: string) => KIND_FILL[kind] ?? "var(--text-dim)";

/** Thousands take the course's narrow space in both locales, as in the prose. */
const grouped = (v: number) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/** Where each of a row of sizes starts: 0, then the running sum. */
const offsets = (sizes: readonly number[]) => sizes.map((_, i) => sizes.slice(0, i).reduce((a, b) => a + b, 0));

const W = 1000;
const BAR_H = 22;
const label: CSSProperties = { fontSize: "0.8rem", color: "var(--text-dim)" };
const swatch: CSSProperties = { display: "inline-block", width: 12, height: 8, borderRadius: 2 };
const legendItem: CSSProperties = { display: "inline-flex", alignItems: "center", gap: "0.35rem" };

export default function ContextWindow(props: Record<string, unknown>) {
  const tr = useTranslations("courses.widgets.context-window");
  const tc = useTranslations("courses.widgets.common");

  const preset = CONTEXT_WINDOW_PRESETS[isPresetName(props.preset) ? props.preset : "asistente"];
  const [tCtx, setTCtx] = useState(preset.tCtxDefault);
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY);

  const fit = fitWindow(preset, tCtx, policy);
  const axis = Math.max(preset.tCtxMax, fit.total);
  const x = (tokens: number) => (W * tokens) / axis;

  const name = (s: Segment) => tr(`kinds.${s.kind}`, { n: s.n ?? 0 });
  const names = (ps: readonly Placed[]) => ps.map((p) => name(p.segment)).join(", ");

  const dropped = fit.placed.filter((p) => p.status === "dropped");
  const cut = fit.placed.filter((p) => p.status === "cut");
  const kinds = [...new Set([...preset.segments.map((s) => s.kind), ...(fit.summary ? ["resumen"] : [])])];

  const reset = () => {
    setTCtx(preset.tCtxDefault);
    setPolicy(DEFAULT_POLICY);
  };

  /** One segment drawn on a bar: `kept` of its `tokens` filled, the rest hollow. */
  const drawSegment = (s: Segment, start: number, kept: number, i: number) => {
    const fill = fillOf(s.kind);
    const shade = s.n !== undefined && s.n % 2 === 0 ? 0.72 : 1;
    const reserve = s.kind === "respuesta";
    return (
      <g key={`${s.id}-${i}`}>
        <title>{tr("segmentTitle", { name: name(s), tokens: grouped(s.tokens) })}</title>
        {kept < s.tokens ? (
          <rect
            x={x(start) + 1}
            y={1}
            width={Math.max(x(s.tokens) - 2, 1)}
            height={BAR_H - 2}
            fill="none"
            stroke={fill}
            strokeDasharray="3 3"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            opacity={0.8}
          />
        ) : null}
        {kept > 0 ? (
          <rect
            x={x(start + s.tokens - kept) + 1}
            y={1}
            width={Math.max(x(kept) - 2, 1)}
            height={BAR_H - 2}
            fill={fill}
            opacity={shade}
            stroke={reserve ? "var(--green)" : "none"}
            strokeDasharray={reserve ? "4 3" : undefined}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </g>
    );
  };

  // Bar 1: everything, in order. Bar 2: the call, packed from the left.
  const allStarts = offsets(fit.placed.map((p) => p.segment.tokens));
  const allBar = fit.placed.map((p, i) => drawSegment(p.segment, allStarts[i], p.kept, i));
  const callStarts = offsets(fit.call.map((p) => p.kept));
  const callBar = fit.call.map((p, i) => drawSegment({ ...p.segment, tokens: p.kept }, callStarts[i], p.kept, i));

  const windowLine = (
    <line
      x1={x(tCtx)}
      x2={x(tCtx)}
      y1={0}
      y2={BAR_H}
      stroke="var(--text)"
      strokeWidth={2}
      vectorEffect="non-scaling-stroke"
    />
  );

  return (
    <div
      role="group"
      aria-label={tr("groupAria")}
      style={{ display: "flex", flexDirection: "column", gap: "0.85rem", width: "100%" }}
    >
      {/* Who decides what does not fit. */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.4rem" }}>
        <span style={label}>{tr("policyLabel")}</span>
        {POLICIES.map((p) => (
          <WidgetButton key={p} active={policy === p} aria-pressed={policy === p} onClick={() => setPolicy(p)}>
            {tr(`policies.${p}`)}
          </WidgetButton>
        ))}
      </div>

      {/* Everything the harness has, with the window marked. */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        <span style={label}>{tr("allTitle", { total: grouped(fit.total) })}</span>
        <svg
          viewBox={`0 0 ${W} ${BAR_H}`}
          preserveAspectRatio="none"
          width="100%"
          height={BAR_H + 4}
          role="img"
          aria-label={tr("allAria", { total: grouped(fit.total), tCtx: grouped(tCtx) })}
        >
          {allBar}
          {windowLine}
        </svg>
      </div>

      {/* The call: what the model reads. */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        <span style={{ ...label, color: fit.fits ? label.color : "var(--error)" }}>
          {fit.fits
            ? tr("callTitle", { used: grouped(fit.used), tCtx: grouped(tCtx) })
            : tr("callNone", { used: grouped(fit.used), tCtx: grouped(tCtx) })}
        </span>
        <svg
          viewBox={`0 0 ${W} ${BAR_H}`}
          preserveAspectRatio="none"
          width="100%"
          height={BAR_H + 4}
          role="img"
          aria-label={tr("callAria", { used: grouped(fit.used), tCtx: grouped(tCtx), parts: names(fit.call) })}
        >
          <rect
            x={0.5}
            y={0.5}
            width={x(tCtx) - 1}
            height={BAR_H - 1}
            fill="var(--surface-lowest)"
            stroke="var(--border-variant)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <g opacity={fit.fits ? 1 : 0.35}>{callBar}</g>
          {windowLine}
        </svg>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem 1rem", fontSize: "0.72rem", color: "var(--text-dim)" }}>
        {kinds.map((k) => (
          <span key={k} style={legendItem}>
            <span style={{ ...swatch, background: fillOf(k) }} />
            {tr(`legend.${k}`)}
          </span>
        ))}
        <span style={legendItem}>
          <span style={{ ...swatch, border: "1px dashed var(--text-dim)" }} />
          {tr("legend.out")}
        </span>
      </div>

      {/* What happened, in words. */}
      <div
        aria-live="polite"
        style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.82rem", fontVariantNumeric: "tabular-nums" }}
      >
        {!fit.fits ? (
          <span style={{ color: "var(--error)" }}>{tr("noFit")}</span>
        ) : dropped.length === 0 && cut.length === 0 && !fit.summary ? (
          <span style={{ color: "var(--text)" }}>{tr("allFits")}</span>
        ) : null}
        {fit.summary ? (
          <span style={{ color: "var(--text)" }}>
            {tr("compacted", {
              replaced: grouped(fit.summary.replaced),
              summary: grouped(fit.summary.segment.tokens),
              parts: names(fit.placed.filter((p) => p.status === "compacted")),
            })}
          </span>
        ) : null}
        {cut.map((p) => (
          <span key={p.segment.id} style={{ color: "var(--text)" }}>
            {tr("cut", { name: name(p.segment), kept: grouped(p.kept), tokens: grouped(p.segment.tokens) })}
          </span>
        ))}
        {fit.fits && dropped.length > 0 ? (
          <span style={{ color: "var(--text-muted)" }}>{tr("dropped", { parts: names(dropped) })}</span>
        ) : null}
      </div>

      {/* Controls. */}
      <Slider
        label={tr("slider")}
        value={tCtx}
        min={preset.tCtxMin}
        max={preset.tCtxMax}
        step={preset.tCtxStep}
        onChange={setTCtx}
        format={(v) => tr("sliderValue", { tokens: grouped(v) })}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
        <WidgetButton onClick={reset}>{tc("reset")}</WidgetButton>
      </div>
    </div>
  );
}

/*
 * BLOG-27 — `latency-budget`, the interactive figure of «latencia-en-asistentes-de-voz».
 *
 * One voice turn as a timeline, time 0 being the moment the user stops speaking: one lane per
 * component (the user, the network, end-of-turn detection, the model, search and tools, speech
 * synthesis) and two readouts, the first sound the user hears and the start of the actual
 * answer. The reader changes how the end of the turn is decided, adds a search before the model
 * (classic RAG) or tool calls one after another, moves the tool to a remote MCP server, and
 * turns on the two ways of hiding a wait: a filler phrase and starting the first search while
 * the user is still talking. Three reference lines stay put: the human gap, both as measured on
 * yes/no questions (208 ms, Stivers et al. 2009) and over every turn (59 ms, Dingemanse &
 * Liesenfeld 2022), and Twilio's 1,115 ms target, which the default turn adds up to exactly.
 *
 * Every number comes from `./model.ts`, where each constant names its source. The chart draws
 * in real pixels (it measures its box), so its labels stay legible on a phone, the lesson
 * widgets' lesson (`ScalingLaws`).
 */

"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState, type RefObject } from "react";

import {
  ALL_TURNS_GAP,
  DEFAULT_INPUT,
  HUMAN_GAP,
  LANES,
  LISTEN_MS,
  MAX_TOOLS,
  MAX_TOOL_MS,
  SEARCH_MS,
  TOOL_RTTS,
  TWILIO_TARGET,
  computeBudget,
  timelineDomain,
  type BudgetInput,
  type ListenMode,
  type SearchMode,
  type Segment,
  type SegmentKind,
  type ToolHost,
} from "./model";
import { layoutRefs } from "./ref-layout";

const DEFAULT_W = 640;
/** Room above the lanes for the three reference labels, one row each. */
const TOP = 50;
const LANE_H = 22;
const LANE_PITCH = 30;
const AXIS = 28;
const RIGHT = 14;
const FONT = 11;
/** The least room an axis label gets before every other one is dropped (its grid line stays). */
const MIN_TICK_GAP = 40;

const PRESETS: Record<"chat" | "rag" | "tool" | "agent", Partial<BudgetInput>> = {
  chat: {},
  rag: { search: "rerank" },
  tool: { tools: 1, toolMs: SEARCH_MS.rerank },
  agent: { tools: 3, toolMs: SEARCH_MS.rerank, host: "mcpFresh" },
};

const BAR_CLASS: Record<SegmentKind, string> = {
  speech: "lb-bar--speech",
  netIn: "lb-bar--net",
  netOut: "lb-bar--net",
  fillerNetOut: "lb-bar--net lb-bar--filler",
  listen: "lb-bar--listen",
  search: "lb-bar--tool",
  callGen: "lb-bar--call",
  toolRun: "lb-bar--tool",
  ttft: "lb-bar--model",
  tts: "lb-bar--voice",
  fillerTtft: "lb-bar--model lb-bar--filler",
  fillerTts: "lb-bar--voice lb-bar--filler",
};

/** Bars too dark (or too faint) for the dark label. */
const LIGHT_LABEL = new Set<SegmentKind>(["speech", "fillerTtft", "fillerTts"]);

function useWidth(): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(DEFAULT_W);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(200, Math.round(el.clientWidth)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/**
 * Whole milliseconds as the post writes them: «1115» and «10 000» in Spanish (no separator
 * under five digits, a space from there on), «1,115» in English. Intl's es-ES grouping is a
 * dot, which the prose never uses.
 */
function integerFormat(locale: string): { format: (v: number) => string } {
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  if (!locale.startsWith("es")) return nf;
  return {
    format: (v) =>
      nf
        .formatToParts(v)
        .map((p) => (p.type === "group" ? "\u00a0" : p.value))
        .join(""),
  };
}

export default function LatencyBudget() {
  const t = useTranslations("blog.figures.latencyBudget");
  const locale = useLocale();
  const [input, setInput] = useState<BudgetInput>(DEFAULT_INPUT);
  const budget = useMemo(() => computeBudget(input), [input]);
  const set = (patch: Partial<BudgetInput>) => setInput((prev) => ({ ...prev, ...patch }));

  const msFmt = useMemo(() => integerFormat(locale), [locale]);
  const sFmt = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }), [locale]);
  const ms = (v: number) => t("ms", { value: msFmt.format(v) });
  const toolsOff = input.tools === 0;
  const noWork = !budget.hasWork;

  return (
    <div className="lb">
      <div className="lb-presets" role="group" aria-label={t("presets.label")}>
        {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((key) => (
          <button
            key={key}
            type="button"
            className="lb-chip"
            onClick={() => setInput({ ...DEFAULT_INPUT, ...PRESETS[key] })}
          >
            {t(`presets.${key}`)}
          </button>
        ))}
      </div>

      <div className="lb-readout" aria-live="polite">
        <div className="lb-readout__item">
          <span className="lb-readout__label">{t("readout.firstSound")}</span>
          <span className="lb-readout__value">{ms(budget.firstSound)}</span>
        </div>
        <div className="lb-readout__item lb-readout__item--answer">
          <span className="lb-readout__label">{t("readout.answer")}</span>
          <span className="lb-readout__value">{ms(budget.answer)}</span>
        </div>
        <p className="lb-readout__note">
          {t("readout.vsTarget", {
            ratio: sFmt.format(budget.answer / TWILIO_TARGET),
            human: sFmt.format(budget.firstSound / HUMAN_GAP),
          })}
        </p>
      </div>

      <Timeline
        segments={budget.segments}
        firstSound={budget.firstSound}
        answer={budget.answer}
        domain={timelineDomain(budget)}
        formatSeconds={(v) => (v === 0 ? "0" : t("seconds", { value: sFmt.format(v / 1000) }))}
        ariaLabel={t("aria", { first: msFmt.format(budget.firstSound), answer: msFmt.format(budget.answer) })}
      />

      <div className="lb-controls">
        <Choice<ListenMode>
          label={t("listen.label")}
          value={input.listen}
          options={(Object.keys(LISTEN_MS) as ListenMode[]).map((k) => ({ value: k, label: t(`listen.${k}`) }))}
          onChange={(listen) => set({ listen })}
        />
        <Choice<SearchMode>
          label={t("search.label")}
          value={input.search}
          options={(Object.keys(SEARCH_MS) as SearchMode[]).map((k) => ({ value: k, label: t(`search.${k}`) }))}
          onChange={(search) => set({ search })}
        />
        <Choice<string>
          label={t("tools.label")}
          value={String(input.tools)}
          options={Array.from({ length: MAX_TOOLS + 1 }, (_, n) => ({ value: String(n), label: String(n) }))}
          onChange={(v) => set({ tools: Number(v) })}
        />
        <ToolTime
          label={t("toolMs.label")}
          value={input.toolMs}
          disabled={toolsOff}
          format={ms}
          presets={[
            { value: SEARCH_MS.local, label: t("toolMs.local") },
            { value: SEARCH_MS.rerank, label: t("toolMs.rerank") },
          ]}
          onChange={(toolMs) => set({ toolMs })}
        />
        <Choice<ToolHost>
          label={t("host.label")}
          value={input.host}
          disabled={toolsOff}
          note={t("host.note")}
          options={(Object.keys(TOOL_RTTS) as ToolHost[]).map((k) => ({ value: k, label: t(`host.${k}`) }))}
          onChange={(host) => set({ host })}
        />
        <div className="lb-toggles">
          <Toggle
            label={t("filler.label")}
            checked={input.filler}
            disabled={noWork}
            onChange={(filler) => set({ filler })}
          />
          <Toggle
            label={t("speculative.label")}
            note={t("speculative.note")}
            checked={input.speculative}
            disabled={noWork}
            onChange={(speculative) => set({ speculative })}
          />
        </div>
      </div>
    </div>
  );
}

// ── The timeline ─────────────────────────────────────────────────────────────────────────

function Timeline({
  segments,
  firstSound,
  answer,
  domain,
  formatSeconds,
  ariaLabel,
}: {
  segments: Segment[];
  firstSound: number;
  answer: number;
  domain: { lo: number; hi: number; step: number };
  formatSeconds: (ms: number) => string;
  ariaLabel: string;
}) {
  const t = useTranslations("blog.figures.latencyBudget");
  const [box, W] = useWidth();
  const labelW = W < 440 ? 84 : 112;
  const H = TOP + LANES.length * LANE_PITCH + AXIS;
  const plotW = W - labelW - RIGHT;
  const x = (v: number) => labelW + ((v - domain.lo) / (domain.hi - domain.lo)) * plotW;
  const laneY = (lane: Segment["lane"]) => TOP + LANES.indexOf(lane) * LANE_PITCH;
  const ticks: number[] = [];
  for (let v = domain.lo; v <= domain.hi; v += domain.step) ticks.push(v);
  const hatch = `lb-hatch-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const plotBottom = TOP + LANES.length * LANE_PITCH - (LANE_PITCH - LANE_H);
  const labelEvery = Math.max(1, Math.ceil(MIN_TICK_GAP / (plotW / Math.max(1, ticks.length - 1))));
  const refDefs = [
    { x: x(ALL_TURNS_GAP), label: t("refs.allTurns") },
    { x: x(HUMAN_GAP), label: t("refs.human") },
    { x: x(TWILIO_TARGET), label: t("refs.target") },
  ];
  const placed = layoutRefs(
    refDefs.map((r) => ({ x: r.x, width: r.label.length * REF_CHAR_W })),
    W,
  );
  const refs = refDefs.map((r, i) => ({ ...r, place: placed[i] }));

  return (
    <div ref={box} className="lb-timeline">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={ariaLabel}>
        <defs>
          <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" className="lb-hatch-bg" />
            <line x1="0" y1="0" x2="0" y2="6" className="lb-hatch-line" />
          </pattern>
        </defs>

        {ticks.map((v, i) => (
          <g key={v}>
            <line x1={x(v)} x2={x(v)} y1={TOP - 6} y2={plotBottom} className={v === 0 ? "lb-zero" : "lb-grid"} />
            {(v === 0 || (i - ticks.indexOf(0)) % labelEvery === 0) && (
              <text x={x(v)} y={H - 10} className="lb-tick" textAnchor="middle" fontSize={FONT}>
                {formatSeconds(v)}
              </text>
            )}
          </g>
        ))}

        {/* Each line rises to its label's row, so line and label read as one mark. All the lines
            go first: on a phone a crossing can't always be avoided, and the label's halo
            (`paint-order: stroke` in post.css) then hides the line behind the text. */}
        {refs.map((r, i) => (
          <line key={i} x1={r.x} x2={r.x} y1={refRowY(r.place.row) - 9} y2={plotBottom} className="lb-ref" />
        ))}
        {refs.map((r, i) => (
          <text
            key={i}
            x={r.place.labelX}
            y={refRowY(r.place.row)}
            textAnchor={r.place.anchor}
            className="lb-ref-label"
            fontSize={FONT - 0.5}
          >
            {r.label}
          </text>
        ))}

        {LANES.map((lane) => (
          <text
            key={lane}
            x={labelW - 8}
            y={laneY(lane) + LANE_H / 2 + 4}
            textAnchor="end"
            className="lb-lane"
            fontSize={FONT}
          >
            {t(`lanes.${lane}`)}
          </text>
        ))}

        {segments.map((s, i) => {
          const x0 = x(s.start);
          const w = Math.max(1.5, x(s.end) - x0);
          const label = barLabel(s, t);
          const fits = label && w > label.length * 6.1 + 8;
          return (
            <g key={i}>
              <rect
                x={x0}
                y={laneY(s.lane)}
                width={w}
                height={LANE_H}
                rx={3}
                className={`lb-bar ${BAR_CLASS[s.kind]}${s.speculative ? " lb-bar--speculative" : ""}`}
                style={s.speculative ? { fill: `url(#${hatch})` } : undefined}
              >
                <title>{`${label ?? ""} ${Math.round(s.start)}–${Math.round(s.end)} ms`.trim()}</title>
              </rect>
              {fits && (
                <text
                  x={x0 + w / 2}
                  y={laneY(s.lane) + LANE_H / 2 + 4}
                  textAnchor="middle"
                  className={`lb-bar-label${LIGHT_LABEL.has(s.kind) || s.speculative ? " lb-bar-label--light" : ""}`}
                  fontSize={FONT - 0.5}
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}

        {firstSound < answer && (
          <line x1={x(firstSound)} x2={x(firstSound)} y1={TOP - 6} y2={plotBottom} className="lb-mark lb-mark--first" />
        )}
        <line x1={x(answer)} x2={x(answer)} y1={TOP - 6} y2={plotBottom} className="lb-mark" />
      </svg>
      <p className="lb-axis-note">{t("axis")}</p>
    </div>
  );
}

/** A generous estimate of a label's width at the reference font size (sans-serif ≈ 0.55em). */
const REF_CHAR_W = 6;

/** Baseline of reference-label row `row` (0 = top). */
const refRowY = (row: number) => 10 + row * 13;

function barLabel(s: Segment, t: ReturnType<typeof useTranslations>): string | null {
  switch (s.kind) {
    case "speech":
      return t("bars.speech");
    case "listen":
      return t("bars.listen");
    case "search":
      return t("bars.search");
    case "callGen":
      return t("bars.callGen", { n: s.round ?? 1 });
    case "toolRun":
      return t("bars.toolRun", { n: s.round ?? 1 });
    case "ttft":
      return t("bars.ttft");
    case "fillerTtft":
      return t("bars.filler");
    case "tts":
    case "fillerTts":
      return t("bars.tts");
    default:
      return null;
  }
}

// ── Controls ─────────────────────────────────────────────────────────────────────────────

function Choice<V extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  note,
}: {
  label: string;
  value: V;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
  disabled?: boolean;
  note?: string;
}) {
  const id = useId();
  return (
    <div className="lb-control" aria-disabled={disabled || undefined}>
      <span id={id} className="lb-control__label">
        {label}
      </span>
      <div className="lb-segmented" role="group" aria-labelledby={id}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className="lb-chip"
            aria-pressed={o.value === value}
            disabled={disabled}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {note && <span className="lb-control__note">{note}</span>}
    </div>
  );
}

function ToolTime({
  label,
  value,
  disabled,
  format,
  presets,
  onChange,
}: {
  label: string;
  value: number;
  disabled: boolean;
  format: (v: number) => string;
  presets: { value: number; label: string }[];
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div className="lb-control" aria-disabled={disabled || undefined}>
      <label htmlFor={id} className="lb-control__label lb-control__label--split">
        <span>{label}</span>
        <span className="lb-control__value">{format(value)}</span>
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={MAX_TOOL_MS}
        step={10}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="lb-range"
      />
      <div className="lb-segmented">
        {presets.map((p) => (
          <button
            key={p.value}
            type="button"
            className="lb-chip"
            aria-pressed={p.value === value}
            disabled={disabled}
            onClick={() => onChange(p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({
  label,
  note,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  note?: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="lb-toggle" aria-disabled={disabled || undefined}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {label}
        {note && <span className="lb-control__note">{note}</span>}
      </span>
    </label>
  );
}

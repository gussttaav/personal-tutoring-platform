/*
 * COURSE-C2-P1-01 — `sampling-explorer` (llm-agents Block 1 lesson 4, «Muestreo:
 * temperatura, top-k y top-p»).
 *
 * One real logit vector from the mini-GPT checkpoint (two, to choose between: a context
 * where the model hesitates and one where it has all but decided), turned into the
 * distribution a sampler draws from. The reader moves τ, picks a cut-off (none, top-k,
 * top-p) and its k or p, and sees, at once:
 *
 *   - the twelve most probable entries, each with two bars: softmax(z/τ) before the cut
 *     (faint) and what the sampler actually draws from after renormalising (solid). An
 *     entry the cut drops is drawn hatched, with its mass still visible — the discarded
 *     mass is SHOWN, not implied, which is the block plan's one requirement for this
 *     widget;
 *   - the other 500 entries as one aggregated row, split the same way, because that tail
 *     is where most of what a cut throws away lives;
 *   - a mass bar: how much of the tempered distribution the cut keeps, how much it drops,
 *     and between how many entries the draw is.
 *
 * The rows are in rank order at τ = 1 and never move: temperature does not change the
 * order (the lesson derives it, math/__tests__/sampling.test.ts asserts it), so a bar
 * that stayed put while τ slid is the claim made visible.
 *
 * All the maths is ../math/sampling (the port of minigpt.py's `muestrear`); the vectors
 * are ../math/sampling-presets, generated from the checkpoint. The contexts and token
 * labels are data bound to the Spanish checkpoint (corpora.ts, SPANISH_BOUND_CORPORA);
 * every other string is `courses.widgets.sampling-explorer`.
 */

"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState, type CSSProperties } from "react";

import { rankOrder, samplingDistribution, temperedSoftmax } from "../math/sampling";
import { SAMPLING_PRESETS, type SamplingPreset } from "../math/sampling-presets";
import { Slider } from "../primitives/Slider";
import { WidgetButton } from "../primitives/WidgetButton";

/** Rows drawn one by one; the rest of the vocabulary is one aggregated row. */
const ROWS = 12;
const VISIBLE_SPACE = "␣";
const DEFAULTS = { preset: "open" as SamplingPreset["id"], tau: 1, mode: "none" as Mode, k: 10, p: 0.9 };

type Mode = "none" | "topK" | "topP";

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

/**
 * A probability as a percentage with one decimal, decimal point in both locales (as the prose).
 * Below 1e-8 it is rounding residue (1 − 0.9999999999999999 with no cut), not mass: it prints 0.0.
 */
function pct(x: number): string {
  const v = 100 * x;
  return v >= 1e-6 && v < 0.05 ? "<0.1" : Math.max(0, v).toFixed(1);
}

/** A cut entry: its tempered mass, hatched. */
const HATCH = "repeating-linear-gradient(135deg, var(--text-dim) 0 2px, transparent 2px 5px)";

/** A token with its leading space drawn, dimmed, as ␣ — the way `bpe-merges` draws them. */
function TokenText({ text }: { text: string }) {
  const parts = text.split(" ");
  return (
    <span style={{ whiteSpace: "pre" }}>
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 ? <span style={{ color: "var(--text-dim)" }}>{VISIBLE_SPACE}</span> : null}
          {part}
        </span>
      ))}
    </span>
  );
}

/** The two bars of one row: before the cut (faint or hatched) and after it (solid). */
function Bars({ keptBefore, cutBefore, after }: { keptBefore: number; cutBefore: number; after: number }) {
  return (
    <div
      style={{
        position: "relative",
        height: 16,
        borderRadius: 3,
        background: "var(--surface-lowest)",
        border: "1px solid var(--border-variant)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "0 auto 0 0",
          width: `${100 * keptBefore}%`,
          background: "var(--green-mid)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${100 * keptBefore}%`,
          width: `${100 * cutBefore}%`,
          background: HATCH,
          opacity: 0.55,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          height: 6,
          width: `${100 * after}%`,
          background: "var(--green)",
        }}
      />
    </div>
  );
}

const rowGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(3.6rem, auto) minmax(0, 1fr) 3.6rem",
  alignItems: "center",
  gap: "0.5rem",
  fontSize: "0.8rem",
};
const valueStyle: CSSProperties = { textAlign: "right", fontVariantNumeric: "tabular-nums" };
const legendSwatch: CSSProperties = { display: "inline-block", width: 14, height: 8, borderRadius: 2 };

export default function SamplingExplorer() {
  const t = useTranslations("courses.widgets.sampling-explorer");
  const tc = useTranslations("courses.widgets.common");

  const [presetId, setPresetId] = useState(DEFAULTS.preset);
  const [tau, setTau] = useState(DEFAULTS.tau);
  const [mode, setMode] = useState<Mode>(DEFAULTS.mode);
  const [k, setK] = useState(DEFAULTS.k);
  const [p, setP] = useState(DEFAULTS.p);

  const preset = SAMPLING_PRESETS.find((s) => s.id === presetId) ?? SAMPLING_PRESETS[0];
  // Rank order at τ = 1: the same at every τ, so the rows never reorder.
  const order = useMemo(() => rankOrder(temperedSoftmax(preset.logits, 1)), [preset]);
  const result = useMemo(
    () =>
      samplingDistribution(preset.logits, {
        tau,
        topK: mode === "topK" ? k : null,
        topP: mode === "topP" ? p : null,
      }),
    [preset, tau, mode, k, p],
  );

  const rows = order.slice(0, ROWS);
  const rest = order.slice(ROWS);
  const restKeptBefore = sum(rest.map((i) => (result.keep[i] ? result.tempered[i] : 0)));
  const restCutBefore = sum(rest.map((i) => (result.keep[i] ? 0 : result.tempered[i])));
  const restAfter = sum(rest.map((i) => result.dist[i]));
  const greedy = tau === 0;
  const favourite = preset.labels[order[0]] ?? "";

  const reset = () => {
    setPresetId(DEFAULTS.preset);
    setTau(DEFAULTS.tau);
    setMode(DEFAULTS.mode);
    setK(DEFAULTS.k);
    setP(DEFAULTS.p);
  };

  return (
    <div
      role="group"
      aria-label={t("groupAria")}
      style={{ display: "flex", flexDirection: "column", gap: "0.85rem", width: "100%" }}
    >
      {/* The context: which logit vector. */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.4rem" }}>
        <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>{t("context")}</span>
        {SAMPLING_PRESETS.map((s) => (
          <WidgetButton
            key={s.id}
            active={s.id === presetId}
            aria-pressed={s.id === presetId}
            aria-label={t(s.id === "open" ? "presetOpenAria" : "presetPeakedAria", { context: s.context })}
            onClick={() => setPresetId(s.id)}
          >
            {s.context}
            <span style={{ opacity: 0.6 }}>▮</span>
          </WidgetButton>
        ))}
      </div>

      {/* How much the cut keeps, and between how many entries the draw is. */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        <div
          aria-hidden
          style={{
            display: "flex",
            height: 12,
            borderRadius: 3,
            overflow: "hidden",
            border: "1px solid var(--border-variant)",
          }}
        >
          <div style={{ width: `${100 * result.keptMass}%`, background: "var(--green)" }} />
          <div style={{ flex: 1, background: HATCH, opacity: 0.55 }} />
        </div>
        <div style={{ fontSize: "0.82rem", color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
          {t("mass", { kept: pct(result.keptMass), cut: pct(1 - result.keptMass) })}
        </div>
        <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
          {greedy ? t("greedySummary", { token: favourite.replaceAll(" ", VISIBLE_SPACE) }) : t("drawSummary", { n: result.keptCount })}
        </div>
      </div>

      {/* The rows, in rank order: they never move when τ does. */}
      <div role="list" style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
        {rows.map((id) => {
          const kept = result.keep[id] && result.dist[id] > 0;
          const before = result.tempered[id];
          const label = preset.labels[id] ?? String(id);
          return (
            <div
              key={id}
              role="listitem"
              aria-label={
                kept
                  ? t("rowAria", { token: label, before: pct(before), after: pct(result.dist[id]) })
                  : t("rowCutAria", { token: label, before: pct(before) })
              }
              style={{ ...rowGrid, opacity: kept || greedy ? 1 : 0.7 }}
            >
              <span style={{ color: "var(--text)" }}>
                <TokenText text={label} />
              </span>
              <Bars keptBefore={kept ? before : 0} cutBefore={kept ? 0 : before} after={result.dist[id]} />
              <span style={{ ...valueStyle, color: kept ? "var(--text)" : "var(--text-dim)" }}>
                {kept ? t("percent", { value: pct(result.dist[id]) }) : t("cut")}
              </span>
            </div>
          );
        })}
        <div
          role="listitem"
          aria-label={t("restAria", {
            n: rest.length,
            before: pct(restKeptBefore + restCutBefore),
            after: pct(restAfter),
          })}
          style={{ ...rowGrid, marginTop: "0.2rem" }}
        >
          <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>{t("rest", { n: rest.length })}</span>
          <Bars keptBefore={restKeptBefore} cutBefore={restCutBefore} after={restAfter} />
          <span style={{ ...valueStyle, color: restAfter > 0 ? "var(--text)" : "var(--text-dim)" }}>
            {restAfter > 0 ? t("percent", { value: pct(restAfter) }) : t("cutRest")}
          </span>
        </div>
      </div>

      {/* Legend. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem 1rem", fontSize: "0.72rem", color: "var(--text-dim)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
          <span style={{ ...legendSwatch, background: "var(--green-mid)" }} />
          {t("legendBefore")}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
          <span style={{ ...legendSwatch, background: "var(--green)", height: 5 }} />
          {t("legendAfter")}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
          <span style={{ ...legendSwatch, background: HATCH, opacity: 0.7 }} />
          {t("legendCut")}
        </span>
      </div>

      {/* Controls. */}
      <Slider
        label={t("temperature")}
        value={tau}
        min={0}
        max={2}
        step={0.05}
        onChange={setTau}
        format={(v) => (v === 0 ? t("greedyValue") : v.toFixed(2))}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
        <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>{t("cutLabel")}</span>
        {(["none", "topK", "topP"] as const).map((m) => (
          <WidgetButton key={m} active={mode === m} aria-pressed={mode === m} onClick={() => setMode(m)}>
            {t(`modes.${m}`)}
          </WidgetButton>
        ))}
      </div>
      {mode === "topK" ? (
        <Slider label={t("kSlider")} value={k} min={1} max={50} step={1} onChange={setK} />
      ) : null}
      {mode === "topP" ? (
        <Slider
          label={t("pSlider")}
          value={p}
          min={0.05}
          max={1}
          step={0.05}
          onChange={setP}
          format={(v) => v.toFixed(2)}
        />
      ) : null}
      <div>
        <WidgetButton onClick={reset}>{tc("reset")}</WidgetButton>
      </div>
    </div>
  );
}

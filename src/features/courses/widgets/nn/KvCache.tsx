/*
 * COURSE-C2-P1-01 — `kv-cache` (llm-agents Block 1 lesson 5, «La caché de claves y valores:
 * cuánto cuesta cada token»).
 *
 * The mini-GPT generating a full context window, one position at a time. The reader moves
 * t (a slider, one token back or forward, or Animate) and switches between the two ways of
 * producing token t:
 *
 *   - the text so far, the token at t outlined and the prompt underlined. Tokens not yet
 *     generated are empty dashed slots that keep their place, so the widget never reflows;
 *   - the cache as a grid: one column per position, one row per stored matrix (the keys and
 *     the values of each of the two layers). With the cache, column t is computed and the
 *     t − 1 before it are read; without it, all t are computed again — the recomputation
 *     the toggle exists to show;
 *   - the multiplications of every position, 1 to 64, both ways at once on one linear axis:
 *     c(t) with the cache, nearly flat, and t · c(t) without it, a ramp. That the second is
 *     exactly t times the first is the lesson's first result, and both come from
 *     ../math/kv-cache, which the tests recount product by product;
 *   - the numbers at t: the cost both ways, the running totals, and the cache's 2·L·t·d.
 *
 * The text is ../math/kv-cache-presets, generated from the checkpoint, and is Spanish-bound
 * like it (corpora.ts). Every other string is `courses.widgets.kv-cache`; the notation
 * (t, c(t), K⁽¹⁾…) reads the same in both languages.
 */

"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, type CSSProperties } from "react";

import { useReducedMotion } from "@/hooks/useReducedMotion";

import { MINI_GPT, cacheNumbers, stepCost, totalCost } from "../math/kv-cache";
import { KV_PROMPT_TOKENS, KV_TOKENS } from "../math/kv-cache-presets";
import { Slider } from "../primitives/Slider";
import { WidgetButton } from "../primitives/WidgetButton";

const T_MAX = MINI_GPT.tCtx;
const DEFAULTS = { t: 12, cached: true };
/** The four stored matrices, in drawing order: keys and values of layer 1, then of layer 2. */
const CACHE_ROWS = ["K⁽¹⁾", "V⁽¹⁾", "K⁽²⁾", "V⁽²⁾"] as const;
const MAX_COST = stepCost(T_MAX, MINI_GPT, false);

/** Thousands take the course's narrow space in both locales, as in the prose. */
const grouped = (v: number) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f");

const positions = Array.from({ length: T_MAX }, (_, i) => i + 1);

const label: CSSProperties = { fontSize: "0.8rem", color: "var(--text-dim)" };
const swatch: CSSProperties = { display: "inline-block", width: 12, height: 8, borderRadius: 2 };
const legendItem: CSSProperties = { display: "inline-flex", alignItems: "center", gap: "0.35rem" };

export default function KvCache() {
  const tr = useTranslations("courses.widgets.kv-cache");
  const tc = useTranslations("courses.widgets.common");
  const reduced = useReducedMotion();

  const [t, setT] = useState(DEFAULTS.t);
  const [cached, setCached] = useState(DEFAULTS.cached);
  const [playing, setPlaying] = useState(false);

  // One position at a time while playing (never under reduce-motion); stops at the window's end.
  useEffect(() => {
    if (!playing || reduced || t >= T_MAX) return;
    const id = setTimeout(() => setT((s) => Math.min(s + 1, T_MAX)), 220);
    return () => clearTimeout(id);
  }, [playing, reduced, t]);
  const animating = playing && t < T_MAX;

  const withCache = stepCost(t, MINI_GPT, true);
  const withoutCache = stepCost(t, MINI_GPT, false);

  const reset = () => {
    setPlaying(false);
    setT(DEFAULTS.t);
    setCached(DEFAULTS.cached);
  };

  /** A cache cell's fill: computed for this token, read from the cache, or not there yet. */
  const cellFill = (i: number) => {
    if (i > t) return "none";
    if (i === t || !cached) return "var(--green)";
    return "var(--green-mid)";
  };

  return (
    <div
      role="group"
      aria-label={tr("groupAria")}
      style={{ display: "flex", flexDirection: "column", gap: "0.85rem", width: "100%" }}
    >
      {/* With the cache, or recomputing everything. */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.4rem" }}>
        <span style={label}>{tr("modeLabel")}</span>
        {([true, false] as const).map((m) => (
          <WidgetButton key={String(m)} active={cached === m} aria-pressed={cached === m} onClick={() => setCached(m)}>
            {tr(m ? "modes.cached" : "modes.recompute")}
          </WidgetButton>
        ))}
      </div>

      {/* The text so far. A token not generated yet is an empty slot, like the grid's empty
          cells: it holds its place (no reflow) and its text is neither shown nor read out. */}
      <p style={{ margin: 0, fontSize: "0.85rem", lineHeight: 1.7, color: "var(--text)", whiteSpace: "pre-wrap" }}>
        {KV_TOKENS.map(([, text], i) => {
          const pos = i + 1;
          const future = pos > t;
          return (
            <span
              key={pos}
              aria-hidden={future || undefined}
              style={{
                color: future ? "transparent" : undefined,
                background: future
                  ? "none"
                  : pos === t
                    ? "var(--green-mid)"
                    : i % 2
                      ? "var(--surface-high)"
                      : "var(--surface-lowest)",
                outline: pos === t ? "1px solid var(--green)" : future ? "1px dashed var(--border-variant)" : undefined,
                outlineOffset: future ? "-2px" : undefined,
                borderRadius: "0.2rem",
                padding: "0.05rem 0.06rem",
                textDecoration: pos <= KV_PROMPT_TOKENS ? "underline" : undefined,
                textDecorationColor: "var(--text-dim)",
                textUnderlineOffset: "0.2em",
              }}
            >
              {text}
            </span>
          );
        })}
      </p>

      {/* The cache: one column per position, one row per stored matrix. */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        <span style={label}>{tr("cacheTitle")}</span>
        <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: "0.2rem 0.5rem", alignItems: "center" }}>
          {CACHE_ROWS.map((row) => (
            <div key={row} style={{ display: "contents" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{row}</span>
              <svg
                viewBox={`0 0 ${T_MAX * 10} 10`}
                preserveAspectRatio="none"
                width="100%"
                height={14}
                role="img"
                aria-label={
                  cached
                    ? tr("cacheRowAria", { row, read: t - 1, computed: 1 })
                    : tr("cacheRowAria", { row, read: 0, computed: t })
                }
              >
                {positions.map((i) => (
                  <rect
                    key={i}
                    x={(i - 1) * 10 + 1}
                    y={1}
                    width={8}
                    height={8}
                    rx={1}
                    fill={cellFill(i)}
                    stroke={i > t ? "var(--border-variant)" : "none"}
                    strokeWidth={0.8}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </svg>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem 1rem", fontSize: "0.72rem", color: "var(--text-dim)" }}>
          <span style={legendItem}>
            <span style={{ ...swatch, background: "var(--green)" }} />
            {tr("legendComputed")}
          </span>
          <span style={legendItem}>
            <span style={{ ...swatch, background: "var(--green-mid)" }} />
            {tr("legendRead")}
          </span>
          <span style={legendItem}>
            <span style={{ ...swatch, border: "1px solid var(--border-variant)" }} />
            {tr("legendEmpty")}
          </span>
        </div>
      </div>

      {/* Multiplications of every position, both ways, on one linear axis. */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        <span style={label}>{tr("costTitle", { max: grouped(MAX_COST) })}</span>
        <svg
          viewBox={`0 0 ${T_MAX * 10} 100`}
          preserveAspectRatio="none"
          width="100%"
          height={110}
          role="img"
          aria-label={tr("costAria", { total: T_MAX, t })}
          style={{ background: "var(--surface-lowest)", borderRadius: 3, border: "1px solid var(--border-variant)" }}
        >
          {positions.map((i) => {
            const full = (100 * stepCost(i, MINI_GPT, false)) / MAX_COST;
            const one = (100 * stepCost(i, MINI_GPT, true)) / MAX_COST;
            const future = i > t;
            return (
              <g key={i} opacity={future ? 0.25 : 1}>
                <rect
                  x={(i - 1) * 10 + 1.5}
                  y={100 - full}
                  width={7}
                  height={full}
                  fill="var(--text-dim)"
                  opacity={cached ? 0.35 : 0.8}
                />
                <rect
                  x={(i - 1) * 10 + 1.5}
                  y={100 - Math.max(one, 0.8)}
                  width={7}
                  height={Math.max(one, 0.8)}
                  fill="var(--green)"
                  opacity={cached ? 1 : 0.6}
                />
                {i === t ? (
                  <rect
                    x={(i - 1) * 10 + 0.5}
                    y={0.5}
                    width={9}
                    height={99}
                    fill="none"
                    stroke="var(--text)"
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null}
              </g>
            );
          })}
        </svg>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem 1rem", fontSize: "0.72rem", color: "var(--text-dim)" }}>
          <span style={legendItem}>
            <span style={{ ...swatch, background: "var(--green)" }} />
            {tr("legendWith")}
          </span>
          <span style={legendItem}>
            <span style={{ ...swatch, background: "var(--text-dim)" }} />
            {tr("legendWithout")}
          </span>
        </div>
      </div>

      {/* The numbers at t. */}
      <div
        aria-live="polite"
        style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.82rem", fontVariantNumeric: "tabular-nums" }}
      >
        <span style={{ color: "var(--text)" }}>
          {tr("position", { t, total: T_MAX, numbers: grouped(cacheNumbers(t, MINI_GPT)) })}
        </span>
        <span style={{ color: cached ? "var(--text)" : "var(--text-dim)", fontWeight: cached ? 600 : 400 }}>
          {tr("withCache", { mults: grouped(withCache) })}
        </span>
        <span style={{ color: cached ? "var(--text-dim)" : "var(--text)", fontWeight: cached ? 400 : 600 }}>
          {tr("withoutCache", { t, mults: grouped(withoutCache) })}
        </span>
        <span style={{ color: "var(--text-muted)" }}>
          {tr("totals", {
            with: grouped(totalCost(t, MINI_GPT, true)),
            without: grouped(totalCost(t, MINI_GPT, false)),
          })}
        </span>
      </div>

      {/* Controls. */}
      <Slider
        label={tr("slider")}
        value={t}
        min={1}
        max={T_MAX}
        step={1}
        onChange={(v) => {
          setPlaying(false);
          setT(v);
        }}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
        <WidgetButton
          onClick={() => {
            setPlaying(false);
            setT((s) => Math.max(1, s - 1));
          }}
          disabled={t <= 1}
        >
          {tr("back")}
        </WidgetButton>
        <WidgetButton
          onClick={() => {
            setPlaying(false);
            setT((s) => Math.min(T_MAX, s + 1));
          }}
          disabled={t >= T_MAX}
        >
          {tr("forward")}
        </WidgetButton>
        {!reduced && (
          <WidgetButton
            active={animating}
            onClick={() => {
              if (t >= T_MAX) {
                setT(1);
                setPlaying(true);
              } else {
                setPlaying((p) => !p);
              }
            }}
          >
            {animating ? tc("pause") : tc("animate")}
          </WidgetButton>
        )}
        <WidgetButton onClick={reset}>{tc("reset")}</WidgetButton>
      </div>
    </div>
  );
}

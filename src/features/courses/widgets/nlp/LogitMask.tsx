/*
 * COURSE-C2-P1-03 — `logit-mask` (llm-agents Block 3 lesson 3, «Salida estructurada:
 * generación restringida»).
 *
 * The mini-GPT writing `{"personaje": "<nombre>"}` under the lesson's grammar, one position
 * at a time. The reader picks which of the five names the path writes and moves through its
 * positions (one token back or forward, or a tap on a token of the text), and sees, at once:
 *
 *   - the text, token by token, as the mask cut it — the position being drawn outlined, the
 *     tokens still to come dimmed, every one of them a button to jump to its position;
 *   - the rows of that position: the entries the model ranks highest and every entry the
 *     grammar allows, each with two bars, the model's probability before the mask (faint, or
 *     hatched when the grammar forbids it) and what the mask draws from (solid, renormalised
 *     on the allowed set), the rest of the vocabulary as one row;
 *   - the mass the mask keeps, p_θ(A_j | x, y_<j), and how many entries share it;
 *   - the path so far, without the mask and with it. The first divided by the second is the
 *     product of the masses kept, which is the lesson's q̃(y | x) = p_θ(y | x) / Π_j p_θ(A_j).
 *
 * The positions that make the lesson's point are one tap apart: the first, where `{` has
 * 1.2 × 10⁻⁷ and gets everything; the value's first letter, where the mask hands P 61 % and
 * N 1.6 %; and the one after it, where the model wants «or» (Por) and the mask writes Pablo
 * anyway. All the maths is ../math/logit-mask, which cuts with `restrict` from ../math/sampling;
 * the paths are ../math/logit-mask-presets, generated from the checkpoint and Spanish-bound
 * like it (corpora.ts). Every other string is `courses.widgets.logit-mask`.
 */

"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState, type CSSProperties } from "react";

import { maskView, pathTotals, VOCAB_SIZE } from "../math/logit-mask";
import {
  LOGIT_MASK_NAMES,
  LOGIT_MASK_PATHS,
  LOGIT_MASK_PROMPT,
  LOGIT_MASK_SHARED,
  type MaskEntry,
  type MaskName,
} from "../math/logit-mask-presets";
import { WidgetButton } from "../primitives/WidgetButton";

const DEFAULTS = { name: "Nela" as MaskName, pos: 0 };
const VISIBLE_SPACE = "␣";
const VISIBLE_NEWLINE = "↵";
const SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹";

/** A cut entry: its mass before the mask, hatched. */
const HATCH = "repeating-linear-gradient(135deg, var(--text-dim) 0 2px, transparent 2px 5px)";

/**
 * A probability for the reader: a percentage with one decimal from 0.1 % up, and below that
 * a power of ten, `1.2 × 10⁻⁷` — the notation is the same in both locales, so it is not copy.
 */
function prob(p: number, percent: (value: string) => string): string {
  if (p >= 0.9995) return percent("100");
  if (p >= 0.00095) return percent((100 * p).toFixed(1));
  if (p <= 0) return percent("0");
  const exp = Math.floor(Math.log10(p));
  let mant = p / 10 ** exp;
  let e = exp;
  if (Number(mant.toFixed(1)) >= 10) {
    mant /= 10;
    e += 1;
  }
  const sup = String(Math.abs(e))
    .split("")
    .map((d) => SUPERSCRIPT[Number(d)])
    .join("");
  return `${mant.toFixed(1)} × 10${e < 0 ? "⁻" : ""}${sup}`;
}

/** A token for an aria-label: a line break is not something a label can show, so it is ↵. */
const ariaToken = (label: string) => label.replaceAll("\n", VISIBLE_NEWLINE);

/** A token as the reader sees it: visible spaces and line breaks, or its bytes in hex. */
function TokenText({ entry }: { entry: Pick<MaskEntry, "label" | "partial"> }) {
  if (entry.partial) {
    return (
      <span
        style={{
          fontFamily: "var(--font-mono, ui-monospace, monospace)",
          fontSize: "0.72em",
          color: "var(--text-muted)",
          border: "1px dashed var(--text-dim)",
          borderRadius: "0.2rem",
          padding: "0 0.15rem",
        }}
      >
        {entry.label}
      </span>
    );
  }
  const parts = entry.label.split(/( |\n)/);
  return (
    <span style={{ whiteSpace: "pre" }}>
      {parts.map((part, i) =>
        part === " " || part === "\n" ? (
          <span key={i} style={{ color: "var(--text-dim)" }}>
            {part === " " ? VISIBLE_SPACE : VISIBLE_NEWLINE}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}

/** The two bars of one row: before the mask (faint, or hatched if cut) and after it (solid). */
function Bars({ before, after, allowed }: { before: number; after: number; allowed: boolean }) {
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
          width: `${100 * before}%`,
          background: allowed ? "var(--green-mid)" : HATCH,
          opacity: allowed ? 1 : 0.55,
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
  gridTemplateColumns: "minmax(2.6rem, auto) minmax(0, 1fr) 4.6rem 3.4rem",
  alignItems: "center",
  gap: "0.4rem",
  fontSize: "0.8rem",
};
const valueStyle: CSSProperties = { textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
const legendSwatch: CSSProperties = { display: "inline-block", width: 14, height: 8, borderRadius: 2 };
const dim: CSSProperties = { fontSize: "0.8rem", color: "var(--text-dim)" };

export default function LogitMask() {
  const t = useTranslations("courses.widgets.logit-mask");
  const tc = useTranslations("courses.widgets.common");

  const [name, setName] = useState<MaskName>(DEFAULTS.name);
  const [pos, setPos] = useState(DEFAULTS.pos);

  const steps = useMemo(() => [...LOGIT_MASK_SHARED, ...LOGIT_MASK_PATHS[name]], [name]);
  const at = Math.min(pos, steps.length - 1);
  const step = steps[at];
  const view = useMemo(() => maskView(step), [step]);
  const totals = useMemo(() => pathTotals(steps, at + 1), [steps, at]);
  const pct = (value: string) => t("percent", { value });
  const chosenOf = (s: (typeof steps)[number]) => s.allowed.find((e) => e.id === s.chosen) as MaskEntry;
  const chosen = chosenOf(step);

  const reset = () => {
    setName(DEFAULTS.name);
    setPos(DEFAULTS.pos);
  };

  return (
    <div
      role="group"
      aria-label={t("groupAria")}
      style={{ display: "flex", flexDirection: "column", gap: "0.85rem", width: "100%" }}
    >
      {/* The prompt, and which of the grammar's five texts the path writes. */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
          <span style={{ color: "var(--text-dim)" }}>{t("prompt")} </span>
          {LOGIT_MASK_PROMPT}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.4rem" }}>
          <span style={dim}>{t("pathLabel")}</span>
          {LOGIT_MASK_NAMES.map((n) => (
            <WidgetButton
              key={n}
              active={n === name}
              aria-pressed={n === name}
              aria-label={t("pathAria", { name: n })}
              onClick={() => setName(n)}
            >
              {n}
            </WidgetButton>
          ))}
        </div>
      </div>

      {/* The text, token by token: written, being drawn (outlined), still to come (dimmed). */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.2rem", fontSize: "0.85rem", lineHeight: 1.5 }}>
        {steps.map((s, i) => {
          const entry = chosenOf(s);
          const current = i === at;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setPos(i)}
              aria-current={current ? "step" : undefined}
              aria-label={t("tokenAria", { n: i + 1, token: ariaToken(entry.label) })}
              style={{
                cursor: "pointer",
                font: "inherit",
                color: i > at ? "var(--text-dim)" : "var(--text)",
                background: current ? "var(--green-mid)" : i < at ? "var(--surface-high)" : "transparent",
                borderWidth: 1,
                borderStyle: i > at ? "dashed" : "solid",
                borderColor: current ? "var(--green)" : "var(--border-variant)",
                borderRadius: "0.3rem",
                padding: "0.05rem 0.3rem",
                minWidth: "1.4rem",
              }}
            >
              <TokenText entry={entry} />
            </button>
          );
        })}
      </div>

      {/* Where we are, and how much of the model's mass the mask keeps here. */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        <div style={{ fontSize: "0.82rem", color: "var(--text)" }}>
          {t("position", { n: at + 1, total: steps.length })}{" "}
          <span style={{ color: "var(--text-muted)" }}>{t("allowed", { n: view.allowedCount, size: VOCAB_SIZE })}</span>
        </div>
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
          <div style={{ width: `${100 * view.keptMass}%`, background: "var(--green)" }} />
          <div style={{ flex: 1, background: HATCH, opacity: 0.55 }} />
        </div>
        <div style={{ fontSize: "0.82rem", color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
          {t("kept", { kept: prob(view.keptMass, pct) })}
        </div>
      </div>

      {/* The rows: the model's favourites and every allowed entry, before and after the mask. */}
      <div role="list" style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
        <div aria-hidden style={{ ...rowGrid, fontSize: "0.7rem", color: "var(--text-dim)" }}>
          <span />
          <span />
          <span style={valueStyle}>{t("headBefore")}</span>
          <span style={valueStyle}>{t("headAfter")}</span>
        </div>
        {view.rows.map((r) => {
          const entry = steps[at].allowed.find((e) => e.id === r.id) ?? steps[at].top.find((e) => e.id === r.id);
          return (
            <div
              key={r.id}
              role="listitem"
              aria-label={
                r.allowed
                  ? t("rowAria", { token: ariaToken(r.label), before: prob(r.before, pct), after: prob(r.after, pct) })
                  : t("rowCutAria", { token: ariaToken(r.label), before: prob(r.before, pct) })
              }
              style={{ ...rowGrid, opacity: r.allowed ? 1 : 0.75 }}
            >
              <span
                style={{
                  color: "var(--text)",
                  fontWeight: r.id === chosen.id ? 700 : 400,
                  textDecoration: r.id === chosen.id ? "underline" : undefined,
                  textDecorationColor: "var(--green)",
                  textUnderlineOffset: "0.2em",
                }}
              >
                <TokenText entry={entry ?? { label: r.label }} />
              </span>
              <Bars before={r.before} after={r.after} allowed={r.allowed} />
              <span style={{ ...valueStyle, color: "var(--text-muted)" }}>{prob(r.before, pct)}</span>
              <span style={{ ...valueStyle, color: r.allowed ? "var(--text)" : "var(--text-dim)" }}>
                {r.allowed ? prob(r.after, pct) : t("cut")}
              </span>
            </div>
          );
        })}
        <div
          role="listitem"
          aria-label={t("restAria", { n: view.rest.count, before: prob(view.rest.mass, pct) })}
          style={{ ...rowGrid, marginTop: "0.2rem" }}
        >
          <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>{t("rest", { n: view.rest.count })}</span>
          <Bars before={view.rest.mass} after={0} allowed={false} />
          <span style={{ ...valueStyle, color: "var(--text-muted)" }}>{prob(view.rest.mass, pct)}</span>
          <span style={{ ...valueStyle, color: "var(--text-dim)" }}>{t("cut")}</span>
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

      {/* The path so far: its probability without the mask and with it. */}
      <div aria-live="polite" style={{ fontSize: "0.82rem", color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
        {t("totals", { raw: prob(totals.raw, pct), masked: prob(totals.masked, pct) })}
      </div>

      {/* Controls. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
        <WidgetButton onClick={() => setPos(Math.max(0, at - 1))} disabled={at <= 0}>
          {tc("stepBack")}
        </WidgetButton>
        <WidgetButton onClick={() => setPos(Math.min(steps.length - 1, at + 1))} disabled={at >= steps.length - 1}>
          {tc("stepForward")}
        </WidgetButton>
        <WidgetButton onClick={reset}>{tc("reset")}</WidgetButton>
      </div>
    </div>
  );
}

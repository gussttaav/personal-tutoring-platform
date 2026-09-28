/*
 * COURSE-C2-P1-01 — `bpe-merges` (llm-agents Block 1 lesson 2, «BPE de verdad»).
 *
 * BPE trained in front of the reader. A corpus small enough to read whole, trained with
 * the course tokeniser's rules (math/bpe-merges.ts, the port of bpe.py): start from the
 * UTF-8 bytes, count every pair of neighbours inside a pre-token, glue the most frequent,
 * repeat while some pair still occurs twice. The slider steps through those merges and
 * shows, at each one:
 *
 *   - the corpus with its token boundaries (alternating shades), the tokens the last
 *     merge created lit up, and the first course's ℓ̄ in bytes per token going up;
 *   - the merge just made, with its f, and the three pairs the NEXT merge chooses from —
 *     so «the most frequent pair» is a count the reader can check, not a claim;
 *   - a sentence the corpus does not contain, encoded with the merges learned so far —
 *     `codificar`, rank order — which the reader can replace with their own.
 *
 * A token that is not text on its own (one byte of `ñ`) is drawn as its hex bytes in a
 * dashed box: at step 0 the Spanish `ñ` is `C3` `B1`, and merge 1 is what makes it one.
 *
 * Everything the reader sees comes from `messages` (`courses.widgets.bpe-merges`) except
 * notation (|V|, ℓ̄, f) and the tokens themselves. The corpus and sentence are teaching
 * instruments, in corpora.ts with their property.
 */

"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, type CSSProperties } from "react";

import { widgetCorpus } from "../corpora";
import {
  BPE_WIDGET_MAX_MERGES,
  BPE_WIDGET_MIN_FREQ,
  N_BYTES,
  encode,
  tokenLabel,
  trainBpe,
  utf8,
  vocabulary,
  type Pair,
} from "../math/bpe-merges";
import { Slider } from "../primitives/Slider";
import { WidgetButton } from "../primitives/WidgetButton";

const VISIBLE_SPACE = "␣";
/** Long enough for a sentence of one's own; short enough that the chips stay a few rows. */
const MAX_SENTENCE_CHARS = 120;

/** A token as the reader sees it: text with visible spaces, or its bytes in hex. */
function Token({
  bytes,
  fresh,
  shade,
  chip,
}: {
  bytes: readonly number[];
  /** Created by the merge just made. */
  fresh: boolean;
  /** Alternate background, so adjacent tokens stay distinguishable in running text. */
  shade: boolean;
  /** Sentence chips are padded boxes; corpus tokens flow as text. */
  chip: boolean;
}) {
  const { text, valid } = tokenLabel(bytes);
  const style: CSSProperties = {
    whiteSpace: "pre",
    borderRadius: chip ? "0.4rem" : "0.2rem",
    padding: chip ? "0.15rem 0.4rem" : "0.05rem 0.08rem",
    fontVariantNumeric: "tabular-nums",
    color: "var(--text)",
    background: fresh ? "var(--green-mid)" : shade ? "var(--surface-high)" : "var(--surface-lowest)",
    outline: fresh ? "1px solid var(--green)" : undefined,
    border: chip ? "1px solid var(--border-variant)" : undefined,
  };
  if (!valid) {
    return (
      <span
        style={{
          ...style,
          fontFamily: "var(--font-mono, ui-monospace, monospace)",
          fontSize: "0.72em",
          color: "var(--text-muted)",
          border: "1px dashed var(--text-dim)",
        }}
      >
        {text}
      </span>
    );
  }
  // A leading space belongs to the token (` de`), so it is drawn — dimmed — inside it.
  const parts = text.split(" ");
  return (
    <span style={style}>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 ? <span style={{ color: "var(--text-dim)" }}>{VISIBLE_SPACE}</span> : null}
          {p}
        </span>
      ))}
    </span>
  );
}

/** «a» + «b» → «ab», as token labels. */
function PairLabel({ pair, vocab }: { pair: Pair; vocab: readonly number[][] }) {
  const show = (id: number) => {
    const { text, valid } = tokenLabel(vocab[id]);
    return valid ? text.replaceAll(" ", VISIBLE_SPACE) : text;
  };
  return (
    <span style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "pre" }}>
      «{show(pair[0])}» + «{show(pair[1])}»
    </span>
  );
}

const sectionTitle: CSSProperties = {
  fontWeight: 600,
  fontSize: "0.85rem",
  color: "var(--text)",
};
const stat: CSSProperties = {
  fontSize: "0.8rem",
  color: "var(--text-dim)",
  fontVariantNumeric: "tabular-nums",
};

export default function BpeMerges() {
  const t = useTranslations("courses.widgets.bpe-merges");
  const tc = useTranslations("courses.widgets.common");
  const locale = useLocale();
  const { corpus, sentence: defaultSentence } = widgetCorpus("bpe-merges", locale);

  const training = useMemo(
    () => trainBpe(corpus, BPE_WIDGET_MAX_MERGES, BPE_WIDGET_MIN_FREQ),
    [corpus],
  );
  const vocab = useMemo(() => vocabulary(training.merges), [training]);
  const total = training.merges.length;

  const [k, setK] = useState(0);
  const [sentence, setSentence] = useState(defaultSentence);

  const active = useMemo(() => training.merges.slice(0, k), [training, k]);
  const corpusIds = useMemo(() => encode(corpus, active), [corpus, active]);
  const sentenceIds = useMemo(() => encode(sentence, active), [sentence, active]);
  const corpusBytes = useMemo(() => utf8(corpus).length, [corpus]);
  const sentenceBytes = utf8(sentence).length;

  const last = k > 0 ? training.merges[k - 1] : null;
  const next = k < total ? training.merges[k].candidates : null;
  const freshId = last?.id ?? -1;

  const go = (delta: number) => setK((v) => Math.max(0, Math.min(total, v + delta)));
  const reset = () => {
    setK(0);
    setSentence(defaultSentence);
  };

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "0.9rem", width: "100%", outlineOffset: 3 }}
      tabIndex={0}
      role="group"
      aria-label={t("groupAria")}
      onKeyDown={(e) => {
        // The slider and the sentence field handle their own arrow keys.
        if (e.target instanceof HTMLInputElement) return;
        if (e.key === "ArrowRight") {
          e.preventDefault();
          go(1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          go(-1);
        }
      }}
    >
      {/* The corpus, with its boundaries. */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.25rem 0.75rem" }}>
          <span style={sectionTitle}>{t("corpus")}</span>
          <span style={stat}>
            {t.rich("corpusStats", {
              bytes: String(corpusBytes),
              tokens: String(corpusIds.length),
              lbar: (corpusBytes / corpusIds.length).toFixed(2),
              // ℓ̄ as an overline: the combining macron sits off-centre on ℓ in the UI font.
              bar: (chunks) => <span style={{ textDecoration: "overline" }}>{chunks}</span>,
            })}
          </span>
        </div>
        {/* A flex row, not running text: spaces are drawn as ␣, so the only places a
            line may break are the token boundaries, which is also where it should. */}
        <div style={{ display: "flex", flexWrap: "wrap", rowGap: "0.3rem", fontSize: "0.85rem", lineHeight: 1.5 }}>
          {corpusIds.map((id, i) => (
            <Token key={i} bytes={vocab[id]} fresh={id === freshId} shade={i % 2 === 1} chip={false} />
          ))}
        </div>
      </div>

      {/* The merge just made, and what the next one will choose from. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.35rem",
          padding: "0.6rem 0.8rem",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border-variant)",
          background: "var(--surface-lowest)",
          fontSize: "0.85rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.25rem 0.75rem" }}>
          <span style={{ fontWeight: 700, color: "var(--green)" }}>
            {k === 0 ? t("noMerges") : t("stepLabel", { k: String(k), total: String(total) })}
          </span>
          <span style={stat}>{t("vocab", { k: String(k), size: String(N_BYTES + k) })}</span>
        </div>
        {last ? (
          <div style={{ color: "var(--text)" }}>
            <PairLabel pair={last.pair} vocab={vocab} /> →{" "}
            <Token bytes={vocab[last.id]} fresh shade={false} chip />{" "}
            <span style={stat}>{t("freq", { f: String(last.freq) })}</span>
          </div>
        ) : null}
        {/* Each candidate is one unbreakable unit, so a count never wraps away from its
            pair on a phone; the line breaks between candidates instead. */}
        <div
          style={{
            color: "var(--text-muted)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "baseline",
            gap: "0.15rem 0.75rem",
          }}
        >
          {next ? (
            <>
              <span>{t("next")}</span>
              {next.map((c, i) => (
                <span key={i} style={{ whiteSpace: "nowrap", color: i === 0 ? "var(--text)" : undefined }}>
                  <PairLabel pair={c.pair} vocab={vocab} /> <span style={stat}>{c.freq}</span>
                </span>
              ))}
            </>
          ) : (
            <span>{t("exhausted")}</span>
          )}
        </div>
      </div>

      {/* A sentence the corpus does not contain, encoded with the merges so far. */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.25rem 0.75rem" }}>
          <span style={sectionTitle}>{t("sentence")}</span>
          <span style={stat}>
            {t("sentenceStats", { bytes: String(sentenceBytes), tokens: String(sentenceIds.length) })}
          </span>
        </div>
        <input
          type="text"
          aria-label={t("sentenceAria")}
          value={sentence}
          maxLength={MAX_SENTENCE_CHARS}
          onChange={(e) => setSentence(e.target.value)}
          style={{
            padding: "0.45rem 0.6rem",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border-variant)",
            background: "var(--surface-lowest)",
            color: "var(--text)",
            fontSize: "0.9rem",
          }}
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", fontSize: "0.8rem" }}>
          {sentenceIds.map((id, i) => (
            <Token key={i} bytes={vocab[id]} fresh={id === freshId} shade={false} chip />
          ))}
        </div>
        <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>{t("byteHint")}</span>
      </div>

      {/* Controls. */}
      <Slider
        label={t("slider")}
        value={k}
        min={0}
        max={total}
        step={1}
        onChange={setK}
        format={(v) => `${v} / ${total}`}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
        <WidgetButton onClick={() => go(-1)} disabled={k === 0}>
          {tc("previous")}
        </WidgetButton>
        <WidgetButton onClick={() => go(1)} disabled={k === total}>
          {tc("next")}
        </WidgetButton>
        <WidgetButton onClick={reset}>{tc("reset")}</WidgetButton>
      </div>
    </div>
  );
}

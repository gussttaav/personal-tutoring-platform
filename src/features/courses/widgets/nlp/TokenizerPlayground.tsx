/*
 * COURSE-P2-02 — `tokenizer-playground`: one sentence, three segmentations side by
 * side (words / characters / subwords), so "tokenisation is a choice" is concrete in
 * five seconds. All tokenisation is pure (math/tokenisation.ts, NFC-normalised so
 * Spanish accents and ñ stay intact). Local state only; the textarea is the input.
 *
 * COURSE-P11-02 — column titles, hints and the textarea's aria-label are now
 * `courses.widgets.tokenizer-playground`, and the DEFAULT SENTENCE moved to
 * ../corpora.ts. That sentence is a teaching instrument, not copy: the Spanish one is
 * chosen so `niño` lands the NFC point and `programación` splits into subwords, and the
 * English one is chosen against the same property rather than translated from it. See
 * the reasoning next to it in corpora.ts.
 */

"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { widgetCorpus } from "../corpora";
import { tokenizeWords, tokenizeChars, tokenizeSubwords, CONTINUATION } from "../math/tokenisation";
import { WidgetButton } from "../primitives/WidgetButton";

const VISIBLE_SPACE = "␣"; // ␣, so spaces are visible as character tokens

interface Column {
  title: string;
  tokens: string[];
  hint: string;
}

function Chip({ token }: { token: string }) {
  const continuation = token.startsWith(CONTINUATION);
  const label = continuation ? token.slice(CONTINUATION.length) : token === " " ? VISIBLE_SPACE : token;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: "0.1rem",
        padding: "0.15rem 0.4rem",
        borderRadius: "0.4rem",
        border: "1px solid var(--border-variant)",
        background: "var(--surface-lowest)",
        color: "var(--text)",
        fontSize: "0.8rem",
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "pre",
      }}
    >
      {continuation ? <span style={{ color: "var(--text-dim)" }}>{CONTINUATION}</span> : null}
      {label}
    </span>
  );
}

function TokenColumn({ title, tokens, hint }: Column) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", flex: "1 1 180px", minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.5rem" }}>
        <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text)" }}>{title}</span>
        <span style={{ fontSize: "0.8rem", color: "var(--green)", fontVariantNumeric: "tabular-nums" }}>
          {tokens.length}
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
        {tokens.map((t, i) => (
          <Chip key={i} token={t} />
        ))}
      </div>
      <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>{hint}</span>
    </div>
  );
}

export default function TokenizerPlayground() {
  const t = useTranslations("courses.widgets.tokenizer-playground");
  const tc = useTranslations("courses.widgets.common");
  const locale = useLocale();
  const defaultText = widgetCorpus("tokenizer-playground", locale);
  const [text, setText] = useState(defaultText);

  const columns = useMemo<Column[]>(
    () => [
      { title: t("words.title"), tokens: tokenizeWords(text), hint: t("words.hint") },
      { title: t("chars.title"), tokens: tokenizeChars(text), hint: t("chars.hint") },
      { title: t("subwords.title"), tokens: tokenizeSubwords(text), hint: t("subwords.hint") },
    ],
    [text, t],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "100%" }}>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
        <textarea
          aria-label={t("inputAria")}
          value={text}
          rows={1}
          onChange={(e) => setText(e.target.value)}
          style={{
            flex: 1,
            resize: "vertical",
            padding: "0.5rem 0.6rem",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border-variant)",
            background: "var(--surface-lowest)",
            color: "var(--text)",
            fontSize: "0.9rem",
            lineHeight: 1.4,
          }}
        />
        <WidgetButton onClick={() => setText(defaultText)}>{tc("reset")}</WidgetButton>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "1.25rem" }}>
        {columns.map((c) => (
          <TokenColumn key={c.title} {...c} />
        ))}
      </div>
    </div>
  );
}

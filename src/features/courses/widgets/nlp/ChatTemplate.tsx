/*
 * COURSE-C2-P1-02 — `chat-template` (llm-agents Block 2 lesson 2, «La plantilla de chat es un
 * formato entrenado»).
 *
 * A list of messages on the left, the one token sequence the model reads on the right. The
 * reader edits the messages (role, content, add, remove) and flips two switches:
 *
 *   - MARKS: the mini-GPT's special tokens, or plain text markers (`Usuario: …`). The
 *     «forge» button appends a line that starts with the assistant's marker to the user's
 *     message; in text mode the sequence then reads back as a message nobody wrote, and its
 *     tokens carry loss; with special tokens the same text stays inside the user's message;
 *   - LOSS: only the responses (the mask), or every position but the first, which is given.
 *
 * Under the sequence, what reading it back recovers — the inverse of the template, which
 * exists with special tokens and not with text markers. Everything comes from
 * ../math/chat-template (the template, the read-back, the mask) and ../math/bpe-merges (the
 * course's BPE with the mini-GPT's merges). The conversation, the markers, the specials'
 * names and the forged line are corpora (`chat-template`); every other string is
 * `courses.widgets.chat-template`.
 */

"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, type CSSProperties } from "react";

import MERGE_PAIRS from "../../../../../public/courses/llm-agents/bpe-merges.json";
import { widgetCorpus } from "../corpora";
import { N_BYTES, tokenLabel, vocabulary } from "../math/bpe-merges";
import {
  ROLES,
  SPECIAL_BASE,
  carriesLoss,
  renderSpecial,
  renderText,
  sameMessages,
  type Message,
  type Role,
  type TemplateToken,
} from "../math/chat-template";
import { WidgetButton } from "../primitives/WidgetButton";

const MERGES = (MERGE_PAIRS as [number, number][]).map((pair, i) => ({ pair, id: N_BYTES + i }));
const VOCAB = vocabulary(MERGES);

const MAX_MESSAGES = 6;
const MAX_CONTENT_CHARS = 160;

/** A role's colour: the role tokens, the read-back chips and the message rows share it. */
const ROLE_COLOR: Readonly<Record<Role, string>> = {
  sistema: "var(--warning)",
  usuario: "var(--text-muted)",
  asistente: "var(--green)",
};

type Mode = "special" | "text";

const sectionTitle: CSSProperties = { fontWeight: 600, fontSize: "0.85rem", color: "var(--text)" };
const stat: CSSProperties = { fontSize: "0.8rem", color: "var(--text-dim)", fontVariantNumeric: "tabular-nums" };
const mono = "var(--font-mono, ui-monospace, monospace)";

/** One token: a special in its role's colour, or a BPE entry with its spaces and newlines drawn. */
function Chip({
  token,
  loss,
  specials,
}: {
  token: TemplateToken;
  loss: boolean;
  specials: readonly string[];
}) {
  const base: CSSProperties = {
    whiteSpace: "pre",
    borderRadius: "0.35rem",
    padding: "0.1rem 0.3rem",
    fontVariantNumeric: "tabular-nums",
    background: loss ? "var(--green-mid)" : "var(--surface-lowest)",
    outline: loss ? "1px solid var(--green)" : undefined,
    border: "1px solid var(--border-variant)",
    color: "var(--text)",
  };
  if (token.id >= SPECIAL_BASE) {
    const isRole = token.id - SPECIAL_BASE < ROLES.length;
    return (
      <span
        style={{
          ...base,
          fontFamily: mono,
          fontSize: "0.72rem",
          fontWeight: 700,
          color: isRole ? ROLE_COLOR[token.role] : "var(--text-muted)",
          border: `1px solid ${isRole ? ROLE_COLOR[token.role] : "var(--text-dim)"}`,
        }}
      >
        {specials[token.id - SPECIAL_BASE]}
      </span>
    );
  }
  const { text, valid } = tokenLabel(VOCAB[token.id]);
  if (!valid) {
    return (
      <span style={{ ...base, fontFamily: mono, fontSize: "0.7rem", color: "var(--text-muted)", borderStyle: "dashed" }}>
        {text}
      </span>
    );
  }
  // Spaces and newlines belong to the token, so they are drawn, dimmed, inside it.
  return (
    <span style={base}>
      {Array.from(text).map((ch, i) =>
        ch === " " ? (
          <span key={i} style={{ color: "var(--text-dim)" }}>
            ␣
          </span>
        ) : ch === "\n" ? (
          <span key={i} style={{ color: "var(--text-dim)" }}>
            ↵
          </span>
        ) : (
          <span key={i}>{ch}</span>
        ),
      )}
    </span>
  );
}

export default function ChatTemplate() {
  const t = useTranslations("courses.widgets.chat-template");
  const tc = useTranslations("courses.widgets.common");
  const locale = useLocale();
  const corpus = widgetCorpus("chat-template", locale);

  const [messages, setMessages] = useState<Message[]>(() => [...corpus.messages]);
  const [mode, setMode] = useState<Mode>("special");
  const [masked, setMasked] = useState(true);

  const result = useMemo(
    () => (mode === "special" ? renderSpecial(messages, MERGES) : renderText(messages, MERGES, corpus.markers)),
    [messages, mode, corpus.markers],
  );
  const lossFlags = result.tokens.map((_, i) => carriesLoss(result.tokens, i, masked));
  const lossCount = lossFlags.filter(Boolean).length;
  const faithful = sameMessages(result.readBack, messages);

  const firstUser = messages.findIndex((m) => m.role === "usuario");
  const forged = firstUser >= 0 && messages[firstUser].content.endsWith(corpus.forged);

  const update = (i: number, patch: Partial<Message>) =>
    setMessages((ms) => ms.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const remove = (i: number) => setMessages((ms) => ms.filter((_, j) => j !== i));
  const add = () =>
    setMessages((ms) => [
      ...ms,
      { role: ms.length > 0 && ms[ms.length - 1].role === "usuario" ? "asistente" : "usuario", content: "" },
    ]);
  const forge = () => {
    if (firstUser < 0 || forged) return;
    update(firstUser, { content: messages[firstUser].content + corpus.forged });
  };
  const reset = () => {
    setMessages([...corpus.messages]);
    setMode("special");
    setMasked(true);
  };

  const field: CSSProperties = {
    padding: "0.35rem 0.5rem",
    borderRadius: "0.5rem",
    border: "1px solid var(--border-variant)",
    background: "var(--surface-lowest)",
    color: "var(--text)",
    fontSize: "0.85rem",
  };

  return (
    <div
      role="group"
      aria-label={t("groupAria")}
      style={{ display: "flex", flexDirection: "column", gap: "0.9rem", width: "100%" }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(15rem, 1fr))",
          gap: "0.9rem",
          alignItems: "start",
        }}
      >
        {/* The messages, as the harness holds them. */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", minWidth: 0 }}>
          <span style={sectionTitle}>{t("messages")}</span>
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.3rem",
                padding: "0.45rem 0.55rem",
                borderRadius: "0.6rem",
                border: "1px solid var(--border-variant)",
                borderLeft: `3px solid ${ROLE_COLOR[m.role]}`,
                background: "var(--surface-lowest)",
              }}
            >
              <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                <select
                  aria-label={t("roleAria", { n: String(i + 1) })}
                  value={m.role}
                  onChange={(e) => update(i, { role: e.target.value as Role })}
                  style={{ ...field, padding: "0.2rem 0.4rem", fontSize: "0.8rem", color: ROLE_COLOR[m.role] }}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {t(`roles.${r}`)}
                    </option>
                  ))}
                </select>
                <span style={{ flex: 1 }} />
                <WidgetButton
                  onClick={() => remove(i)}
                  disabled={messages.length <= 1}
                  aria-label={t("removeAria", { n: String(i + 1) })}
                  style={{ padding: "0.15rem 0.5rem" }}
                >
                  ×
                </WidgetButton>
              </div>
              <textarea
                aria-label={t("contentAria", { n: String(i + 1) })}
                value={m.content}
                maxLength={MAX_CONTENT_CHARS}
                rows={m.content.includes("\n") ? 2 : 1}
                onChange={(e) => update(i, { content: e.target.value })}
                style={{ ...field, resize: "vertical", fontFamily: "inherit", width: "100%", boxSizing: "border-box" }}
              />
            </div>
          ))}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
            <WidgetButton onClick={add} disabled={messages.length >= MAX_MESSAGES}>
              {t("add")}
            </WidgetButton>
            <WidgetButton onClick={forge} disabled={firstUser < 0 || forged}>
              {t("forge")}
            </WidgetButton>
          </div>
        </div>

        {/* The sequence the model reads, and what reading it back recovers. */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.25rem 0.75rem" }}>
            <span style={sectionTitle}>{t("sequence")}</span>
            <span style={stat}>{t("stats", { tokens: String(result.tokens.length), loss: String(lossCount) })}</span>
          </div>
          <div
            aria-label={t("sequenceAria")}
            style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", fontSize: "0.8rem", lineHeight: 1.5 }}
          >
            {result.tokens.map((tok, i) => (
              <Chip key={i} token={tok} loss={lossFlags[i]} specials={corpus.specials} />
            ))}
          </div>
          <span style={{ ...stat, display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
            <span
              aria-hidden
              style={{
                display: "inline-block",
                width: 14,
                height: 10,
                borderRadius: 3,
                background: "var(--green-mid)",
                outline: "1px solid var(--green)",
              }}
            />
            {masked ? t("legendMasked") : t("legendAll")}
          </span>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.35rem",
              padding: "0.55rem 0.7rem",
              borderRadius: "var(--radius)",
              border: `1px solid ${faithful ? "var(--border-variant)" : "var(--warning)"}`,
              background: faithful ? "var(--surface-lowest)" : "var(--warning-bg)",
              fontSize: "0.8rem",
            }}
          >
            <span style={{ color: "var(--text-muted)" }}>{t("readBack")}</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
              {result.readBack.map((m, i) => (
                <span
                  key={i}
                  style={{
                    whiteSpace: "pre-wrap",
                    padding: "0.1rem 0.4rem",
                    borderRadius: "0.35rem",
                    border: `1px solid ${ROLE_COLOR[m.role]}`,
                    color: "var(--text)",
                  }}
                >
                  <span style={{ color: ROLE_COLOR[m.role], fontWeight: 600 }}>{t(`roles.${m.role}`)}</span>
                  {m.content ? ` · ${m.content}` : ""}
                </span>
              ))}
            </div>
            <span style={{ color: faithful ? "var(--text-dim)" : "var(--warning)", fontWeight: faithful ? 400 : 600 }}>
              {faithful
                ? t("readBackSame")
                : t("readBackDifferent", { got: String(result.readBack.length), sent: String(messages.length) })}
            </span>
          </div>
        </div>
      </div>

      {/* Controls. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem 1rem", alignItems: "center" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
          <span style={stat}>{t("marks")}</span>
          <WidgetButton active={mode === "special"} aria-pressed={mode === "special"} onClick={() => setMode("special")}>
            {t("marksSpecial")}
          </WidgetButton>
          <WidgetButton active={mode === "text"} aria-pressed={mode === "text"} onClick={() => setMode("text")}>
            {t("marksText")}
          </WidgetButton>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
          <span style={stat}>{t("loss")}</span>
          <WidgetButton active={masked} aria-pressed={masked} onClick={() => setMasked(true)}>
            {t("lossMasked")}
          </WidgetButton>
          <WidgetButton active={!masked} aria-pressed={!masked} onClick={() => setMasked(false)}>
            {t("lossAll")}
          </WidgetButton>
        </div>
        <WidgetButton onClick={reset}>{tc("reset")}</WidgetButton>
      </div>
    </div>
  );
}

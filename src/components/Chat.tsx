"use client";

/**
 * UX-04: Chat message persistence via sessionStorage.
 *
 * Previously the chat reset to the greeting on every page load. A returning
 * user asking a follow-up had to scroll and re-read context they already knew.
 *
 * Fix: on mount, hydrate messages from sessionStorage (if any). On every
 * message change, persist the last 20 messages back to sessionStorage.
 * sessionStorage — not localStorage — is intentional: each browser tab gets
 * its own conversation, conversations don't persist across browser restarts,
 * and there is no cross-tab state pollution.
 *
 * The initial greeting messages are always shown (they are prepended to any
 * hydrated messages), but the first greeting is skipped when hydrated history
 * is present so the UI doesn't look like a fresh chat when it isn't.
 *
 * All Week 4 fixes are carried forward:
 *   - QUAL-01: Components typed via react-markdown's Components interface
 *
 * CHAT-GLOBAL-01: mounted once by `ChatProvider` (root layout), which also owns the open state
 * (`useChat()`), so the Navbar icon and the Footer link open this same panel. There is no
 * floating button: it sat on the reading column of lessons and posts between 1024 and ~1270px,
 * so the Navbar icon is the entry point at every width and the panel drops from under it. The
 * mobile hero-overlap tracking (the FAB hid itself while it sat on the hero CTAs) went with it.
 *
 * CHAT-DRAWER-01: the panel is a full-height side panel under the Navbar (full screen on a
 * phone), 440px wide, so there is no «expand» mode any more: the 340×530 dropdown squeezed
 * every list answer, and the 800×700 expanded one covered the page. It is a NON-modal dialog:
 * the page beside it stays usable. Closed, it is `inert` (and `visibility: hidden` once it has
 * slid out), so its input is no longer a hidden tab stop. Escape and ✕ close it and hand focus
 * back to whatever opened it. «Nueva conversación» drops the thread and the server session id.
 *
 * CHAT-AGENT-P1-04: each message sends the visitor's `timezone` (only a SUPPORTED_TIMEZONES value,
 * else none and the tools use the tutor's), and a bot message keeps the `actions` its reply
 * returned, with the timezone the tools used, persisted with it. A `slots` action renders as
 * chips that send the pick as the next message; a `proposal` as a confirmation card whose
 * Confirmar is the one booking write (`api.book.post`). Only the LATEST proposal in the thread
 * is live, and a booked one stays booked across reloads (`booking` on its message).
 *
 * CHAT-AGENT-P2-01: a microphone button left of «send» dictates into the input through the
 * browser's speech engine (`useDictation`). Only rendered where the API exists (not Firefox).
 * The interim transcript shows greyed in the input; the final one is appended to what was
 * there, and the user edits and sends it as usual (no auto-send: dates and times get misheard).
 * Dictation is dropped when the panel closes, on «Nueva conversación», on send and on unmount.
 * `voiceTurnRef` marks a message that was dictated, for P2-02's read-aloud and its metrics.
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  Fragment,
  type KeyboardEvent,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import ChatAvatarIcon from "@/components/icons/ChatAvatarIcon";
import { useChat } from "@/hooks/useChat";
import type { ChatAction } from "@/infrastructure/anthropic/IChatModelClient";
import SlotChips from "@/components/chat/SlotChips";
import FreeCallProposalCard, { type ProposalOutcome } from "@/components/chat/FreeCallProposalCard";
import { browserTimezone, chatRequestTimezone } from "@/components/chat/slot-format";
import { useDictation } from "@/hooks/useDictation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "bot";
  text: string;
  /** CHAT-AGENT-P1-04: what the reply offered (chips, a proposal card). */
  actions?:  ChatAction[];
  /** The timezone the tools used for `actions`. */
  timezone?: string;
  /** Set when this message's proposal card booked the call. */
  booking?:  ProposalOutcome;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INITIAL_MESSAGES_COUNT = 2; // number of initial bot greeting messages

const SESSION_STORAGE_KEY = "chat:messages";
const LOCAL_STORAGE_KEY   = "chat:sessionId";
const MAX_PERSISTED       = 20; // cap to avoid bloating sessionStorage

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadFromSession(): Message[] | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Message[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveToSession(messages: Message[]): void {
  try {
    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify(messages.slice(-MAX_PERSISTED))
    );
  } catch {
    // sessionStorage quota exceeded or unavailable — fail silently
  }
}

// ─── Markdown components (QUAL-01: typed, no `any`) ───────────────────────────

const MarkdownComponents: Components = {
  ul: ({ ...props }) => <ul style={{ margin: "8px 0", paddingLeft: "24px", listStyleType: "disc" }} {...props} />,
  ol: ({ ...props }) => <ol style={{ margin: "8px 0", paddingLeft: "24px", listStyleType: "decimal" }} {...props} />,
  li: ({ ...props }) => <li style={{ margin: "4px 0", lineHeight: "1.5" }} {...props} />,
  h1: ({ ...props }) => <h1 style={{ margin: "12px 0 6px 0", fontSize: "18px", fontWeight: 600, color: "var(--text)" }} {...props} />,
  h2: ({ ...props }) => <h2 style={{ margin: "12px 0 6px 0", fontSize: "16px", fontWeight: 600, color: "var(--text)" }} {...props} />,
  h3: ({ ...props }) => <h3 style={{ margin: "12px 0 6px 0", fontSize: "14px", fontWeight: 600, color: "var(--text)" }} {...props} />,
  p:  ({ ...props }) => <p  style={{ margin: "0 0 8px 0", lineHeight: "1.5" }} {...props} />,
  strong: ({ ...props }) => <strong style={{ color: "var(--text)", fontWeight: 500 }} {...props} />,
  code: ({ className, children, ...props }) => {
    const isBlock = Boolean(className);
    if (!isBlock) {
      return <code style={{ background: "rgba(255,255,255,0.06)", padding: "2px 4px", borderRadius: "4px", fontFamily: "monospace", fontSize: "12px" }} {...props}>{children}</code>;
    }
    return (
      <pre style={{ background: "rgba(255,255,255,0.06)", padding: "8px 12px", borderRadius: "8px", overflowX: "auto", margin: "8px 0" }}>
        <code className={className} style={{ background: "none", padding: 0 }} {...props}>{children}</code>
      </pre>
    );
  },
  a:          ({ ...props }) => <a style={{ color: "var(--green)", textDecoration: "none" }} target="_blank" rel="noopener noreferrer" {...props} />,
  blockquote: ({ ...props }) => <blockquote style={{ borderLeft: "2px solid var(--green)", paddingLeft: "12px", margin: "8px 0", color: "var(--text-dim)" }} {...props} />,
};

function BotMessage({ text }: { text: string }) {
  return (
    <div className="chat-bot-message">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Chat() {
  const t = useTranslations("chat");
  const locale = useLocale();
  const suggestions = useMemo(() => t.raw("suggestions") as string[], [t]);
  const initialMessages = useMemo<Message[]>(() => [
    { role: "bot", text: t("initialMessage") },
    { role: "bot", text: t("initialQuestion") },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  // UX-04: Hydrate from sessionStorage on first render; fall back to greeting.
  const [messages,        setMessages]        = useState<Message[]>(() => {
    const saved = loadFromSession();
    return saved ?? initialMessages;
  });
  // REFACTOR-P2-03: Server-side session ID for chat history continuity.
  // localStorage keeps the session alive across page reloads.
  const [sessionId,       setSessionId]       = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem(LOCAL_STORAGE_KEY) : null
  );
  const { isOpen, close } = useChat();
  const [input,           setInput]           = useState("");
  const [isLoading,       setIsLoading]       = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  // CHAT-AGENT-P1-04: render-time "now" for the chips' past-slot filter (the card re-checks on tap).
  const [mountedAt]                           = useState(() => Date.now());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  // CHAT-DRAWER-01: the element that had focus when the panel opened (a Navbar button, the
  // Footer link, a landing CTA): closing from inside the panel hands focus back to it.
  const openerRef      = useRef<HTMLElement | null>(null);
  // CHAT-AGENT-P2-01: true once a dictated transcript lands in the input, until it is sent or
  // the conversation is reset. P2-02 reads it to answer aloud and count voice turns.
  const voiceTurnRef   = useRef(false);

  const appendTranscript = useCallback((text: string) => {
    voiceTurnRef.current = true;
    setInput((prev) => (prev.trim() ? `${prev.trimEnd()} ${text}` : text).slice(0, 1000));
    inputRef.current?.focus();
  }, []);
  const dictation = useDictation({ locale, onFinal: appendTranscript });
  const { cancel: cancelDictation } = dictation;

  // UX-04: Persist messages to sessionStorage whenever they change.
  // We skip the initial INITIAL_MESSAGES-only state to avoid a no-op write
  // on first load, but we persist everything once the user has sent a message.
  useEffect(() => {
    if (messages.length > INITIAL_MESSAGES_COUNT) {
      saveToSession(messages);
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // CHAT-AGENT-P2-01: closing the panel (from inside or from the Navbar) stops listening.
  useEffect(() => {
    if (!isOpen) cancelDictation();
  }, [isOpen, cancelDictation]);

  useEffect(() => {
    if (!isOpen) return;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setTimeout(() => inputRef.current?.focus(), 220);
  }, [isOpen]);

  // Focus goes back BEFORE the panel turns inert: inert would drop it on <body>. A close from
  // the Navbar button needs none of this, focus is already on it. Safari doesn't focus a
  // clicked button, so the opener can be <body>, and a client navigation since may have
  // unmounted it: then the visible Navbar button that controls this panel takes focus instead.
  function closeFromPanel() {
    const saved = openerRef.current;
    const opener = saved && saved !== document.body && saved.isConnected
      ? saved
      : Array.from(document.querySelectorAll<HTMLElement>('[aria-controls="chat-panel"]'))
          .find((el) => el.getClientRects().length > 0);
    opener?.focus();
    close();
  }

  function startNewConversation() {
    cancelDictation();
    dictation.clearError();
    voiceTurnRef.current = false;
    setMessages(initialMessages);
    setShowSuggestions(true);
    setInput("");
    setSessionId(null);
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch {
      // storage unavailable — the in-memory reset above is what the reader sees
    }
    inputRef.current?.focus();
  }

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    cancelDictation();
    voiceTurnRef.current = false;
    setShowSuggestions(false);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setIsLoading(true);

    try {
      const res  = await fetch("/api/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message: trimmed, sessionId, timezone: chatRequestTimezone() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("unknownError"));

      // REFACTOR-P2-03: Persist the server-assigned sessionId for future turns.
      if (typeof data.sessionId === "string" && data.sessionId.length === 36) {
        setSessionId(data.sessionId);
        localStorage.setItem(LOCAL_STORAGE_KEY, data.sessionId);
      }

      const actions: ChatAction[] = Array.isArray(data.actions) ? data.actions : [];
      setMessages((prev) => [
        ...prev,
        actions.length > 0
          ? { role: "bot", text: data.reply, actions, timezone: typeof data.timezone === "string" ? data.timezone : undefined }
          : { role: "bot", text: data.reply },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: err instanceof Error ? err.message : t("error") },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, sessionId, cancelDictation]);

  // Only the latest proposal in the thread is live (a scroll-back tap can't book a slot the
  // conversation moved past).
  const latestProposalIndex = messages.reduce(
    (last, m, i) => (m.actions?.some((a) => a.type === "proposal") ? i : last),
    -1,
  );

  function markBooked(index: number, outcome: ProposalOutcome) {
    setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, booking: outcome } : m)));
  }

  function renderActions(msg: Message, index: number) {
    const timezone = msg.timezone ?? browserTimezone() ?? "Europe/Madrid";
    return msg.actions?.map((action, j) => {
      if (action.type === "slots" && Array.isArray(action.slots)) {
        return (
          <SlotChips
            key={j} slots={action.slots} timezone={timezone} nowMs={mountedAt}
            disabled={isLoading} onPick={sendMessage}
          />
        );
      }
      if (action.type === "proposal") {
        return (
          <FreeCallProposalCard
            key={j} startIso={action.startIso} endIso={action.endIso} timezone={timezone}
            live={index === latestProposalIndex} booked={msg.booking ?? null} chatBusy={isLoading}
            onBooked={(outcome) => markBooked(index, outcome)} onFindAnother={sendMessage}
          />
        );
      }
      return null;
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  }

  function toggleDictation() {
    if (dictation.listening) dictation.stop();
    else dictation.start();
  }

  const voiceHint =
    dictation.error === "not-allowed" ? t("voice.denied")
    : dictation.error === "no-speech" ? t("voice.noSpeech")
    : dictation.error === "unsupported" ? t("voice.unsupported")
    : null;
  const showInterim = dictation.listening && dictation.interim !== "";

  return (
    <div
      id="chat-panel"
      className={`chat-panel${isOpen ? " chat-panel--open" : ""}`}
      role="dialog" aria-label={t("assistantLabel")}
      inert={!isOpen}
      onKeyDown={(e) => { if (e.key === "Escape") closeFromPanel(); }}
    >
      <div className="chat-header">
        <div className="chat-header-avatar" aria-hidden="true"><ChatAvatarIcon size={22} /></div>
        <div className="chat-header-info">
          <div className="chat-header-name">{t("title")}</div>
          <div className="chat-header-status">{t("status")}</div>
        </div>
        <div className="chat-header-actions">
          <button
            className="chat-new-btn" onClick={startNewConversation}
            disabled={isLoading || messages.length <= INITIAL_MESSAGES_COUNT}
            aria-label={t("newConversation")} title={t("newConversation")}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
            </svg>
          </button>
          <button className="chat-close-btn" onClick={closeFromPanel} aria-label={t("close")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <div className="chat-messages" role="log" aria-live="polite">
        {messages.map((msg, i) => (
          <Fragment key={i}>
            <div className={`chat-msg chat-msg--${msg.role}`}>
              {msg.role === "bot" ? <BotMessage text={msg.text} /> : msg.text}
            </div>
            {msg.role === "bot" && msg.actions && msg.actions.length > 0 && (
              <div className="chat-actions">{renderActions(msg, i)}</div>
            )}
          </Fragment>
        ))}
        {isLoading && <div className="chat-typing" aria-label={t("status")}><span /><span /><span /></div>}
        <div ref={messagesEndRef} />
      </div>

      {showSuggestions && (
        <div className="chat-suggestions">
          {suggestions.map((s) => (
            <button key={s} className="chat-suggestion" onClick={() => sendMessage(s)} disabled={isLoading}>{s}</button>
          ))}
        </div>
      )}

      <div className="chat-composer">
        <div className="chat-input-row">
          <input
            ref={inputRef} className={`chat-input${showInterim ? " chat-input--interim" : ""}`} type="text"
            placeholder={dictation.listening ? t("voice.listening") : t("placeholder")}
            value={showInterim ? (input.trim() ? `${input.trimEnd()} ${dictation.interim}` : dictation.interim) : input}
            onChange={(e) => { setInput(e.target.value); if (dictation.error) dictation.clearError(); }}
            onKeyDown={handleKeyDown}
            readOnly={dictation.listening}
            disabled={isLoading} maxLength={1000} aria-label={t("placeholderShort")}
          />
          {dictation.supported && (
            <button
              type="button"
              className={`chat-mic${dictation.listening ? " chat-mic--listening" : ""}`}
              onClick={toggleDictation} disabled={isLoading}
              aria-pressed={dictation.listening}
              aria-label={dictation.listening ? t("voice.stop") : t("voice.start")}
              title={dictation.listening ? t("voice.stop") : t("voice.start")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v1a7 7 0 0 0 14 0v-1" /><line x1="12" y1="18" x2="12" y2="22" />
              </svg>
            </button>
          )}
          <button className="chat-send" onClick={() => sendMessage(input)} disabled={isLoading || dictation.listening || !input.trim()} aria-label={t("send")}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0d0f10" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        {voiceHint && <p className="chat-voice-hint" role="status">{voiceHint}</p>}
        <p className="chat-disclaimer">{t("disclaimer")}</p>
      </div>
    </div>
  );
}

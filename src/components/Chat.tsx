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
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type KeyboardEvent,
} from "react";
import { useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import ChatAvatarIcon from "@/components/icons/ChatAvatarIcon";
import { useChat } from "@/hooks/useChat";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "bot";
  text: string;
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
  const [isExpanded,      setIsExpanded]      = useState(false);
  const [input,           setInput]           = useState("");
  const [isLoading,       setIsLoading]       = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  // A closed panel always reopens at its normal size, wherever the close came from (the ✕ or
  // the Navbar icon, which this component doesn't see) — adjusted during render.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (!isOpen) setIsExpanded(false);
  }

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 220);
  }, [isOpen]);

  function toggleExpand() { setIsExpanded((prev) => !prev); }

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    setShowSuggestions(false);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setIsLoading(true);

    try {
      const res  = await fetch("/api/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message: trimmed, sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("unknownError"));

      // REFACTOR-P2-03: Persist the server-assigned sessionId for future turns.
      if (typeof data.sessionId === "string" && data.sessionId.length === 36) {
        setSessionId(data.sessionId);
        localStorage.setItem(LOCAL_STORAGE_KEY, data.sessionId);
      }

      setMessages((prev) => [...prev, { role: "bot", text: data.reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: err instanceof Error ? err.message : t("error") },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, sessionId]);

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  }

  return (
    <div
      className={`chat-panel${isOpen ? " chat-panel--open" : ""}${isExpanded ? " chat-panel--expanded" : ""}`}
      role="dialog" aria-modal="true" aria-label={t("assistantLabel")}
    >
      <div className="chat-header">
        <div className="chat-header-avatar" aria-hidden="true"><ChatAvatarIcon size={22} /></div>
        <div className="chat-header-info">
          <div className="chat-header-name">{t("title")}</div>
          <div className="chat-header-status">{t("status")}</div>
        </div>
        <div className="chat-header-actions">
          <button className="chat-expand-btn" onClick={toggleExpand} aria-label={isExpanded ? t("minimize") : t("expand")} title={isExpanded ? t("minimize") : t("expand")}>
            {isExpanded
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" /></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
            }
          </button>
          <button className="chat-close-btn" onClick={close} aria-label={t("close")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <div className="chat-messages" role="log" aria-live="polite">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-msg chat-msg--${msg.role}`}>
            {msg.role === "bot" ? <BotMessage text={msg.text} /> : msg.text}
          </div>
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

      <div className="chat-input-row">
        <input
          ref={inputRef} className="chat-input" type="text" placeholder={t("placeholder")}
          value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
          disabled={isLoading} maxLength={1000} aria-label={t("placeholderShort")}
        />
        <button className="chat-send" onClick={() => sendMessage(input)} disabled={isLoading || !input.trim()} aria-label={t("send")}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0d0f10" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

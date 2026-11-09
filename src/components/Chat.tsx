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
 *
 * CHAT-AGENT-P2-02: a dictated message is sent with `voice: true` (the route asks the model for
 * a short reply without markdown, links or lists) and its reply is read aloud (`useReadAloud`,
 * through `toSpeakableText`); a typed one is not. With read-aloud off, a dictated message goes
 * without `voice` (the reply is read on screen, so it keeps its links). The header's speaker toggle turns read-aloud
 * off, persisted in localStorage. Speech is cancelled on a new message, when dictation starts,
 * on typing, on close, on «Nueva conversación» and on unmount; a reply that lands after the
 * panel closed isn't spoken. iOS only speaks after a gesture, so the send handler primes the
 * engine. A user message keeps `voice` (persisted), so a booking from the card counts as a
 * voice booking in the adoption events (`chat-analytics.ts`), even after a reload.
 *
 * CHAT-AGENT-P2-01b: dictation is continuous (it listens through pauses until the user taps
 * stop), and the whole text heard so far shows greyed in the input. While listening the mic
 * turns into a stop square and a hint says to tap it when done. On a touch device
 * (`useCoarsePointer`) the user's stop SENDS the message (input + transcript, as a voice turn);
 * on a desktop it lands in the input to review, as before. A dictation the browser ended by
 * itself (a long silence) never sends. The stop tap primes the speech engine, since the send
 * comes a moment later, from the engine's `end` event, outside the gesture iOS needs.
 * The composer is a one-row textarea that grows with its text up to ~5 lines (`.chat-input`
 * max-height), then scrolls, so a long explanation, typed or dictated, can be read back before
 * sending. Enter sends, Shift+Enter is a new line; on a touch device Enter is a new line too
 * (the on-screen keyboard has no Shift+Enter) and only «send» sends. A user message keeps its
 * line breaks.
 *
 * CHAT-AGENT-P3-02: a signed-in visitor can compare a row of slot chips with their own Google
 * Calendar (`SlotChips`, «Comparar con mi calendario»). The free/busy token is held here, in a
 * ref (memory only, never persisted, never sent to /api/chat), for the whole conversation, and
 * dropped on «Nueva conversación» and on unmount. The busy times stay inside the chips.
 */

import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
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
import { useCoarsePointer } from "@/hooks/useCoarsePointer";
import { useReadAloud } from "@/hooks/useReadAloud";
import { toSpeakableText } from "@/lib/chat-speech";
import { trackChatMessage, trackVoiceBooking, trackVoiceUnsupported } from "@/lib/chat-analytics";
import type { FreeBusyToken } from "@/lib/google-calendar-freebusy";

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
  /** CHAT-AGENT-P2-02: a user message that was dictated. */
  voice?:    true;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INITIAL_MESSAGES_COUNT = 2; // number of initial bot greeting messages

const SESSION_STORAGE_KEY = "chat:messages";
const LOCAL_STORAGE_KEY   = "chat:sessionId";
const MAX_PERSISTED       = 20; // cap to avoid bloating sessionStorage
const READ_ALOUD_KEY      = "chat:readAloud"; // CHAT-AGENT-P2-02: "off" when the user turned it off

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

function loadReadAloud(): boolean {
  try {
    return localStorage.getItem(READ_ALOUD_KEY) !== "off";
  } catch {
    return true;
  }
}

function saveReadAloud(on: boolean): void {
  try {
    if (on) localStorage.removeItem(READ_ALOUD_KEY);
    else localStorage.setItem(READ_ALOUD_KEY, "off");
  } catch {
    // storage unavailable: the choice lasts until the page reloads
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
  const inputRef       = useRef<HTMLTextAreaElement>(null);
  // CHAT-DRAWER-01: the element that had focus when the panel opened (a Navbar button, the
  // Footer link, a landing CTA): closing from inside the panel hands focus back to it.
  const openerRef      = useRef<HTMLElement | null>(null);
  // CHAT-AGENT-P2-01: true once a dictated transcript lands in the input, until it is sent or
  // the conversation is reset. P2-02 reads it to answer aloud and count voice turns.
  const voiceTurnRef   = useRef(false);
  // CHAT-AGENT-P3-02: the conversation's Google free/busy token (≤ 1 h), memory only, so a
  // second «Comparar con mi calendario» opens no popup. Dropped on «Nueva conversación».
  const calendarTokenRef = useRef<FreeBusyToken | null>(null);

  // CHAT-AGENT-P2-01b: the latest input value and sendMessage, for a send from the engine's `end`.
  const inputValueRef  = useRef("");
  const sendMessageRef = useRef<(text: string, opts?: { dictated?: boolean }) => void>(() => {});
  const touch          = useCoarsePointer();
  const touchRef       = useRef(touch);
  useEffect(() => { inputValueRef.current = input; }, [input]);
  useEffect(() => { touchRef.current = touch; }, [touch]);

  const appendTranscript = useCallback((text: string, { byUser }: { byUser: boolean }) => {
    voiceTurnRef.current = true;
    const prev = inputValueRef.current;
    const next = (prev.trim() ? `${prev.trimEnd()} ${text}` : text).slice(0, 1000);
    // CHAT-AGENT-P2-01b: on a phone, the stop tap means «send it».
    if (byUser && touchRef.current) { sendMessageRef.current(next, { dictated: true }); return; }
    setInput(next);
    inputRef.current?.focus();
  }, []);
  const dictation = useDictation({ locale, onFinal: appendTranscript });
  const { cancel: cancelDictation } = dictation;

  // CHAT-AGENT-P2-02: read-aloud of the replies to dictated turns.
  const speech = useReadAloud(locale);
  const { cancel: cancelSpeech } = speech;
  const [readAloud, setReadAloud] = useState(loadReadAloud);
  // Read when the reply lands, not when it was asked: a toggle-off or a close meanwhile wins.
  const readAloudRef = useRef(readAloud);
  const isOpenRef    = useRef(isOpen);
  useEffect(() => { readAloudRef.current = readAloud; }, [readAloud]);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

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
  // CHAT-AGENT-P2-02: and reading.
  useEffect(() => {
    if (!isOpen) { cancelDictation(); cancelSpeech(); }
  }, [isOpen, cancelDictation, cancelSpeech]);

  // CHAT-AGENT-P2-01b: the textarea grows with its text (CSS max-height caps it, then it
  // scrolls), and while dictating its end stays in view.
  const shownInput = dictation.listening && dictation.interim !== ""
    ? (input.trim() ? `${input.trimEnd()} ${dictation.interim}` : dictation.interim)
    : input;
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    // Measured with overflow hidden: a scrollbar showing at the collapsed height narrows the
    // box and adds a wrapped line to the measurement.
    el.style.overflowY = "hidden";
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
    el.style.overflowY = "";
    if (dictation.listening) el.scrollTop = el.scrollHeight;
  }, [shownInput, dictation.listening]);

  // CHAT-AGENT-P2-02: the chat opened where the mic can't be offered (a P2-03 revisit metric).
  useEffect(() => {
    if (isOpen && !dictation.supported) trackVoiceUnsupported();
  }, [isOpen, dictation.supported]);

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
    cancelSpeech();
    dictation.clearError();
    voiceTurnRef.current = false;
    calendarTokenRef.current = null;
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

  const sendMessage = useCallback(async (text: string, opts?: { dictated?: boolean }) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    cancelDictation();
    // CHAT-AGENT-P2-02: a chip or suggestion tap after dictating something is not a voice turn.
    const voice = opts?.dictated ?? (voiceTurnRef.current && text === inputRef.current?.value);
    voiceTurnRef.current = false;
    // Toggle off → the reply is read, not heard: keep the normal one (links included).
    const spoken = voice && readAloudRef.current;
    // Still inside the tap / Enter: iOS lets the reply be spoken later only if this speaks now.
    if (spoken) speech.prime();
    else cancelSpeech();
    trackChatMessage(voice);
    setShowSuggestions(false);
    setInput("");
    setMessages((prev) => [...prev, voice ? { role: "user", text: trimmed, voice: true } : { role: "user", text: trimmed }]);
    setIsLoading(true);
    const speakReply = (reply: string) => {
      if (spoken && readAloudRef.current && isOpenRef.current) speech.speak(toSpeakableText(reply));
    };

    try {
      const res  = await fetch("/api/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          message: trimmed, sessionId, timezone: chatRequestTimezone(),
          ...(spoken ? { voice: true } : {}), // CHAT-AGENT-P2-02
        }),
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
      speakReply(data.reply);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("error");
      setMessages((prev) => [...prev, { role: "bot", text: message }]);
      speakReply(message);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, sessionId, cancelDictation, cancelSpeech, speech]);
  useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);

  // Only the latest proposal in the thread is live (a scroll-back tap can't book a slot the
  // conversation moved past).
  const latestProposalIndex = messages.reduce(
    (last, m, i) => (m.actions?.some((a) => a.type === "proposal") ? i : last),
    -1,
  );

  function markBooked(index: number, outcome: ProposalOutcome) {
    if (messages.some((m) => m.role === "user" && m.voice)) trackVoiceBooking(); // CHAT-AGENT-P2-02
    setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, booking: outcome } : m)));
  }

  function renderActions(msg: Message, index: number) {
    const timezone = msg.timezone ?? browserTimezone() ?? "Europe/Madrid";
    return msg.actions?.map((action, j) => {
      if (action.type === "slots" && Array.isArray(action.slots)) {
        return (
          <SlotChips
            key={j} slots={action.slots} timezone={timezone} nowMs={mountedAt}
            disabled={isLoading} onPick={sendMessage} calendarTokenRef={calendarTokenRef}
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

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (touch) return; // CHAT-AGENT-P2-01b: on a phone Enter is a new line; «send» sends
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  }

  function toggleDictation() {
    if (dictation.listening) {
      // CHAT-AGENT-P2-01b: this tap is the gesture the send that follows on a phone speaks from.
      if (touch && readAloud) speech.prime();
      dictation.stop();
    } else { cancelSpeech(); dictation.start(); }
  }

  function toggleReadAloud() {
    const next = !readAloud;
    if (!next) cancelSpeech();
    setReadAloud(next);
    saveReadAloud(next);
  }

  const voiceHint =
    dictation.error === "not-allowed" ? t("voice.denied")
    : dictation.error === "no-speech" ? t("voice.noSpeech")
    : dictation.error === "unsupported" ? t("voice.unsupported")
    : null;
  const showInterim = dictation.listening && dictation.interim !== "";
  const stopLabel   = touch ? t("voice.stopAndSend") : t("voice.stop"); // CHAT-AGENT-P2-01b

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
          {dictation.supported && speech.supported && (
            <button
              type="button" className="chat-new-btn chat-read-aloud-btn" onClick={toggleReadAloud}
              aria-label={readAloud ? t("voice.readAloudOn") : t("voice.readAloudOff")}
              title={readAloud ? t("voice.readAloudOn") : t("voice.readAloudOff")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                {readAloud
                  ? <><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M19 5a10 10 0 0 1 0 14" /></>
                  : <><line x1="22" y1="9" x2="16" y2="15" /><line x1="16" y1="9" x2="22" y2="15" /></>}
              </svg>
            </button>
          )}
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
          <textarea
            ref={inputRef} className={`chat-input${showInterim ? " chat-input--interim" : ""}`} rows={1}
            enterKeyHint={touch ? "enter" : "send"}
            placeholder={dictation.listening ? t("voice.listening") : t("placeholder")}
            value={shownInput}
            onChange={(e) => { setInput(e.target.value); cancelSpeech(); if (dictation.error) dictation.clearError(); }}
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
              aria-label={dictation.listening ? stopLabel : t("voice.start")}
              title={dictation.listening ? stopLabel : t("voice.start")}
            >
              {dictation.listening ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <rect x="5" y="5" width="14" height="14" rx="2.5" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v1a7 7 0 0 0 14 0v-1" /><line x1="12" y1="18" x2="12" y2="22" />
                </svg>
              )}
            </button>
          )}
          <button className="chat-send" onClick={() => sendMessage(input)} disabled={isLoading || dictation.listening || !input.trim()} aria-label={t("send")}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0d0f10" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        {voiceHint && <p className="chat-voice-hint" role="status">{voiceHint}</p>}
        {!voiceHint && dictation.listening && (
          <p className="chat-voice-hint">{touch ? t("voice.listeningHintSend") : t("voice.listeningHintReview")}</p>
        )}
        <p className="chat-disclaimer">{t("disclaimer")}</p>
      </div>
    </div>
  );
}

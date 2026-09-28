/*
 * CONTENT-FEEDBACK-01 — the footer row every lesson and post carries:
 *
 *   ¿Te ha sido útil?  [👍] [👎]        [Compartir]  [Reportar un error]
 *
 * One component for both readers, living in `features/content` like the shared
 * code-copy button, for the same reason: the blog route must never import the
 * course feature tree (bundle guard), and the two surfaces want identical
 * behaviour. It receives strings only (`shareUrl` is computed by the server
 * component via `localeUrl`), fetches NOTHING on mount — both pages ship static —
 * and remembers the reader's own vote in localStorage so the pressed thumb
 * survives a reload without a request.
 *
 * Anonymous readers can do everything here. The only thing a session changes is
 * the report form: a signed-in reporter is not asked for an email.
 *
 * Flow (transitions in `feedback-state.ts`, tested in node):
 *   👍 → POST → "¡Gracias!"
 *   👎 → POST → comment box (optional) → POST again with the comment, or skip
 *   Compartir → native share sheet on touch devices, else copy link ("Enlace copiado")
 *   Reportar → message (+ email when signed out) → POST → "Recibido"
 *
 * Keyboard: Escape closes a panel and returns focus to its trigger; Ctrl/Cmd+Enter
 * submits a textarea; Enter in the email field submits via onKeyDown because the
 * in-app Browser pane sends keydown/keyup only (implicit form submission never
 * fires there), and `preventDefault` keeps real browsers from submitting twice.
 *
 * No bare <p>/<ul> in the markup and every selector in `content-feedback.css` is
 * two classes deep, so the lesson prose rules (`.lesson-content p`) never bleed in.
 */

"use client";

import "./content-feedback.css";

import {
  useEffect,
  useReducer,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { api, ApiError } from "@/lib/api-client";
import { useClientValue } from "@/hooks/useClientValue";
import type { ContentLocale, ContentType, VoteValue } from "@/domain/types";
import { copyToClipboard } from "./clipboard";
import { feedbackReducer, INITIAL_FEEDBACK_STATE, type Notice } from "./feedback-state";
import { getClientId, readVote, safeLocalStorage, writeVote } from "./feedback-storage";

export interface ContentFeedbackProps {
  contentType: ContentType;
  contentKey:  string;
  /** Locale of the PROSE on the page (a fallback lesson read from /en/ is "es"). */
  locale:      ContentLocale;
  /** Absolute canonical URL to share, from `localeUrl` on the server. */
  shareUrl:    string;
  shareTitle:  string;
}

const COMMENT_MAX = 1000;
const REPORT_MIN  = 10;
const REPORT_MAX  = 2000;
const COPIED_MS   = 2000;
const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const failStatus = (err: unknown): number | null => (err instanceof ApiError ? err.status : null);

export function ContentFeedback({ contentType, contentKey, locale, shareUrl, shareTitle }: ContentFeedbackProps) {
  const t = useTranslations("content.feedback");
  const { data: session } = useSession();
  const sessionEmail = session?.user?.email ?? null;

  const [state, dispatch] = useReducer(feedbackReducer, INITIAL_FEEDBACK_STATE);
  const ref = { contentType, contentKey };

  // The vote remembered from a previous load — read after hydration, null on the
  // server, no effect-driven setState (see useClientValue).
  const storedVote = useClientValue(() => readVote(safeLocalStorage(), ref), null);
  const effectiveVote: VoteValue | null = state.vote ?? storedVote;

  const [comment, setComment]       = useState("");
  const [message, setMessage]       = useState("");
  const [email, setEmail]           = useState("");
  const [emailError, setEmailError] = useState(false);

  const downRef          = useRef<HTMLButtonElement>(null);
  const reportTriggerRef = useRef<HTMLButtonElement>(null);
  const textareaRef      = useRef<HTMLTextAreaElement>(null);
  const copiedTimer      = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  // Focus is not state, so moving it in an effect keyed on the open panel is fine.
  useEffect(() => {
    if (state.panel !== "none") textareaRef.current?.focus();
  }, [state.panel]);

  // ── Vote ─────────────────────────────────────────────────────────────────
  async function castVote(vote: VoteValue, withComment?: string) {
    const storage = safeLocalStorage();
    try {
      await api.content.vote({
        contentType,
        contentKey,
        locale,
        clientId: getClientId(storage),
        vote,
        ...(withComment !== undefined ? { comment: withComment } : {}),
      });
      writeVote(storage, ref, vote);
      return true;
    } catch (err) {
      return failStatus(err);
    }
  }

  async function onThumb(vote: VoteValue) {
    if (state.voting) return;
    if (vote === effectiveVote) {
      // Pressing the already-pressed 👎 reopens the comment box (no un-vote).
      if (vote === -1) dispatch({ type: "OPEN_COMMENT" });
      return;
    }
    dispatch({ type: "VOTE_START", vote });
    const result = await castVote(vote);
    if (result === true) dispatch({ type: "VOTE_OK" });
    else dispatch({ type: "VOTE_FAIL", status: result });
  }

  // ── Comment (after 👎) ───────────────────────────────────────────────────
  async function sendComment() {
    const text = comment.trim();
    if (state.comment !== "idle") return;
    if (!text) {
      dispatch({ type: "COMMENT_SKIP" });
      return;
    }
    dispatch({ type: "COMMENT_SEND" });
    const result = await castVote(-1, text);
    if (result === true) dispatch({ type: "COMMENT_OK" });
    else dispatch({ type: "COMMENT_FAIL", status: result });
  }

  function skipComment() {
    dispatch({ type: "COMMENT_SKIP" });
    downRef.current?.focus();
  }

  // ── Report ───────────────────────────────────────────────────────────────
  const messageLength = message.trim().length;
  const messageValid  = messageLength >= REPORT_MIN && messageLength <= REPORT_MAX;

  async function sendReport() {
    if (state.report !== "idle" || !messageValid) return;
    const typedEmail = email.trim();
    if (!sessionEmail && typedEmail && !EMAIL_RE.test(typedEmail)) {
      setEmailError(true);
      return;
    }
    setEmailError(false);
    dispatch({ type: "REPORT_SEND" });
    try {
      await api.content.report({
        contentType,
        contentKey,
        locale,
        message: message.trim(),
        ...(!sessionEmail && typedEmail ? { email: typedEmail } : {}),
      });
      dispatch({ type: "REPORT_OK" });
      reportTriggerRef.current?.focus();
    } catch (err) {
      dispatch({ type: "REPORT_FAIL", status: failStatus(err) });
    }
  }

  function closeReport() {
    dispatch({ type: "CLOSE_PANEL" });
    reportTriggerRef.current?.focus();
  }

  // ── Share ────────────────────────────────────────────────────────────────
  async function share() {
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    // The OS share sheet is what a touch device expects; on a pointer device the
    // link on the clipboard is more useful than a sheet.
    const touch = typeof window.matchMedia === "function" && window.matchMedia("(hover: none)").matches;
    if (touch && typeof nav.share === "function") {
      try {
        await nav.share({ title: shareTitle, url: shareUrl });
        return;
      } catch (err) {
        // Dismissed: nothing to do. Anything else falls through to the clipboard.
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    if (!(await copyToClipboard(shareUrl))) return;
    dispatch({ type: "SHARE_COPIED" });
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => dispatch({ type: "SHARE_RESET" }), COPIED_MS);
  }

  // ── Keyboard / submit ────────────────────────────────────────────────────
  // Plain functions rather than a factory called during render: the React Compiler
  // lint (react-hooks/refs) rejects a render-time call whose arguments read refs.
  function panelKey(e: KeyboardEvent<HTMLElement>, onSubmit: () => void, onClose: () => void) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit();
    }
  }
  function onCommentKey(e: KeyboardEvent<HTMLElement>) {
    panelKey(e, () => void sendComment(), skipComment);
  }
  function onReportKey(e: KeyboardEvent<HTMLElement>) {
    panelKey(e, () => void sendReport(), closeReport);
  }
  function onEmailKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void sendReport();
    }
  }
  function onCommentSubmit(e: FormEvent) {
    e.preventDefault();
    void sendComment();
  }
  function onReportSubmit(e: FormEvent) {
    e.preventDefault();
    void sendReport();
  }

  const noticeText = noticeCopy(t, state.notice);
  const noticeTone = state.notice === "error" || state.notice === "rateLimited" ? "error" : "ok";
  const copied = state.share === "copied";

  return (
    <section className="content-feedback" aria-label={t("regionLabel")}>
      <div className="content-feedback__row">
        <div className="content-feedback__vote">
          <span className="content-feedback__question">{t("question")}</span>
          <button
            type="button"
            className="content-feedback__thumb"
            aria-pressed={effectiveVote === 1}
            aria-label={t("up")}
            title={t("up")}
            disabled={state.voting}
            onClick={() => void onThumb(1)}
          >
            <span className="material-symbols-outlined" aria-hidden="true">thumb_up</span>
          </button>
          <button
            ref={downRef}
            type="button"
            className="content-feedback__thumb"
            aria-pressed={effectiveVote === -1}
            aria-label={t("down")}
            title={t("down")}
            aria-expanded={state.panel === "comment"}
            disabled={state.voting}
            onClick={() => void onThumb(-1)}
          >
            <span className="material-symbols-outlined" aria-hidden="true">thumb_down</span>
          </button>
        </div>

        <div className="content-feedback__actions">
          <button
            type="button"
            className="content-feedback__action"
            data-copied={copied ? "" : undefined}
            onClick={() => void share()}
          >
            <span className="material-symbols-outlined" aria-hidden="true">{copied ? "check" : "share"}</span>
            <span>{copied ? t("shareCopied") : t("share")}</span>
          </button>
          <button
            ref={reportTriggerRef}
            type="button"
            className="content-feedback__action"
            aria-expanded={state.panel === "report"}
            disabled={state.report === "sent"}
            onClick={() => dispatch({ type: "OPEN_REPORT" })}
          >
            <span className="material-symbols-outlined" aria-hidden="true">flag</span>
            <span>{t("report")}</span>
          </button>
        </div>
      </div>

      <span className="content-feedback__status" role="status" aria-live="polite" data-tone={noticeTone}>
        {noticeText}
      </span>

      {state.panel === "comment" && (
        <form
          className="content-feedback__panel"
          onSubmit={onCommentSubmit}
          onKeyDown={onCommentKey}
        >
          <label className="content-feedback__label" htmlFor="content-feedback-comment">
            {t("commentPrompt")}
          </label>
          <textarea
            ref={textareaRef}
            id="content-feedback-comment"
            className="content-feedback__textarea"
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))}
            maxLength={COMMENT_MAX}
            placeholder={t("commentPlaceholder")}
            rows={3}
            disabled={state.comment === "sending"}
          />
          <div className="content-feedback__panel-foot">
            <span className="content-feedback__count">
              {t("charCount", { count: comment.length, max: COMMENT_MAX })}
            </span>
            <div className="content-feedback__buttons">
              <button type="button" className="content-feedback__btn" onClick={skipComment}>
                {t("commentSkip")}
              </button>
              <button
                type="submit"
                className="content-feedback__btn content-feedback__btn--primary"
                disabled={state.comment === "sending"}
              >
                {t("commentSend")}
              </button>
            </div>
          </div>
        </form>
      )}

      {state.panel === "report" && (
        <form
          className="content-feedback__panel"
          onSubmit={onReportSubmit}
          onKeyDown={onReportKey}
        >
          <label className="content-feedback__label" htmlFor="content-feedback-report">
            {t("reportPrompt")}
          </label>
          <textarea
            ref={textareaRef}
            id="content-feedback-report"
            className="content-feedback__textarea"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, REPORT_MAX))}
            maxLength={REPORT_MAX}
            placeholder={t("reportPlaceholder")}
            rows={4}
            disabled={state.report === "sending"}
            aria-describedby="content-feedback-report-hint"
          />
          <div className="content-feedback__panel-foot">
            <span id="content-feedback-report-hint" className="content-feedback__count">
              {messageLength > 0 && messageLength < REPORT_MIN
                ? t("reportTooShort", { min: REPORT_MIN })
                : t("charCount", { count: message.length, max: REPORT_MAX })}
            </span>
          </div>

          {sessionEmail ? (
            <span className="content-feedback__hint">{t("reportAsUser", { email: sessionEmail })}</span>
          ) : (
            <div className="content-feedback__field">
              <label className="content-feedback__label" htmlFor="content-feedback-email">
                {t("reportEmailLabel")}
              </label>
              <input
                id="content-feedback-email"
                className="content-feedback__input"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError(false);
                }}
                onKeyDown={onEmailKey}
                aria-invalid={emailError || undefined}
                disabled={state.report === "sending"}
              />
              {emailError && <span className="content-feedback__error">{t("reportEmailInvalid")}</span>}
            </div>
          )}

          <div className="content-feedback__buttons content-feedback__buttons--end">
            <button type="button" className="content-feedback__btn" onClick={closeReport}>
              {t("reportCancel")}
            </button>
            <button
              type="submit"
              className="content-feedback__btn content-feedback__btn--primary"
              disabled={state.report === "sending" || !messageValid}
            >
              {t("reportSend")}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function noticeCopy(t: ReturnType<typeof useTranslations<"content.feedback">>, notice: Notice): string {
  switch (notice) {
    case "thanks":      return t("thanks");
    case "commentSent": return t("commentSent");
    case "reportSent":  return t("reportSent");
    case "error":       return t("error");
    case "rateLimited": return t("rateLimited");
    default:            return "";
  }
}

export default ContentFeedback;

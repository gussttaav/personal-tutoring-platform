"use client";

/**
 * PastClassModal — detail view for one past class, and the only place outside the
 * Zoom room where a class can be rated.
 *
 * Before this, POST /api/reviews was reachable only from PostClassReview, which
 * mounts when a session ends inside the room. Miss that moment and the class
 * could never be rated. The stars here close that gap using the same endpoint.
 *
 * Dialog mechanics follow src/features/courses/reader/MobileLessonBar.tsx — the
 * repo's most complete dialog: portal, Escape, scroll lock, focus trap and focus
 * restore. (ComingSoonModal has the same shape but no focus handling.)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { BookingHistoryEntry } from "@/domain/types";
import { useHydrated } from "@/hooks/useClientValue";
import { camelCaseCode } from "@/constants/errors";
import { formatDate, formatRelative } from "@/lib/formatting";
import { canReview, durationMinutes, paymentLabel } from "./history-stats";
import { sessionTypeKey, timeRange, viewerTimeZone } from "./session-display";
import StarRating from "./StarRating";

interface PastClassModalProps {
  entry:    BookingHistoryEntry;
  onClose:  () => void;
  /** Patches the entry in the parent list so the row updates without a refetch. */
  onReviewed: (id: string, review: { rating: number; comment: string | null }) => void;
}

type ReviewPhase = "stars" | "saving" | "comment" | "done" | "error";

export default function PastClassModal({ entry, onClose, onReviewed }: PastClassModalProps) {
  const t        = useTranslations("areaPersonal.history.modal");
  const tHistory = useTranslations("areaPersonal.history");
  const tSession = useTranslations("areaPersonal.nextSession");
  const tErrors  = useTranslations("errors");
  const tCommon  = useTranslations("common");
  const locale   = useLocale() as "es" | "en";
  const router   = useRouter();
  const mounted  = useHydrated();

  const cardRef     = useRef<HTMLDivElement>(null);
  const restoreRef  = useRef<HTMLElement | null>(null);

  const [phase,    setPhase]    = useState<ReviewPhase>(canReview(entry) ? "stars" : "done");
  const [rating,   setRating]   = useState(entry.review?.rating ?? 0);
  const [comment,  setComment]  = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  // Distinguishes "you just rated this" from "this was already rated" — only the
  // former earns the thank-you line.
  const [justRated, setJustRated] = useState(false);

  // ── Focus restore ──────────────────────────────────────────────────────────
  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null;
    return () => restoreRef.current?.focus?.();
  }, []);

  // ── Scroll lock ────────────────────────────────────────────────────────────
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // ── Escape + focus trap ────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key !== "Tab") return;

    const focusables = cardRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), textarea, a[href], [tabindex]:not([tabindex="-1"])',
    );
    if (!focusables || focusables.length === 0) return;

    const first = focusables[0];
    const last  = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Move focus into the dialog once it exists.
  useEffect(() => {
    if (mounted) cardRef.current?.querySelector<HTMLElement>("button")?.focus();
  }, [mounted]);

  // ── Review submission ──────────────────────────────────────────────────────

  function mapError(status: number, code?: string): string {
    return code
      ? tErrors(`domain.${camelCaseCode(code)}` as Parameters<typeof tErrors>[0])
      : tErrors(`http.${status}` as Parameters<typeof tErrors>[0]);
  }

  async function submitRating(value: number) {
    setRating(value);
    setPhase("saving");
    try {
      const res  = await fetch("/api/reviews", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ kind: "rating", eventId: entry.eventId, rating: value }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErrorMsg(mapError(res.status, data.error));
        setPhase("error");
        return;
      }
      // The response also carries showGoogleReview. Ignored here on purpose: the
      // Google CTA stays exclusive to the in-room PostClassReview flow.
      onReviewed(entry.id, { rating: value, comment: null });
      setJustRated(true);
      setPhase("comment");
    } catch {
      setErrorMsg(tErrors("http.502"));
      setPhase("error");
    }
  }

  async function submitComment() {
    const text = comment.trim();
    if (!text) { setPhase("done"); return; }
    setPhase("saving");
    try {
      const res = await fetch("/api/reviews", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ kind: "comment", eventId: entry.eventId, comment: text }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setErrorMsg(mapError(res.status, data.error));
        setPhase("error");
        return;
      }
      onReviewed(entry.id, { rating, comment: text });
      setPhase("done");
    } catch {
      setErrorMsg(tErrors("http.502"));
      setPhase("error");
    }
  }

  if (!mounted) return null;

  // ── Derived display values ─────────────────────────────────────────────────

  const isCancelled = entry.status === "cancelled";
  const typeLabel   = tSession(`sessionLabels.${sessionTypeKey(entry.sessionType)}` as Parameters<typeof tSession>[0]);
  const tz          = viewerTimeZone();
  const minutes     = durationMinutes(entry);
  const pay         = paymentLabel(entry, locale);
  const payText     = pay.key === "payCard"
    ? tHistory("payCard", { amount: pay.amount })
    : tHistory(pay.key);

  const fullDate = formatDate(entry.startsAt, locale, {
    weekday: "long",
    day:     "numeric",
    month:   "long",
    year:    "numeric",
    ...(tz ? { timeZone: tz } : {}),
  });
  const shortDate = formatDate(entry.startsAt, locale, {
    weekday: "short",
    day:     "numeric",
    month:   "short",
    year:    undefined,
    ...(tz ? { timeZone: tz } : {}),
  });

  const showNudge = canReview(entry) && phase === "stars";
  // Cancelled classes never show stars. Otherwise: an unrated class gets the input,
  // an already-rated one gets its stars back read-only.
  const showRating = !isCancelled && (canReview(entry) || rating > 0);

  const dialog = (
    <div className="pa-modal">
      <button
        type="button"
        className="pa-modal__bg"
        aria-label={tCommon("close")}
        onClick={onClose}
      />
      <div
        className="pa-modal__card"
        role="dialog"
        aria-modal="true"
        aria-label={t("title")}
        ref={cardRef}
      >
        <div className="pa-modal__head">
          <h3>{t("title")}</h3>
          {/* Short reference a student can quote in an email; the full id is a uuid. */}
          <span className="pa-id">#{entry.id.slice(0, 8)}</span>
          <button type="button" className="pa-modal__x" onClick={onClose} aria-label={tCommon("close")}>
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>

        <div className="pa-modal__body">
          <div className="pa-mhero">
            <div className="pa-mhero__top">
              <span className={`pa-badge ${isCancelled ? "pa-badge--cancel" : "pa-badge--done"}`}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  {isCancelled ? "cancel" : "check_circle"}
                </span>
                {isCancelled ? t("badgeCancelled") : t("badgeCompleted")}
              </span>
              <span className="pa-mago">{formatRelative(entry.startsAt, locale)}</span>
            </div>
            <div className="pa-ov">{typeLabel}</div>
            <div className="pa-big">{shortDate}</div>
            <div className="pa-sub">
              {minutes > 0 && `${minutes} min · `}{t("withTutor")}
            </div>
          </div>

          {showNudge && (
            <div className="pa-mnote">
              <div className="pa-ic">
                <span className="material-symbols-outlined" aria-hidden="true">star</span>
              </div>
              <div>
                <b>{t("reviewNudgeTitle")}</b>
                <small>{t("reviewNudgeBody")}</small>
              </div>
            </div>
          )}

          <div className="pa-mrows">
            <div className="pa-mrow">
              <span className="material-symbols-outlined" aria-hidden="true">calendar_month</span>
              <span className="pa-k">{t("rowDate")}</span>
              <span className="pa-v">{fullDate}</span>
            </div>
            <div className="pa-mrow">
              <span className="material-symbols-outlined" aria-hidden="true">schedule</span>
              <span className="pa-k">{t("rowTime")}</span>
              <span className="pa-v">{timeRange(entry.startsAt, entry.endsAt, locale)}</span>
            </div>
            <div className="pa-mrow">
              <span className="material-symbols-outlined" aria-hidden="true">credit_card</span>
              <span className="pa-k">{t("rowPayment")}</span>
              <span className="pa-v">{payText}</span>
            </div>
          </div>

          {entry.note && (
            <div className="pa-mnotecard">
              <div className="pa-k">
                <span className="material-symbols-outlined" aria-hidden="true">description</span>
                {t("yourNote")}
              </div>
              <p>{entry.note}</p>
            </div>
          )}

          {/* Rating — a completed class with an eventId to key POST /api/reviews on. */}
          {showRating && (
            <div className="pa-rate">
              <p className="pa-rate__k">{t("rateLabel")}</p>
              <StarRating
                value={rating}
                onSelect={submitRating}
                disabled={phase !== "stars"}
                labelFor={(n) => t("starLabel", { count: n })}
              />

              {phase === "saving" && (
                <div className="pa-dots" role="status" aria-live="polite">
                  <span /><span /><span />
                </div>
              )}

              {phase === "error" && (
                <p className="pa-confirm__err" role="alert" style={{ marginTop: 10 }}>{errorMsg}</p>
              )}

              {phase === "comment" && (
                <>
                  <textarea
                    className="pa-rate__comment"
                    maxLength={1000}
                    placeholder={t("commentPlaceholder")}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    aria-label={t("commentPlaceholder")}
                  />
                  <button
                    type="button"
                    className="pa-btn pa-btn--ghost pa-btn--block"
                    style={{ marginTop: 10 }}
                    onClick={submitComment}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">send</span>
                    {t("submitComment")}
                  </button>
                </>
              )}

              {phase === "done" && justRated && (
                <p className="pa-rate__done">
                  <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
                  {t("thanks")}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="pa-modal__foot">
          <button
            type="button"
            className="pa-btn pa-btn--primary pa-btn--lg pa-btn--block"
            onClick={() => router.push(`/?book=${entry.sessionType}`)}
          >
            <span className="material-symbols-outlined" aria-hidden="true">event_repeat</span>
            {t("bookSame")}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}

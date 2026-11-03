"use client";

// CHAT-AGENT-P1-04: a `proposal` action from /api/chat. The model never books (PLAN Q1): this
// card's Confirmar is the one write, the same `api.book.post` the booking wizard makes, so
// /api/book keeps CSRF, auth, rate limiting, checkSlot, the one-free-call cap and the emails.
//
//   signin   signed out: Google sign-in inside the card (popup, `resumeInPlace`). After the
//            session flips the card shows Confirmar; it never books on its own (Q1).
//   ready    Confirmar reserva.
//   booking  request in flight (a ref guards the double tap: one request).
//   done     booked; persisted on the message, so a reload shows it booked, not bookable.
//   error    SLOT_UNAVAILABLE / INVALID_SLOT → «Buscar otro hueco» (sends a message);
//            FREE_SESSION_ALREADY_USED → the rule; anything else → the message + Confirmar again.
//   expired  the start is past, or inside the booking min-notice.
//   superseded  a newer proposal exists in the thread: only the latest card is live.
//
// It doesn't use `useBooking()` (only some pages mount BookingOverlays) nor the commerce
// providers' throwing hooks: the chat is on every page. `hasBookings` in the Navbar updates on
// the next navigation (useUserSession has no refetch for it), accepted for v1.
import { useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { Link } from "@/i18n/navigation";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { useUserSession } from "@/hooks/useUserSession";
import { useScheduleConfigOptional } from "@/components/booking/ScheduleProvider";
import { api, ApiError } from "@/lib/api-client";
import { trackBooking } from "@/lib/booking-analytics";
import { errorCodeToKey } from "@/constants/errors";
import { browserTimezone, longDate, slotParts, timezoneCity } from "./slot-format";

export interface ProposalOutcome {
  emailFailed: boolean;
}

interface FreeCallProposalCardProps {
  startIso: string;
  endIso:   string;
  /** The timezone the server's tools used for this reply. */
  timezone: string;
  /** False when a newer proposal exists further down the thread. */
  live:     boolean;
  /** Set once this card booked (persisted with the message). */
  booked:   ProposalOutcome | null;
  /** The chat is waiting for a reply: «Buscar otro hueco» would be dropped. */
  chatBusy: boolean;
  onBooked:      (outcome: ProposalOutcome) => void;
  onFindAnother: (message: string) => void;
}

type ErrorKind = "slotGone" | "alreadyUsed" | "other";

const SLOT_GONE_CODES = new Set(["SLOT_UNAVAILABLE", "INVALID_SLOT"]);

export default function FreeCallProposalCard({
  startIso, endIso, timezone, live, booked, chatBusy, onBooked, onFindAnother,
}: FreeCallProposalCardProps) {
  const t       = useTranslations("chat.actions");
  const tErrors = useTranslations("errors");
  const locale  = useLocale() === "en" ? "en" : "es";
  const pathname = usePathname();
  const { isSignedIn, isAuthLoading } = useUserSession();
  const minNoticeHours = useScheduleConfigOptional()?.minNoticeHours ?? 0;

  const isPastNotice = (nowMs: number) => Date.parse(startIso) - minNoticeHours * 3_600_000 <= nowMs;

  const [expired,  setExpired]  = useState(() => isPastNotice(Date.now()));
  const [pending,  setPending]  = useState(false);
  const [error,    setError]    = useState<{ kind: ErrorKind; message: string } | null>(null);
  const inFlight = useRef(false);

  const start = slotParts(startIso, locale, timezone);
  const end   = slotParts(endIso, locale, timezone);
  const day   = longDate(startIso, locale, timezone);
  const range = `${start.time}–${end.time}`;
  const when  = `${day} · ${range}`;

  async function confirm() {
    if (inFlight.current) return;
    if (isPastNotice(Date.now())) { setExpired(true); return; }
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      const data = await api.book.post({
        startIso,
        endIso,
        sessionType: "free15min",
        timezone:    browserTimezone() ?? timezone,
      });
      trackBooking("free15min"); // BOOKING-ATTRIBUTION-01
      onBooked({ emailFailed: data.emailFailed });
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      const code   = err instanceof ApiError ? err.message : "";
      if (SLOT_GONE_CODES.has(code)) {
        setError({ kind: "slotGone", message: t("slotTaken") });
      } else {
        const message = tErrors(errorCodeToKey(code, status) as Parameters<typeof tErrors>[0]);
        setError({ kind: code === "FREE_SESSION_ALREADY_USED" ? "alreadyUsed" : "other", message });
      }
      inFlight.current = false;
    } finally {
      setPending(false);
    }
  }

  let body: ReactNode;
  if (booked) {
    body = (
      <div className="chat-proposal-card__result">
        <p className="chat-proposal-card__success">
          {booked.emailFailed ? t("bookedNoEmail") : t("booked")}
        </p>
        <Link href="/area-personal" className="chat-proposal-card__link">{t("goToPersonalArea")}</Link>
      </div>
    );
  } else if (!live) {
    body = <p className="chat-proposal-card__note">{t("superseded")}</p>;
  } else if (expired) {
    body = <p className="chat-proposal-card__note">{t("expired")}</p>;
  } else if (error && error.kind !== "other") {
    body = (
      <div className="chat-proposal-card__result">
        <p className="chat-proposal-card__error">{error.message}</p>
        {error.kind === "slotGone" && (
          <button
            type="button"
            className="chat-proposal-card__secondary"
            disabled={chatBusy}
            onClick={() => onFindAnother(t("findAnotherMessage"))}
          >
            {t("findAnother")}
          </button>
        )}
      </div>
    );
  } else if (!isSignedIn) {
    body = (
      <div className="chat-proposal-card__result">
        <p className="chat-proposal-card__note">{t("signInFirst")}</p>
        {isAuthLoading ? (
          <button type="button" className="chat-proposal-card__confirm" disabled>{t("confirm")}</button>
        ) : (
          <GoogleSignInButton resumeInPlace callbackUrl={pathname ?? "/"} label={t("signIn")} />
        )}
      </div>
    );
  } else {
    body = (
      <div className="chat-proposal-card__result">
        {error && <p className="chat-proposal-card__error">{error.message}</p>}
        <button
          type="button"
          className="chat-proposal-card__confirm"
          onClick={confirm}
          disabled={pending}
          aria-busy={pending}
        >
          {pending ? t("booking") : t("confirm")}
        </button>
      </div>
    );
  }

  const inactive = !booked && (!live || expired);

  return (
    <div
      className={`chat-proposal-card${inactive ? " chat-proposal-card--inactive" : ""}`}
      role="group"
      aria-label={t("proposalLabel", { when })}
    >
      <p className="chat-proposal-card__title">{t("proposalTitle")}</p>
      <p className="chat-proposal-card__when">
        {day} · <span className="chat-proposal-card__time">{range}</span>
      </p>
      <p className="chat-proposal-card__tz">{t("timezone", { city: timezoneCity(timezone) })}</p>
      {body}
    </div>
  );
}

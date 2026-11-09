"use client";

// CHAT-AGENT-P1-04: a `slots` action from /api/chat, as a row of chips under the bot message.
// A chip books nothing: it sends «Prefiero el mar 4 nov a las 10:15» as the user's next
// message, and the assistant answers with a proposal card. Slots already past are left out
// (the thread is persisted, so a chip can outlive its slot).
//
// CHAT-AGENT-P3-02: «Comparar con mi calendario» under the chips, for a signed-in visitor.
// It asks Google for a free/busy token (popup), reads the visitor's busy times for the chips'
// range from the browser, and hides the chips that clash. The token lives in `calendarTokenRef`
// (owned by Chat, dropped on «Nueva conversación» and unmount), so a second comparison in the
// same conversation opens no popup. Nothing about the calendar goes into the next message: a
// chip still sends the usual «Prefiero …». Closing the popup or declining leaves the chips as
// they were, with no message.
import { useState, type RefObject } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useUserSession } from "@/hooks/useUserSession";
import {
  GOOGLE_CLIENT_ID,
  FreeBusyError,
  fetchBusy,
  isTokenFresh,
  loadGis,
  requestFreeBusyToken,
  type FreeBusyToken,
} from "@/lib/google-calendar-freebusy";
import { filterSlotsByBusy, type TimeInterval } from "@/lib/slot-overlap";
import { slotParts } from "./slot-format";

interface SlotChipsProps {
  slots:    { startIso: string; endIso: string }[];
  timezone: string;
  /** Mount time, so the past-slot filter stays pure during render. */
  nowMs:    number;
  disabled: boolean;
  onPick:   (message: string) => void;
  /** CHAT-AGENT-P3-02: the conversation's free/busy token, owned by Chat. */
  calendarTokenRef: RefObject<FreeBusyToken | null>;
}

type CalendarState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "filtered"; busy: TimeInterval[] }
  | { status: "blocked" }
  | { status: "failed" };

export default function SlotChips({ slots, timezone, nowMs, disabled, onPick, calendarTokenRef }: SlotChipsProps) {
  const t      = useTranslations("chat.actions");
  const tc     = useTranslations("chat.calendar");
  const locale = useLocale() === "en" ? "en" : "es";
  const { isSignedIn, googleUser } = useUserSession();
  const [calendar, setCalendar] = useState<CalendarState>({ status: "idle" });

  const upcoming = slots.filter((s) => Date.parse(s.startIso) > nowMs);
  if (upcoming.length === 0) return null;

  const shown   = calendar.status === "filtered" ? filterSlotsByBusy(upcoming, calendar.busy) : upcoming;
  const canCompare = isSignedIn && GOOGLE_CLIENT_ID !== "";

  async function compare() {
    const timeMin = new Date(Math.min(...upcoming.map((s) => Date.parse(s.startIso)))).toISOString();
    const timeMax = new Date(Math.max(...upcoming.map((s) => Date.parse(s.endIso)))).toISOString();
    setCalendar({ status: "loading" });
    try {
      // The popup must open inside this click: requestFreeBusyToken opens it synchronously
      // when the script is already loaded (preloaded on hover / focus).
      const token = isTokenFresh(calendarTokenRef.current)
        ? calendarTokenRef.current
        : await requestFreeBusyToken(googleUser?.email ?? undefined);
      calendarTokenRef.current = token;
      try {
        const busy = await fetchBusy(token.accessToken, timeMin, timeMax);
        setCalendar({ status: "filtered", busy });
      } catch (err) {
        calendarTokenRef.current = null; // revoked or expired early: the next try asks again
        throw err;
      }
    } catch (err) {
      const kind = err instanceof FreeBusyError ? err.kind : "failed";
      setCalendar(kind === "dismissed" ? { status: "idle" } : { status: kind });
    }
  }

  function preload() {
    loadGis().catch(() => undefined); // a failure surfaces on the click
  }

  return (
    <div className="chat-slot-chips-block">
      <div
        className="chat-slot-chips" role="group"
        aria-label={calendar.status === "filtered" ? tc("filteredLabel") : t("slotsLabel")}
      >
        {shown.map((s) => {
          const p = slotParts(s.startIso, locale, timezone);
          return (
            <button
              key={s.startIso}
              type="button"
              className="chat-slot-chip"
              disabled={disabled}
              onClick={() => onPick(t("pickSlot", { day: `${p.weekday} ${p.day} ${p.month}`, time: p.time }))}
            >
              {`${p.weekday} ${p.day} · ${p.time}`}
            </button>
          );
        })}
      </div>

      {calendar.status === "filtered" && (
        <p className="chat-slot-calendar-note" role="status">
          {shown.length === 0 ? tc("none") : tc("filtered", { count: shown.length })}
        </p>
      )}
      {calendar.status === "blocked" && <p className="chat-slot-calendar-note" role="status">{tc("blocked")}</p>}
      {calendar.status === "failed"  && <p className="chat-slot-calendar-note" role="status">{tc("failed")}</p>}

      {canCompare && (calendar.status === "idle" || calendar.status === "loading" || calendar.status === "failed") && (
        <button
          type="button"
          className="chat-slot-calendar-btn"
          disabled={calendar.status === "loading"}
          aria-busy={calendar.status === "loading"}
          onPointerEnter={preload} onFocus={preload}
          onClick={compare}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {calendar.status === "loading" ? tc("comparing") : tc("compare")}
        </button>
      )}
    </div>
  );
}

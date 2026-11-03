"use client";

// CHAT-AGENT-P1-04: a `slots` action from /api/chat, as a row of chips under the bot message.
// A chip books nothing: it sends «Prefiero el mar 4 nov a las 10:00» as the user's next
// message, and the assistant answers with a proposal card. Slots already past are left out
// (the thread is persisted, so a chip can outlive its slot).
import { useLocale, useTranslations } from "next-intl";
import { slotParts } from "./slot-format";

interface SlotChipsProps {
  slots:    { startIso: string; endIso: string }[];
  timezone: string;
  /** Mount time, so the past-slot filter stays pure during render. */
  nowMs:    number;
  disabled: boolean;
  onPick:   (message: string) => void;
}

export default function SlotChips({ slots, timezone, nowMs, disabled, onPick }: SlotChipsProps) {
  const t      = useTranslations("chat.actions");
  const locale = useLocale() === "en" ? "en" : "es";

  const upcoming = slots.filter((s) => Date.parse(s.startIso) > nowMs);
  if (upcoming.length === 0) return null;

  return (
    <div className="chat-slot-chips" role="group" aria-label={t("slotsLabel")}>
      {upcoming.map((s) => {
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
  );
}

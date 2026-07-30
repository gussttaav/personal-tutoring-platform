/**
 * Shared display helpers for booking rows in /area-personal.
 *
 * Times render in the *viewer's* timezone, matching the booking flow
 * (src/components/WeeklyCalendar.tsx) and preserving what the old personal area
 * did with raw `Date.getHours()`. Falls back to Europe/Madrid — the default
 * baked into src/lib/formatting.ts — if the browser will not report a zone.
 */

import type { SessionType } from "@/domain/types";
import { formatTime } from "@/lib/formatting";

type Locale = "es" | "en";

const KNOWN_SESSION_TYPES = ["free15min", "session1h", "session2h", "pack"] as const;

export type KnownSessionType = (typeof KNOWN_SESSION_TYPES)[number];

/** Narrows an unrecognised session type to "pack" so `t()` never misses a key. */
export function sessionTypeKey(sessionType: SessionType | string): KnownSessionType {
  return KNOWN_SESSION_TYPES.includes(sessionType as KnownSessionType)
    ? (sessionType as KnownSessionType)
    : "pack";
}

export function viewerTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

/** "09:00 – 09:15" in the viewer's timezone. */
export function timeRange(startsAt: string, endsAt: string, locale: Locale): string {
  const tz = viewerTimeZone();
  const opts = tz ? { timeZone: tz } : undefined;
  return `${formatTime(startsAt, locale, opts)} – ${formatTime(endsAt, locale, opts)}`;
}

/** Day-of-month and short month name, for the little date tiles. */
export function dateTile(iso: string, locale: Locale): { day: string; month: string } {
  const d = new Date(iso);
  const tz = viewerTimeZone();
  const tag = locale === "en" ? "en-GB" : "es-ES";
  return {
    day:   new Intl.DateTimeFormat(tag, { day: "numeric", ...(tz ? { timeZone: tz } : {}) }).format(d),
    month: new Intl.DateTimeFormat(tag, { month: "short", ...(tz ? { timeZone: tz } : {}) })
      .format(d)
      .replace(".", ""),
  };
}

/** Weekday name — "Jueves" / "Thursday". */
export function weekdayName(iso: string, locale: Locale, style: "long" | "short" = "long"): string {
  const tz = viewerTimeZone();
  const tag = locale === "en" ? "en-GB" : "es-ES";
  return new Intl.DateTimeFormat(tag, { weekday: style, ...(tz ? { timeZone: tz } : {}) })
    .format(new Date(iso))
    .replace(".", "");
}

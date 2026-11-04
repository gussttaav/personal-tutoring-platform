// CHAT-AGENT-P1-04: how the chat's slot chips and proposal card write a slot. Always in the
// timezone the server's tools used for that reply (`/api/chat` answers it), so «10:00» on a
// chip is the same «10:00» the assistant said, and the locales match the tools' `localLabel`
// (es-ES / en-GB, 24 h).
import { isSupportedTimezone } from "@/lib/timezones";

type Locale = "es" | "en";

interface SlotParts {
  weekday: string;  // "mar" / "Tue"
  day:     string;  // "4"
  month:   string;  // "nov" / "Nov"
  time:    string;  // "10:00"
}

function intlLocale(locale: Locale): string {
  return locale === "en" ? "en-GB" : "es-ES";
}

export function slotParts(iso: string, locale: Locale, timezone: string): SlotParts {
  const parts = new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone:  timezone,
    weekday:   "short",
    day:       "numeric",
    month:     "short",
    hour:      "2-digit",
    minute:    "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    (parts.find((p) => p.type === type)?.value ?? "").replace(/\.$/, "");
  return {
    weekday: part("weekday"),
    day:     part("day"),
    month:   part("month"),
    time:    `${part("hour")}:${part("minute")}`,
  };
}

/** "martes, 4 de noviembre" / "Tuesday 4 November". */
export function longDate(iso: string, locale: Locale, timezone: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: timezone,
    weekday:  "long",
    day:      "numeric",
    month:    "long",
  }).format(new Date(iso));
}

/** "Europe/Madrid" → "Madrid", "America/Argentina/Buenos_Aires" → "Buenos Aires". */
export function timezoneCity(timezone: string): string {
  return (timezone.split("/").pop() ?? timezone).replace(/_/g, " ");
}

/** The browser's timezone; undefined when it can't be read. */
export function browserTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/**
 * The timezone `/api/chat` is sent: the browser's when the server accepts it
 * (`SUPPORTED_TIMEZONES`), else none, and the tools fall back to the tutor's
 * (CHAT-AGENT-P1-02 answers 400 for any other value).
 */
export function chatRequestTimezone(): string | undefined {
  const tz = browserTimezone();
  return tz && isSupportedTimezone(tz) ? tz : undefined;
}

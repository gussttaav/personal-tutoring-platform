/**
 * ADMIN-01: Shared formatting helpers for the admin panel.
 * Ported from the redesign prototype (admin-app.jsx).
 *
 * ADMIN-03: every date/time helper takes the tutor's timezone (ScheduleConfig.timezone)
 * explicitly. fmtDate / fmtDateTime / fmtShort used to format in the RUNTIME's
 * timezone: UTC on Vercel, so the server-rendered pages were 1–2 h off Madrid, and the
 * client tables rendered UTC on the server and the browser's zone on hydration. The
 * parameter is required so a new caller cannot fall back to the runtime's zone.
 */

import type { SessionType } from "@/domain/types";

/** "09/10/2026" */
export const fmtDate = (iso: string, timeZone: string): string =>
  new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", timeZone });

/** "09/10/2026, 22:14" */
export const fmtDateTime = (iso: string, timeZone: string): string =>
  new Date(iso).toLocaleString("es-ES", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone,
  });

/** "9/10, 22:14" (es-ES drops the leading zeros when there is no year) */
export const fmtShort = (iso: string, timeZone: string): string =>
  new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone });

export const relativeTime = (iso: string): string => {
  const diffMs = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const mins = Math.round(abs / 60000);
  const hrs = Math.round(abs / 3600000);
  const dys = Math.round(abs / 86400000);
  let s: string;
  if (mins < 60) s = `${mins} min`;
  else if (hrs < 24) s = `${hrs} h`;
  else s = `${dys} d`;
  return diffMs < 0 ? `hace ${s}` : `en ${s}`;
};

/** First letters of up to the first two name parts, e.g. "Diego Ramírez" → "DR". */
export const initials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .map((n) => n[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();

/* ─── ADMIN-02: dashboard helpers ────────────────────────────────────────────
 * The dashboard groups its agenda by day ("Hoy", "Mañana"); like the helpers above
 * (ADMIN-03), these take the tutor's timezone (ScheduleConfig.timezone) explicitly. */

/** "1.240,00 €" — Spanish grouping and decimals, euro sign after. */
export const fmtEuros = (cents: number): string =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(cents / 100);

/** "18:00" */
export const fmtTime = (iso: string, timeZone: string): string =>
  new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone });

/** "2026-10-12" in `timeZone` — a stable key to group and compare calendar days. */
export const dayKey = (iso: string | number, timeZone: string): string =>
  new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone })
    .format(new Date(iso));

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** "Sábado, 10 de octubre de 2026" */
export const fmtLongDate = (iso: string | number, timeZone: string): string =>
  capitalize(
    new Date(iso).toLocaleDateString("es-ES", {
      weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone,
    }),
  );

/** "sáb 10 oct" */
export const fmtDayShort = (iso: string, timeZone: string): string =>
  new Date(iso)
    .toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone })
    .replace(/,/g, "")
    .replace(/\./g, "");

/** "14 nov" */
export const fmtDayMonth = (iso: string, timeZone: string): string =>
  new Date(iso)
    .toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone })
    .replace(/\./g, "");

/**
 * A day heading for the agenda: "Hoy" / "Mañana" / the weekday ("Lunes"), plus the
 * date ("12 de octubre"). `now` is passed in so a Server Component reads the clock once.
 */
export function agendaDay(iso: string, now: number, timeZone: string): { name: string; date: string } {
  const key = dayKey(iso, timeZone);
  const date = new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", timeZone });
  if (key === dayKey(now, timeZone)) return { name: "Hoy", date };
  if (key === dayKey(now + 86_400_000, timeZone)) return { name: "Mañana", date };
  return {
    name: capitalize(new Date(iso).toLocaleDateString("es-ES", { weekday: "long", timeZone })),
    date,
  };
}

/** Minutes between two ISO instants, rounded. */
export const durationMinutes = (startIso: string, endIso: string): number =>
  Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000);

const SESSION_TYPE_LABEL: Record<SessionType, string> = {
  free15min: "Llamada 15 min",
  session1h: "Sesión 1 h",
  session2h: "Sesión 2 h",
  pack:      "Clase de pack",
};

/** "Sesión 1 h" for `session1h`; an unknown type shows as itself. */
export const sessionTypeLabel = (type: string): string =>
  SESSION_TYPE_LABEL[type as SessionType] ?? type;

/** The colour key the `.type-pill` modifiers use: `t-15` (call), `t-1h` (1 h or a
 *  pack class, which is an hour), `t-2h`. */
export const sessionTypeTone = (type: string): string =>
  type === "free15min" ? "t-15"
  : type === "session2h" ? "t-2h"
  : type === "session1h" || type === "pack" ? "t-1h"
  : "";

/** "vie 9 oct, 22:14" */
export const fmtDayTime = (iso: string, timeZone: string): string =>
  `${fmtDayShort(iso, timeZone)}, ${fmtTime(iso, timeZone)}`;

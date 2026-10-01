// REFACTOR-R4-P1-01: slot helpers for tests that book. The server now validates every
// window (session length, 15-minute grid, working hours, min-notice), so an unaligned
// `Date.now() + h` start, or the seeded working hours, would reject most test bookings.
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import type { SessionType, WeeklyHours } from "@/domain/types";
import { SESSION_DURATION_MINUTES, SLOT_ALIGNMENT_MINUTES } from "@/lib/booking-config";

/** Every weekday open 00:00–24:00, so working hours never reject a test slot. */
export function allDaySchedule(): WeeklyHours {
  const out = {} as WeeklyHours;
  for (let dow = 0; dow < 7; dow++) out[dow] = [{ startMinute: 0, endMinute: 1440 }];
  return out;
}

/**
 * A bookable window for `sessionType`, at least `hoursAhead` from now: the start is
 * rounded UP to the 15-minute grid and the end is start + the session's length.
 * Madrid's UTC offset is a whole number of hours, so a UTC-aligned start is aligned in
 * the tutor's timezone too. A window that would cross local midnight moves to the next
 * midnight, since no single all-day block contains it.
 */
export function alignedSlot(
  sessionType: SessionType,
  hoursAhead: number,
  timezone = "Europe/Madrid",
): { startIso: string; endIso: string } {
  const stepMs = SLOT_ALIGNMENT_MINUTES * 60_000;
  const lenMin = SESSION_DURATION_MINUTES[sessionType];

  let startMs = Math.ceil((Date.now() + hoursAhead * 3_600_000) / stepMs) * stepMs;
  const zoned  = toZonedTime(new Date(startMs), timezone);
  const minute = zoned.getHours() * 60 + zoned.getMinutes();
  if (minute + lenMin > 1440) startMs += (1440 - minute) * 60_000;

  return {
    startIso: new Date(startMs).toISOString(),
    endIso:   new Date(startMs + lenMin * 60_000).toISOString(),
  };
}

/**
 * A window for `sessionType` starting at local `time` (HH:mm) in `timezone`,
 * `daysAhead` calendar days from today there. Deterministic wall-clock placement for
 * tests that need two slots to overlap, or a slot outside the seeded working hours.
 */
export function slotAtLocal(
  sessionType: SessionType,
  daysAhead: number,
  time: string,
  timezone = "Europe/Madrid",
): { startIso: string; endIso: string } {
  const day   = formatInTimeZone(new Date(Date.now() + daysAhead * 86_400_000), timezone, "yyyy-MM-dd");
  const start = fromZonedTime(`${day}T${time}:00`, timezone);
  return {
    startIso: start.toISOString(),
    endIso:   new Date(start.getTime() + SESSION_DURATION_MINUTES[sessionType] * 60_000).toISOString(),
  };
}

/**
 * lib/booking-config.ts
 *
 * Pure, data-free helpers + static constants for the booking schedule.
 *
 * The actual schedule DATA (working hours, min advance notice, timezone) is now
 * admin-editable and lives in the `working_hours` + `booking_settings` tables,
 * read via ScheduleService and delivered to the client through ScheduleProvider.
 * Kept separate from calendar.ts so client components can import these helpers
 * without pulling in googleapis and Node.js built-ins.
 *
 * REFACTOR-R4-P1-01: SESSION_DURATION_MINUTES + SLOT_ALIGNMENT_MINUTES — the
 * server-side definition of a bookable window, enforced by BookingService.checkSlot.
 *
 * SESSION-JOIN-01: joinOpensAtMs / tutorAbsentAlertAtMs — when the classroom opens
 * for the student, and when the tutor-absent alert may fire. One definition shared
 * by SessionService (enforcement), the /sesion page and the personal area (display).
 */

import type { ScheduleConfig, SessionType, TimeBlock, WeeklyHours } from "@/domain/types";

/** How many weeks ahead bookings are allowed. Static for now (not admin-editable). */
export const BOOKING_WINDOW_WEEKS = 8;

// REFACTOR-R4-P1-01: the server-side source of truth for how long each session type
// lasts. The Zoom grace table (infrastructure/zoom/jwt.ts) and the booking UI already
// assume these values; the validator now enforces them.
export const SESSION_DURATION_MINUTES: Record<SessionType, number> = {
  free15min: 15,
  session1h: 60,
  session2h: 120,
  pack:      60,
};

/** Every bookable start sits on this grid in the tutor's timezone. */
export const SLOT_ALIGNMENT_MINUTES = 15;

// SESSION-JOIN-01: fallbacks for a ScheduleConfig cached before migration 0028 added
// the fields (the Redis config cache and the 30-day ISR loader can both serve the old
// shape until the next admin save). Same values as the 0028 column defaults.
export const DEFAULT_JOIN_OPEN_MINUTES = 15;
export const DEFAULT_TUTOR_ABSENT_ALERT_MINUTES = 5;

type JoinWindowConfig = Partial<Pick<ScheduleConfig, "joinOpenMinutesBefore" | "tutorAbsentAlertMinutes">>;

/** Epoch ms at which the student may enter the classroom (start − joinOpenMinutesBefore). */
export function joinOpensAtMs(startIso: string, config: JoinWindowConfig): number {
  const minutes = config.joinOpenMinutesBefore ?? DEFAULT_JOIN_OPEN_MINUTES;
  return new Date(startIso).getTime() - minutes * 60_000;
}

/** Epoch ms from which a waiting student may raise the tutor-absent alert (start + M). */
export function tutorAbsentAlertAtMs(startIso: string, config: JoinWindowConfig): number {
  const minutes = config.tutorAbsentAlertMinutes ?? DEFAULT_TUTOR_ABSENT_ALERT_MINUTES;
  return new Date(startIso).getTime() + minutes * 60_000;
}

/**
 * Generates the candidate slot start-minutes for a set of working blocks.
 * For each block, a slot at `cursor` is valid while `cursor + duration <= endMinute`,
 * advancing by `stepMinutes`. Returns minutes-since-midnight start values.
 *
 * The literal block model carries no buffer (unlike the legacy `-15` morning quirk):
 * a block of 09:00–13:30 yields 60-min slots starting at 09:00, 10:00, 11:00, 12:00.
 */
export function slotsFromBlocks(
  blocks: TimeBlock[],
  durationMinutes: number,
  stepMinutes: number = durationMinutes,
): number[] {
  const starts: number[] = [];
  for (const block of blocks) {
    let cursor = block.startMinute;
    while (cursor + durationMinutes <= block.endMinute) {
      starts.push(cursor);
      cursor += stepMinutes;
    }
  }
  return starts;
}

/**
 * Returns true when a slot of `slotLenMin` minutes starting at `rowStartMin`
 * (minutes since midnight) fits entirely within one of the day's blocks.
 */
export function isWithinBlocks(
  blocks: TimeBlock[],
  rowStartMin: number,
  slotLenMin: number,
): boolean {
  return blocks.some(
    (b) => rowStartMin >= b.startMinute && rowStartMin + slotLenMin <= b.endMinute,
  );
}

/**
 * Derives the grid's hour bounds from the configured weekly hours: the earliest
 * block start (floored to the hour) and the latest block end (ceiled to the hour).
 * Falls back to 09:00–19:00 when no blocks are configured.
 */
export function gridHourRange(weekly: WeeklyHours): { minHour: number; maxHour: number } {
  let minStart = Infinity;
  let maxEnd   = -Infinity;
  for (const blocks of Object.values(weekly)) {
    for (const b of blocks) {
      if (b.startMinute < minStart) minStart = b.startMinute;
      if (b.endMinute   > maxEnd)   maxEnd   = b.endMinute;
    }
  }
  if (minStart === Infinity || maxEnd === -Infinity) {
    return { minHour: 9, maxHour: 19 };
  }
  return {
    minHour: Math.floor(minStart / 60),
    maxHour: Math.ceil(maxEnd / 60),
  };
}

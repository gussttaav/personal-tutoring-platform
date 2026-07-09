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
 */

import type { TimeBlock, WeeklyHours } from "@/domain/types";

/** How many weeks ahead bookings are allowed. Static for now (not admin-editable). */
export const BOOKING_WINDOW_WEEKS = 8;

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

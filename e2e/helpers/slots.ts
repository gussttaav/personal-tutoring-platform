/**
 * e2e/helpers/slots.ts
 *
 * REFACTOR-R4-P1-01: the server now validates every booking window (15-min grid,
 * working hours, min-notice, the tutor's calendar), so specs that seed a booking
 * through POST /api/book must ask the server for a slot it actually offers instead
 * of guessing "tomorrow 10:00 in the runner's timezone" — which fails on weekends,
 * off-hours, or a busy morning.
 *
 * `firstAvailableSlot` walks GET /api/availability day by day (the same source the
 * booking calendar reads) and returns the first slot of the requested length.
 */

import type { APIRequestContext } from "@playwright/test";

/** The tutor's timezone — /api/availability's `date` is a day in it. */
const SCHEDULE_TZ = "Europe/Madrid";

/** How far ahead to look before giving up: covers a weekend plus a busy week. */
const SEARCH_DAYS = 14;

export interface AvailableSlot {
  start: string;
  end:   string;
}

function dayKey(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SCHEDULE_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

export async function firstAvailableSlot(
  request: APIRequestContext,
  durationMinutes: 15 | 60 | 120 = 15,
): Promise<AvailableSlot> {
  for (let offset = 0; offset < SEARCH_DAYS; offset++) {
    const res = await request.get(`/api/availability?date=${dayKey(offset)}&duration=${durationMinutes}`);
    if (!res.ok()) {
      throw new Error(`GET /api/availability failed (${res.status()}): ${await res.text()}`);
    }
    const { slots = [] } = (await res.json()) as { slots?: AvailableSlot[] };
    if (slots.length > 0) return slots[0]!;
  }
  throw new Error(`No ${durationMinutes}-minute slot offered in the next ${SEARCH_DAYS} days`);
}

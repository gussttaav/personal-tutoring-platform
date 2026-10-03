/**
 * lib/booking-analytics.ts — BOOKING-ATTRIBUTION-01
 *
 * Vercel Web Analytics custom events for bookings, so the dashboard can count them
 * by source next to the page views. The users table (utm_* columns, set at a
 * student's first booking) stays the source of truth: an event can be blocked by the browser, a row cannot.
 *
 *   intro_call_booked — a new free 15-minute call
 *   class_booked      — a new pack class, or a paid 1h/2h class once Stripe confirms
 *
 * Reschedules move an existing booking and fire nothing. Client-only.
 */

import { track } from "@vercel/analytics";
import type { SessionType } from "@/domain/types";
import { readStoredAttribution } from "@/lib/attribution";

export function trackBooking(sessionType: SessionType): void {
  const a = readStoredAttribution();
  try {
    track(sessionType === "free15min" ? "intro_call_booked" : "class_booked", {
      sessionType,
      source:   a?.source ?? a?.referrerHost ?? "direct",
      medium:   a?.medium ?? null,
      campaign: a?.campaign ?? null,
    });
  } catch { /* analytics is best-effort */ }
}

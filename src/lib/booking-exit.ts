/**
 * lib/booking-exit.ts
 *
 * BOOKING-EXIT-01: how a site link leaves an open booking screen.
 *
 * The booking screens are overlays over the page (`BookingOverlays`, `PackBookingOverlay`), not
 * routes. A link to the page the overlay sits on (the logo or «Inicio» on `/`, «Mentoría» on
 * `/mentoria`, …) is a same-URL navigation for Next: it replaces the history entry and keeps the
 * page — and the overlay — mounted, so the click did nothing. A link to another page did leave,
 * but left the booking's history entry behind (one dead back press on the way home).
 *
 * So the Navbar and Footer links ask first: `requestBookingExit` dispatches a CANCELABLE
 * `close-booking-overlay` carrying the link's href. Nobody listening (no booking screen open)
 * → the event is not canceled and the link navigates as usual. A booking screen open → its
 * owner (`useBookingHistory`) cancels the event and takes the trip itself: close in place for
 * the current page, `router.replace` (dropping the booking's entry) for another one — and the
 * link's own navigation is prevented so the two never race.
 */

import type { MouseEvent } from "react";

export const CLOSE_BOOKING_EVENT = "close-booking-overlay";

export interface CloseBookingDetail {
  /** The locale-free route the link points at (`/`, `/mentoria`, …). */
  href: string;
}

/**
 * Call from a link's `onClick`. Clicks that open a new tab or window (modifier keys, middle
 * button) are the browser's, not ours: the booking stays open in this tab.
 */
export function requestBookingExit(e: MouseEvent, href: string): void {
  if (e.defaultPrevented) return;
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

  const event = new CustomEvent<CloseBookingDetail>(CLOSE_BOOKING_EVENT, {
    cancelable: true,
    detail:     { href },
  });
  // dispatchEvent returns false when a listener called preventDefault(): the booking owner
  // handled the trip, so the link must not navigate on its own.
  if (!window.dispatchEvent(event)) e.preventDefault();
}

"use client";

/**
 * useBookingActions — the personal area's CTAs open the booking IN PLACE.
 *
 * Until now every CTA on /area-personal did `router.push("/mentoria?book=<intent>")` (and
 * «Reprogramar» `…?reschedule=<type>&token=…`). The booking screens are overlays rendered by
 * `BookingOverlays`, which was mounted on `/` and `/mentoria` only, so the page had no choice
 * but to send the student to Mentoría and let the provider's `?book=` consumer open the screen
 * there: Mentoría painted, then the effect fired. The same detour REDESIGN-P1-06 removed from
 * the home hero. The page now mounts `BookingOverlays` itself (area-personal/page.tsx), so this
 * hook calls the router the deep link would have reached — one click, no navigation, URL
 * unchanged.
 *
 * Not window events: those exist for a few cross-page triggers (`open-pack-booking`,
 * `open-smart-book`, …) and none covers session1h/2h or the pack sizes. The components here
 * are children of the provider, so they read the router the way the Mentoría sections do
 * (`InteractiveShell.tsx`). The intent → handler mapping is `booking-intent.ts`.
 */

import { useBooking } from "@/features/booking/BookingProvider";
import { openBookingIntent, type BookingIntent } from "./booking-intent";
import type { UserBooking } from "./types";

export function useBookingActions() {
  const { router } = useBooking();

  return {
    /** Open the calendar / pack modal for `intent` over this page. */
    openBooking(intent: BookingIntent) {
      openBookingIntent(router, intent);
    },
    /**
     * Reschedule `booking` over this page. The student is signed in here (the page is
     * auth-gated server-side), so the URL round-trip `useRescheduleIntent` does for email
     * links is unnecessary: this is the call `RescheduleBridge` makes once that resolves.
     */
    openReschedule(booking: UserBooking) {
      router.applyReschedule(booking.sessionType, booking.token);
    },
  };
}

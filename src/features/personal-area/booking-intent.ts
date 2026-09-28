/**
 * booking-intent.ts — what each personal-area CTA asks the booking router to open.
 *
 * A pure module beside `useBookingActions.ts` (the `session-display.ts` / `history-stats.ts`
 * pattern) so the mapping can be unit tested without jsdom, this repo having none.
 * `openBookingIntent` mirrors the `?book=` switch in `BookingProvider.tsx` case for case: the
 * deep link and the in-place click must always open the same screen.
 */

import type { SessionType } from "@/domain/types";
import type { BookingRouterState } from "@/hooks/useBookingRouter";

/** What a personal-area CTA can open: a session type, a pack class, or a pack to buy. */
export type BookingIntent = SessionType | "pack5" | "pack10";

/** Only the three handlers the mapping needs — keeps the test double small. */
export type BookingIntentRouter = Pick<
  BookingRouterState,
  "handleSessionClick" | "handlePackBuy" | "handlePackSchedule"
>;

export function openBookingIntent(router: BookingIntentRouter, intent: BookingIntent): void {
  switch (intent) {
    case "pack":   router.handlePackSchedule(); break;
    case "pack5":  router.handlePackBuy(5);     break;
    case "pack10": router.handlePackBuy(10);    break;
    default:       router.handleSessionClick(intent);
  }
}

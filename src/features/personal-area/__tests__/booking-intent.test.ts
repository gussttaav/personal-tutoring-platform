// The personal area's CTAs open the booking in place: each intent must reach the same
// router handler the `/mentoria?book=<intent>` deep link reached (BookingProvider.tsx).

import { openBookingIntent, type BookingIntentRouter } from "@/features/personal-area/booking-intent";

function stubRouter() {
  const calls: string[] = [];
  const router: BookingIntentRouter = {
    handleSessionClick: (type) => { calls.push(`session:${type}`); },
    handlePackBuy:      (size) => { calls.push(`buy:${size}`); },
    handlePackSchedule: ()     => { calls.push("schedule-pack"); },
  };
  return { router, calls };
}

describe("openBookingIntent", () => {
  it.each(["free15min", "session1h", "session2h"] as const)("opens the %s calendar", (type) => {
    const { router, calls } = stubRouter();
    openBookingIntent(router, type);
    expect(calls).toEqual([`session:${type}`]);
  });

  it("opens the pack booking for a pack class", () => {
    const { router, calls } = stubRouter();
    openBookingIntent(router, "pack");
    expect(calls).toEqual(["schedule-pack"]);
  });

  it("opens the purchase modal for the pack sizes", () => {
    const { router, calls } = stubRouter();
    openBookingIntent(router, "pack5");
    openBookingIntent(router, "pack10");
    expect(calls).toEqual(["buy:5", "buy:10"]);
  });
});

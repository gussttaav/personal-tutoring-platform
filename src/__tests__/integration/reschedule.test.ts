// TEST-01: Integration tests for the reschedule flow.
// Verifies that rescheduling atomically replaces a booking and correctly handles
// credit state for pack vs non-pack sessions.
// REFACTOR-R4-P1-01: slots come from fixtures/slots (aligned, the right length).
jest.mock("@/lib/availability-cache", () => ({
  invalidate: jest.fn().mockResolvedValue(undefined),
  getCached:  jest.fn().mockResolvedValue(null),
  setCached:  jest.fn().mockResolvedValue(undefined),
}));

import { InMemoryCreditsRepository } from "../fixtures/InMemoryCreditsRepository";
import { InMemoryBookingRepository } from "../fixtures/InMemoryBookingRepository";
import {
  buildTestCreditService,
  buildTestBookingService,
} from "../fixtures/services";
import { alignedSlot } from "../fixtures/slots";

const creditParams = {
  email:           "carol@example.com",
  name:            "Carol",
  amount:          5,
  packLabel:       "Pack 5 clases",
  stripeSessionId: "pi_reschedule_001",
  expiresAt:       new Date(Date.now() + 180 * 24 * 60 * 60_000).toISOString(),
};

const packInput = (hoursAhead = 6) => ({
  email:       "carol@example.com",
  name:        "Carol",
  ...alignedSlot("pack", hoursAhead),
  sessionType: "pack" as const,
});

const freeInput = (hoursAhead = 6) => ({
  ...packInput(hoursAhead),
  ...alignedSlot("free15min", hoursAhead),
  sessionType: "free15min" as const,
});

describe("Reschedule flow — pack session", () => {
  it("replaces the old booking and leaves credit balance unchanged", async () => {
    const creditsRepo = new InMemoryCreditsRepository();
    const bookingRepo = new InMemoryBookingRepository();
    const credits     = buildTestCreditService({ credits: creditsRepo });
    await credits.addCredits(creditParams);

    const service   = buildTestBookingService({ credits, bookings: bookingRepo });
    const original  = await service.createBooking(packInput(6));

    const balanceAfterBooking = await credits.getBalance("carol@example.com");
    expect(balanceAfterBooking?.credits).toBe(4);

    // Reschedule to a new slot
    const rescheduled = await service.createBooking({
      ...packInput(24),
      rescheduleToken: original.cancelToken,
    });

    // New booking exists
    expect(rescheduled.eventId).toBeDefined();
    expect(rescheduled.cancelToken).not.toBe(original.cancelToken);

    // Old cancel token is consumed
    const oldRecord = await bookingRepo.findByCancelToken(original.cancelToken);
    expect(oldRecord).toBeNull();

    // Credit balance is back to 4 (restore from old + decrement for new = net 0)
    const balanceAfterReschedule = await credits.getBalance("carol@example.com");
    expect(balanceAfterReschedule?.credits).toBe(4);
  });

  it("does not change credit balance when rescheduling a non-pack session", async () => {
    const creditsRepo = new InMemoryCreditsRepository();
    const credits     = buildTestCreditService({ credits: creditsRepo });
    await credits.addCredits(creditParams);

    const bookingRepo = new InMemoryBookingRepository();
    const service     = buildTestBookingService({ credits, bookings: bookingRepo });

    const original = await service.createBooking(freeInput(6));

    const balanceBefore = await credits.getBalance("carol@example.com");
    expect(balanceBefore?.credits).toBe(5); // free sessions don't decrement

    await service.createBooking({
      ...freeInput(24),
      rescheduleToken: original.cancelToken,
    });

    const balanceAfter = await credits.getBalance("carol@example.com");
    expect(balanceAfter?.credits).toBe(5); // still unchanged
  });
});

describe("Reschedule flow — error cases", () => {
  it("throws INVALID_RESCHEDULE_TOKEN for an unknown token", async () => {
    const service = buildTestBookingService();

    await expect(
      service.createBooking({ ...packInput(24), rescheduleToken: "bad-token" }),
    ).rejects.toMatchObject({ code: "INVALID_RESCHEDULE_TOKEN" });
  });

  it("throws SESSION_TYPE_MISMATCH when session type differs from original", async () => {
    const creditsRepo = new InMemoryCreditsRepository();
    const credits     = buildTestCreditService({ credits: creditsRepo });
    await credits.addCredits(creditParams);

    const bookingRepo = new InMemoryBookingRepository();
    const service     = buildTestBookingService({ credits, bookings: bookingRepo });
    const original    = await service.createBooking(packInput(6));

    await expect(
      service.createBooking({
        ...packInput(24),
        sessionType:     "session1h", // wrong type
        rescheduleToken: original.cancelToken,
      }),
    ).rejects.toMatchObject({ code: "SESSION_TYPE_MISMATCH" });
  });

  it("throws OUTSIDE_RESCHEDULE_WINDOW when original session starts within 2 hours", async () => {
    const creditsRepo = new InMemoryCreditsRepository();
    const credits     = buildTestCreditService({ credits: creditsRepo });
    await credits.addCredits(creditParams);

    const bookingRepo = new InMemoryBookingRepository();
    const service     = buildTestBookingService({ credits, bookings: bookingRepo });
    const original    = await service.createBooking(packInput(6));

    // Patch the stored record's startsAt to simulate imminent session
    const record = await bookingRepo.findByCancelToken(original.cancelToken);
    if (record) {
      (record as { startsAt: string }).startsAt = new Date(Date.now() + 30 * 60_000).toISOString();
    }

    await expect(
      service.createBooking({ ...packInput(24), rescheduleToken: original.cancelToken }),
    ).rejects.toMatchObject({ code: "OUTSIDE_RESCHEDULE_WINDOW" });
  });

  it("prevents double-reschedule — second attempt fails after token is consumed", async () => {
    const creditsRepo = new InMemoryCreditsRepository();
    const credits     = buildTestCreditService({ credits: creditsRepo });
    await credits.addCredits(creditParams);

    const bookingRepo = new InMemoryBookingRepository();
    const service     = buildTestBookingService({ credits, bookings: bookingRepo });
    const original    = await service.createBooking(packInput(6));

    // First reschedule succeeds
    await service.createBooking({ ...packInput(24), rescheduleToken: original.cancelToken });

    // Second attempt with the same token is rejected
    await expect(
      service.createBooking({ ...packInput(36), rescheduleToken: original.cancelToken }),
    ).rejects.toMatchObject({ code: "INVALID_RESCHEDULE_TOKEN" });
  });
});

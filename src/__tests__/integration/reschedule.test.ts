// TEST-01: Integration tests for the reschedule flow.
// Verifies that rescheduling atomically replaces a booking and correctly handles
// credit state for pack vs non-pack sessions.
// REFACTOR-R4-P1-01: slots come from fixtures/slots (aligned, the right length).
// REFACTOR-R4-P1-03: a pack reschedule moves the original's credit (no restore + decrement);
// a failure after the old token's claim leaves the original booking in place, retryable.
jest.mock("@/lib/availability-cache", () => ({
  invalidate: jest.fn().mockResolvedValue(undefined),
  getCached:  jest.fn().mockResolvedValue(null),
  setCached:  jest.fn().mockResolvedValue(undefined),
}));

import { InMemoryCreditsRepository } from "../fixtures/InMemoryCreditsRepository";
import { InMemoryBookingRepository } from "../fixtures/InMemoryBookingRepository";
import { InMemorySessionRepository } from "../fixtures/InMemorySessionRepository";
import { InMemoryAuditRepository } from "../fixtures/InMemoryAuditRepository";
import { FakeCalendarClient } from "../fixtures/FakeCalendarClient";
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

    // Credit balance is still 4 — REFACTOR-R4-P1-03: the original's credit moves to the
    // new booking (no restore, no decrement)
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

// ─── REFACTOR-R4-P1-03 ────────────────────────────────────────────────────────

const paidInput = (hoursAhead = 6) => ({
  email:       "carol@example.com",
  name:        "Carol",
  ...alignedSlot("session1h", hoursAhead),
  sessionType: "session1h" as const,
});

async function bookOriginalPack() {
  const creditsRepo = new InMemoryCreditsRepository();
  const audit       = new InMemoryAuditRepository();
  const credits     = buildTestCreditService({ credits: creditsRepo, audit });
  await credits.addCredits(creditParams);

  const bookings = new InMemoryBookingRepository();
  const sessions = new InMemorySessionRepository();
  const calendar = new FakeCalendarClient();
  const service  = buildTestBookingService({ credits, bookings, sessions, calendar });
  const original = await service.createBooking(packInput(6));
  return { credits, audit, bookings, sessions, calendar, service, original };
}

type Ctx = Awaited<ReturnType<typeof bookOriginalPack>>;

/** The original is confirmed, its ORIGINAL tokens work, and nothing of it was deleted. */
async function expectOriginalIntact({ bookings, sessions, calendar, credits, original }: Ctx) {
  expect((await bookings.findByEventId(original.eventId))?.status).toBe("confirmed");
  expect(await bookings.findByCancelToken(original.cancelToken)).toMatchObject({ eventId: original.eventId });
  expect(await bookings.findByJoinToken(original.joinToken)).toMatchObject({ eventId: original.eventId });
  expect(calendar.deletedEventIds).not.toContain(original.eventId);
  expect(await sessions.findByEventId(original.eventId)).not.toBeNull();
  expect(bookings.getPendingTerminations().has(original.eventId)).toBe(true);
  expect((await credits.getBalance("carol@example.com"))?.credits).toBe(4);
}

describe("REFACTOR-R4-P1-03: a failure after the claim keeps the original booking", () => {
  it("calendar insert fails → original reinstated, and the same link retries successfully", async () => {
    const ctx = await bookOriginalPack();
    ctx.calendar.createEventShouldFail = true;

    await expect(
      ctx.service.createBooking({ ...packInput(24), rescheduleToken: ctx.original.cancelToken }),
    ).rejects.toThrow("simulated failure");
    await expectOriginalIntact(ctx);

    ctx.calendar.createEventShouldFail = false;
    const retried = await ctx.service.createBooking({ ...packInput(24), rescheduleToken: ctx.original.cancelToken });
    expect((await ctx.bookings.findByEventId(retried.eventId))?.status).toBe("confirmed");
    expect((await ctx.bookings.findByEventId(ctx.original.eventId))?.status).toBe("cancelled");
  });

  it("booking insert fails → original reinstated; the new calendar event is deleted", async () => {
    const ctx = await bookOriginalPack();
    ctx.bookings.createBookingShouldFail = true;

    await expect(
      ctx.service.createBooking({ ...packInput(24), rescheduleToken: ctx.original.cancelToken }),
    ).rejects.toThrow("simulated insert failure");
    await expectOriginalIntact(ctx);
    expect(ctx.calendar.deletedEventIds).toEqual(["evt-1"]); // the new event, and only it

    ctx.bookings.createBookingShouldFail = false;
    await expect(
      ctx.service.createBooking({ ...packInput(24), rescheduleToken: ctx.original.cancelToken }),
    ).resolves.toMatchObject({ eventId: "evt-2" });
  });

  it("Zoom session insert fails → the new booking is cancelled and the original reinstated", async () => {
    const ctx = await bookOriginalPack();
    jest.spyOn(ctx.sessions, "createSession").mockRejectedValueOnce(new Error("zoom_sessions insert failed"));

    await expect(
      ctx.service.createBooking({ ...packInput(24), rescheduleToken: ctx.original.cancelToken }),
    ).rejects.toThrow("zoom_sessions insert failed");
    await expectOriginalIntact(ctx);
    expect((await ctx.bookings.findByEventId("evt-1"))?.status).toBe("cancelled");
    expect(ctx.calendar.deletedEventIds).toEqual(["evt-1"]);
  });
});

describe("REFACTOR-R4-P1-03: a successful reschedule", () => {
  it("cancels the original and deletes its event, Zoom session and pending termination", async () => {
    const { bookings, sessions, calendar, service, original } = await bookOriginalPack();

    const rescheduled = await service.createBooking({ ...packInput(24), rescheduleToken: original.cancelToken });

    expect((await bookings.findByEventId(original.eventId))?.status).toBe("cancelled");
    expect(await bookings.findByCancelToken(original.cancelToken)).toBeNull();
    expect(calendar.deletedEventIds).toEqual([original.eventId]);
    expect(await sessions.findByEventId(original.eventId)).toBeNull();
    expect(bookings.getPendingTerminations().has(original.eventId)).toBe(false);

    expect((await bookings.findByEventId(rescheduled.eventId))?.status).toBe("confirmed");
    expect(await sessions.findByEventId(rescheduled.eventId)).not.toBeNull();
    expect(bookings.getPendingTerminations().has(rescheduled.eventId)).toBe(true);
  });

  it("moves a pack class's credit: same pack link, balance unchanged, no decrement/restore audit rows", async () => {
    const { credits, audit, bookings, service, original } = await bookOriginalPack();
    const originalPackId = (await bookings.findByCancelToken(original.cancelToken))?.creditPackId;
    expect(originalPackId).toBeDefined();
    const auditBefore = audit.getAll("carol@example.com").length;

    const rescheduled = await service.createBooking({ ...packInput(24), rescheduleToken: original.cancelToken });

    expect((await bookings.findByCancelToken(rescheduled.cancelToken))?.creditPackId).toBe(originalPackId);
    expect((await credits.getBalance("carol@example.com"))?.credits).toBe(4);
    expect(audit.getAll("carol@example.com")).toHaveLength(auditBefore);
  });

  it("carries a paid class's PaymentIntent: findByStripePaymentId returns the NEW booking", async () => {
    const bookings = new InMemoryBookingRepository();
    const service  = buildTestBookingService({ bookings });
    const original = await service.createBooking({ ...paidInput(6), stripePaymentId: "pi_paid_001" });

    // /api/book reschedules a paid class without a PaymentIntent in the request.
    const rescheduled = await service.createBooking({ ...paidInput(24), rescheduleToken: original.cancelToken });

    expect((await bookings.findByCancelToken(rescheduled.cancelToken))?.stripePaymentId).toBe("pi_paid_001");
    expect((await bookings.findByStripePaymentId("pi_paid_001"))?.eventId).toBe(rescheduled.eventId);
    expect(await bookings.hasBookingForPayment("pi_paid_001")).toBe(true);
  });
});

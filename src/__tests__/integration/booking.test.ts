// TEST-01: Integration tests for the booking flow.
// Uses in-memory repositories and fake clients to exercise real service logic
// without HTTP or external I/O. Tests state transitions that unit mocks cannot verify.
// REFACTOR-R4-P1-01: slots come from fixtures/slots (aligned, the right length); the
// "server-side slot validation" suite checks that a rejected slot has no side effects.
jest.mock("@/lib/availability-cache", () => ({
  invalidate: jest.fn().mockResolvedValue(undefined),
  getCached:  jest.fn().mockResolvedValue(null),
  setCached:  jest.fn().mockResolvedValue(undefined),
}));

import { InsufficientCreditsError } from "@/domain/errors";
import { InMemoryCreditsRepository } from "../fixtures/InMemoryCreditsRepository";
import { InMemoryBookingRepository } from "../fixtures/InMemoryBookingRepository";
import { FakeCalendarClient }        from "../fixtures/FakeCalendarClient";
import { FakeEmailClient }           from "../fixtures/FakeEmailClient";
import {
  buildTestCreditService,
  buildTestBookingService,
  buildTestScheduleService,
} from "../fixtures/services";
import { alignedSlot, slotAtLocal } from "../fixtures/slots";

// Slots must be ≥5 h in the future (minNoticeHours = 5); use +6 to be safe.
const packInput = (hoursAhead = 6) => ({
  email:       "alice@example.com",
  name:        "Alice",
  ...alignedSlot("pack", hoursAhead),
  sessionType: "pack" as const,
});

const freeInput = (hoursAhead = 6) => ({
  ...packInput(hoursAhead),
  ...alignedSlot("free15min", hoursAhead),
  sessionType: "free15min" as const,
});

const creditParams = {
  email:           "alice@example.com",
  name:            "Alice",
  amount:          5,
  packLabel:       "Pack 5 clases",
  stripeSessionId: "pi_test_001",
  expiresAt:       new Date(Date.now() + 180 * 24 * 60 * 60_000).toISOString(),
};

describe("Booking flow — pack session success", () => {
  it("decrements credit, records calendar event, returns tokens, and sends two emails", async () => {
    const creditsRepo = new InMemoryCreditsRepository();
    const credits     = buildTestCreditService({ credits: creditsRepo });
    await credits.addCredits(creditParams);

    const calendar = new FakeCalendarClient();
    const email    = new FakeEmailClient();
    const service  = buildTestBookingService({ credits, calendar, email });

    const result = await service.createBooking(packInput());

    expect(result.eventId).toBeDefined();
    expect(result.cancelToken).toBeDefined();
    expect(result.joinToken).toBeDefined();
    expect(result.emailFailed).toBe(false);

    const balance = await credits.getBalance("alice@example.com");
    expect(balance?.credits).toBe(4);

    expect(calendar.createdEvents).toHaveLength(1);
    expect(email.sent).toHaveLength(2);
    expect(email.sent.map(e => e.type)).toEqual(
      expect.arrayContaining(["confirmation", "newBookingNotification"]),
    );
  });

  it("writes a pending_termination row on booking", async () => {
    const credits     = buildTestCreditService();
    await credits.addCredits(creditParams);
    const bookingRepo = new InMemoryBookingRepository();
    const service     = buildTestBookingService({ credits, bookings: bookingRepo });

    await service.createBooking(packInput());

    expect(bookingRepo.getPendingTerminations().size).toBe(1);
  });

  it("stores the booking so it is findable by cancelToken", async () => {
    const creditsRepo = new InMemoryCreditsRepository();
    const bookingRepo = new InMemoryBookingRepository();
    const credits     = buildTestCreditService({ credits: creditsRepo });
    await credits.addCredits(creditParams);

    const service = buildTestBookingService({ credits, bookings: bookingRepo });
    const result  = await service.createBooking(packInput());

    const found = await bookingRepo.findByCancelToken(result.cancelToken);
    expect(found).not.toBeNull();
    expect(found?.email).toBe("alice@example.com");
  });
});

describe("Booking flow — credit guard", () => {
  it("throws InsufficientCreditsError and creates no calendar event when credits = 0", async () => {
    const calendar = new FakeCalendarClient();
    const service  = buildTestBookingService({ calendar });

    await expect(service.createBooking(packInput())).rejects.toThrow(InsufficientCreditsError);
    expect(calendar.createdEvents).toHaveLength(0);
  });

  it("restores credit when calendar creation fails (pack)", async () => {
    const creditsRepo = new InMemoryCreditsRepository();
    const credits     = buildTestCreditService({ credits: creditsRepo });
    await credits.addCredits(creditParams);

    const calendar    = new FakeCalendarClient();
    calendar.shouldFail = true;
    const service = buildTestBookingService({ credits, calendar });

    await expect(service.createBooking(packInput())).rejects.toThrow();

    const balance = await credits.getBalance("alice@example.com");
    expect(balance?.credits).toBe(5); // restored
  });

  it("does NOT restore credit when calendar fails on a free session", async () => {
    const creditsRepo = new InMemoryCreditsRepository();
    const credits     = buildTestCreditService({ credits: creditsRepo });
    await credits.addCredits(creditParams);

    const calendar      = new FakeCalendarClient();
    calendar.shouldFail = true;
    const service = buildTestBookingService({ credits, calendar });

    await expect(
      service.createBooking(freeInput()),
    ).rejects.toThrow();

    const balance = await credits.getBalance("alice@example.com");
    expect(balance?.credits).toBe(5); // untouched — free session never decremented
  });

  it("does not decrement credits for free15min sessions", async () => {
    const creditsRepo = new InMemoryCreditsRepository();
    const credits     = buildTestCreditService({ credits: creditsRepo });
    await credits.addCredits(creditParams);

    const calendar = new FakeCalendarClient();
    const service  = buildTestBookingService({ credits, calendar });

    await service.createBooking(freeInput());

    const balance = await credits.getBalance("alice@example.com");
    expect(balance?.credits).toBe(5); // unchanged
  });
});

describe("Booking flow — concurrency", () => {
  it("handles two simultaneous bookings on a single credit — exactly one succeeds", async () => {
    const creditsRepo = new InMemoryCreditsRepository();
    const credits     = buildTestCreditService({ credits: creditsRepo });
    await credits.addCredits({ ...creditParams, amount: 1, stripeSessionId: "pi_conc_001" });

    // Use a shared booking repo so both calls share the same state
    const bookingRepo = new InMemoryBookingRepository();
    const service     = buildTestBookingService({ credits, bookings: bookingRepo });

    const results = await Promise.allSettled([
      service.createBooking(packInput()),
      service.createBooking(packInput(8)),
    ]);

    const successes = results.filter(r => r.status === "fulfilled");
    const failures  = results.filter(r => r.status === "rejected");

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect((failures[0] as PromiseRejectedResult).reason).toBeInstanceOf(InsufficientCreditsError);
  });
});

describe("REFACTOR-R4-P1-01: server-side slot validation", () => {
  async function withCredits() {
    const creditsRepo = new InMemoryCreditsRepository();
    const credits     = buildTestCreditService({ credits: creditsRepo });
    await credits.addCredits(creditParams);
    return credits;
  }

  it("rejects an off-hours slot on the real schedule — no event, no row, no credit spent", async () => {
    const credits     = await withCredits();
    const calendar    = new FakeCalendarClient();
    const bookingRepo = new InMemoryBookingRepository();
    const service     = buildTestBookingService({
      credits, calendar, bookings: bookingRepo, schedule: buildTestScheduleService(), // seeded hours
    });

    // 03:00 in Madrid, two days out: outside every block of the seeded schedule.
    await expect(service.createBooking({ ...packInput(), ...slotAtLocal("pack", 2, "03:00") }))
      .rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });

    expect(calendar.createdEvents).toHaveLength(0);
    expect(await bookingRepo.hasAnyBooking("alice@example.com")).toBe(false);
    expect((await credits.getBalance("alice@example.com"))?.credits).toBe(5);
  });

  it("rejects a pack class stretched over 4 hours (INVALID_SLOT) — no credit spent", async () => {
    const credits  = await withCredits();
    const calendar = new FakeCalendarClient();
    const service  = buildTestBookingService({ credits, calendar });
    const input    = packInput();

    await expect(service.createBooking({
      ...input, endIso: new Date(new Date(input.startIso).getTime() + 4 * 3_600_000).toISOString(),
    })).rejects.toMatchObject({ code: "INVALID_SLOT" });

    expect(calendar.createdEvents).toHaveLength(0);
    expect((await credits.getBalance("alice@example.com"))?.credits).toBe(5);
  });
});

describe("REFACTOR-R4-P1-01: free-call cap", () => {
  it("allows one non-cancelled free call; cancelling it frees the allowance", async () => {
    const bookingRepo = new InMemoryBookingRepository();
    const service     = buildTestBookingService({ bookings: bookingRepo });

    const first = await service.createBooking(freeInput(6));

    await expect(service.createBooking(freeInput(30)))
      .rejects.toMatchObject({ code: "FREE_SESSION_ALREADY_USED" });

    await service.cancelByToken(first.cancelToken);

    await expect(service.createBooking(freeInput(30))).resolves.toMatchObject({ eventId: expect.any(String) });
  });

  it("counts a completed free call against the cap", async () => {
    const bookingRepo = new InMemoryBookingRepository();
    const service     = buildTestBookingService({ bookings: bookingRepo });

    const first = await service.createBooking(freeInput(6));
    await bookingRepo.markCompleted(first.eventId);

    await expect(service.createBooking(freeInput(30)))
      .rejects.toMatchObject({ code: "FREE_SESSION_ALREADY_USED" });
  });
});

// TEST-01: Integration tests for the booking flow.
// Uses in-memory repositories and fake clients to exercise real service logic
// without HTTP or external I/O. Tests state transitions that unit mocks cannot verify.
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
import { FakeScheduler }             from "../fixtures/FakeScheduler";
import {
  buildTestCreditService,
  buildTestBookingService,
} from "../fixtures/services";

// Slots must be ≥5 h in the future (minNoticeHours = 5); use +6 to be safe.
const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

const packInput = () => ({
  email:       "alice@example.com",
  name:        "Alice",
  startIso:    hoursFromNow(6),
  endIso:      hoursFromNow(7),
  sessionType: "pack" as const,
});

const creditParams = {
  email:           "alice@example.com",
  name:            "Alice",
  amount:          5,
  packLabel:       "Pack 5 clases",
  stripeSessionId: "pi_test_001",
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

  it("schedules a Zoom cleanup job via the scheduler", async () => {
    const credits   = buildTestCreditService();
    await credits.addCredits(creditParams);
    const scheduler = new FakeScheduler();
    const service   = buildTestBookingService({ credits, scheduler });

    await service.createBooking(packInput());

    expect(scheduler.scheduled).toHaveLength(1);
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
      service.createBooking({ ...packInput(), sessionType: "free15min" }),
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

    await service.createBooking({ ...packInput(), sessionType: "free15min" });

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
      service.createBooking({ ...packInput(), startIso: hoursFromNow(8), endIso: hoursFromNow(9) }),
    ]);

    const successes = results.filter(r => r.status === "fulfilled");
    const failures  = results.filter(r => r.status === "rejected");

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect((failures[0] as PromiseRejectedResult).reason).toBeInstanceOf(InsufficientCreditsError);
  });
});

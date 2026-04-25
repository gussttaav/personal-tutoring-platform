// TEST-01: Integration tests for the cancellation flow.
// Verifies real token lifecycle and credit restoration using in-memory state.
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

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

const creditParams = {
  email:           "bob@example.com",
  name:            "Bob",
  amount:          3,
  packLabel:       "Pack 5 clases",
  stripeSessionId: "pi_cancel_001",
};

const packInput = () => ({
  email:       "bob@example.com",
  name:        "Bob",
  startIso:    hoursFromNow(6),
  endIso:      hoursFromNow(7),
  sessionType: "pack" as const,
});

async function bookOnePack() {
  const creditsRepo = new InMemoryCreditsRepository();
  const bookingRepo = new InMemoryBookingRepository();
  const credits     = buildTestCreditService({ credits: creditsRepo });
  await credits.addCredits(creditParams);

  const service = buildTestBookingService({ credits, bookings: bookingRepo });
  const result  = await service.createBooking(packInput());

  return { service, credits, creditsRepo, bookingRepo, ...result };
}

describe("Cancellation flow — pack session", () => {
  it("restores credit and removes cancel token after cancelling a pack booking", async () => {
    const { service, credits, bookingRepo, cancelToken } = await bookOnePack();

    const output = await service.cancelByToken(cancelToken);

    expect(output.creditsRestored).toBe(true);

    const balance = await credits.getBalance("bob@example.com");
    expect(balance?.credits).toBe(3); // back to original

    // Token is consumed — a second lookup should fail
    const found = await bookingRepo.findByCancelToken(cancelToken);
    expect(found).toBeNull();
  });

  it("prevents double-cancellation — second call fails after token is consumed", async () => {
    const { service, cancelToken } = await bookOnePack();

    await service.cancelByToken(cancelToken);

    // After sequential cancel, the token is removed from the store so the
    // second lookup returns null → INVALID_CANCEL_TOKEN (not CANCEL_TOKEN_CONSUMED,
    // which is reserved for concurrent races where both threads pass the initial
    // findByCancelToken check before one atomically deletes the token).
    await expect(service.cancelByToken(cancelToken)).rejects.toMatchObject({
      code: "INVALID_CANCEL_TOKEN",
    });
  });
});

describe("Cancellation flow — non-pack session", () => {
  it("does not restore credits when cancelling a free15min session", async () => {
    const creditsRepo = new InMemoryCreditsRepository();
    const credits     = buildTestCreditService({ credits: creditsRepo });
    // Even with credits, a free session should not affect them
    await credits.addCredits(creditParams);

    const bookingRepo = new InMemoryBookingRepository();
    const service     = buildTestBookingService({ credits, bookings: bookingRepo });
    const { cancelToken } = await service.createBooking({
      ...packInput(),
      sessionType: "free15min",
    });

    const output = await service.cancelByToken(cancelToken);

    expect(output.creditsRestored).toBe(false);
    const balance = await credits.getBalance("bob@example.com");
    expect(balance?.credits).toBe(3); // unchanged
  });
});

describe("Cancellation flow — error cases", () => {
  it("throws INVALID_CANCEL_TOKEN for an unknown token", async () => {
    const service = buildTestBookingService();
    await expect(service.cancelByToken("nonexistent-token")).rejects.toMatchObject({
      code: "INVALID_CANCEL_TOKEN",
    });
  });

  it("throws OUTSIDE_CANCEL_WINDOW when session starts within 2 hours", async () => {
    const creditsRepo = new InMemoryCreditsRepository();
    const credits     = buildTestCreditService({ credits: creditsRepo });
    await credits.addCredits(creditParams);

    const bookingRepo = new InMemoryBookingRepository();
    const service     = buildTestBookingService({ credits, bookings: bookingRepo });

    // Book a slot that starts in only 1 hour — will be within the 2h cancel window
    const { cancelToken } = await service.createBooking({
      ...packInput(),
      startIso: hoursFromNow(6),
      endIso:   hoursFromNow(7),
    });

    // Now manipulate the stored record's startsAt to simulate a session starting in 1h
    // We do this by directly patching the in-memory repo's internal map via the cancel token
    const record = await bookingRepo.findByCancelToken(cancelToken);
    if (record) {
      (record as { startsAt: string }).startsAt = hoursFromNow(1);
    }

    await expect(service.cancelByToken(cancelToken)).rejects.toMatchObject({
      code: "OUTSIDE_CANCEL_WINDOW",
    });
  });
});

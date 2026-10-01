// TEST-01: Integration tests for the cancellation flow.
// Verifies real token lifecycle and credit restoration using in-memory state.
// REFACTOR-R4-P1-01: slots come from fixtures/slots (aligned, the right length).
// REFACTOR-R4-P1-04: the booking fake now restores the credit itself (it mirrors the
// cancel_booking RPC), so it is built with the credits fake. New cases: an expired pack
// (creditsRestored false end to end), a failed RPC (booking still cancellable), and two
// concurrent cancels (one wins, one credit).
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
import { FakeEmailClient } from "../fixtures/FakeEmailClient";

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

const creditParams = {
  email:           "bob@example.com",
  name:            "Bob",
  amount:          3,
  packLabel:       "Pack 5 clases",
  stripeSessionId: "pi_cancel_001",
  expiresAt:       new Date(Date.now() + 180 * 24 * 60 * 60_000).toISOString(),
};

const packInput = () => ({
  email:       "bob@example.com",
  name:        "Bob",
  ...alignedSlot("pack", 6),
  sessionType: "pack" as const,
});

async function bookOnePack() {
  const creditsRepo = new InMemoryCreditsRepository();
  const bookingRepo = new InMemoryBookingRepository(creditsRepo);
  const credits     = buildTestCreditService({ credits: creditsRepo });
  await credits.addCredits(creditParams);

  const email   = new FakeEmailClient();
  const service = buildTestBookingService({ credits, bookings: bookingRepo, email });
  const result  = await service.createBooking(packInput());

  return { service, credits, creditsRepo, bookingRepo, email, ...result };
}

const cancellationEmail = (email: FakeEmailClient) =>
  email.sent.find(e => e.type === "cancellationConfirmation")?.params as { creditsRestored: boolean } | undefined;

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

  // REFACTOR-R4-P1-04
  it("returns the credit to the pack the class was paid from", async () => {
    const { service, creditsRepo, bookingRepo, cancelToken } = await bookOnePack();
    const record = await bookingRepo.findByCancelToken(cancelToken);
    expect(record?.creditPackId).toBe(creditsRepo.packIdOf("bob@example.com"));

    const restore = jest.spyOn(creditsRepo, "restoreCreditToPack");
    await service.cancelByToken(cancelToken);

    expect(restore).toHaveBeenCalledWith(record!.creditPackId);
  });

  it("an expired pack gets nothing back — creditsRestored is false in the result AND the email", async () => {
    const { service, credits, creditsRepo, email, cancelToken } = await bookOnePack();
    creditsRepo.setExpiresAt("bob@example.com", new Date(Date.now() - 60_000).toISOString());

    const output = await service.cancelByToken(cancelToken);

    expect(output.creditsRestored).toBe(false);
    expect(cancellationEmail(email)?.creditsRestored).toBe(false);
    expect((await credits.getBalance("bob@example.com"))?.credits).toBe(2); // not restored
  });

  it("a failed cancel RPC leaves the booking confirmed and its link working", async () => {
    const { service, credits, bookingRepo, cancelToken, eventId } = await bookOnePack();

    bookingRepo.cancelByTokenShouldFail = true;
    await expect(service.cancelByToken(cancelToken)).rejects.toThrow("simulated RPC failure");
    expect((await bookingRepo.findByEventId(eventId))?.status).toBe("confirmed");
    expect(await bookingRepo.findByCancelToken(cancelToken)).not.toBeNull();
    expect((await credits.getBalance("bob@example.com"))?.credits).toBe(2);

    // The student retries the same link: it works, and the credit comes back once.
    bookingRepo.cancelByTokenShouldFail = false;
    await expect(service.cancelByToken(cancelToken)).resolves.toMatchObject({ creditsRestored: true });
    expect((await credits.getBalance("bob@example.com"))?.credits).toBe(3);
  });

  it("two concurrent cancels with the same token: one wins, one credit restored", async () => {
    const { service, credits, cancelToken } = await bookOnePack();

    const results = await Promise.allSettled([
      service.cancelByToken(cancelToken),
      service.cancelByToken(cancelToken),
    ]);

    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toMatchObject({ code: "CANCEL_TOKEN_CONSUMED" });
    expect((await credits.getBalance("bob@example.com"))?.credits).toBe(3); // 2 + exactly one
  });
});

describe("Cancellation flow — non-pack session", () => {
  it("does not restore credits when cancelling a free15min session", async () => {
    const creditsRepo = new InMemoryCreditsRepository();
    const credits     = buildTestCreditService({ credits: creditsRepo });
    // Even with credits, a free session should not affect them
    await credits.addCredits(creditParams);

    const bookingRepo = new InMemoryBookingRepository(creditsRepo);
    const service     = buildTestBookingService({ credits, bookings: bookingRepo });
    const { cancelToken } = await service.createBooking({
      ...packInput(),
      ...alignedSlot("free15min", 6),
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
    const { cancelToken } = await service.createBooking(packInput());

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

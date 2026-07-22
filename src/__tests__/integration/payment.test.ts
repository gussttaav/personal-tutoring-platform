// TEST-01: Integration tests for the payment webhook flow.
// Tests that PaymentService correctly adds credits, creates bookings, and writes
// dead-letter entries using in-memory state.

// Mock getAvailableSlots — PaymentService.processSingleSession calls it directly
// (not injected) for the slot re-check. REFACTOR-R3-P1-02: the re-check now fails
// CLOSED, so a rejection propagates instead of being swallowed. Each single-session
// test sets the resolved value to the slot it books (defaults to "slot taken").
jest.mock("@/infrastructure/google", () => ({
  getAvailableSlots: jest.fn().mockResolvedValue([]),
}));
jest.mock("@/lib/availability-cache", () => ({
  invalidate: jest.fn().mockResolvedValue(undefined),
  getCached:  jest.fn().mockResolvedValue(null),
  setCached:  jest.fn().mockResolvedValue(undefined),
}));

// Prevent writeDeadLetter from firing real Resend API calls when NOTIFY_EMAIL
// and RESEND_API_KEY are set in the local environment.
global.fetch = jest.fn().mockResolvedValue({});

import { InMemoryCreditsRepository } from "../fixtures/InMemoryCreditsRepository";
import { InMemoryUserRepository }    from "../fixtures/InMemoryUserRepository";
import { FakeCalendarClient }        from "../fixtures/FakeCalendarClient";
import { InMemoryPaymentRepository } from "../fixtures/InMemoryPaymentRepository";
import { FakeStripeClient }          from "../fixtures/FakeStripeClient";
import { InMemoryPricingRepository } from "../fixtures/InMemoryPricingRepository";
import { InMemoryAuditRepository }   from "../fixtures/InMemoryAuditRepository";
import {
  buildTestCreditService,
  buildTestBookingService,
  buildTestPaymentService,
  buildTestScheduleService,
} from "../fixtures/services";
import { PaymentService } from "@/services/PaymentService";
import { PricingService } from "@/services/PricingService";
import { UserService }    from "@/services/UserService";
import { getAvailableSlots } from "@/infrastructure/google";

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

// REFACTOR-R3-P1-02: the slot re-check fails closed, so single-session tests must
// present the booked slot as still free (getAvailableSlots resolves with it).
const slotFree = (startIso: string) =>
  (getAvailableSlots as jest.Mock).mockResolvedValue([{ start: startIso }]);

function makePaymentService(overrides: {
  creditsRepo?: InMemoryCreditsRepository;
  calendar?:    FakeCalendarClient;
  paymentRepo?: InMemoryPaymentRepository;
} = {}) {
  const creditsRepo = overrides.creditsRepo ?? new InMemoryCreditsRepository();
  const credits     = buildTestCreditService({ credits: creditsRepo });
  const calendar    = overrides.calendar ?? new FakeCalendarClient();
  const stripe      = new FakeStripeClient();
  const paymentRepo = overrides.paymentRepo ?? new InMemoryPaymentRepository();
  const userRepo    = new InMemoryUserRepository();
  const bookings    = buildTestBookingService({ credits, calendar });
  const pricing     = new PricingService(new InMemoryPricingRepository(), new InMemoryAuditRepository());
  const schedule    = buildTestScheduleService();
  const service     = new PaymentService(stripe, credits, bookings, paymentRepo, new UserService(userRepo), pricing, schedule);
  return { service, stripe, credits, creditsRepo, calendar, paymentRepo, userRepo };
}

describe("Payment flow — pack webhook", () => {
  it("adds credits to the user after a pack payment_intent.succeeded event", async () => {
    const { service, stripe, credits, paymentRepo } = makePaymentService();

    const event = stripe.buildPackPaymentEvent({
      email:      "dave@example.com",
      name:       "Dave",
      packSize:   5,
      intentId:   "pi_pack_001",
      amountCents: 14900,
    });

    await service.processWebhookEvent(event);

    const balance = await credits.getBalance("dave@example.com");
    expect(balance?.credits).toBe(5);

    // PAYMENTS-AUDIT-01: exactly one audit row, keyed by the credit_packs stripe id.
    expect(paymentRepo.payments).toHaveLength(1);
    expect(paymentRepo.payments[0]).toMatchObject({
      stripePaymentId: "pi_pack_001",
      amountCents:     14900,
      currency:        "eur",
      checkoutType:    "pack",
      status:          "succeeded",
    });
  });

  it("is idempotent — processing the same pack event twice adds credits only once", async () => {
    const { service, stripe, credits, paymentRepo } = makePaymentService();

    const event = stripe.buildPackPaymentEvent({
      email:    "dave@example.com",
      name:     "Dave",
      packSize: 5,
      intentId: "pi_pack_idem_001",
    });

    await service.processWebhookEvent(event);
    await service.processWebhookEvent(event); // duplicate delivery

    const balance = await credits.getBalance("dave@example.com");
    expect(balance?.credits).toBe(5); // not 10

    // PAYMENTS-AUDIT-01: duplicate webhook must not write a second payments row.
    expect(paymentRepo.payments).toHaveLength(1);
  });
});

describe("Payment flow — single-session webhook", () => {
  it("creates a booking after a single-session payment_intent.succeeded event", async () => {
    const { service, stripe, calendar, paymentRepo } = makePaymentService();

    const startIso = hoursFromNow(6);
    const endIso   = hoursFromNow(7);
    slotFree(startIso);

    const event = stripe.buildSingleSessionPaymentEvent({
      email:    "eve@example.com",
      name:     "Eve",
      startIso,
      endIso,
      duration: "1h",
      intentId: "pi_single_001",
    });

    await service.processWebhookEvent(event);

    expect(calendar.createdEvents).toHaveLength(1);
    expect(calendar.createdEvents[0].studentEmail).toBe("eve@example.com");
    expect(await paymentRepo.isProcessed("pi_single_001")).toBe(true);

    // PAYMENTS-AUDIT-01: one audit row, keyed by the booking's stripe_payment_id.
    expect(paymentRepo.payments).toHaveLength(1);
    expect(paymentRepo.payments[0]).toMatchObject({
      stripePaymentId: "pi_single_001",
      amountCents:     4900,
      currency:        "eur",
      checkoutType:    "single",
      status:          "succeeded",
    });
  });

  it("is idempotent — duplicate webhook does not create a second booking", async () => {
    const { service, stripe, calendar, paymentRepo } = makePaymentService();

    const startIso = hoursFromNow(6);
    slotFree(startIso);

    const event = stripe.buildSingleSessionPaymentEvent({
      email:    "eve@example.com",
      name:     "Eve",
      startIso,
      endIso:   hoursFromNow(7),
      duration: "1h",
      intentId: "pi_single_idem_001",
    });

    await service.processWebhookEvent(event);
    await service.processWebhookEvent(event); // duplicate

    expect(calendar.createdEvents).toHaveLength(1); // not 2

    // PAYMENTS-AUDIT-01: duplicate webhook must not write a second payments row.
    expect(paymentRepo.payments).toHaveLength(1);
  });

  it("writes a dead-letter entry when booking creation fails after payment", async () => {
    const calendar = new FakeCalendarClient();
    calendar.shouldFail = true; // simulate calendar outage

    const { service, stripe, paymentRepo, userRepo } = makePaymentService({ calendar });

    const startIso = hoursFromNow(6);
    slotFree(startIso);

    const event = stripe.buildSingleSessionPaymentEvent({
      email:    "frank@example.com",
      name:     "Frank",
      startIso,
      endIso:   hoursFromNow(7),
      duration: "1h",
      intentId: "pi_deadletter_001",
    });

    await service.processWebhookEvent(event); // should not throw — dead-letter path

    const failed = await paymentRepo.listFailedBookings();
    expect(failed).toHaveLength(1);
    expect(failed[0].stripeSessionId).toBe("pi_deadletter_001");

    // userId is the ID the UserService assigned to frank@example.com
    const frankUser = await userRepo.findByEmail("frank@example.com");
    expect(failed[0].userId).toBe(frankUser?.id);
  });
});

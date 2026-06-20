// TEST-01: Integration tests for the payment webhook flow.
// Tests that PaymentService correctly adds credits, creates bookings, and writes
// dead-letter entries using in-memory state.

// Mock getAvailableSlots to simulate the absence of Google Calendar credentials in
// the test environment. PaymentService.processSingleSession calls it directly (not
// injected) and treats any failure as "slot still available" via .catch(() => null).
jest.mock("@/infrastructure/google", () => ({
  getAvailableSlots: jest.fn().mockRejectedValue(new Error("no credentials in test")),
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
} from "../fixtures/services";
import { PaymentService } from "@/services/PaymentService";
import { PricingService } from "@/services/PricingService";
import { UserService }    from "@/services/UserService";

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

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
  const service     = new PaymentService(stripe, credits, bookings, paymentRepo, new UserService(userRepo), pricing);
  return { service, stripe, credits, creditsRepo, calendar, paymentRepo, userRepo };
}

describe("Payment flow — pack webhook", () => {
  it("adds credits to the user after a pack payment_intent.succeeded event", async () => {
    const { service, stripe, credits } = makePaymentService();

    const event = stripe.buildPackPaymentEvent({
      email:    "dave@example.com",
      name:     "Dave",
      packSize: 5,
      intentId: "pi_pack_001",
    });

    await service.processWebhookEvent(event);

    const balance = await credits.getBalance("dave@example.com");
    expect(balance?.credits).toBe(5);
  });

  it("is idempotent — processing the same pack event twice adds credits only once", async () => {
    const { service, stripe, credits } = makePaymentService();

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
  });
});

describe("Payment flow — single-session webhook", () => {
  it("creates a booking after a single-session payment_intent.succeeded event", async () => {
    const { service, stripe, calendar, paymentRepo } = makePaymentService();

    const startIso = hoursFromNow(6);
    const endIso   = hoursFromNow(7);

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
  });

  it("is idempotent — duplicate webhook does not create a second booking", async () => {
    const { service, stripe, calendar } = makePaymentService();

    const event = stripe.buildSingleSessionPaymentEvent({
      email:    "eve@example.com",
      name:     "Eve",
      startIso: hoursFromNow(6),
      endIso:   hoursFromNow(7),
      duration: "1h",
      intentId: "pi_single_idem_001",
    });

    await service.processWebhookEvent(event);
    await service.processWebhookEvent(event); // duplicate

    expect(calendar.createdEvents).toHaveLength(1); // not 2
  });

  it("writes a dead-letter entry when booking creation fails after payment", async () => {
    const calendar = new FakeCalendarClient();
    calendar.shouldFail = true; // simulate calendar outage

    const { service, stripe, paymentRepo, userRepo } = makePaymentService({ calendar });

    const event = stripe.buildSingleSessionPaymentEvent({
      email:    "frank@example.com",
      name:     "Frank",
      startIso: hoursFromNow(6),
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

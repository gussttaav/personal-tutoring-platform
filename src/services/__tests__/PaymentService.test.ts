// ARCH-14: Unit tests for PaymentService.
import type { IStripeClient } from "@/infrastructure/stripe/StripeClient";
import type { IPaymentRepository, FailedBookingEntry } from "@/domain/repositories/IPaymentRepository";
import type Stripe from "stripe";
import { PermanentWebhookError } from "@/domain/errors";
import { FakeStripeClient } from "@/__tests__/fixtures/FakeStripeClient";
import { InMemoryPricingRepository } from "@/__tests__/fixtures/InMemoryPricingRepository";
import { InMemoryAuditRepository } from "@/__tests__/fixtures/InMemoryAuditRepository";

// Mock getAvailableSlots before importing PaymentService (direct module import)
const mockGetAvailableSlots = jest.fn();
jest.mock("@/infrastructure/google", () => ({
  getAvailableSlots: (...args: unknown[]) => mockGetAvailableSlots(...args),
}));

// Mock fetch (used by writeDeadLetter for admin notification email)
global.fetch = jest.fn().mockResolvedValue({});

import { PaymentService } from "../PaymentService";
import { CreditService }  from "../CreditService";
import { BookingService } from "../BookingService";
import { UserService }    from "../UserService";
import { PricingService } from "../PricingService";
import { ScheduleService } from "../ScheduleService";
import { InMemoryScheduleRepository } from "@/__tests__/fixtures/InMemoryScheduleRepository";

// ─── Mock factories ───────────────────────────────────────────────────────────

const mockStripe = (): jest.Mocked<IStripeClient> => ({
  verifyWebhookSignature:   jest.fn(),
  createPaymentIntent:      jest.fn(),
  retrievePaymentIntent:    jest.fn(),
  retrieveCheckoutSession:  jest.fn(),
  createRefund:             jest.fn(),
});

// Real PricingService backed by an in-memory repo seeded with default prices.
const makePricing = () =>
  new PricingService(new InMemoryPricingRepository(), new InMemoryAuditRepository());

// Real ScheduleService backed by the seeded in-memory repo.
const makeSchedule = () =>
  new ScheduleService(new InMemoryScheduleRepository(), new InMemoryAuditRepository());

const mockPaymentRepo = (): jest.Mocked<IPaymentRepository> => ({
  isProcessed:          jest.fn(),
  markProcessed:        jest.fn(),
  recordFailedBooking:  jest.fn(),
  listFailedBookings:   jest.fn(),
  clearFailedBooking:   jest.fn(),
  hasFailedBooking:     jest.fn(),
});

// REFACTOR-P3-05: handlePackPayment now also reads getBalance + fires
// broadcastPaymentConfirmed after addCredits, so the mock stubs all three.
const mockCredits = (): jest.Mocked<Pick<CreditService, "addCredits" | "getBalance" | "broadcastPaymentConfirmed">> => ({
  addCredits:                jest.fn(),
  getBalance:                jest.fn().mockResolvedValue(null),
  broadcastPaymentConfirmed: jest.fn(),
});

const mockBookings = (): jest.Mocked<Pick<BookingService, "createBooking">> => ({
  createBooking: jest.fn(),
});

const TEST_USER_ID = "user-uuid-test-123";

const mockUserService = (): jest.Mocked<Pick<UserService, "ensureUser" | "findByEmail">> => ({
  ensureUser:   jest.fn().mockResolvedValue(TEST_USER_ID),
  findByEmail:  jest.fn(),
});

function makeService(overrides?: {
  stripe?:       Partial<jest.Mocked<IStripeClient>>;
  paymentRepo?:  Partial<jest.Mocked<IPaymentRepository>>;
  credits?:      Partial<jest.Mocked<Pick<CreditService, "addCredits" | "getBalance" | "broadcastPaymentConfirmed">>>;
  bookings?:     Partial<jest.Mocked<Pick<BookingService, "createBooking">>>;
  userService?:  Partial<jest.Mocked<Pick<UserService, "ensureUser" | "findByEmail">>>;
}) {
  const stripe      = { ...mockStripe(),       ...overrides?.stripe };
  const paymentRepo = { ...mockPaymentRepo(),  ...overrides?.paymentRepo };
  const credits     = { ...mockCredits(),      ...overrides?.credits };
  const bookings    = { ...mockBookings(),      ...overrides?.bookings };
  const userSvc     = { ...mockUserService(),  ...overrides?.userService };
  const service = new PaymentService(
    stripe as jest.Mocked<IStripeClient>,
    credits as unknown as CreditService,
    bookings as unknown as BookingService,
    paymentRepo,
    userSvc as unknown as UserService,
    makePricing(),
    makeSchedule(),
  );
  return { service, stripe, paymentRepo, credits, bookings, userSvc };
}

// ─── Helpers for fake Stripe events ──────────────────────────────────────────

function fakePackEvent(intentId = "pi_pack_123"): Stripe.Event {
  return {
    id:   "evt_pack",
    type: "payment_intent.succeeded",
    data: {
      object: {
        id:       intentId,
        metadata: {
          checkout_type:  "pack",
          student_email:  "student@test.com",
          student_name:   "Student",
          pack_size:      "5",
        },
      },
    },
  } as unknown as Stripe.Event;
}

function fakeSingleEvent(intentId = "pi_single_123", startIso = "2099-12-01T10:00:00.000Z"): Stripe.Event {
  return {
    id:   "evt_single",
    type: "payment_intent.succeeded",
    data: {
      object: {
        id:       intentId,
        metadata: {
          checkout_type:    "single",
          student_email:    "student@test.com",
          student_name:     "Student",
          session_duration: "1h",
          start_iso:        startIso,
          end_iso:          "2099-12-01T11:00:00.000Z",
          reschedule_token: "",
        },
      },
    },
  } as unknown as Stripe.Event;
}

// ─── processWebhookEvent — pack dispatch ─────────────────────────────────────

describe("PaymentService.processWebhookEvent — pack", () => {
  beforeEach(() => jest.clearAllMocks());

  it("calls credits.addCredits for pack event", async () => {
    const { service, credits } = makeService();
    (credits.addCredits as jest.Mock).mockResolvedValue(undefined);

    await service.processWebhookEvent(fakePackEvent());

    expect(credits.addCredits).toHaveBeenCalledWith(expect.objectContaining({
      email:           "student@test.com",
      amount:          5,
      stripeSessionId: "pi_pack_123",
    }));
  });

  it("throws PermanentWebhookError for pack event with missing email", async () => {
    const { service } = makeService();
    const event = fakePackEvent();
    (event.data.object as unknown as Record<string, unknown>).metadata = {
      checkout_type: "pack", pack_size: "5",
    };

    await expect(service.processWebhookEvent(event)).rejects.toBeInstanceOf(PermanentWebhookError);
  });
});

// ─── REFACTOR-P3-05: broadcast on pack confirmation ──────────────────────────

describe("REFACTOR-P3-05: broadcast on pack confirmation", () => {
  beforeEach(() => jest.clearAllMocks());

  it("broadcasts after credits are written", async () => {
    const { service, credits } = makeService();
    (credits.addCredits as jest.Mock).mockResolvedValue(undefined);

    await service.processWebhookEvent(fakePackEvent("pi_123"));

    expect(credits.broadcastPaymentConfirmed).toHaveBeenCalledWith(
      "pi_123",
      expect.objectContaining({ packSize: expect.any(Number) }),
    );
  });

  it("does not fail the webhook if broadcast throws", async () => {
    const { service, credits } = makeService();
    (credits.addCredits as jest.Mock).mockResolvedValue(undefined);
    (credits.broadcastPaymentConfirmed as jest.Mock).mockRejectedValueOnce(new Error("network"));

    await expect(service.processWebhookEvent(fakePackEvent("pi_123"))).resolves.toBeUndefined();
  });
});

// ─── processWebhookEvent — single-session dispatch ───────────────────────────

describe("PaymentService.processWebhookEvent — single session", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAvailableSlots.mockResolvedValue([{ start: "2099-12-01T10:00:00.000Z" }]);
  });

  it("calls bookings.createBooking for single-session event", async () => {
    const { service, paymentRepo, bookings } = makeService();
    paymentRepo.isProcessed.mockResolvedValue(false);
    paymentRepo.markProcessed.mockResolvedValue(undefined);
    (bookings.createBooking as jest.Mock).mockResolvedValue({ eventId: "evt_1" });

    await service.processWebhookEvent(fakeSingleEvent());

    expect(bookings.createBooking).toHaveBeenCalledWith(expect.objectContaining({
      email:       "student@test.com",
      sessionType: "session1h",
      startIso:    "2099-12-01T10:00:00.000Z",
    }));
    expect(paymentRepo.markProcessed).toHaveBeenCalledWith("pi_single_123");
  });

  it("skips duplicate event (idempotency guard)", async () => {
    const { service, paymentRepo, bookings } = makeService();
    paymentRepo.isProcessed.mockResolvedValue(true);

    await service.processWebhookEvent(fakeSingleEvent());

    expect(bookings.createBooking).not.toHaveBeenCalled();
    expect(paymentRepo.markProcessed).not.toHaveBeenCalled();
  });

  it("issues refund when slot is no longer available", async () => {
    const { service, paymentRepo, stripe, bookings } = makeService();
    paymentRepo.isProcessed.mockResolvedValue(false);
    mockGetAvailableSlots.mockResolvedValue([]); // slot taken

    await service.processWebhookEvent(fakeSingleEvent());

    expect(stripe.createRefund).toHaveBeenCalledWith(expect.objectContaining({
      reason: "duplicate",
    }));
    expect(bookings.createBooking).not.toHaveBeenCalled();
  });

  it("defaults to slot free when getAvailableSlots throws", async () => {
    const { service, paymentRepo, bookings } = makeService();
    paymentRepo.isProcessed.mockResolvedValue(false);
    paymentRepo.markProcessed.mockResolvedValue(undefined);
    mockGetAvailableSlots.mockRejectedValue(new Error("network error"));
    (bookings.createBooking as jest.Mock).mockResolvedValue({ eventId: "evt_1" });

    await service.processWebhookEvent(fakeSingleEvent());

    expect(bookings.createBooking).toHaveBeenCalled();
  });

  it("books a single session with a half-hour start time (:30)", async () => {
    const { service, paymentRepo, bookings } = makeService();
    paymentRepo.isProcessed.mockResolvedValue(false);
    paymentRepo.markProcessed.mockResolvedValue(undefined);
    (bookings.createBooking as jest.Mock).mockResolvedValue({ eventId: "evt_1" });
    mockGetAvailableSlots.mockResolvedValue([{ start: "2099-12-01T10:30:00.000Z" }]);

    await service.processWebhookEvent(fakeSingleEvent("pi_single_456", "2099-12-01T10:30:00.000Z"));

    expect(bookings.createBooking).toHaveBeenCalledWith(expect.objectContaining({
      email:    "student@test.com",
      startIso: "2099-12-01T10:30:00.000Z",
    }));
    expect(mockGetAvailableSlots).toHaveBeenCalledWith("2099-12-01", 60, expect.anything(), 30);
  });

  it("writes dead-letter when booking fails", async () => {
    const { service, paymentRepo, bookings } = makeService();
    paymentRepo.isProcessed.mockResolvedValue(false);
    paymentRepo.recordFailedBooking.mockResolvedValue(undefined);
    (bookings.createBooking as jest.Mock).mockRejectedValue(new Error("calendar API down"));

    await service.processWebhookEvent(fakeSingleEvent());

    expect(paymentRepo.recordFailedBooking).toHaveBeenCalledWith(expect.objectContaining({
      stripeSessionId: "pi_single_123",
      userId:          TEST_USER_ID,
    }));
    expect(paymentRepo.markProcessed).not.toHaveBeenCalled();
  });
});

// ─── reprocessFailedBooking ───────────────────────────────────────────────────

describe("PaymentService.reprocessFailedBooking", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAvailableSlots.mockResolvedValue([{ start: "2099-12-01T10:00:00.000Z" }]);
  });

  const deadLetterEntry: FailedBookingEntry = {
    stripeSessionId: "pi_single_123",
    userId:          TEST_USER_ID,
    startIso:        "2099-12-01T10:00:00.000Z",
    failedAt:        "2099-11-30T00:00:00.000Z",
    error:           "calendar API down",
  };

  it("returns not-found when dead-letter entry missing", async () => {
    const { service, paymentRepo } = makeService();
    paymentRepo.listFailedBookings.mockResolvedValue([]);

    const result = await service.reprocessFailedBooking("pi_single_123");

    expect(result).toEqual({ ok: false, error: "Not found" });
  });

  it("returns ok:true and clears dead-letter on success", async () => {
    const { service, paymentRepo, stripe, bookings } = makeService();
    paymentRepo.listFailedBookings.mockResolvedValue([deadLetterEntry]);
    paymentRepo.isProcessed.mockResolvedValue(false);
    paymentRepo.markProcessed.mockResolvedValue(undefined);
    paymentRepo.clearFailedBooking.mockResolvedValue(undefined);
    stripe.retrievePaymentIntent.mockResolvedValue({
      id:       "pi_single_123",
      metadata: {
        student_email:    "student@test.com",
        student_name:     "Student",
        start_iso:        "2099-12-01T10:00:00.000Z",
        end_iso:          "2099-12-01T11:00:00.000Z",
        session_duration: "1h",
        reschedule_token: "",
      },
    } as unknown as Stripe.PaymentIntent);
    (bookings.createBooking as jest.Mock).mockResolvedValue({ eventId: "evt_1" });

    const result = await service.reprocessFailedBooking("pi_single_123");

    expect(result).toEqual({ ok: true });
    expect(paymentRepo.clearFailedBooking).toHaveBeenCalledWith("pi_single_123");
  });

  it("returns ok:false when Stripe retrieval fails", async () => {
    const { service, paymentRepo, stripe } = makeService();
    paymentRepo.listFailedBookings.mockResolvedValue([deadLetterEntry]);
    stripe.retrievePaymentIntent.mockRejectedValue(new Error("Stripe error"));

    const result = await service.reprocessFailedBooking("pi_single_123");

    expect(result).toEqual({ ok: false, error: "Failed to retrieve Stripe data" });
  });
});

// ─── REFACTOR-P1-02: webhook error semantics ──────────────────────────────────

describe("REFACTOR-P1-02: webhook error semantics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAvailableSlots.mockResolvedValue([{ start: "2099-12-01T10:00:00.000Z" }]);
  });

  it("throws PermanentWebhookError when student_email missing in pack metadata", async () => {
    const { service } = makeService();
    const event: Stripe.Event = {
      id:   "evt_test",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_test", metadata: { checkout_type: "pack", pack_size: "5" } } },
    } as unknown as Stripe.Event;

    await expect(service.processWebhookEvent(event)).rejects.toBeInstanceOf(PermanentWebhookError);
  });

  it("throws PermanentWebhookError when student_email missing in single-session metadata", async () => {
    const { service } = makeService();
    const event: Stripe.Event = {
      id:   "evt_test",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id:       "pi_test",
          metadata: {
            checkout_type: "single",
            start_iso:     "2099-12-01T10:00:00.000Z",
            end_iso:       "2099-12-01T11:00:00.000Z",
          },
        },
      },
    } as unknown as Stripe.Event;

    await expect(service.processWebhookEvent(event)).rejects.toBeInstanceOf(PermanentWebhookError);
  });

  it("throws PermanentWebhookError when start_iso or end_iso missing in single-session metadata", async () => {
    const { service } = makeService();
    const event: Stripe.Event = {
      id:   "evt_test",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id:       "pi_test",
          metadata: {
            checkout_type: "single",
            student_email: "student@test.com",
          },
        },
      },
    } as unknown as Stripe.Event;

    await expect(service.processWebhookEvent(event)).rejects.toBeInstanceOf(PermanentWebhookError);
  });

  it("rethrows when paymentRepo.recordFailedBooking fails inside writeDeadLetter", async () => {
    const dbError = new Error("DB down");
    const { service, paymentRepo, bookings } = makeService();
    paymentRepo.isProcessed.mockResolvedValue(false);
    (bookings.createBooking as jest.Mock).mockRejectedValue(new Error("calendar API down"));
    paymentRepo.recordFailedBooking.mockRejectedValue(dbError);

    await expect(service.processWebhookEvent(fakeSingleEvent())).rejects.toThrow("DB down");
  });
});

// ─── REFACTOR-P1-05: idempotency keys ────────────────────────────────────────

describe("REFACTOR-P1-05: idempotency keys", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function makeServiceWithFakeStripe() {
    const fakeStripe  = new FakeStripeClient();
    const paymentRepo = mockPaymentRepo();
    const credits     = mockCredits();
    const bookings    = mockBookings();
    const userSvc     = mockUserService();
    const service = new PaymentService(
      fakeStripe,
      credits  as unknown as CreditService,
      bookings as unknown as BookingService,
      paymentRepo,
      userSvc  as unknown as UserService,
      makePricing(),
      makeSchedule(),
    );
    return { service, fakeStripe };
  }

  it("returns the same PaymentIntent for two identical pack checkouts", async () => {
    const { service } = makeServiceWithFakeStripe();
    const a = await service.createPackCheckout({ email: "u@example.com", name: "U", packSize: 5 });
    const b = await service.createPackCheckout({ email: "u@example.com", name: "U", packSize: 5 });
    expect(a.paymentIntentId).toBe(b.paymentIntentId);
  });

  it("returns different PaymentIntents for different pack sizes", async () => {
    const { service } = makeServiceWithFakeStripe();
    const a = await service.createPackCheckout({ email: "u@example.com", name: "U", packSize: 5 });
    const b = await service.createPackCheckout({ email: "u@example.com", name: "U", packSize: 10 });
    expect(a.paymentIntentId).not.toBe(b.paymentIntentId);
  });

  it("returns different PaymentIntents for the same single-session checkout in different time windows", async () => {
    const { service } = makeServiceWithFakeStripe();
    const params = {
      email:    "u@example.com",
      name:     "U",
      duration: "1h" as const,
      startIso: "2026-06-01T10:00:00.000Z",
      endIso:   "2026-06-01T11:00:00.000Z",
    };

    const a = await service.createSingleSessionCheckout(params);

    jest.useFakeTimers();
    jest.advanceTimersByTime(6 * 60_000);

    const b = await service.createSingleSessionCheckout(params);

    expect(a.paymentIntentId).not.toBe(b.paymentIntentId);
  });
});

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

// REFACTOR-R3-P1-01: send() now throws on Resend failure. writeDeadLetter
// imports sendDeadLetterNotificationEmail directly (not via IEmailClient),
// so mock the module to control failure injection per test.
const mockSendDeadLetterEmail = jest.fn().mockResolvedValue(undefined);
jest.mock("@/infrastructure/resend/email-functions", () => ({
  sendDeadLetterNotificationEmail: (...args: unknown[]) => mockSendDeadLetterEmail(...args),
}));

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
  markProcessed:        jest.fn().mockResolvedValue(undefined),
  recordFailedBooking:  jest.fn(),
  listFailedBookings:   jest.fn(),
  clearFailedBooking:   jest.fn(),
  hasFailedBooking:     jest.fn().mockResolvedValue(false),
  // SINGLE-SESSION-CONFIRM-01
  recordSlotTakenRefund:          jest.fn().mockResolvedValue(undefined),
  wasRefunded:                    jest.fn().mockResolvedValue(false),
  broadcastSingleSessionResolved: jest.fn().mockResolvedValue(undefined),
  // PAYMENTS-AUDIT-01
  recordPayment:                  jest.fn().mockResolvedValue(undefined),
});

// REFACTOR-P3-05: handlePackPayment now also reads getBalance + fires
// broadcastPaymentConfirmed after addCredits, so the mock stubs all three.
const mockCredits = (): jest.Mocked<Pick<CreditService, "addCredits" | "getBalance" | "broadcastPaymentConfirmed">> => ({
  addCredits:                jest.fn(),
  getBalance:                jest.fn().mockResolvedValue(null),
  broadcastPaymentConfirmed: jest.fn(),
});

const mockBookings = (): jest.Mocked<Pick<BookingService, "createBooking" | "findByStripePaymentId">> => ({
  createBooking:          jest.fn(),
  findByStripePaymentId:  jest.fn().mockResolvedValue(null),
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
  bookings?:     Partial<jest.Mocked<Pick<BookingService, "createBooking" | "findByStripePaymentId">>>;
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
        amount:   14900,
        currency: "eur",
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
        amount:   4900,
        currency: "eur",
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

  // PAYMENTS-AUDIT-01
  it("records a payments row for pack event", async () => {
    const { service, credits, paymentRepo } = makeService();
    (credits.addCredits as jest.Mock).mockResolvedValue(undefined);

    await service.processWebhookEvent(fakePackEvent());

    expect(paymentRepo.recordPayment).toHaveBeenCalledTimes(1);
    expect(paymentRepo.recordPayment).toHaveBeenCalledWith(expect.objectContaining({
      userId:          TEST_USER_ID,
      stripePaymentId: "pi_pack_123",
      amountCents:     14900,
      currency:        "eur",
      checkoutType:    "pack",
      status:          "succeeded",
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

  // PAYMENTS-AUDIT-01
  it("records a payments row for single-session event", async () => {
    const { service, paymentRepo, bookings } = makeService();
    paymentRepo.isProcessed.mockResolvedValue(false);
    paymentRepo.markProcessed.mockResolvedValue(undefined);
    (bookings.createBooking as jest.Mock).mockResolvedValue({ eventId: "evt_1" });

    await service.processWebhookEvent(fakeSingleEvent());

    expect(paymentRepo.recordPayment).toHaveBeenCalledTimes(1);
    expect(paymentRepo.recordPayment).toHaveBeenCalledWith(expect.objectContaining({
      userId:          TEST_USER_ID,
      stripePaymentId: "pi_single_123",
      amountCents:     4900,
      currency:        "eur",
      checkoutType:    "single",
      status:          "succeeded",
    }));
  });

  // PAYMENTS-AUDIT-01: the refund/slot-taken exit must not record a succeeded payment.
  it("does not record a payments row when the slot was taken (refund path)", async () => {
    const { service, paymentRepo } = makeService();
    paymentRepo.isProcessed.mockResolvedValue(false);
    mockGetAvailableSlots.mockResolvedValue([]); // slot taken

    await service.processWebhookEvent(fakeSingleEvent());

    expect(paymentRepo.recordPayment).not.toHaveBeenCalled();
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

  // REFACTOR-R3-P1-02: fail CLOSED — a freebusy failure must propagate (webhook 500 →
  // Stripe redelivers), never "assume free". No booking, no refund in that case.
  it("rejects (no booking, no refund) when getAvailableSlots throws", async () => {
    const { service, paymentRepo, stripe, bookings } = makeService();
    paymentRepo.isProcessed.mockResolvedValue(false);
    mockGetAvailableSlots.mockRejectedValue(new Error("network error"));

    await expect(service.processWebhookEvent(fakeSingleEvent())).rejects.toThrow("network error");

    expect(bookings.createBooking).not.toHaveBeenCalled();
    expect(stripe.createRefund).not.toHaveBeenCalled();
    expect(paymentRepo.markProcessed).not.toHaveBeenCalled();
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

  // REFACTOR-R3-P1-01: the dead-letter admin email now throws on Resend
  // failure — writeDeadLetter's .catch(() => {}) must keep it non-fatal.
  it("still writes dead-letter when the notification email throws", async () => {
    const { service, paymentRepo, bookings } = makeService();
    paymentRepo.isProcessed.mockResolvedValue(false);
    paymentRepo.recordFailedBooking.mockResolvedValue(undefined);
    (bookings.createBooking as jest.Mock).mockRejectedValue(new Error("calendar API down"));
    mockSendDeadLetterEmail.mockRejectedValueOnce(new Error("resend down"));

    await service.processWebhookEvent(fakeSingleEvent());

    expect(mockSendDeadLetterEmail).toHaveBeenCalled();
    expect(paymentRepo.recordFailedBooking).toHaveBeenCalled();
    expect(paymentRepo.markProcessed).not.toHaveBeenCalled();
  });
});

// ─── SINGLE-SESSION-CONFIRM-01: async confirmation surface ───────────────────

describe("SINGLE-SESSION-CONFIRM-01: single-session resolution + polling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAvailableSlots.mockResolvedValue([{ start: "2099-12-01T10:00:00.000Z" }]);
  });

  const fullBooking = {
    eventId:         "evt_1",
    zoomSessionName: "zoom-1",
    zoomPasscode:    "pass-1",
    cancelToken:     "c".repeat(64),
    joinToken:       "j".repeat(64),
    emailFailed:     false,
  };

  // 1. Success → broadcast confirmed + persist + markProcessed.
  it("broadcasts status:confirmed with booking detail after a successful booking", async () => {
    const { service, paymentRepo, bookings } = makeService();
    paymentRepo.isProcessed.mockResolvedValue(false);
    (bookings.createBooking as jest.Mock).mockResolvedValue(fullBooking);

    await service.processWebhookEvent(fakeSingleEvent());

    expect(paymentRepo.markProcessed).toHaveBeenCalledWith("pi_single_123");
    expect(paymentRepo.broadcastSingleSessionResolved).toHaveBeenCalledWith(
      "pi_single_123",
      {
        status:      "confirmed",
        eventId:     "evt_1",
        startIso:    "2099-12-01T10:00:00.000Z",
        endIso:      "2099-12-01T11:00:00.000Z",
        sessionType: "session1h",
        joinToken:   "j".repeat(64),
        emailFailed: false,
      },
    );
  });

  // 1b. Broadcast failure must not fail the webhook (best-effort).
  it("does not fail the webhook if the confirmed broadcast throws", async () => {
    const { service, paymentRepo, bookings } = makeService();
    paymentRepo.isProcessed.mockResolvedValue(false);
    (bookings.createBooking as jest.Mock).mockResolvedValue(fullBooking);
    paymentRepo.broadcastSingleSessionResolved.mockRejectedValueOnce(new Error("network"));

    await expect(service.processWebhookEvent(fakeSingleEvent())).resolves.toBeUndefined();
    expect(paymentRepo.markProcessed).toHaveBeenCalledWith("pi_single_123");
  });

  // 2 + 3. Polling confirms (missed broadcast / webhook-before-subscribe race).
  it("getSingleSessionStatus returns confirmed + booking when a confirmed row exists", async () => {
    const detail = {
      eventId:     "evt_1",
      startIso:    "2099-12-01T10:00:00.000Z",
      endIso:      "2099-12-01T11:00:00.000Z",
      sessionType: "session1h" as const,
      joinToken:   "j".repeat(64),
    };
    const { service, bookings } = makeService();
    (bookings.findByStripePaymentId as jest.Mock).mockResolvedValue(detail);

    await expect(service.getSingleSessionStatus("pi_single_123")).resolves.toEqual({
      status:  "confirmed",
      booking: detail,
    });
  });

  // 4. Slot taken → refund issued, record persisted, broadcast slot_taken, no booking; then polling reports slot_taken.
  it("records the refund + broadcasts slot_taken when the slot was taken", async () => {
    const { service, paymentRepo, stripe, bookings } = makeService();
    paymentRepo.isProcessed.mockResolvedValue(false);
    mockGetAvailableSlots.mockResolvedValue([]); // slot taken

    await service.processWebhookEvent(fakeSingleEvent());

    expect(stripe.createRefund).toHaveBeenCalledWith(expect.objectContaining({ reason: "duplicate" }));
    expect(paymentRepo.recordSlotTakenRefund).toHaveBeenCalledWith("pi_single_123");
    expect(paymentRepo.broadcastSingleSessionResolved).toHaveBeenCalledWith(
      "pi_single_123", { status: "slot_taken" },
    );
    expect(bookings.createBooking).not.toHaveBeenCalled();
    expect(paymentRepo.markProcessed).not.toHaveBeenCalled();

    // polling reflects it
    paymentRepo.wasRefunded.mockResolvedValue(true);
    await expect(service.getSingleSessionStatus("pi_single_123")).resolves.toEqual({ status: "slot_taken" });
  });

  // 5. Duplicate webhook after refund short-circuits before a second refund.
  it("short-circuits a duplicate webhook for an already-refunded PaymentIntent", async () => {
    const { service, paymentRepo, stripe } = makeService();
    paymentRepo.isProcessed.mockResolvedValue(false);
    paymentRepo.wasRefunded.mockResolvedValue(true); // prior run already refunded

    await service.processWebhookEvent(fakeSingleEvent());

    expect(stripe.createRefund).not.toHaveBeenCalled();
    expect(paymentRepo.recordSlotTakenRefund).not.toHaveBeenCalled();
  });

  // REFACTOR-R3-P1-03: redelivery after createBooking committed but markProcessed failed.
  // The booking-exists gate heals the marker and stops before the slot re-check, so a
  // fulfilled booking is never refunded.
  const confirmedDetail = {
    eventId:     "evt_1",
    startIso:    "2099-12-01T10:00:00.000Z",
    endIso:      "2099-12-01T11:00:00.000Z",
    sessionType: "session1h" as const,
    joinToken:   "j".repeat(64),
  };

  it("heals the marker and skips (no refund, no second booking) when a booking already exists", async () => {
    const { service, paymentRepo, stripe, bookings } = makeService();
    paymentRepo.isProcessed.mockResolvedValue(false);
    paymentRepo.wasRefunded.mockResolvedValue(false);
    (bookings.findByStripePaymentId as jest.Mock).mockResolvedValue(confirmedDetail);

    await expect(service.processWebhookEvent(fakeSingleEvent())).resolves.toBeUndefined();

    expect(stripe.createRefund).not.toHaveBeenCalled();
    expect(bookings.createBooking).not.toHaveBeenCalled();
    expect(paymentRepo.markProcessed).toHaveBeenCalledWith("pi_single_123");
    expect(paymentRepo.broadcastSingleSessionResolved).not.toHaveBeenCalled();
  });

  it("still resolves when the marker heal-write itself fails", async () => {
    const { service, paymentRepo, stripe, bookings } = makeService();
    paymentRepo.isProcessed.mockResolvedValue(false);
    (bookings.findByStripePaymentId as jest.Mock).mockResolvedValue(confirmedDetail);
    paymentRepo.markProcessed.mockRejectedValue(new Error("db down"));

    await expect(service.processWebhookEvent(fakeSingleEvent())).resolves.toBeUndefined();

    expect(stripe.createRefund).not.toHaveBeenCalled();
    expect(bookings.createBooking).not.toHaveBeenCalled();
  });

  it("still refunds exactly once when no booking exists and the slot was genuinely taken", async () => {
    const { service, paymentRepo, stripe, bookings } = makeService();
    paymentRepo.isProcessed.mockResolvedValue(false);
    paymentRepo.wasRefunded.mockResolvedValue(false);
    (bookings.findByStripePaymentId as jest.Mock).mockResolvedValue(null);
    mockGetAvailableSlots.mockResolvedValue([]); // slot taken

    await service.processWebhookEvent(fakeSingleEvent());

    expect(stripe.createRefund).toHaveBeenCalledTimes(1);
    expect(bookings.createBooking).not.toHaveBeenCalled();
  });

  // 6. Dead-letter → failed (broadcast + polling).
  it("broadcasts status:failed and polling reports failed when booking dead-letters", async () => {
    const { service, paymentRepo, bookings } = makeService();
    paymentRepo.isProcessed.mockResolvedValue(false);
    (bookings.createBooking as jest.Mock).mockRejectedValue(new Error("calendar API down"));

    await service.processWebhookEvent(fakeSingleEvent());

    expect(paymentRepo.recordFailedBooking).toHaveBeenCalled();
    expect(paymentRepo.broadcastSingleSessionResolved).toHaveBeenCalledWith(
      "pi_single_123", { status: "failed" },
    );

    paymentRepo.hasFailedBooking.mockResolvedValue(true);
    await expect(service.getSingleSessionStatus("pi_single_123")).resolves.toEqual({ status: "failed" });
  });

  // 7. Pending — nothing written yet.
  it("getSingleSessionStatus returns pending when nothing is recorded", async () => {
    const { service } = makeService();
    await expect(service.getSingleSessionStatus("pi_single_123")).resolves.toEqual({ status: "pending" });
  });

  // 8. Confirmed-then-cancelled is not stale (correction #1): the confirmed finder is
  //    status-scoped, so a cancelled booking returns null → pending, never confirmed.
  it("never reports stale confirmed for a cancelled booking", async () => {
    const { service, bookings, paymentRepo } = makeService();
    // findByStripePaymentId is scoped to status='confirmed', so a cancelled row → null.
    (bookings.findByStripePaymentId as jest.Mock).mockResolvedValue(null);
    paymentRepo.wasRefunded.mockResolvedValue(false);
    paymentRepo.hasFailedBooking.mockResolvedValue(false);

    const result = await service.getSingleSessionStatus("pi_single_123");

    expect(result.status).not.toBe("confirmed");
    expect(result).toEqual({ status: "pending" });
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

  // REFACTOR-R3-P1-02: a throwing re-check must surface as { ok: false }, not an
  // unhandled rejection — the fail-closed throw is caught by reprocessFailedBooking.
  it("returns ok:false when the slot re-check throws", async () => {
    const { service, paymentRepo, stripe, bookings } = makeService();
    paymentRepo.listFailedBookings.mockResolvedValue([deadLetterEntry]);
    paymentRepo.isProcessed.mockResolvedValue(false);
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
    mockGetAvailableSlots.mockRejectedValue(new Error("network error"));

    const result = await service.reprocessFailedBooking("pi_single_123");

    expect(result.ok).toBe(false);
    expect(bookings.createBooking).not.toHaveBeenCalled();
    expect(paymentRepo.clearFailedBooking).not.toHaveBeenCalled();
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

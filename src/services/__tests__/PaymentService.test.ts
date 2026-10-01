// ARCH-14: Unit tests for PaymentService.
// REFACTOR-R4-P1-01: checkout runs BookingService.assertSlotBookable (mocked here —
// the validator itself is covered in BookingService.test.ts), and the webhook books
// an end derived from the paid duration.
// REFACTOR-R4-P1-02: the booking-exists gate is BookingService.hasBookingForPayment
// (status-agnostic), and the webhook's idempotency reads fail closed — see the in-memory
// suite at the end of this file.
// REFACTOR-R4-P3-01: reconcileRecentPayments (the cron's logic, moved from its route) and
// the dead-letter retry's payments row — in-memory suites at the end of this file.
// DEAD-LETTER-RETRY-01: a retry whose booking fails again keeps its dead-letter entry and
// reports the failure — in-memory suite at the end of this file.
// DEAD-LETTER-RETRY-02: a successful retry returns its `outcome` (booked / refunded /
// already_handled), which the admin RetryButton shows.
// REFACTOR-R4-P4-01: the slot-taken refund is keyed by the PI (a redelivery after a failed
// refund record replays it), and the checkout keys carry the amount — suite at the end.
import type { IStripeClient } from "@/infrastructure/stripe/StripeClient";
import type { IPaymentRepository, FailedBookingEntry } from "@/domain/repositories/IPaymentRepository";
import type Stripe from "stripe";
import { InvalidSlotError, PermanentWebhookError } from "@/domain/errors";
import { FakeStripeClient } from "@/__tests__/fixtures/FakeStripeClient";
import { InMemoryPricingRepository } from "@/__tests__/fixtures/InMemoryPricingRepository";
import { InMemoryAuditRepository } from "@/__tests__/fixtures/InMemoryAuditRepository";
import { InMemoryBookingRepository } from "@/__tests__/fixtures/InMemoryBookingRepository";
import { InMemoryPaymentRepository } from "@/__tests__/fixtures/InMemoryPaymentRepository";
import { buildTestBookingService, buildTestPaymentService } from "@/__tests__/fixtures/services";
import { alignedSlot } from "@/__tests__/fixtures/slots";

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

// REFACTOR-R3-P3-03: getConfirmationChannelState derives the channel name via HMAC.
// Stub it so the expected bodies below are exact literals instead of env-dependent MACs.
jest.mock("@/lib/realtime-channel", () => ({
  paymentChannelName: (id: string) => `pay:mac-${id}`,
}));

global.fetch = jest.fn().mockResolvedValue({});

import { PaymentService } from "../PaymentService";
import { CreditService }  from "../CreditService";
import { BookingService } from "../BookingService";
import { UserService }    from "../UserService";
import { PricingService } from "../PricingService";
import { ScheduleService } from "../ScheduleService";
import { InMemoryScheduleRepository } from "@/__tests__/fixtures/InMemoryScheduleRepository";
import { InMemoryConfigCache } from "@/__tests__/fixtures/InMemoryConfigCache";

// ─── Mock factories ───────────────────────────────────────────────────────────

const mockStripe = (): jest.Mocked<IStripeClient> => ({
  verifyWebhookSignature:   jest.fn(),
  createPaymentIntent:      jest.fn(),
  retrievePaymentIntent:    jest.fn(),
  listPaymentIntents:       jest.fn(),
  retrieveCheckoutSession:  jest.fn(),
  createRefund:             jest.fn(),
  retrievePaymentForAudit:  jest.fn(), // REFACTOR-R4-P3-03
});

// Real PricingService backed by an in-memory repo seeded with default prices.
const makePricing = () =>
  new PricingService(new InMemoryPricingRepository(), new InMemoryAuditRepository());

// Real ScheduleService backed by the seeded in-memory repo.
const makeSchedule = () =>
  new ScheduleService(
    new InMemoryScheduleRepository(),
    new InMemoryAuditRepository(),
    new InMemoryConfigCache(),
  );

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
// REFACTOR-R3-P3-03: getConfirmationChannelState adds hasProcessedPayment.
type MockedCredits = jest.Mocked<
  Pick<CreditService, "addCredits" | "getBalance" | "broadcastPaymentConfirmed" | "hasProcessedPayment">
>;

const mockCredits = (): MockedCredits => ({
  addCredits:                jest.fn(),
  getBalance:                jest.fn().mockResolvedValue(null),
  broadcastPaymentConfirmed: jest.fn(),
  hasProcessedPayment:       jest.fn().mockResolvedValue(false),
});

// REFACTOR-R4-P1-02: hasBookingForPayment backs the webhook's booking-exists gate.
type BookingDeps = "createBooking" | "findByStripePaymentId" | "hasBookingForPayment" | "assertSlotBookable";

const mockBookings = (): jest.Mocked<Pick<BookingService, BookingDeps>> => ({
  createBooking:          jest.fn(),
  findByStripePaymentId:  jest.fn().mockResolvedValue(null),
  hasBookingForPayment:   jest.fn().mockResolvedValue(false),
  assertSlotBookable:     jest.fn().mockResolvedValue(undefined),
});

const TEST_USER_ID = "user-uuid-test-123";

const mockUserService = (): jest.Mocked<Pick<UserService, "ensureUser" | "findByEmail">> => ({
  ensureUser:   jest.fn().mockResolvedValue(TEST_USER_ID),
  findByEmail:  jest.fn(),
});

function makeService(overrides?: {
  stripe?:       Partial<jest.Mocked<IStripeClient>>;
  paymentRepo?:  Partial<jest.Mocked<IPaymentRepository>>;
  credits?:      Partial<MockedCredits>;
  bookings?:     Partial<jest.Mocked<Pick<BookingService, BookingDeps>>>;
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

function fakeSingleEvent(
  intentId = "pi_single_123",
  startIso = "2099-12-01T10:00:00.000Z",
  endIso   = "2099-12-01T11:00:00.000Z",
  duration = "1h",
): Stripe.Event {
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
          session_duration: duration,
          start_iso:        startIso,
          end_iso:          endIso,
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

    // The pack's expiry reflects the configured validity (default 180 days) —
    // stamped from PricingService, not a hardcoded constant.
    const { expiresAt } = (credits.addCredits as jest.Mock).mock.calls[0]![0];
    const daysOut = (new Date(expiresAt).getTime() - Date.now()) / (24 * 60 * 60_000);
    expect(daysOut).toBeGreaterThan(179);
    expect(daysOut).toBeLessThanOrEqual(180);
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

    expect(stripe.createRefund).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "duplicate" }),
      { idempotencyKey: "refund:slot_taken:pi_single_123" }, // REFACTOR-R4-P4-01
    );
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

    expect(stripe.createRefund).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "duplicate" }),
      { idempotencyKey: "refund:slot_taken:pi_single_123" }, // REFACTOR-R4-P4-01
    );
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
  // fulfilled booking is never refunded. REFACTOR-R4-P1-02: the gate is now
  // hasBookingForPayment (any status), so that is what these tests stub.
  it("heals the marker and skips (no refund, no second booking) when a booking already exists", async () => {
    const { service, paymentRepo, stripe, bookings } = makeService();
    paymentRepo.isProcessed.mockResolvedValue(false);
    paymentRepo.wasRefunded.mockResolvedValue(false);
    (bookings.hasBookingForPayment as jest.Mock).mockResolvedValue(true);

    await expect(service.processWebhookEvent(fakeSingleEvent())).resolves.toBeUndefined();

    expect(stripe.createRefund).not.toHaveBeenCalled();
    expect(bookings.createBooking).not.toHaveBeenCalled();
    expect(paymentRepo.markProcessed).toHaveBeenCalledWith("pi_single_123");
    expect(paymentRepo.broadcastSingleSessionResolved).not.toHaveBeenCalled();
  });

  it("still resolves when the marker heal-write itself fails", async () => {
    const { service, paymentRepo, stripe, bookings } = makeService();
    paymentRepo.isProcessed.mockResolvedValue(false);
    (bookings.hasBookingForPayment as jest.Mock).mockResolvedValue(true);
    paymentRepo.markProcessed.mockRejectedValue(new Error("db down"));

    await expect(service.processWebhookEvent(fakeSingleEvent())).resolves.toBeUndefined();

    expect(stripe.createRefund).not.toHaveBeenCalled();
    expect(bookings.createBooking).not.toHaveBeenCalled();
  });

  it("still refunds exactly once when no booking exists and the slot was genuinely taken", async () => {
    const { service, paymentRepo, stripe, bookings } = makeService();
    paymentRepo.isProcessed.mockResolvedValue(false);
    paymentRepo.wasRefunded.mockResolvedValue(false);
    (bookings.hasBookingForPayment as jest.Mock).mockResolvedValue(false);
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

// ─── REFACTOR-R3-P3-03: payment-confirmation channel state ───────────────────

describe("REFACTOR-R3-P3-03: getConfirmationChannelState", () => {
  const OWNER = "student@test.com";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function packIntent(overrides?: Record<string, string>) {
    return {
      id:       "pi_pack_123",
      metadata: {
        checkout_type: "pack",
        student_email: OWNER,
        student_name:  "Student",
        pack_size:     "5",
        ...overrides,
      },
    } as unknown as Stripe.PaymentIntent;
  }

  function singleIntent(overrides?: Record<string, string>) {
    return {
      id:       "pi_single_123",
      metadata: {
        checkout_type: "single",
        student_email: OWNER,
        student_name:  "Student",
        ...overrides,
      },
    } as unknown as Stripe.PaymentIntent;
  }

  const bookingDetail = {
    eventId:     "evt_1",
    startIso:    "2099-12-01T10:00:00.000Z",
    endIso:      "2099-12-01T11:00:00.000Z",
    sessionType: "session1h" as const,
    joinToken:   "j".repeat(64),
  };

  // Wire-contract assertion: the pack body is exactly these 5 keys — no checkoutType.
  it("returns the confirmed pack body from the credit balance", async () => {
    const { service, stripe, credits } = makeService();
    stripe.retrievePaymentIntent.mockResolvedValue(packIntent());
    credits.hasProcessedPayment.mockResolvedValue(true);
    credits.getBalance.mockResolvedValue({ credits: 5, name: "Student", packSize: 5 });

    await expect(
      service.getConfirmationChannelState({ paymentIntentId: "pi_pack_123", authenticatedEmail: OWNER }),
    ).resolves.toEqual({
      channelName: "pay:mac-pi_pack_123",
      confirmed:   true,
      credits:     5,
      name:        "Student",
      packSize:    5,
    });
    expect(credits.getBalance).toHaveBeenCalledWith(OWNER);
  });

  it("returns the pending pack body (no balance lookup) when the webhook has not landed", async () => {
    const { service, stripe, credits } = makeService();
    stripe.retrievePaymentIntent.mockResolvedValue(packIntent());
    credits.hasProcessedPayment.mockResolvedValue(false);

    await expect(
      service.getConfirmationChannelState({ paymentIntentId: "pi_pack_123", authenticatedEmail: OWNER }),
    ).resolves.toEqual({
      channelName: "pay:mac-pi_pack_123",
      confirmed:   false,
      credits:     null,
      name:        "Student",
      packSize:    5,
    });
    expect(credits.getBalance).not.toHaveBeenCalled();
  });

  it("falls back to the PaymentIntent metadata when confirmed but no balance row exists", async () => {
    const { service, stripe, credits } = makeService();
    stripe.retrievePaymentIntent.mockResolvedValue(packIntent());
    credits.hasProcessedPayment.mockResolvedValue(true);
    credits.getBalance.mockResolvedValue(null);

    await expect(
      service.getConfirmationChannelState({ paymentIntentId: "pi_pack_123", authenticatedEmail: OWNER }),
    ).resolves.toEqual({
      channelName: "pay:mac-pi_pack_123",
      confirmed:   true,
      credits:     5,
      name:        "Student",
      packSize:    5,
    });
  });

  it("returns the single-session body with booking detail when confirmed", async () => {
    const { service, stripe, bookings } = makeService();
    stripe.retrievePaymentIntent.mockResolvedValue(singleIntent());
    (bookings.findByStripePaymentId as jest.Mock).mockResolvedValue(bookingDetail);

    await expect(
      service.getConfirmationChannelState({ paymentIntentId: "pi_single_123", authenticatedEmail: OWNER }),
    ).resolves.toEqual({
      channelName:  "pay:mac-pi_single_123",
      checkoutType: "single",
      status:       "confirmed",
      booking:      bookingDetail,
    });
  });

  it("omits booking for a non-confirmed single-session status", async () => {
    const { service, stripe, paymentRepo } = makeService();
    stripe.retrievePaymentIntent.mockResolvedValue(singleIntent());
    paymentRepo.wasRefunded.mockResolvedValue(true);

    const state = await service.getConfirmationChannelState({
      paymentIntentId: "pi_single_123", authenticatedEmail: OWNER,
    });

    expect(state).toEqual({
      channelName:  "pay:mac-pi_single_123",
      checkoutType: "single",
      status:       "slot_taken",
    });
    expect("booking" in state).toBe(false);
  });

  // Ownership gate sits before any booking/credit lookup — a non-owner learns nothing.
  it("throws a 403-shaped error for a non-owner without touching the status lookup", async () => {
    const { service, stripe, bookings, credits } = makeService();
    stripe.retrievePaymentIntent.mockResolvedValue(singleIntent());

    await expect(
      service.getConfirmationChannelState({
        paymentIntentId: "pi_single_123", authenticatedEmail: "someone-else@test.com",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(bookings.findByStripePaymentId).not.toHaveBeenCalled();
    expect(credits.hasProcessedPayment).not.toHaveBeenCalled();
  });

  it("matches ownership case-insensitively and ignoring surrounding whitespace", async () => {
    const { service, stripe } = makeService();
    stripe.retrievePaymentIntent.mockResolvedValue(packIntent({ student_email: " Student@Test.com " }));

    await expect(
      service.getConfirmationChannelState({ paymentIntentId: "pi_pack_123", authenticatedEmail: OWNER }),
    ).resolves.toMatchObject({ confirmed: false });
  });

  it("throws a 400-shaped error when the PaymentIntent has no student_email", async () => {
    const { service, stripe } = makeService();
    stripe.retrievePaymentIntent.mockResolvedValue(packIntent({ student_email: "" }));

    await expect(
      service.getConfirmationChannelState({ paymentIntentId: "pi_pack_123", authenticatedEmail: OWNER }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("propagates a Stripe retrieval failure (route maps it to 500)", async () => {
    const { service, stripe } = makeService();
    stripe.retrievePaymentIntent.mockRejectedValue(new Error("stripe down"));

    await expect(
      service.getConfirmationChannelState({ paymentIntentId: "pi_pack_123", authenticatedEmail: OWNER }),
    ).rejects.toThrow("stripe down");
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

    expect(result).toEqual({ ok: true, outcome: "booked" });
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

  // REFACTOR-R4-P3-01: the legacy Checkout Session branch carries amount_total through.
  describe("legacy Checkout Session", () => {
    const CS = "cs_legacy_123";

    function legacyCheckout(amountTotal: number | null) {
      return {
        id:             CS,
        payment_intent: "pi_legacy_123",
        customer_email: "student@test.com",
        amount_total:   amountTotal,
        currency:       amountTotal == null ? null : "eur",
        metadata: {
          student_email:    "student@test.com",
          student_name:     "Student",
          start_iso:        "2099-12-01T10:00:00.000Z",
          end_iso:          "2099-12-01T11:00:00.000Z",
          session_duration: "1h",
          reschedule_token: "",
        },
      } as unknown as Stripe.Checkout.Session;
    }

    function build(amountTotal: number | null) {
      const ctx = makeService();
      ctx.paymentRepo.listFailedBookings.mockResolvedValue([{ ...deadLetterEntry, stripeSessionId: CS }]);
      ctx.paymentRepo.isProcessed.mockResolvedValue(false);
      ctx.paymentRepo.clearFailedBooking.mockResolvedValue(undefined);
      ctx.stripe.retrieveCheckoutSession.mockResolvedValue(legacyCheckout(amountTotal));
      (ctx.bookings.createBooking as jest.Mock).mockResolvedValue({ eventId: "evt_1" });
      return ctx;
    }

    it("records the payments row from amount_total, keyed by the PaymentIntent", async () => {
      const { service, paymentRepo } = build(4900);

      await expect(service.reprocessFailedBooking(CS)).resolves.toEqual({ ok: true, outcome: "booked" });

      expect(paymentRepo.recordPayment).toHaveBeenCalledWith({
        userId:          TEST_USER_ID,
        stripePaymentId: "pi_legacy_123",
        amountCents:     4900,
        currency:        "eur",
        checkoutType:    "single",
        status:          "succeeded",
      });
    });

    it("books but skips the payments row when Stripe has no amount_total", async () => {
      const { service, paymentRepo, bookings } = build(null);

      await expect(service.reprocessFailedBooking(CS)).resolves.toEqual({ ok: true, outcome: "booked" });

      expect(bookings.createBooking).toHaveBeenCalledTimes(1);
      expect(paymentRepo.recordPayment).not.toHaveBeenCalled();
    });
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

// ─── PRICING-STUDENT-01 ───────────────────────────────────────────────────────

describe("per-student pricing at checkout", () => {
  /**
   * The charge is the part that must be right: whatever the client displays, the
   * amount handed to Stripe has to come from this student's resolved price. The
   * service is given a pricing repo the test can seed, and a userService that
   * resolves the email to an id (the real one does this via `users`).
   */
  function makeServiceWithSeedablePricing(userId: string | null) {
    const pricingRepo = new InMemoryPricingRepository();
    const pricing     = new PricingService(pricingRepo, new InMemoryAuditRepository());
    const stripe      = mockStripe();
    (stripe.createPaymentIntent as jest.Mock).mockResolvedValue({
      id: "pi_student", client_secret: "pi_student_secret",
    });
    const userSvc = {
      ensureUser:  jest.fn().mockResolvedValue(userId ?? TEST_USER_ID),
      findByEmail: jest.fn().mockResolvedValue(userId ? { id: userId } : null),
    };
    const service = new PaymentService(
      stripe,
      mockCredits() as unknown as CreditService,
      mockBookings() as unknown as BookingService,
      mockPaymentRepo(),
      userSvc as unknown as UserService,
      pricing,
      makeSchedule(),
    );
    return { service, stripe, pricingRepo };
  }

  it("charges the student's override for a pack, not the public price", async () => {
    const { service, stripe, pricingRepo } = makeServiceWithSeedablePricing("user-1");
    await pricingRepo.upsertForUser("user-1", "pack10", 9000, "admin@test.com");

    await service.createPackCheckout({ email: "ana@test.com", name: "Ana", packSize: 10 });

    expect(stripe.createPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 9000, currency: "eur" }),
      expect.anything(),
    );
  });

  it("charges the student's override for a single session", async () => {
    const { service, stripe, pricingRepo } = makeServiceWithSeedablePricing("user-1");
    await pricingRepo.upsertForUser("user-1", "session1h", 1000, "admin@test.com");

    await service.createSingleSessionCheckout({
      email: "ana@test.com", name: "Ana", duration: "1h",
      startIso: "2026-06-01T10:00:00.000Z", endIso: "2026-06-01T11:00:00.000Z",
    });

    expect(stripe.createPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1000 }),
      expect.anything(),
    );
  });

  it("charges the public price for a product the student has no override for", async () => {
    const { service, stripe, pricingRepo } = makeServiceWithSeedablePricing("user-1");
    // Overrides pack10 only; the 2h session must stay at the seeded 3000.
    await pricingRepo.upsertForUser("user-1", "pack10", 9000, "admin@test.com");

    await service.createSingleSessionCheckout({
      email: "ana@test.com", name: "Ana", duration: "2h",
      startIso: "2026-06-01T10:00:00.000Z", endIso: "2026-06-01T12:00:00.000Z",
    });

    expect(stripe.createPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 3000 }),
      expect.anything(),
    );
  });

  it("charges the public price to a student with no overrides", async () => {
    const { service, stripe } = makeServiceWithSeedablePricing("user-2");

    await service.createPackCheckout({ email: "bob@test.com", name: "Bob", packSize: 10 });

    expect(stripe.createPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 14000 }),
      expect.anything(),
    );
  });

  it("charges the public price when the email has no users row yet", async () => {
    const { service, stripe } = makeServiceWithSeedablePricing(null);

    await service.createPackCheckout({ email: "ghost@test.com", name: "Ghost", packSize: 5 });

    expect(stripe.createPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 7500 }),
      expect.anything(),
    );
  });
});

// ─── REFACTOR-R4-P1-01: slot validation on the paid path ──────────────────────

describe("REFACTOR-R4-P1-01: checkout validates the slot before any PaymentIntent", () => {
  beforeEach(() => jest.clearAllMocks());

  const params = {
    email: "student@test.com", name: "Student", duration: "1h" as const,
    startIso: "2099-12-01T10:00:00.000Z", endIso: "2099-12-01T13:00:00.000Z",
  };

  it("runs the validator with the session type the payment is for", async () => {
    const { service, bookings, stripe } = makeService();
    stripe.createPaymentIntent.mockResolvedValue({ id: "pi_ok", client_secret: "s" } as Stripe.PaymentIntent);

    await service.createSingleSessionCheckout({ ...params, duration: "2h" });

    expect(bookings.assertSlotBookable).toHaveBeenCalledWith({
      startIso: params.startIso, endIso: params.endIso, sessionType: "session2h",
    });
  });

  it("creates no PaymentIntent when the validator rejects the window", async () => {
    const { service, bookings, stripe } = makeService();
    bookings.assertSlotBookable.mockRejectedValue(new InvalidSlotError());

    await expect(service.createSingleSessionCheckout(params)).rejects.toBeInstanceOf(InvalidSlotError);
    expect(stripe.createPaymentIntent).not.toHaveBeenCalled();
  });
});

describe("REFACTOR-R4-P1-01: webhook books the paid duration, not metadata end_iso", () => {
  const booked = { eventId: "evt_1", joinToken: "j".repeat(64), emailFailed: false };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAvailableSlots.mockResolvedValue([{ start: "2099-12-01T10:00:00.000Z" }]);
  });

  it("books start + 1h for a 1h payment whose metadata claims 3 hours", async () => {
    const { service, paymentRepo, bookings } = makeService();
    paymentRepo.isProcessed.mockResolvedValue(false);
    (bookings.createBooking as jest.Mock).mockResolvedValue(booked);

    await service.processWebhookEvent(
      fakeSingleEvent("pi_lying", "2099-12-01T10:00:00.000Z", "2099-12-01T13:00:00.000Z"),
    );

    expect(bookings.createBooking).toHaveBeenCalledWith(expect.objectContaining({
      startIso: "2099-12-01T10:00:00.000Z", endIso: "2099-12-01T11:00:00.000Z", sessionType: "session1h",
    }));
    expect(paymentRepo.broadcastSingleSessionResolved).toHaveBeenCalledWith(
      "pi_lying", expect.objectContaining({ status: "confirmed", endIso: "2099-12-01T11:00:00.000Z" }),
    );
  });

  it("books start + 2h for a 2h payment, re-checking 120-minute availability", async () => {
    const { service, paymentRepo, bookings } = makeService();
    paymentRepo.isProcessed.mockResolvedValue(false);
    (bookings.createBooking as jest.Mock).mockResolvedValue(booked);

    await service.processWebhookEvent(
      fakeSingleEvent("pi_2h", "2099-12-01T10:00:00.000Z", "2099-12-01T11:00:00.000Z", "2h"),
    );

    expect(mockGetAvailableSlots).toHaveBeenCalledWith("2099-12-01", 120, expect.anything(), 30);
    expect(bookings.createBooking).toHaveBeenCalledWith(expect.objectContaining({
      endIso: "2099-12-01T12:00:00.000Z", sessionType: "session2h",
    }));
  });

  it("re-checks the tutor-timezone day, not the UTC date", async () => {
    const { service, paymentRepo, bookings } = makeService();
    paymentRepo.isProcessed.mockResolvedValue(false);
    (bookings.createBooking as jest.Mock).mockResolvedValue(booked);
    // 23:30Z on 1 Dec is 00:30 on 2 Dec in Madrid (CET, UTC+1).
    mockGetAvailableSlots.mockResolvedValue([{ start: "2099-12-01T23:30:00.000Z" }]);

    await service.processWebhookEvent(
      fakeSingleEvent("pi_tz", "2099-12-01T23:30:00.000Z", "2099-12-02T00:30:00.000Z"),
    );

    expect(mockGetAvailableSlots).toHaveBeenCalledWith("2099-12-02", 60, expect.anything(), 30);
    expect(bookings.createBooking).toHaveBeenCalled();
  });

  it("matches the free slot by instant, whatever the ISO spelling", async () => {
    const { service, paymentRepo, bookings, stripe } = makeService();
    paymentRepo.isProcessed.mockResolvedValue(false);
    (bookings.createBooking as jest.Mock).mockResolvedValue(booked);

    await service.processWebhookEvent(fakeSingleEvent("pi_nomillis", "2099-12-01T10:00:00Z"));

    expect(stripe.createRefund).not.toHaveBeenCalled();
    expect(bookings.createBooking).toHaveBeenCalled();
  });

  it("throws PermanentWebhookError (no refund, no booking) for an unparseable start_iso", async () => {
    const { service, paymentRepo, stripe, bookings } = makeService();
    paymentRepo.isProcessed.mockResolvedValue(false);

    await expect(service.processWebhookEvent(fakeSingleEvent("pi_bad", "not-a-date")))
      .rejects.toBeInstanceOf(PermanentWebhookError);
    expect(stripe.createRefund).not.toHaveBeenCalled();
    expect(bookings.createBooking).not.toHaveBeenCalled();
  });
});

// ─── REFACTOR-R4-P1-02: webhook idempotency reads fail closed ────────────────
// Real PaymentService + BookingService over the in-memory repositories and the
// FakeStripeClient, so "no refund" is read off the refunds Stripe actually recorded.

describe("REFACTOR-R4-P1-02: the webhook fails closed on a read error", () => {
  const PI = "pi_single_123";

  beforeEach(() => {
    jest.clearAllMocks();
    // Our own calendar event makes the slot look taken: a read error that fell through
    // to the re-check would refund a class that exists.
    mockGetAvailableSlots.mockResolvedValue([]);
  });

  function build() {
    const paymentRepo = new InMemoryPaymentRepository();
    const bookingRepo = new InMemoryBookingRepository();
    const bookingSvc  = buildTestBookingService({ bookings: bookingRepo });
    const { service, stripe } = buildTestPaymentService({ paymentRepo, bookings: bookingSvc });
    const createBooking = jest.spyOn(bookingSvc, "createBooking");
    return { service, stripe, paymentRepo, bookingRepo, createBooking };
  }

  it("rejects (no refund, no booking) when isProcessed errors", async () => {
    const { service, stripe, paymentRepo, createBooking } = build();
    paymentRepo.isProcessedShouldFail = true;

    await expect(service.processWebhookEvent(fakeSingleEvent(PI))).rejects.toThrow("simulated read failure");

    expect(stripe.refunds).toEqual([]);
    expect(createBooking).not.toHaveBeenCalled();
  });

  it("rejects (no refund, no booking) when the booking-exists lookup errors", async () => {
    const { service, stripe, bookingRepo, createBooking } = build();
    bookingRepo.hasBookingForPaymentShouldFail = true;

    await expect(service.processWebhookEvent(fakeSingleEvent(PI))).rejects.toThrow("simulated read failure");

    expect(stripe.refunds).toEqual([]);
    expect(createBooking).not.toHaveBeenCalled();
  });

  it("rejects (no refund, no booking) when wasRefunded errors", async () => {
    const { service, stripe, paymentRepo, createBooking } = build();
    paymentRepo.wasRefundedShouldFail = true;

    await expect(service.processWebhookEvent(fakeSingleEvent(PI))).rejects.toThrow("simulated read failure");

    expect(stripe.refunds).toEqual([]);
    expect(createBooking).not.toHaveBeenCalled();
  });

  it("skips a redelivery whose booking was cancelled (marker healed, not re-booked)", async () => {
    const { service, stripe, paymentRepo, bookingRepo, createBooking } = build();
    const { cancelToken } = await bookingRepo.createBooking({
      eventId:         "evt_paid",
      email:           "student@test.com",
      name:            "Student",
      sessionType:     "session1h",
      startsAt:        "2099-12-01T10:00:00.000Z",
      endsAt:          "2099-12-01T11:00:00.000Z",
      stripePaymentId: PI,
    });
    await bookingRepo.consumeCancelToken(cancelToken); // the student gave the slot back
    // The slot is free again — the old confirmed-only gate would have re-booked it.
    mockGetAvailableSlots.mockResolvedValue([{ start: "2099-12-01T10:00:00.000Z" }]);

    await expect(service.processWebhookEvent(fakeSingleEvent(PI))).resolves.toBeUndefined();

    expect(createBooking).not.toHaveBeenCalled();
    expect(stripe.refunds).toEqual([]);
    await expect(paymentRepo.isProcessed(PI)).resolves.toBe(true);
  });
});

// ─── REFACTOR-R4-P3-01: payment ledger accuracy ───────────────────────────────
// Real PaymentService + BookingService + CreditService over the in-memory repositories
// and the FakeStripeClient's listPaymentIntents.

describe("REFACTOR-R4-P3-01: reconcileRecentPayments", () => {
  const OPTS = { lookbackHours: 48, pageSize: 100, maxPages: 10 };
  const SLOT = "2099-12-01T10:00:00.000Z";

  let nowSpy: jest.SpyInstance | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAvailableSlots.mockResolvedValue([]);
  });
  afterEach(() => nowSpy?.mockRestore());

  function freezeNow(unixSeconds: number) {
    nowSpy = jest.spyOn(Date, "now").mockReturnValue(unixSeconds * 1000);
  }

  function build() {
    const paymentRepo = new InMemoryPaymentRepository();
    const bookingRepo = new InMemoryBookingRepository();
    const bookingSvc  = buildTestBookingService({ bookings: bookingRepo });
    const { service, stripe, credits } = buildTestPaymentService({ paymentRepo, bookings: bookingSvc });
    return { service, stripe, credits, paymentRepo, bookingRepo };
  }

  async function bookFor(bookingRepo: InMemoryBookingRepository, paymentIntentId: string) {
    await bookingRepo.createBooking({
      eventId:         `evt_${paymentIntentId}`,
      email:           "student@test.com",
      name:            "Student",
      sessionType:     "session1h",
      startsAt:        SLOT,
      endsAt:          "2099-12-01T11:00:00.000Z",
      stripePaymentId: paymentIntentId,
    });
  }

  it("flags a pack with no credit pack and clears one that has it", async () => {
    const { service, stripe, credits } = build();
    freezeNow(1_900_000_000);
    stripe.seedListedPaymentIntent({ id: "pi_pack_ok",   checkoutType: "pack" });
    stripe.seedListedPaymentIntent({ id: "pi_pack_lost", checkoutType: "pack", amount: 14900 });
    await credits.addCredits({
      email: "student@test.com", name: "Student", amount: 5, packLabel: "Pack 5 clases",
      stripeSessionId: "pi_pack_ok", expiresAt: "2100-01-01T00:00:00.000Z",
    });

    const result = await service.reconcileRecentPayments(OPTS);

    expect(result).toEqual({
      scanned:    2,
      hitPageCap: false,
      mismatches: [{
        paymentIntentId: "pi_pack_lost",
        amount:          14900,
        currency:        "eur",
        email:           "student@test.com",
        createdAt:       new Date(1_900_000_000 * 1000).toISOString(),
        reason:          "no_credit_pack",
      }],
    });
  });

  it("clears a single with a booking, a refund, a dead-letter or the marker; flags one with none", async () => {
    const { service, stripe, paymentRepo, bookingRepo } = build();
    for (const id of ["pi_booked", "pi_refunded", "pi_dead_letter", "pi_marked", "pi_lost"]) {
      stripe.seedListedPaymentIntent({ id, checkoutType: "single" });
    }
    await bookFor(bookingRepo, "pi_booked");
    await paymentRepo.recordSlotTakenRefund("pi_refunded");
    await paymentRepo.recordFailedBooking({
      stripeSessionId: "pi_dead_letter", userId: "u1", startIso: SLOT,
      failedAt: "2099-11-30T00:00:00.000Z", error: "calendar API down",
    });
    await paymentRepo.markProcessed("pi_marked");

    const { scanned, mismatches } = await service.reconcileRecentPayments(OPTS);

    expect(scanned).toBe(5);
    expect(mismatches.map(m => [m.paymentIntentId, m.reason])).toEqual([["pi_lost", "no_booking"]]);
  });

  // The bug this task fixes: the slot-taken path refunds without writing the marker, and
  // the PI stays `succeeded`, so every such refund used to raise a false mismatch.
  it("does not flag a single whose slot was taken and refunded by the webhook", async () => {
    const { service, stripe, paymentRepo } = build();
    await service.processWebhookEvent(fakeSingleEvent("pi_slot_taken"));
    expect(stripe.refunds).toEqual([{ payment_intent: "pi_slot_taken", reason: "duplicate" }]);
    await expect(paymentRepo.isProcessed("pi_slot_taken")).resolves.toBe(false);
    stripe.seedListedPaymentIntent({ id: "pi_slot_taken", checkoutType: "single" });

    const { mismatches } = await service.reconcileRecentPayments(OPTS);

    expect(mismatches).toEqual([]);
  });

  it("falls back to the processed marker for an unknown checkout type", async () => {
    const { service, stripe, paymentRepo } = build();
    stripe.seedListedPaymentIntent({ id: "pi_untyped_marked" });
    stripe.seedListedPaymentIntent({ id: "pi_untyped_lost" });
    stripe.seedListedPaymentIntent({ id: "pi_odd_lost", checkoutType: "gift" });
    await paymentRepo.markProcessed("pi_untyped_marked");

    const { mismatches } = await service.reconcileRecentPayments(OPTS);

    expect(mismatches.map(m => [m.paymentIntentId, m.reason])).toEqual([
      ["pi_untyped_lost", "no_webhook_row"],
      ["pi_odd_lost",     "no_webhook_row"],
    ]);
  });

  it("counts but does not check PaymentIntents that have not succeeded", async () => {
    const { service, stripe } = build();
    stripe.seedListedPaymentIntent({ id: "pi_processing", checkoutType: "pack", status: "processing" });

    await expect(service.reconcileRecentPayments(OPTS)).resolves.toEqual({
      scanned: 1, mismatches: [], hitPageCap: false,
    });
  });

  it("asks Stripe only for the lookback window", async () => {
    const { service, stripe } = build();
    const now = 1_900_000_000;
    freezeNow(now);
    stripe.seedListedPaymentIntent({ id: "pi_recent", checkoutType: "pack", created: now - 47 * 3600 });
    stripe.seedListedPaymentIntent({ id: "pi_old",    checkoutType: "pack", created: now - 49 * 3600 });

    const { scanned, mismatches } = await service.reconcileRecentPayments(OPTS);

    expect(stripe.listCalls[0]).toEqual({ createdGte: now - 48 * 3600, limit: 100 });
    expect(scanned).toBe(1);
    expect(mismatches.map(m => m.paymentIntentId)).toEqual(["pi_recent"]);
  });

  it("pages with the last id as the cursor until Stripe has no more", async () => {
    const { service, stripe, paymentRepo } = build();
    for (let i = 1; i <= 5; i++) stripe.seedListedPaymentIntent({ id: `pi_${i}`, checkoutType: "single" });
    for (const id of ["pi_1", "pi_2", "pi_3", "pi_5"]) await paymentRepo.markProcessed(id);

    const result = await service.reconcileRecentPayments({ ...OPTS, pageSize: 2 });

    expect(stripe.listCalls.map(c => c.startingAfter)).toEqual([undefined, "pi_2", "pi_4"]);
    expect(result.scanned).toBe(5);
    expect(result.hitPageCap).toBe(false);
    expect(result.mismatches.map(m => m.paymentIntentId)).toEqual(["pi_4"]); // found on page 2
  });

  it("stops at the page cap and reports it", async () => {
    const { service, stripe } = build();
    for (let i = 1; i <= 5; i++) stripe.seedListedPaymentIntent({ id: `pi_${i}`, checkoutType: "single" });

    const result = await service.reconcileRecentPayments({ ...OPTS, pageSize: 2, maxPages: 2 });

    expect(stripe.listCalls).toHaveLength(2);
    expect(result.scanned).toBe(4);
    expect(result.hitPageCap).toBe(true);
  });

  it("fails the run (no false mismatches) when a proof read errors", async () => {
    const { service, stripe, paymentRepo } = build();
    stripe.seedListedPaymentIntent({ id: "pi_single", checkoutType: "single" });
    paymentRepo.wasRefundedShouldFail = true;

    await expect(service.reconcileRecentPayments(OPTS)).rejects.toThrow("simulated read failure");
  });
});

describe("REFACTOR-R4-P3-01: a dead-letter retry records the payment", () => {
  const PI = "pi_dead_letter_123";
  // The real BookingService validates the window, so the slot must be one it offers.
  const { startIso, endIso } = alignedSlot("session1h", 48);

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAvailableSlots.mockResolvedValue([{ start: startIso }]);
  });

  it("writes a payments row with the PaymentIntent's amount and currency", async () => {
    const paymentRepo = new InMemoryPaymentRepository();
    const { service, stripe } = buildTestPaymentService({ paymentRepo });
    stripe.buildSingleSessionPaymentEvent({
      email: "student@test.com", name: "Student",
      startIso, endIso, duration: "1h", intentId: PI, amountCents: 5900,
    });
    await paymentRepo.recordFailedBooking({
      stripeSessionId: PI, userId: "u1", startIso,
      failedAt: new Date().toISOString(), error: "calendar API down",
    });

    await expect(service.reprocessFailedBooking(PI)).resolves.toEqual({ ok: true, outcome: "booked" });

    expect(paymentRepo.payments).toEqual([expect.objectContaining({
      stripePaymentId: PI,
      amountCents:     5900,
      currency:        "eur",
      checkoutType:    "single",
      status:          "succeeded",
    })]);
    await expect(paymentRepo.hasFailedBooking(PI)).resolves.toBe(false);
  });
});

// ─── DEAD-LETTER-RETRY-01: a failed retry keeps its dead-letter ───────────────

describe("DEAD-LETTER-RETRY-01: reprocessFailedBooking only clears a resolved payment", () => {
  const PI = "pi_retry_again_123";
  const { startIso, endIso } = alignedSlot("session1h", 48);

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAvailableSlots.mockResolvedValue([{ start: startIso }]);
  });

  async function build() {
    const paymentRepo = new InMemoryPaymentRepository();
    const bookingRepo = new InMemoryBookingRepository();
    const bookingSvc  = buildTestBookingService({ bookings: bookingRepo });
    const { service, stripe } = buildTestPaymentService({ paymentRepo, bookings: bookingSvc });
    stripe.buildSingleSessionPaymentEvent({
      email: "student@test.com", name: "Student",
      startIso, endIso, duration: "1h", intentId: PI, amountCents: 4900,
    });
    await paymentRepo.recordFailedBooking({
      stripeSessionId: PI, userId: "u1", startIso,
      failedAt: "2026-01-01T00:00:00.000Z", error: "calendar API down",
    });
    return { service, stripe, paymentRepo, bookingRepo };
  }

  it("keeps the entry, with the new error, and reports the failure when the booking fails again", async () => {
    const { service, paymentRepo, bookingRepo } = await build();
    bookingRepo.createBookingShouldFail = true;

    const result = await service.reprocessFailedBooking(PI);

    expect(result).toEqual({ ok: false, error: expect.stringContaining("simulated insert failure") });
    const [entry] = await paymentRepo.listFailedBookings();
    expect(entry).toMatchObject({ stripeSessionId: PI, error: expect.stringContaining("simulated insert failure") });
    expect(entry.failedAt).not.toBe("2026-01-01T00:00:00.000Z");
    expect(paymentRepo.payments).toEqual([]);
    await expect(paymentRepo.isProcessed(PI)).resolves.toBe(false);
  });

  it("can still be recovered by a later retry once the cause is gone", async () => {
    const { service, paymentRepo, bookingRepo } = await build();
    bookingRepo.createBookingShouldFail = true;
    await service.reprocessFailedBooking(PI);
    bookingRepo.createBookingShouldFail = false;

    await expect(service.reprocessFailedBooking(PI)).resolves.toEqual({ ok: true, outcome: "booked" });

    await expect(paymentRepo.hasFailedBooking(PI)).resolves.toBe(false);
    await expect(bookingRepo.hasBookingForPayment(PI)).resolves.toBe(true);
    expect(paymentRepo.payments).toEqual([expect.objectContaining({ stripePaymentId: PI, amountCents: 4900 })]);
  });

  // The student got their money back, so there is nothing left to recover.
  it("clears the entry when the retry finds the slot taken and refunds", async () => {
    const { service, stripe, paymentRepo } = await build();
    mockGetAvailableSlots.mockResolvedValue([]);

    await expect(service.reprocessFailedBooking(PI)).resolves.toEqual({ ok: true, outcome: "refunded" });

    expect(stripe.refunds).toEqual([{ payment_intent: PI, reason: "duplicate" }]);
    await expect(paymentRepo.hasFailedBooking(PI)).resolves.toBe(false);
  });

  it("reports refunded, without a second refund, when an earlier run already refunded", async () => {
    const { service, stripe, paymentRepo } = await build();
    await paymentRepo.recordSlotTakenRefund(PI);

    await expect(service.reprocessFailedBooking(PI)).resolves.toEqual({ ok: true, outcome: "refunded" });

    expect(stripe.refunds).toEqual([]);
    await expect(paymentRepo.hasFailedBooking(PI)).resolves.toBe(false);
  });

  it("clears the entry when the payment was already handled", async () => {
    const { service, stripe, paymentRepo } = await build();
    await paymentRepo.markProcessed(PI);

    await expect(service.reprocessFailedBooking(PI)).resolves.toEqual({ ok: true, outcome: "already_handled" });

    expect(stripe.refunds).toEqual([]);
    await expect(paymentRepo.hasFailedBooking(PI)).resolves.toBe(false);
  });
});

// ─── REFACTOR-R4-P4-01: Stripe idempotency keys ───────────────────────────────

describe("REFACTOR-R4-P4-01: a redelivery after a failed refund record replays the refund", () => {
  const PI = "pi_slot_taken_retry";

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAvailableSlots.mockResolvedValue([]); // slot taken
  });

  it("reuses the keyed refund, records it, and resolves (webhook 200)", async () => {
    const paymentRepo = new InMemoryPaymentRepository();
    const { service, stripe } = buildTestPaymentService({ paymentRepo });
    jest.spyOn(paymentRepo, "recordSlotTakenRefund").mockRejectedValueOnce(new Error("db down"));

    // Stripe refunded, the record write failed → webhook 500.
    await expect(service.processWebhookEvent(fakeSingleEvent(PI))).rejects.toThrow("db down");
    await expect(paymentRepo.wasRefunded(PI)).resolves.toBe(false);

    // Stripe redelivers.
    await expect(service.processWebhookEvent(fakeSingleEvent(PI))).resolves.toBeUndefined();

    expect(stripe.refundCalls.map(c => c.idempotencyKey)).toEqual([
      `refund:slot_taken:${PI}`,
      `refund:slot_taken:${PI}`,
    ]);
    expect(stripe.refunds).toEqual([{ payment_intent: PI, reason: "duplicate" }]); // one refund, replayed
    await expect(paymentRepo.wasRefunded(PI)).resolves.toBe(true);
    expect(paymentRepo.broadcasts).toEqual([{ paymentIntentId: PI, payload: { status: "slot_taken" } }]);
  });
});

describe("REFACTOR-R4-P4-01: checkout keys carry the amount", () => {
  // Inside one 5-min window for the whole test: bucket 6_000_000.
  const NOW = 6_000_000 * 300_000 + 60_000;
  let nowSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    nowSpy = jest.spyOn(Date, "now").mockReturnValue(NOW);
  });
  afterEach(() => nowSpy.mockRestore());

  function build() {
    const fakeStripe  = new FakeStripeClient();
    const pricingRepo = new InMemoryPricingRepository();
    const userSvc     = {
      ensureUser:  jest.fn().mockResolvedValue("user-1"),
      findByEmail: jest.fn().mockResolvedValue({ id: "user-1" }),
    };
    const service = new PaymentService(
      fakeStripe,
      mockCredits()  as unknown as CreditService,
      mockBookings() as unknown as BookingService,
      mockPaymentRepo(),
      userSvc as unknown as UserService,
      new PricingService(pricingRepo, new InMemoryAuditRepository()),
      makeSchedule(),
    );
    return { service, fakeStripe, pricingRepo };
  }

  const PACK   = { email: "ana@test.com", name: "Ana", packSize: 5 as const };
  const SINGLE = {
    email: "ana@test.com", name: "Ana", duration: "1h" as const,
    startIso: "2026-06-01T10:00:00.000Z", endIso: "2026-06-01T11:00:00.000Z",
  };

  it("a price edit between two pack checkouts gives two keys and a PaymentIntent at the new price", async () => {
    const { service, fakeStripe, pricingRepo } = build();

    const a = await service.createPackCheckout(PACK);
    await pricingRepo.upsertForUser("user-1", "pack5", 6000, "admin@test.com");
    const b = await service.createPackCheckout(PACK);

    expect(fakeStripe.getIdempotencyKeys()).toEqual([
      "pack:ana@test.com:5:7500eur:6000000",
      "pack:ana@test.com:5:6000eur:6000000",
    ]);
    expect(b.paymentIntentId).not.toBe(a.paymentIntentId);
    await expect(fakeStripe.retrievePaymentIntent(b.paymentIntentId)).resolves.toMatchObject({ amount: 6000 });
  });

  it("a price edit between two single-session checkouts gives two keys", async () => {
    const { service, fakeStripe, pricingRepo } = build();

    await service.createSingleSessionCheckout(SINGLE);
    await pricingRepo.upsertForUser("user-1", "session1h", 1000, "admin@test.com");
    await service.createSingleSessionCheckout(SINGLE);

    expect(fakeStripe.getIdempotencyKeys()).toEqual([
      "single:ana@test.com:1h:2026-06-01T10:00:00.000Z:1600eur:6000000",
      "single:ana@test.com:1h:2026-06-01T10:00:00.000Z:1000eur:6000000",
    ]);
  });

  it("no price change keeps one key, so a double-click still gets one PaymentIntent", async () => {
    const { service, fakeStripe } = build();

    const a = await service.createPackCheckout(PACK);
    const b = await service.createPackCheckout(PACK);
    const c = await service.createSingleSessionCheckout(SINGLE);
    const d = await service.createSingleSessionCheckout(SINGLE);

    expect(b.paymentIntentId).toBe(a.paymentIntentId);
    expect(d.paymentIntentId).toBe(c.paymentIntentId);
    expect(fakeStripe.getIdempotencyKeys()).toEqual([
      "pack:ana@test.com:5:7500eur:6000000",
      "single:ana@test.com:1h:2026-06-01T10:00:00.000Z:1600eur:6000000",
    ]);
  });
});

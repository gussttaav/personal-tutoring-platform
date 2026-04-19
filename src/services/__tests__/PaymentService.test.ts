// ARCH-14: Unit tests for PaymentService.
import type { IStripeClient } from "@/infrastructure/stripe/StripeClient";
import type { IPaymentRepository, FailedBookingEntry } from "@/domain/repositories/IPaymentRepository";
import type Stripe from "stripe";

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

// ─── Mock factories ───────────────────────────────────────────────────────────

const mockStripe = (): jest.Mocked<IStripeClient> => ({
  verifyWebhookSignature:   jest.fn(),
  getPriceAmount:           jest.fn(),
  createPaymentIntent:      jest.fn(),
  retrievePaymentIntent:    jest.fn(),
  retrieveCheckoutSession:  jest.fn(),
  createRefund:             jest.fn(),
});

const mockPaymentRepo = (): jest.Mocked<IPaymentRepository> => ({
  isProcessed:          jest.fn(),
  markProcessed:        jest.fn(),
  recordFailedBooking:  jest.fn(),
  listFailedBookings:   jest.fn(),
  clearFailedBooking:   jest.fn(),
});

const mockCredits = (): jest.Mocked<Pick<CreditService, "addCredits">> => ({
  addCredits: jest.fn(),
});

const mockBookings = (): jest.Mocked<Pick<BookingService, "createBooking">> => ({
  createBooking: jest.fn(),
});

function makeService(overrides?: {
  stripe?:      Partial<jest.Mocked<IStripeClient>>;
  paymentRepo?: Partial<jest.Mocked<IPaymentRepository>>;
  credits?:     Partial<jest.Mocked<Pick<CreditService, "addCredits">>>;
  bookings?:    Partial<jest.Mocked<Pick<BookingService, "createBooking">>>;
}) {
  const stripe      = { ...mockStripe(),      ...overrides?.stripe };
  const paymentRepo = { ...mockPaymentRepo(), ...overrides?.paymentRepo };
  const credits     = { ...mockCredits(),     ...overrides?.credits };
  const bookings    = { ...mockBookings(),     ...overrides?.bookings };
  const service = new PaymentService(
    stripe as jest.Mocked<IStripeClient>,
    credits as unknown as CreditService,
    bookings as unknown as BookingService,
    paymentRepo,
  );
  return { service, stripe, paymentRepo, credits, bookings };
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

  it("skips pack event with missing email", async () => {
    const { service, credits } = makeService();
    const event = fakePackEvent();
    (event.data.object as Record<string, unknown>).metadata = {
      checkout_type: "pack", pack_size: "5",
    };

    await service.processWebhookEvent(event);

    expect(credits.addCredits).not.toHaveBeenCalled();
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

  it("writes dead-letter when booking fails", async () => {
    const { service, paymentRepo, bookings } = makeService();
    paymentRepo.isProcessed.mockResolvedValue(false);
    paymentRepo.recordFailedBooking.mockResolvedValue(undefined);
    (bookings.createBooking as jest.Mock).mockRejectedValue(new Error("calendar API down"));

    await service.processWebhookEvent(fakeSingleEvent());

    expect(paymentRepo.recordFailedBooking).toHaveBeenCalledWith(expect.objectContaining({
      stripeSessionId: "pi_single_123",
      email:           "student@test.com",
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
    email:           "student@test.com",
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

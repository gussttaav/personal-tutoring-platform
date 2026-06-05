// ARCH-13: Unit tests for BookingService.
jest.mock("@/lib/availability-cache", () => ({
  invalidate: jest.fn().mockResolvedValue(undefined),
  getCached:  jest.fn().mockResolvedValue(null),
  setCached:  jest.fn().mockResolvedValue(undefined),
}));

import { BookingService } from "../BookingService";
import type { IBookingRepository } from "@/domain/repositories/IBookingRepository";
import type { ISessionRepository } from "@/domain/repositories/ISessionRepository";
import type { ICalendarClient } from "@/infrastructure/google";
import type { IZoomClient } from "@/infrastructure/zoom";
import type { IEmailClient } from "@/infrastructure/resend";
import { CreditService } from "../CreditService";
import type { ICreditsRepository } from "@/domain/repositories/ICreditsRepository";
import type { IAuditRepository } from "@/domain/repositories/IAuditRepository";
import { InsufficientCreditsError, DomainError, SlotUnavailableError } from "@/domain/errors";
import type { BookingRecord } from "@/domain/types";

// ─── Mock factories ───────────────────────────────────────────────────────────

const mockBookings = (): jest.Mocked<IBookingRepository> => ({
  createBooking:              jest.fn().mockResolvedValue({ cancelToken: "ctkn", joinToken: "jtkn" }),
  findByCancelToken:          jest.fn().mockResolvedValue(null),
  findByJoinToken:            jest.fn().mockResolvedValue(null),
  consumeCancelToken:         jest.fn().mockResolvedValue(true),
  listByUser:                 jest.fn().mockResolvedValue([]),
  hasAnyBooking:              jest.fn().mockResolvedValue(false),
  acquireSlotLock:            jest.fn().mockResolvedValue(true),
  releaseSlotLock:            jest.fn().mockResolvedValue(undefined),
  recordRescheduleFailure:    jest.fn().mockResolvedValue(undefined),
  findIdByEventIdForUser:     jest.fn().mockResolvedValue(null),
  findByEventId:              jest.fn().mockResolvedValue(null),
  hasBookingForPayment:       jest.fn().mockResolvedValue(false),
  markCompleted:              jest.fn().mockResolvedValue(undefined),
  markNoShow:                 jest.fn().mockResolvedValue(undefined),
  countCompletedPaid:         jest.fn().mockResolvedValue(0),
  recordPendingTermination:   jest.fn().mockResolvedValue(undefined),
  deletePendingTermination:   jest.fn().mockResolvedValue(undefined),
  listDuePendingTerminations: jest.fn().mockResolvedValue([]),
  recordPendingTerminationFailure: jest.fn().mockResolvedValue(undefined),
});

const mockCreditsRepo = (): jest.Mocked<ICreditsRepository> => ({
  getCredits:      jest.fn().mockResolvedValue({ credits: 5, packSize: 5, packLabel: "Pack 5", email: "s@t.com", name: "S", expiresAt: "", lastUpdated: "", stripeSessionId: "" }),
  addCredits:      jest.fn().mockResolvedValue(undefined),
  decrementCredit: jest.fn().mockResolvedValue({ ok: true, remaining: 4, packSize: 5 }),
  restoreCredit:   jest.fn().mockResolvedValue({ ok: true, credits: 5 }),
  hasProcessedPayment: jest.fn().mockResolvedValue(false),
  broadcastPaymentConfirmed: jest.fn().mockResolvedValue(undefined),
});

const mockAuditRepo = (): jest.Mocked<IAuditRepository> => ({
  append: jest.fn().mockResolvedValue(undefined),
  list:   jest.fn().mockResolvedValue([]),
});

const makeCreditService = (credits?: Partial<jest.Mocked<ICreditsRepository>>) => {
  const repo = { ...mockCreditsRepo(), ...credits };
  return new CreditService(repo, mockAuditRepo());
};

const mockSessions = (): jest.Mocked<ISessionRepository> => ({
  createSession:        jest.fn().mockResolvedValue(undefined),
  findByEventId:        jest.fn().mockResolvedValue(null),
  deleteByEventId:      jest.fn().mockResolvedValue(undefined),
  markStudentJoined:    jest.fn().mockResolvedValue(undefined),
  appendChatMessage:     jest.fn().mockResolvedValue(0),
  listChatMessages:      jest.fn().mockResolvedValue([]),
  countChatMessages:     jest.fn().mockResolvedValue(0),
  resolveZoomSessionId:  jest.fn().mockResolvedValue(null),
  appendChatMessageById: jest.fn().mockResolvedValue(0),
  listChatMessagesById:  jest.fn().mockResolvedValue([]),
  countChatMessagesById: jest.fn().mockResolvedValue(0),
  broadcastChatMessage:  jest.fn().mockResolvedValue(undefined),
});

const mockCalendar = (): jest.Mocked<ICalendarClient> => ({
  getAvailableSlots: jest.fn().mockResolvedValue([]),
  createEvent: jest.fn().mockResolvedValue({
    eventId: "evt1", zoomSessionName: "session-abc", zoomPasscode: "pass123",
    zoomSessionId: "zsid1", durationMinutes: 60,
  }),
  deleteEvent: jest.fn().mockResolvedValue(undefined),
});

const mockZoom = (): jest.Mocked<IZoomClient> => ({
  generateSessionCredentials: jest.fn(),
  generateJWT:                jest.fn(),
  getDurationWithGrace:       jest.fn().mockReturnValue(75),
});

const mockEmail = (): jest.Mocked<IEmailClient> => ({
  sendConfirmation:             jest.fn().mockResolvedValue(undefined),
  sendNewBookingNotification:   jest.fn().mockResolvedValue(undefined),
  sendCancellationConfirmation: jest.fn().mockResolvedValue(undefined),
  sendCancellationNotification: jest.fn().mockResolvedValue(undefined),
});

const makeService = (overrides: {
  bookings?:  jest.Mocked<IBookingRepository>;
  credits?:   CreditService;
  sessions?:  jest.Mocked<ISessionRepository>;
  calendar?:  jest.Mocked<ICalendarClient>;
  zoom?:      jest.Mocked<IZoomClient>;
  email?:     jest.Mocked<IEmailClient>;
} = {}) =>
  new BookingService(
    overrides.bookings  ?? mockBookings(),
    overrides.credits   ?? makeCreditService(),
    overrides.sessions  ?? mockSessions(),
    overrides.calendar  ?? mockCalendar(),
    overrides.zoom      ?? mockZoom(),
    overrides.email     ?? mockEmail(),
  );

// Helpers for time
const hoursFromNow = (h: number) => new Date(Date.now() + h * 60 * 60_000).toISOString();

const basePackInput = () => ({
  email: "student@test.com", name: "Student",
  startIso: hoursFromNow(10), endIso: hoursFromNow(11),
  sessionType: "pack" as const,
});

const baseCancelRecord = (overrides: Partial<BookingRecord> = {}): BookingRecord => ({
  eventId: "evt1", email: "s@t.com", name: "S",
  sessionType: "pack", startsAt: hoursFromNow(5), endsAt: hoursFromNow(6),
  used: false, ...overrides,
});

// ─── createBooking ────────────────────────────────────────────────────────────

describe("BookingService.createBooking", () => {
  it("throws SlotUnavailableError when slot is in the past", async () => {
    const service = makeService();
    await expect(
      service.createBooking({ ...basePackInput(), startIso: hoursFromNow(-1) })
    ).rejects.toThrow(SlotUnavailableError);
  });

  // ARCH-14: REQUIRES_PAYMENT guard moved to /api/book route handler so that
  // PaymentService can call createBooking() directly after Stripe payment.

  it("does not decrement credits for free15min sessions", async () => {
    const creditsRepo = mockCreditsRepo();
    const service = makeService({ credits: makeCreditService(creditsRepo) });

    await service.createBooking({ ...basePackInput(), sessionType: "free15min" });

    expect(creditsRepo.decrementCredit).not.toHaveBeenCalled();
  });

  it("decrements credits for pack sessions", async () => {
    const creditsRepo = mockCreditsRepo();
    const service = makeService({ credits: makeCreditService(creditsRepo) });

    await service.createBooking(basePackInput());

    expect(creditsRepo.decrementCredit).toHaveBeenCalledWith("student@test.com");
  });

  it("throws InsufficientCreditsError and does NOT create calendar event when credits are zero", async () => {
    const creditsRepo = mockCreditsRepo();
    creditsRepo.decrementCredit.mockResolvedValue({ ok: false, remaining: 0, packSize: null });
    const calendar = mockCalendar();
    const service = makeService({ credits: makeCreditService(creditsRepo), calendar });

    await expect(service.createBooking(basePackInput())).rejects.toThrow(InsufficientCreditsError);
    expect(calendar.createEvent).not.toHaveBeenCalled();
  });

  it("restores credit when calendar event creation fails (pack)", async () => {
    const creditsRepo = mockCreditsRepo();
    const calendar = mockCalendar();
    calendar.createEvent.mockRejectedValue(new Error("Google Calendar down"));

    const service = makeService({ credits: makeCreditService(creditsRepo), calendar });

    await expect(service.createBooking(basePackInput())).rejects.toThrow("Google Calendar down");

    expect(creditsRepo.decrementCredit).toHaveBeenCalled();
    expect(creditsRepo.restoreCredit).toHaveBeenCalledWith("student@test.com");
  });

  it("does NOT restore credit when calendar fails on a free session", async () => {
    const creditsRepo = mockCreditsRepo();
    const calendar = mockCalendar();
    calendar.createEvent.mockRejectedValue(new Error("Calendar down"));

    const service = makeService({ credits: makeCreditService(creditsRepo), calendar });

    await expect(
      service.createBooking({ ...basePackInput(), sessionType: "free15min" })
    ).rejects.toThrow();

    expect(creditsRepo.restoreCredit).not.toHaveBeenCalled();
  });

  it("returns correct output on success", async () => {
    const service = makeService();

    const result = await service.createBooking(basePackInput());

    expect(result).toMatchObject({
      eventId:         "evt1",
      zoomSessionName: "session-abc",
      zoomPasscode:    "pass123",
      cancelToken:     "ctkn",
      joinToken:       "jtkn",
      emailFailed:     false,
    });
  });

  it("writes a pending_termination row on successful booking", async () => {
    const bookings = mockBookings();
    const service  = makeService({ bookings });

    await service.createBooking(basePackInput());

    expect(bookings.recordPendingTermination).toHaveBeenCalledWith("evt1", expect.any(Number));
  });
});

// ─── createBooking — reschedule flow ─────────────────────────────────────────

describe("BookingService.createBooking (reschedule)", () => {
  it("throws when reschedule token is invalid", async () => {
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(null);
    const service = makeService({ bookings });

    await expect(
      service.createBooking({ ...basePackInput(), rescheduleToken: "bad-token" })
    ).rejects.toMatchObject({ code: "INVALID_RESCHEDULE_TOKEN" });
  });

  it("throws when reschedule is outside 2-hour window", async () => {
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(
      baseCancelRecord({ sessionType: "pack", startsAt: hoursFromNow(1) }) // < 2h away
    );
    const service = makeService({ bookings });

    await expect(
      service.createBooking({ ...basePackInput(), rescheduleToken: "tkn" })
    ).rejects.toMatchObject({ code: "OUTSIDE_RESCHEDULE_WINDOW" });
  });

  it("throws when session type does not match original", async () => {
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(
      baseCancelRecord({ sessionType: "session1h", startsAt: hoursFromNow(5) })
    );
    const service = makeService({ bookings });

    await expect(
      service.createBooking({ ...basePackInput(), sessionType: "pack", rescheduleToken: "tkn" })
    ).rejects.toMatchObject({ code: "SESSION_TYPE_MISMATCH" });
  });

  it("deletes the old Zoom session record on reschedule", async () => {
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(
      baseCancelRecord({ eventId: "old-evt", sessionType: "pack", startsAt: hoursFromNow(5) })
    );
    const sessions = mockSessions();
    const service = makeService({ bookings, sessions });

    await service.createBooking({ ...basePackInput(), rescheduleToken: "tkn" });

    expect(sessions.deleteByEventId).toHaveBeenCalledWith("old-evt");
  });

  it("deletes the old pending_terminations row on reschedule", async () => {
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(
      baseCancelRecord({ eventId: "old-evt", sessionType: "pack", startsAt: hoursFromNow(5) })
    );
    const service = makeService({ bookings });

    await service.createBooking({ ...basePackInput(), rescheduleToken: "tkn" });

    expect(bookings.deletePendingTermination).toHaveBeenCalledWith("old-evt");
  });

  it("throws when calendar fails during non-pack rescheduling (no dead-letter — REFACTOR-P1-03)", async () => {
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(
      baseCancelRecord({ sessionType: "free15min", startsAt: hoursFromNow(5) })
    );
    const calendar = mockCalendar();
    calendar.createEvent.mockRejectedValue(new Error("Calendar down"));
    const service = makeService({ bookings, calendar });

    await expect(
      service.createBooking({
        ...basePackInput(), sessionType: "free15min", rescheduleToken: "tkn",
      })
    ).rejects.toThrow("Calendar down");

    // Compensation framework replaced the old recordRescheduleFailure dead-letter call.
    expect(bookings.recordRescheduleFailure).not.toHaveBeenCalled();
  });

  it("passes locale: 'en' to sendConfirmation when input locale is 'en'", async () => {
    const email = mockEmail();
    const service = makeService({ email });

    await service.createBooking({ ...basePackInput(), locale: "en" });

    expect(email.sendConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "en" })
    );
  });

  it("defaults to locale: 'es' for sendConfirmation when locale is omitted", async () => {
    const email = mockEmail();
    const service = makeService({ email });

    await service.createBooking(basePackInput());

    expect(email.sendConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "es" })
    );
  });

  it("sends English session label to student but Spanish label to admin notification", async () => {
    const email = mockEmail();
    const service = makeService({ email });

    await service.createBooking({ ...basePackInput(), locale: "en" });

    const confirmCall = email.sendConfirmation.mock.calls[0]?.[0];
    const notifyCall  = email.sendNewBookingNotification.mock.calls[0]?.[0];
    expect(confirmCall?.sessionLabel).toBe("Pack class");
    expect(notifyCall?.sessionLabel).toBe("Clase de pack");
  });
});

// ─── cancelByToken ────────────────────────────────────────────────────────────

describe("BookingService.cancelByToken", () => {
  it("throws DomainError when token is invalid", async () => {
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(null);
    const service = makeService({ bookings });

    await expect(service.cancelByToken("bad")).rejects.toMatchObject({
      code: "INVALID_CANCEL_TOKEN",
    });
  });

  it("throws DomainError when session starts in less than 2 hours", async () => {
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(
      baseCancelRecord({ startsAt: hoursFromNow(1) }) // 1h away — outside window
    );
    const service = makeService({ bookings });

    await expect(service.cancelByToken("tkn")).rejects.toMatchObject({
      code: "OUTSIDE_CANCEL_WINDOW",
    });
  });

  it("throws DomainError when token was already consumed (race condition)", async () => {
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(baseCancelRecord({ startsAt: hoursFromNow(5) }));
    bookings.consumeCancelToken.mockResolvedValue(false);
    const service = makeService({ bookings });

    await expect(service.cancelByToken("tkn")).rejects.toMatchObject({
      code: "CANCEL_TOKEN_CONSUMED",
    });
  });

  it("deletes the Zoom session record on cancellation", async () => {
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(
      baseCancelRecord({ eventId: "evt-cancel-test", startsAt: hoursFromNow(5) })
    );
    const sessions = mockSessions();
    const service = makeService({ bookings, sessions });

    await service.cancelByToken("tkn");

    expect(sessions.deleteByEventId).toHaveBeenCalledWith("evt-cancel-test");
  });

  it("deletes the pending_terminations row on cancellation", async () => {
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(
      baseCancelRecord({ eventId: "evt-cancel-test", startsAt: hoursFromNow(5) })
    );
    const service = makeService({ bookings });

    await service.cancelByToken("tkn");

    expect(bookings.deletePendingTermination).toHaveBeenCalledWith("evt-cancel-test");
  });

  it("restores credit when cancelling a pack session", async () => {
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(
      baseCancelRecord({ sessionType: "pack", startsAt: hoursFromNow(5) })
    );
    const creditsRepo = mockCreditsRepo();
    const service = makeService({ bookings, credits: makeCreditService(creditsRepo) });

    const result = await service.cancelByToken("tkn");

    expect(creditsRepo.restoreCredit).toHaveBeenCalledWith("s@t.com");
    expect(result.creditsRestored).toBe(true);
  });

  it("does NOT restore credit when cancelling a non-pack session", async () => {
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(
      baseCancelRecord({ sessionType: "free15min", startsAt: hoursFromNow(5) })
    );
    const creditsRepo = mockCreditsRepo();
    const service = makeService({ bookings, credits: makeCreditService(creditsRepo) });

    const result = await service.cancelByToken("tkn");

    expect(creditsRepo.restoreCredit).not.toHaveBeenCalled();
    expect(result.creditsRestored).toBe(false);
  });

  it("does NOT send tutor notification for free15min cancellation", async () => {
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(
      baseCancelRecord({ sessionType: "free15min", startsAt: hoursFromNow(5) })
    );
    const email = mockEmail();
    const service = makeService({ bookings, email });

    await service.cancelByToken("tkn");

    expect(email.sendCancellationNotification).not.toHaveBeenCalled();
    expect(email.sendCancellationConfirmation).toHaveBeenCalled();
  });

  it("sends tutor notification for session1h cancellation", async () => {
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(
      baseCancelRecord({ sessionType: "session1h", startsAt: hoursFromNow(5) })
    );
    const email = mockEmail();
    const service = makeService({ bookings, email });

    await service.cancelByToken("tkn");

    expect(email.sendCancellationNotification).toHaveBeenCalled();
  });

  it("passes locale: 'en' to sendCancellationConfirmation when called with 'en'", async () => {
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(
      baseCancelRecord({ startsAt: hoursFromNow(5) })
    );
    const email = mockEmail();
    const service = makeService({ bookings, email });

    await service.cancelByToken("tkn", "en");

    expect(email.sendCancellationConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "en" })
    );
  });

  it("defaults to locale: 'es' for sendCancellationConfirmation", async () => {
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(
      baseCancelRecord({ startsAt: hoursFromNow(5) })
    );
    const email = mockEmail();
    const service = makeService({ bookings, email });

    await service.cancelByToken("tkn");

    expect(email.sendCancellationConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "es" })
    );
  });

  it("uses English session label for student but Spanish for admin notification on cancel", async () => {
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(
      baseCancelRecord({ sessionType: "session1h", startsAt: hoursFromNow(5) })
    );
    const email = mockEmail();
    const service = makeService({ bookings, email });

    await service.cancelByToken("tkn", "en");

    const confirmCall = email.sendCancellationConfirmation.mock.calls[0]?.[0];
    const notifyCall  = email.sendCancellationNotification.mock.calls[0]?.[0];
    expect(confirmCall?.sessionLabel).toBe("Individual session · 1 hour");
    expect(notifyCall?.sessionLabel).toBe("Sesión individual · 1 hora");
  });
});

// ─── listForUser ──────────────────────────────────────────────────────────────

describe("BookingService.listForUser", () => {
  it("maps repository result to UserBooking[]", async () => {
    const bookings = mockBookings();
    bookings.listByUser.mockResolvedValue([
      {
        cancelToken: "tkn1",
        joinToken:   "jtkn1",
        record: {
          eventId: "e1", email: "s@t.com", name: "S",
          sessionType: "pack", startsAt: hoursFromNow(5), endsAt: hoursFromNow(6),
          used: false, packSize: 5,
        },
      },
    ]);
    const service = makeService({ bookings });

    const result = await service.listForUser("s@t.com");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      token:       "tkn1",
      joinToken:   "jtkn1",
      sessionType: "pack",
      packSize:    5,
    });
  });

  it("returns empty array when user has no bookings", async () => {
    const service = makeService();
    const result = await service.listForUser("nobody@test.com");
    expect(result).toEqual([]);
  });
});

// ─── REFACTOR-P1-01: concurrent booking ──────────────────────────────────────

describe("REFACTOR-P1-01: concurrent booking", () => {
  it("rejects the second concurrent booking for the same slot", async () => {
    const { buildTestBookingService } = await import("@/__tests__/fixtures/services");
    const service = buildTestBookingService();
    const input = {
      email: "a@example.com", name: "A",
      startIso: hoursFromNow(10),
      endIso:   hoursFromNow(11),
      sessionType: "session1h" as const,
    };

    const [first, second] = await Promise.allSettled([
      service.createBooking(input),
      service.createBooking({ ...input, email: "b@example.com", name: "B" }),
    ]);

    const fulfilled = [first, second].filter(r => r.status === "fulfilled");
    const rejected  = [first, second].filter(r => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason)
      .toBeInstanceOf(SlotUnavailableError);
  });

  it("releases the slot lock when createBooking throws inside the try block", async () => {
    const { buildTestBookingService } = await import("@/__tests__/fixtures/services");
    const { FakeCalendarClient } = await import("@/__tests__/fixtures/FakeCalendarClient");
    const calendar = new FakeCalendarClient();
    const service = buildTestBookingService({ calendar });

    const input = {
      email: "a@example.com", name: "A",
      startIso: hoursFromNow(10),
      endIso:   hoursFromNow(11),
      sessionType: "session1h" as const,
    };

    // First call fails due to calendar error — lock must be released
    calendar.shouldFail = true;
    await expect(service.createBooking(input)).rejects.toThrow();

    // Second call with same slot must succeed now that lock is released
    calendar.shouldFail = false;
    await expect(service.createBooking(input)).resolves.toBeDefined();
  });
});

// ─── REFACTOR-P1-03: booking saga compensation ───────────────────────────────

describe("REFACTOR-P1-03: booking saga compensation", () => {
  it("restores credit when Calendar create fails (pack)", async () => {
    const creditsRepo = mockCreditsRepo();
    const calendar    = mockCalendar();
    calendar.createEvent.mockRejectedValue(new Error("Calendar down"));

    const service = makeService({ credits: makeCreditService(creditsRepo), calendar });

    await expect(service.createBooking(basePackInput())).rejects.toThrow("Calendar down");

    expect(creditsRepo.decrementCredit).toHaveBeenCalled();
    expect(creditsRepo.restoreCredit).toHaveBeenCalledWith("student@test.com");
  });

  it("deletes Calendar event when DB booking insert fails", async () => {
    const calendar  = mockCalendar();
    const bookings  = mockBookings();
    bookings.createBooking.mockRejectedValue(new Error("DB down"));

    const service = makeService({ calendar, bookings });

    await expect(service.createBooking(basePackInput())).rejects.toThrow("DB down");

    expect(calendar.deleteEvent).toHaveBeenCalledWith("evt1");
  });

  it("releases slot lock even when compensation runs", async () => {
    const bookings = mockBookings();
    const calendar = mockCalendar();
    calendar.createEvent.mockRejectedValue(new Error("Calendar down"));
    const input = basePackInput();

    const service = makeService({ bookings, calendar });

    await expect(service.createBooking(input)).rejects.toThrow();

    expect(bookings.releaseSlotLock).toHaveBeenCalledWith(input.startIso);
  });

  it("surfaces original error when compensation itself fails", async () => {
    const calendar = mockCalendar();
    const bookings = mockBookings();
    bookings.createBooking.mockRejectedValue(new Error("DB"));
    calendar.deleteEvent.mockRejectedValue(new Error("Cal delete also failed"));

    const service = makeService({ calendar, bookings });

    await expect(service.createBooking(basePackInput())).rejects.toThrow("DB");
  });
});

// ─── REFACTOR-P1-04: pending_terminations write ───────────────────────────────

describe("REFACTOR-P1-04: pending_terminations write", () => {
  it("succeeds the booking even when pending_termination write fails", async () => {
    const bookings = mockBookings();
    bookings.recordPendingTermination = jest.fn().mockRejectedValueOnce(new Error("DB down"));

    const service = makeService({ bookings });
    const result  = await service.createBooking(basePackInput());

    expect(result.eventId).toBeDefined();
  });

  it("records the correct fireAtMs in the pending termination row", async () => {
    const { buildTestBookingService } = await import("@/__tests__/fixtures/services");
    const { InMemoryBookingRepository } = await import("@/__tests__/fixtures/InMemoryBookingRepository");

    const bookingRepo = new InMemoryBookingRepository();
    const service     = buildTestBookingService({ bookings: bookingRepo });
    const input = {
      email: "a@example.com", name: "A",
      startIso: hoursFromNow(10), endIso: hoursFromNow(11),
      sessionType: "session1h" as const,
    };

    const result = await service.createBooking(input);

    const pending = bookingRepo.getPendingTerminations();
    expect(pending.has(result.eventId)).toBe(true);
    // fireAtMs must be after the session starts (start + grace period)
    const startMs = new Date(input.startIso).getTime();
    expect(pending.get(result.eventId)!).toBeGreaterThan(startMs);
  });
});

// ─── hasAnyBooking ────────────────────────────────────────────────────────────

describe("BookingService.hasAnyBooking", () => {
  it("delegates to the repository", async () => {
    const bookings = mockBookings();
    bookings.hasAnyBooking.mockResolvedValue(true);
    const service = makeService({ bookings });

    const result = await service.hasAnyBooking("s@t.com");

    expect(bookings.hasAnyBooking).toHaveBeenCalledWith("s@t.com");
    expect(result).toBe(true);
  });

  it("returns false when the repository reports no bookings", async () => {
    const service = makeService();
    const result = await service.hasAnyBooking("nobody@test.com");
    expect(result).toBe(false);
  });
});

// ─── finalizePastSession ──────────────────────────────────────────────────────

describe("BookingService.finalizePastSession", () => {
  const baseZoomSession = {
    sessionId:       "zs-1",
    sessionName:     "sess",
    sessionPasscode: "pw",
    studentEmail:    "s@t.com",
    startIso:        hoursFromNow(-1),
    durationMinutes: 60,
    sessionType:     "session1h" as const,
  };

  it("marks booking completed when student joined", async () => {
    const bookings = mockBookings();
    bookings.findByEventId.mockResolvedValue({ id: "bk-1", status: "confirmed" });
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue({
      ...baseZoomSession,
      studentJoinedAt: new Date().toISOString(),
    });
    const service = makeService({ bookings, sessions });

    await service.finalizePastSession("evt-1");

    expect(bookings.markCompleted).toHaveBeenCalledWith("bk-1");
    expect(bookings.markNoShow).not.toHaveBeenCalled();
    expect(sessions.deleteByEventId).toHaveBeenCalledWith("evt-1");
  });

  it("marks booking no_show when student never joined", async () => {
    const bookings = mockBookings();
    bookings.findByEventId.mockResolvedValue({ id: "bk-1", status: "confirmed" });
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue({
      ...baseZoomSession,
      studentJoinedAt: null,
    });
    const service = makeService({ bookings, sessions });

    await service.finalizePastSession("evt-1");

    expect(bookings.markNoShow).toHaveBeenCalledWith("bk-1");
    expect(bookings.markCompleted).not.toHaveBeenCalled();
    expect(sessions.deleteByEventId).toHaveBeenCalledWith("evt-1");
  });

  it("also marks no_show when zoom_sessions row is missing", async () => {
    const bookings = mockBookings();
    bookings.findByEventId.mockResolvedValue({ id: "bk-1", status: "confirmed" });
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue(null);
    const service = makeService({ bookings, sessions });

    await service.finalizePastSession("evt-1");

    expect(bookings.markNoShow).toHaveBeenCalledWith("bk-1");
  });

  it("skips status updates when booking is already cancelled", async () => {
    const bookings = mockBookings();
    bookings.findByEventId.mockResolvedValue({ id: "bk-1", status: "cancelled" });
    const sessions = mockSessions();
    const service = makeService({ bookings, sessions });

    await service.finalizePastSession("evt-1");

    expect(bookings.markCompleted).not.toHaveBeenCalled();
    expect(bookings.markNoShow).not.toHaveBeenCalled();
    expect(sessions.deleteByEventId).toHaveBeenCalledWith("evt-1");
  });

  it("skips status updates when booking is not found (orphan eventId)", async () => {
    const bookings = mockBookings();
    bookings.findByEventId.mockResolvedValue(null);
    const sessions = mockSessions();
    const service = makeService({ bookings, sessions });

    await service.finalizePastSession("evt-1");

    expect(bookings.markCompleted).not.toHaveBeenCalled();
    expect(bookings.markNoShow).not.toHaveBeenCalled();
    expect(sessions.deleteByEventId).toHaveBeenCalledWith("evt-1");
  });
});

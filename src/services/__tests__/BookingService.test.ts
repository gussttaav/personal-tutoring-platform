// ARCH-13: Unit tests for BookingService.
import { BookingService } from "../BookingService";
import type { IBookingRepository } from "@/domain/repositories/IBookingRepository";
import type { ISessionRepository } from "@/domain/repositories/ISessionRepository";
import type { ICalendarClient } from "@/infrastructure/google";
import type { IZoomClient } from "@/infrastructure/zoom";
import type { IScheduler } from "@/infrastructure/qstash";
import type { IEmailClient } from "@/infrastructure/resend";
import { CreditService } from "../CreditService";
import type { ICreditsRepository } from "@/domain/repositories/ICreditsRepository";
import type { IAuditRepository } from "@/domain/repositories/IAuditRepository";
import { InsufficientCreditsError, DomainError, SlotUnavailableError } from "@/domain/errors";
import type { BookingRecord } from "@/domain/types";

// ─── Mock factories ───────────────────────────────────────────────────────────

const mockBookings = (): jest.Mocked<IBookingRepository> => ({
  createBooking:           jest.fn().mockResolvedValue({ cancelToken: "ctkn", joinToken: "jtkn" }),
  findByCancelToken:       jest.fn().mockResolvedValue(null),
  findByJoinToken:         jest.fn().mockResolvedValue(null),
  consumeCancelToken:      jest.fn().mockResolvedValue(true),
  listByUser:              jest.fn().mockResolvedValue([]),
  acquireSlotLock:         jest.fn().mockResolvedValue(true),
  releaseSlotLock:         jest.fn().mockResolvedValue(undefined),
  recordRescheduleFailure: jest.fn().mockResolvedValue(undefined),
});

const mockCreditsRepo = (): jest.Mocked<ICreditsRepository> => ({
  getCredits:      jest.fn().mockResolvedValue({ credits: 5, packSize: 5, packLabel: "Pack 5", email: "s@t.com", name: "S", expiresAt: "", lastUpdated: "", stripeSessionId: "" }),
  addCredits:      jest.fn().mockResolvedValue(undefined),
  decrementCredit: jest.fn().mockResolvedValue({ ok: true, remaining: 4 }),
  restoreCredit:   jest.fn().mockResolvedValue({ ok: true, credits: 5 }),
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
  createSession:      jest.fn().mockResolvedValue(undefined),
  findByEventId:      jest.fn().mockResolvedValue(null),
  deleteByEventId:    jest.fn().mockResolvedValue(undefined),
  appendChatMessage:  jest.fn().mockResolvedValue(0),
  listChatMessages:   jest.fn().mockResolvedValue([]),
  countChatMessages:  jest.fn().mockResolvedValue(0),
});

const mockCalendar = (): jest.Mocked<ICalendarClient> => ({
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

const mockScheduler = (): jest.Mocked<IScheduler> => ({
  scheduleAt: jest.fn().mockResolvedValue(undefined),
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
  scheduler?: jest.Mocked<IScheduler>;
  email?:     jest.Mocked<IEmailClient>;
} = {}) =>
  new BookingService(
    overrides.bookings  ?? mockBookings(),
    overrides.credits   ?? makeCreditService(),
    overrides.sessions  ?? mockSessions(),
    overrides.calendar  ?? mockCalendar(),
    overrides.zoom      ?? mockZoom(),
    overrides.scheduler ?? mockScheduler(),
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
    creditsRepo.decrementCredit.mockResolvedValue({ ok: false, remaining: 0 });
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

  it("schedules Zoom cleanup via the scheduler", async () => {
    const scheduler = mockScheduler();
    const service = makeService({ scheduler });

    await service.createBooking(basePackInput());

    expect(scheduler.scheduleAt).toHaveBeenCalledWith(expect.objectContaining({
      body: { eventId: "evt1" },
    }));
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

  it("records dead-letter when calendar fails during non-pack rescheduling", async () => {
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
    ).rejects.toThrow();

    expect(bookings.recordRescheduleFailure).toHaveBeenCalledWith(
      expect.objectContaining({ email: "student@test.com", sessionType: "free15min" })
    );
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
});

// ─── listForUser ──────────────────────────────────────────────────────────────

describe("BookingService.listForUser", () => {
  it("maps repository result to UserBooking[]", async () => {
    const bookings = mockBookings();
    bookings.listByUser.mockResolvedValue([
      {
        cancelToken: "tkn1",
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

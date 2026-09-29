// ARCH-13: Unit tests for BookingService.
// REFACTOR-R4-P1-01: inputs are aligned, correctly-sized slots (fixtures/slots) on an
// all-day schedule, since createBooking now validates the window; checkSlot + the
// free-call cap have their own suites below.
// REFACTOR-R4-P1-03: the logger is mocked so the reschedule suite can assert that a
// failed claim compensation is logged for manual intervention.
// REFACTOR-R4-P1-04: cancelByToken goes through the repository's cancelByToken (the
// cancel_booking RPC) — creditsRestored comes from its result; the saga's credit
// compensation restores to the exact pack it decremented (restoreCreditToPack).
jest.mock("@/lib/logger", () => ({ log: jest.fn() }));
jest.mock("@/lib/availability-cache", () => ({
  invalidate: jest.fn().mockResolvedValue(undefined),
  getCached:  jest.fn().mockResolvedValue(null),
  setCached:  jest.fn().mockResolvedValue(undefined),
}));

import { BookingService } from "../BookingService";
import { InvalidCursorError } from "@/domain/errors";
import type { IBookingRepository } from "@/domain/repositories/IBookingRepository";
import type { ISessionRepository } from "@/domain/repositories/ISessionRepository";
import type { ICalendarClient } from "@/infrastructure/google";
import type { IZoomClient } from "@/infrastructure/zoom";
import type { IEmailClient } from "@/infrastructure/resend";
import type { IUserRepository } from "@/domain/repositories/IUserRepository";
import { CreditService } from "../CreditService";
import { ScheduleService } from "../ScheduleService";
import type { ICreditsRepository } from "@/domain/repositories/ICreditsRepository";
import type { IAuditRepository } from "@/domain/repositories/IAuditRepository";
import {
  InsufficientCreditsError, DomainError, SlotUnavailableError,
  InvalidSlotError, FreeSessionAlreadyUsedError,
} from "@/domain/errors";
import type { BookingRecord, WeeklyHours } from "@/domain/types";
import { alignedSlot, allDaySchedule } from "@/__tests__/fixtures/slots";
import { log } from "@/lib/logger";

// ─── Mock factories ───────────────────────────────────────────────────────────

const mockBookings = (): jest.Mocked<IBookingRepository> => ({
  createBooking:              jest.fn().mockResolvedValue({ cancelToken: "ctkn", joinToken: "jtkn" }),
  findByCancelToken:          jest.fn().mockResolvedValue(null),
  findByJoinToken:            jest.fn().mockResolvedValue(null),
  consumeCancelToken:         jest.fn().mockResolvedValue(true),
  // REFACTOR-R4-P1-04: default = a pack class whose credit went back to its own pack.
  cancelByToken:              jest.fn().mockResolvedValue({
    consumed: true, restored: true, restoredPackId: "pack-1", fromOriginating: true, credits: 5,
  }),
  reinstateBooking:           jest.fn().mockResolvedValue(true),
  listByUser:                 jest.fn().mockResolvedValue([]),
  listHistoryByUser:          jest.fn().mockResolvedValue({ entries: [], nextCursor: null }),
  hasAnyBooking:              jest.fn().mockResolvedValue(false),
  hasActiveFreeSession:       jest.fn().mockResolvedValue(false),
  acquireSlotLock:            jest.fn().mockResolvedValue(true),
  releaseSlotLock:            jest.fn().mockResolvedValue(undefined),
  recordRescheduleFailure:    jest.fn().mockResolvedValue(undefined),
  findIdByEventIdForUser:     jest.fn().mockResolvedValue(null),
  findByEventId:              jest.fn().mockResolvedValue(null),
  findByStripePaymentId:      jest.fn().mockResolvedValue(null),
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
  decrementCredit: jest.fn().mockResolvedValue({ ok: true, remaining: 4, packSize: 5, packId: "pack-1" }),
  restoreCredit:   jest.fn().mockResolvedValue({ ok: true, credits: 5 }),
  restoreCreditToPack: jest.fn().mockResolvedValue(true),
  hasProcessedPayment: jest.fn().mockResolvedValue(false),
  broadcastPaymentConfirmed: jest.fn().mockResolvedValue(undefined),
});

const mockAuditRepo = (): jest.Mocked<IAuditRepository> => ({
  append: jest.fn().mockResolvedValue(undefined),
  list:   jest.fn().mockResolvedValue([]),
  listNotifiedEmails: jest.fn().mockResolvedValue(new Set<string>()),
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
  sendContentReportNotification: jest.fn().mockResolvedValue(undefined),
});

// getLocale defaults to null (no stored preference → 'es' fallback in the service).
const mockUsers = (): jest.Mocked<IUserRepository> => ({
  upsert:      jest.fn().mockResolvedValue("user-id"),
  findByEmail: jest.fn().mockResolvedValue(null),
  getRole:     jest.fn().mockResolvedValue("student"),
  setRole:     jest.fn().mockResolvedValue(undefined),
  getLocale:   jest.fn().mockResolvedValue(null),
  setLocale:   jest.fn().mockResolvedValue(undefined),
  deleteAccount: jest.fn().mockResolvedValue({}),
});

// Stub ScheduleService — BookingService only calls getConfig(). Default min
// notice = 5h (matches the old hardcoded SCHEDULE) so existing timing holds, and
// cancelMinNoticeHours = 2h (the old hardcoded CANCEL_WINDOW_MS) so the
// cancel/reschedule window tests still hold. REFACTOR-R4-P1-01: open all day by
// default, so only the checkSlot suite has to think about working hours.
const mockSchedule = (
  overrides: { cancelMinNoticeHours?: number; weeklyHours?: WeeklyHours } = {},
): ScheduleService =>
  ({
    getConfig: jest.fn().mockResolvedValue({
      weeklyHours: overrides.weeklyHours ?? allDaySchedule(),
      timezone: "Europe/Madrid",
      minNoticeHours: 5,
      cancelMinNoticeHours: overrides.cancelMinNoticeHours ?? 2,
      bookingWindowWeeks: 8,
    }),
    updateConfig: jest.fn().mockResolvedValue(undefined),
  } as unknown as ScheduleService);

const makeService = (overrides: {
  bookings?:  jest.Mocked<IBookingRepository>;
  credits?:   CreditService;
  sessions?:  jest.Mocked<ISessionRepository>;
  calendar?:  jest.Mocked<ICalendarClient>;
  zoom?:      jest.Mocked<IZoomClient>;
  email?:     jest.Mocked<IEmailClient>;
  users?:     jest.Mocked<IUserRepository>;
  schedule?:  ScheduleService;
} = {}) =>
  new BookingService(
    overrides.bookings  ?? mockBookings(),
    overrides.credits   ?? makeCreditService(),
    overrides.sessions  ?? mockSessions(),
    overrides.calendar  ?? mockCalendar(),
    overrides.zoom      ?? mockZoom(),
    overrides.email     ?? mockEmail(),
    overrides.users     ?? mockUsers(),
    overrides.schedule  ?? mockSchedule(),
  );

// Helpers for time
const hoursFromNow = (h: number) => new Date(Date.now() + h * 60 * 60_000).toISOString();

const basePackInput = () => ({
  email: "student@test.com", name: "Student",
  ...alignedSlot("pack", 10),
  sessionType: "pack" as const,
});

// REFACTOR-R4-P1-01: a free call is 15 minutes; a pack-sized window is now INVALID_SLOT.
const baseFreeInput = () => ({
  email: "student@test.com", name: "Student",
  ...alignedSlot("free15min", 10),
  sessionType: "free15min" as const,
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
      service.createBooking({ ...basePackInput(), ...alignedSlot("pack", -1) })
    ).rejects.toThrow(SlotUnavailableError);
  });

  // ARCH-14: REQUIRES_PAYMENT guard moved to /api/book route handler so that
  // PaymentService can call createBooking() directly after Stripe payment.

  it("does not decrement credits for free15min sessions", async () => {
    const creditsRepo = mockCreditsRepo();
    const service = makeService({ credits: makeCreditService(creditsRepo) });

    await service.createBooking(baseFreeInput());

    expect(creditsRepo.decrementCredit).not.toHaveBeenCalled();
  });

  it("decrements credits for pack sessions", async () => {
    const creditsRepo = mockCreditsRepo();
    const service = makeService({ credits: makeCreditService(creditsRepo) });

    await service.createBooking(basePackInput());

    expect(creditsRepo.decrementCredit).toHaveBeenCalledWith("student@test.com");
  });

  // BOOKING-PACKLINK-01: the decremented pack's id is persisted on the booking so
  // packSize (and later the price) can be resolved from the pack.
  it("links a pack booking to the pack it drew a credit from", async () => {
    const creditsRepo = mockCreditsRepo();
    creditsRepo.decrementCredit.mockResolvedValue({ ok: true, remaining: 4, packSize: 5, packId: "pack-xyz" });
    const bookings = mockBookings();
    const service  = makeService({ credits: makeCreditService(creditsRepo), bookings });

    await service.createBooking(basePackInput());

    expect(bookings.createBooking).toHaveBeenCalledWith(
      expect.objectContaining({ creditPackId: "pack-xyz" }),
    );
  });

  it("does not set creditPackId for non-pack sessions", async () => {
    const bookings = mockBookings();
    const service  = makeService({ bookings });

    await service.createBooking(baseFreeInput());

    expect(bookings.createBooking).toHaveBeenCalledWith(
      expect.not.objectContaining({ creditPackId: expect.anything() }),
    );
  });

  it("throws InsufficientCreditsError and does NOT create calendar event when credits are zero", async () => {
    const creditsRepo = mockCreditsRepo();
    creditsRepo.decrementCredit.mockResolvedValue({ ok: false, remaining: 0, packSize: null, packId: null });
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
    expect(creditsRepo.restoreCreditToPack).toHaveBeenCalledWith("pack-1");
    expect(creditsRepo.restoreCredit).not.toHaveBeenCalled();
  });

  it("does NOT restore credit when calendar fails on a free session", async () => {
    const creditsRepo = mockCreditsRepo();
    const calendar = mockCalendar();
    calendar.createEvent.mockRejectedValue(new Error("Calendar down"));

    const service = makeService({ credits: makeCreditService(creditsRepo), calendar });

    await expect(
      service.createBooking(baseFreeInput())
    ).rejects.toThrow();

    expect(creditsRepo.restoreCredit).not.toHaveBeenCalled();
    expect(creditsRepo.restoreCreditToPack).not.toHaveBeenCalled();
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

  // REFACTOR-R3-P1-01: send() now throws on Resend failure, so sendWithRetry
  // actually retries and emailFailed reflects reality.
  it("returns emailFailed: true after 3 failed confirmation attempts (booking still succeeds)", async () => {
    const email = mockEmail();
    email.sendConfirmation.mockRejectedValue(new Error("resend down"));
    const service = makeService({ email });

    const result = await service.createBooking(basePackInput());

    expect(email.sendConfirmation).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({ eventId: "evt1", emailFailed: true });
  }, 15_000);

  it("returns emailFailed: false when confirmation succeeds on the third attempt", async () => {
    const email = mockEmail();
    email.sendConfirmation
      .mockRejectedValueOnce(new Error("resend down"))
      .mockRejectedValueOnce(new Error("resend down"));
    const service = makeService({ email });

    const result = await service.createBooking(basePackInput());

    expect(email.sendConfirmation).toHaveBeenCalledTimes(3);
    expect(result.emailFailed).toBe(false);
  }, 15_000);

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
        ...baseFreeInput(), rescheduleToken: "tkn",
      })
    ).rejects.toThrow("Calendar down");

    // Compensation framework replaced the old recordRescheduleFailure dead-letter call.
    expect(bookings.recordRescheduleFailure).not.toHaveBeenCalled();
  });

  it("passes locale: 'en' to sendConfirmation when users.locale is 'en'", async () => {
    const email = mockEmail();
    const users = mockUsers();
    users.getLocale.mockResolvedValue("en");
    const service = makeService({ email, users });

    await service.createBooking(basePackInput());

    expect(users.getLocale).toHaveBeenCalledWith("student@test.com");
    expect(email.sendConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "en" })
    );
  });

  it("defaults to locale: 'es' for sendConfirmation when users.locale is unset", async () => {
    const email = mockEmail();
    const users = mockUsers(); // getLocale → null
    const service = makeService({ email, users });

    await service.createBooking(basePackInput());

    expect(email.sendConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "es" })
    );
  });

  it("sends English session label to student but Spanish label to admin notification", async () => {
    const email = mockEmail();
    const users = mockUsers();
    users.getLocale.mockResolvedValue("en");
    const service = makeService({ email, users });

    await service.createBooking(basePackInput());

    const confirmCall = email.sendConfirmation.mock.calls[0]?.[0];
    const notifyCall  = email.sendNewBookingNotification.mock.calls[0]?.[0];
    expect(confirmCall?.sessionLabel).toBe("Pack class");
    expect(notifyCall?.sessionLabel).toBe("Clase de pack");
  });
});

// ─── REFACTOR-R4-P1-03: reschedule keeps the original until the new one commits ──

describe("REFACTOR-R4-P1-03: reschedule keeps the original until the new one commits", () => {
  const oldPack = () => baseCancelRecord({
    eventId: "old-evt", sessionType: "pack", startsAt: hoursFromNow(5),
    packSize: 10, creditPackId: "pack-orig",
  });

  /** Asserts nothing of the original was deleted — its event, Zoom session and pending termination. */
  const expectOriginalUntouched = (
    calendar: jest.Mocked<ICalendarClient>,
    sessions: jest.Mocked<ISessionRepository>,
    bookings: jest.Mocked<IBookingRepository>,
  ) => {
    expect(calendar.deleteEvent).not.toHaveBeenCalledWith("old-evt");
    expect(sessions.deleteByEventId).not.toHaveBeenCalledWith("old-evt");
    expect(bookings.deletePendingTermination).not.toHaveBeenCalledWith("old-evt");
  };

  it("a calendar failure after the claim reinstates the original and deletes none of it", async () => {
    const bookings = mockBookings();
    const original = oldPack();
    bookings.findByCancelToken.mockResolvedValue(original);
    const calendar = mockCalendar();
    calendar.createEvent.mockRejectedValue(new Error("Calendar down"));
    const sessions = mockSessions();
    const service  = makeService({ bookings, calendar, sessions });

    await expect(service.createBooking({ ...basePackInput(), rescheduleToken: "tkn" }))
      .rejects.toThrow("Calendar down");

    expect(bookings.consumeCancelToken).toHaveBeenCalledWith("tkn");
    expect(bookings.reinstateBooking).toHaveBeenCalledWith(original);
    expectOriginalUntouched(calendar, sessions, bookings);
  });

  it("a booking-insert failure (e.g. the exclusion constraint) reinstates the original; the new event is deleted", async () => {
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(oldPack());
    bookings.createBooking.mockRejectedValue(Object.assign(new Error("conflicting key value"), { code: "23P01" }));
    const calendar = mockCalendar();
    const sessions = mockSessions();
    const service  = makeService({ bookings, calendar, sessions });

    await expect(service.createBooking({ ...basePackInput(), rescheduleToken: "tkn" }))
      .rejects.toThrow("conflicting key value");

    expect(calendar.deleteEvent).toHaveBeenCalledWith("evt1");
    expect(bookings.reinstateBooking).toHaveBeenCalledTimes(1);
    expectOriginalUntouched(calendar, sessions, bookings);
  });

  it("a Zoom-session insert failure cancels the new booking, then reinstates the original", async () => {
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(oldPack());
    const calendar = mockCalendar();
    const sessions = mockSessions();
    sessions.createSession.mockRejectedValue(new Error("zoom_sessions insert failed"));
    const service  = makeService({ bookings, calendar, sessions });

    await expect(service.createBooking({ ...basePackInput(), rescheduleToken: "tkn" }))
      .rejects.toThrow("zoom_sessions insert failed");

    // The new booking is cancelled BEFORE the reinstate (compensations run in reverse),
    // so an overlapping original can come back without tripping the exclusion constraint.
    expect(bookings.consumeCancelToken).toHaveBeenCalledWith("ctkn");
    const cancelNew = bookings.consumeCancelToken.mock.invocationCallOrder[1]!;
    expect(cancelNew).toBeLessThan(bookings.reinstateBooking.mock.invocationCallOrder[0]!);
    expect(calendar.deleteEvent).toHaveBeenCalledWith("evt1");
    expectOriginalUntouched(calendar, sessions, bookings);
  });

  it("tears the original down only after the new booking and its Zoom session exist", async () => {
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(oldPack());
    const calendar = mockCalendar();
    const sessions = mockSessions();
    const service  = makeService({ bookings, calendar, sessions });

    await service.createBooking({ ...basePackInput(), rescheduleToken: "tkn" });

    const zoomCreated = sessions.createSession.mock.invocationCallOrder[0]!;
    expect(calendar.deleteEvent).toHaveBeenCalledWith("old-evt");
    expect(calendar.deleteEvent.mock.invocationCallOrder[0]!).toBeGreaterThan(zoomCreated);
    expect(sessions.deleteByEventId.mock.invocationCallOrder[0]!).toBeGreaterThan(zoomCreated);
    expect(bookings.deletePendingTermination.mock.invocationCallOrder[0]!).toBeGreaterThan(zoomCreated);
    expect(bookings.reinstateBooking).not.toHaveBeenCalled();
  });

  it("a failed teardown step does not fail the reschedule (best-effort, logged)", async () => {
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(oldPack());
    const calendar = mockCalendar();
    calendar.deleteEvent.mockRejectedValue(new Error("Calendar delete failed"));
    const sessions = mockSessions();
    const service  = makeService({ bookings, calendar, sessions });

    await expect(service.createBooking({ ...basePackInput(), rescheduleToken: "tkn" }))
      .resolves.toMatchObject({ eventId: "evt1" });

    // The remaining steps still ran, and the new booking was not rolled back.
    expect(sessions.deleteByEventId).toHaveBeenCalledWith("old-evt");
    expect(bookings.deletePendingTermination).toHaveBeenCalledWith("old-evt");
    expect(bookings.reinstateBooking).not.toHaveBeenCalled();
    expect(bookings.consumeCancelToken).not.toHaveBeenCalledWith("ctkn");
  });

  it("a rejection before the claim has nothing to reinstate", async () => {
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(oldPack());
    bookings.consumeCancelToken.mockResolvedValue(false); // a concurrent reschedule won
    const service  = makeService({ bookings });

    await expect(service.createBooking({ ...basePackInput(), rescheduleToken: "tkn" }))
      .rejects.toMatchObject({ code: "RESCHEDULE_TOKEN_CONSUMED" });
    expect(bookings.reinstateBooking).not.toHaveBeenCalled();
  });

  it("a pack reschedule moves the original's credit: no decrement, no restore", async () => {
    const bookings    = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(oldPack());
    const creditsRepo = mockCreditsRepo();
    const service     = makeService({ bookings, credits: makeCreditService(creditsRepo) });

    await service.createBooking({ ...basePackInput(), rescheduleToken: "tkn" });

    expect(creditsRepo.decrementCredit).not.toHaveBeenCalled();
    expect(creditsRepo.restoreCredit).not.toHaveBeenCalled();
    expect(creditsRepo.restoreCreditToPack).not.toHaveBeenCalled();
    expect(bookings.createBooking).toHaveBeenCalledWith(
      expect.objectContaining({ creditPackId: "pack-orig", packSize: 10 }),
    );
  });

  it("a failed pack reschedule does not touch credits either", async () => {
    const bookings    = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(oldPack());
    const creditsRepo = mockCreditsRepo();
    const calendar    = mockCalendar();
    calendar.createEvent.mockRejectedValue(new Error("Calendar down"));
    const service     = makeService({ bookings, calendar, credits: makeCreditService(creditsRepo) });

    await expect(service.createBooking({ ...basePackInput(), rescheduleToken: "tkn" })).rejects.toThrow();

    expect(creditsRepo.decrementCredit).not.toHaveBeenCalled();
    expect(creditsRepo.restoreCredit).not.toHaveBeenCalled();
    expect(creditsRepo.restoreCreditToPack).not.toHaveBeenCalled();
  });

  it("a paid reschedule carries the original's PaymentIntent to the new booking", async () => {
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(baseCancelRecord({
      eventId: "old-evt", sessionType: "session1h", startsAt: hoursFromNow(5), stripePaymentId: "pi_orig",
    }));
    const service  = makeService({ bookings });

    await service.createBooking({
      email: "student@test.com", name: "Student",
      ...alignedSlot("session1h", 10), sessionType: "session1h", rescheduleToken: "tkn",
    });

    expect(bookings.createBooking).toHaveBeenCalledWith(
      expect.objectContaining({ stripePaymentId: "pi_orig" }),
    );
  });

  it("logs a failed reinstate for manual intervention and still throws the original error", async () => {
    (log as jest.Mock).mockClear();
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(oldPack());
    bookings.reinstateBooking.mockResolvedValue(false); // the slot was re-taken meanwhile
    const calendar = mockCalendar();
    calendar.createEvent.mockRejectedValue(new Error("Calendar down"));
    const service  = makeService({ bookings, calendar });

    await expect(service.createBooking({ ...basePackInput(), rescheduleToken: "tkn" }))
      .rejects.toThrow("Calendar down");

    expect(log).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("manual intervention"),
      expect.objectContaining({ step: expect.stringContaining("old-evt") }),
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

  it("honors the admin-configured cancellation window (not the old hardcoded 2h)", async () => {
    // With a 6h window, a class 5h away is now INSIDE the window (uncancellable),
    // even though under the old hardcoded 2h it would have been cancellable.
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(
      baseCancelRecord({ startsAt: hoursFromNow(5) })
    );
    const service = makeService({ bookings, schedule: mockSchedule({ cancelMinNoticeHours: 6 }) });

    await expect(service.cancelByToken("tkn")).rejects.toMatchObject({
      code: "OUTSIDE_CANCEL_WINDOW",
    });
  });

  it("throws DomainError when token was already consumed (race condition)", async () => {
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(baseCancelRecord({ startsAt: hoursFromNow(5) }));
    bookings.cancelByToken.mockResolvedValue({
      consumed: false, restored: false, restoredPackId: null, fromOriginating: false, credits: 0,
    });
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

    // REFACTOR-R4-P1-04: the restore happens inside the RPC, not as a second write.
    expect(bookings.cancelByToken).toHaveBeenCalledWith("tkn");
    expect(bookings.consumeCancelToken).not.toHaveBeenCalled();
    expect(creditsRepo.restoreCredit).not.toHaveBeenCalled();
    expect(result.creditsRestored).toBe(true);
  });

  it("does NOT restore credit when cancelling a non-pack session", async () => {
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(
      baseCancelRecord({ sessionType: "free15min", startsAt: hoursFromNow(5) })
    );
    bookings.cancelByToken.mockResolvedValue({
      consumed: true, restored: false, restoredPackId: null, fromOriginating: false, credits: 0,
    });
    const creditsRepo = mockCreditsRepo();
    const service = makeService({ bookings, credits: makeCreditService(creditsRepo) });

    const result = await service.cancelByToken("tkn");

    expect(creditsRepo.restoreCredit).not.toHaveBeenCalled();
    expect(creditsRepo.restoreCreditToPack).not.toHaveBeenCalled();
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

  it("uses users.locale ('en') for the cancellation confirmation email, ignoring the display param", async () => {
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(
      baseCancelRecord({ startsAt: hoursFromNow(5) })
    );
    const email = mockEmail();
    const users = mockUsers();
    users.getLocale.mockResolvedValue("en");
    // Display param is 'es' but the email must follow the account's stored locale.
    const service = makeService({ bookings, email, users });

    await service.cancelByToken("tkn", "es");

    expect(users.getLocale).toHaveBeenCalledWith("s@t.com");
    expect(email.sendCancellationConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "en" })
    );
  });

  it("defaults the cancellation email to 'es' when users.locale is unset", async () => {
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(
      baseCancelRecord({ startsAt: hoursFromNow(5) })
    );
    const email = mockEmail();
    const service = makeService({ bookings, email }); // getLocale → null

    await service.cancelByToken("tkn");

    expect(email.sendCancellationConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "es" })
    );
  });

  it("uses English session label for student (from users.locale) but Spanish for admin notification on cancel", async () => {
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(
      baseCancelRecord({ sessionType: "session1h", startsAt: hoursFromNow(5) })
    );
    const email = mockEmail();
    const users = mockUsers();
    users.getLocale.mockResolvedValue("en");
    const service = makeService({ bookings, email, users });

    await service.cancelByToken("tkn");

    const confirmCall = email.sendCancellationConfirmation.mock.calls[0]?.[0];
    const notifyCall  = email.sendCancellationNotification.mock.calls[0]?.[0];
    expect(confirmCall?.sessionLabel).toBe("Individual session · 1 hour");
    expect(notifyCall?.sessionLabel).toBe("Sesión individual · 1 hora");
  });
});

// ─── REFACTOR-R4-P1-04: atomic cancel, truthful creditsRestored ──────────────

describe("REFACTOR-R4-P1-04: cancelByToken reports what the RPC did", () => {
  const notRestored = { consumed: true, restored: false, restoredPackId: null, fromOriginating: false, credits: 0 };

  it("a pack class whose credit could not be restored → creditsRestored false in the result AND the email", async () => {
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(
      baseCancelRecord({ eventId: "evt-expired", sessionType: "pack", startsAt: hoursFromNow(5) }),
    );
    bookings.cancelByToken.mockResolvedValue(notRestored);
    const email = mockEmail();
    const audit = mockAuditRepo();
    (log as jest.Mock).mockClear();
    const service = makeService({ bookings, email, credits: new CreditService(mockCreditsRepo(), audit) });

    const result = await service.cancelByToken("tkn");

    expect(result.creditsRestored).toBe(false);
    expect(email.sendCancellationConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ creditsRestored: false }),
    );
    expect(audit.append).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("no credit could be restored"),
      expect.objectContaining({ eventId: "evt-expired" }),
    );
  });

  it("a restored credit is audited with the pack it went to and the new total", async () => {
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(baseCancelRecord({ startsAt: hoursFromNow(5) }));
    bookings.cancelByToken.mockResolvedValue({
      consumed: true, restored: true, restoredPackId: "pack-other", fromOriginating: false, credits: 7,
    });
    const email = mockEmail();
    const audit = mockAuditRepo();
    const service = makeService({ bookings, email, credits: new CreditService(mockCreditsRepo(), audit) });

    const result = await service.cancelByToken("tkn");

    expect(result.creditsRestored).toBe(true);
    expect(email.sendCancellationConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ creditsRestored: true }),
    );
    expect(audit.append).toHaveBeenCalledWith("s@t.com", {
      action: "restore", credits: 7, packId: "pack-other",
    });
  });

  it("a failed audit write does not fail a cancel that has already committed", async () => {
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(baseCancelRecord({ startsAt: hoursFromNow(5) }));
    const audit = mockAuditRepo();
    audit.append.mockRejectedValue(new Error("audit down"));
    const service = makeService({ bookings, credits: new CreditService(mockCreditsRepo(), audit) });

    await expect(service.cancelByToken("tkn")).resolves.toMatchObject({ creditsRestored: true });
  });

  it("a non-pack cancel ignores a stray `restored` and audits nothing", async () => {
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(
      baseCancelRecord({ sessionType: "session1h", startsAt: hoursFromNow(5) }),
    );
    // Default mock says restored:true — the service still keys off the session type too.
    const audit = mockAuditRepo();
    const service = makeService({ bookings, credits: new CreditService(mockCreditsRepo(), audit) });

    const result = await service.cancelByToken("tkn");

    expect(result.creditsRestored).toBe(false);
    expect(audit.append).not.toHaveBeenCalled();
  });

  it("an RPC failure throws before any teardown — nothing to undo, the link still works", async () => {
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(baseCancelRecord({ startsAt: hoursFromNow(5) }));
    bookings.cancelByToken.mockRejectedValue(new Error("PGRST: connection reset"));
    const calendar = mockCalendar();
    const sessions = mockSessions();
    const email    = mockEmail();
    const service  = makeService({ bookings, calendar, sessions, email });

    await expect(service.cancelByToken("tkn")).rejects.toThrow("connection reset");

    expect(calendar.deleteEvent).not.toHaveBeenCalled();
    expect(sessions.deleteByEventId).not.toHaveBeenCalled();
    expect(bookings.deletePendingTermination).not.toHaveBeenCalled();
    expect(email.sendCancellationConfirmation).not.toHaveBeenCalled();
  });
});

describe("REFACTOR-R4-P1-04: saga compensation restores the exact pack", () => {
  it("a decrement that returned no pack id falls back to restoreCredit(email)", async () => {
    const creditsRepo = mockCreditsRepo();
    creditsRepo.decrementCredit.mockResolvedValue({ ok: true, remaining: 4, packSize: 5, packId: null });
    const calendar = mockCalendar();
    calendar.createEvent.mockRejectedValue(new Error("Calendar down"));
    const service = makeService({ credits: makeCreditService(creditsRepo), calendar });

    await expect(service.createBooking(basePackInput())).rejects.toThrow("Calendar down");

    expect(creditsRepo.restoreCredit).toHaveBeenCalledWith("student@test.com");
    expect(creditsRepo.restoreCreditToPack).not.toHaveBeenCalled();
  });

  it("a pack that can no longer take the credit back is logged for manual intervention", async () => {
    const creditsRepo = mockCreditsRepo();
    creditsRepo.restoreCreditToPack.mockResolvedValue(false);
    const calendar = mockCalendar();
    calendar.createEvent.mockRejectedValue(new Error("Calendar down"));
    (log as jest.Mock).mockClear();
    const service = makeService({ credits: makeCreditService(creditsRepo), calendar });

    await expect(service.createBooking(basePackInput())).rejects.toThrow("Calendar down");

    expect(log).toHaveBeenCalledWith(
      "error",
      "Compensation failed (manual intervention may be needed)",
      expect.objectContaining({ step: "restore decremented credit", error: expect.stringContaining("pack-1") }),
    );
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
      eventId:     "e1",
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
      ...alignedSlot("session1h", 10),
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
      ...alignedSlot("session1h", 10),
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
    expect(creditsRepo.restoreCreditToPack).toHaveBeenCalledWith("pack-1");
    expect(creditsRepo.restoreCredit).not.toHaveBeenCalled();
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
      ...alignedSlot("session1h", 10),
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

// BOOKING-HISTORY-01. The service is a pass-through here — the enrichment and the
// keyset live in the repository — so this asserts the wiring only. The logic that
// can actually be got wrong is covered by the unit tests over booking-history.ts
// and the DB-gated SupabaseBookingRepository.history tests.
describe("BookingService.listHistoryForUser", () => {
  it("passes the limit and cursor through to the repository and returns its page", async () => {
    const bookings = mockBookings();
    const page = {
      entries: [{
        id: "b1", eventId: "evt-1", sessionType: "pack" as const, status: "completed" as const,
        startsAt: "2026-06-14T17:00:00.000Z", endsAt: "2026-06-14T18:00:00.000Z",
        packSize: 10, note: null, amountCents: 3000, currency: "eur",
        review: { rating: 5, comment: null },
      }],
      nextCursor: "2026-06-14T17:00:00.000Z_b1",
    };
    bookings.listHistoryByUser.mockResolvedValue(page);
    const service = makeService({ bookings });

    const result = await service.listHistoryForUser("a@b.com", { limit: 20, cursor: "cur" });

    expect(bookings.listHistoryByUser).toHaveBeenCalledWith("a@b.com", { limit: 20, cursor: "cur" });
    expect(result).toEqual(page);
  });

  it("propagates a malformed-cursor rejection rather than swallowing it", async () => {
    const bookings = mockBookings();
    bookings.listHistoryByUser.mockRejectedValue(new InvalidCursorError());
    const service = makeService({ bookings });

    await expect(service.listHistoryForUser("a@b.com", { limit: 20, cursor: "bad" }))
      .rejects.toBeInstanceOf(InvalidCursorError);
  });
});

// ─── REFACTOR-R4-P1-01: server-side slot validation ──────────────────────────

describe("REFACTOR-R4-P1-01: BookingService.checkSlot", () => {
  // Fixed clock: Monday 2026-10-05, 08:00 in Madrid (CEST, UTC+2). Min notice is 5h,
  // so the earliest bookable start is 13:00 Madrid (11:00Z). Slots are literal
  // instants so the tutor-timezone arithmetic stays visible.
  const NOW = Date.parse("2026-10-05T06:00:00.000Z");
  // The seeded Monday (migration 0013): 09:00–13:30 + 15:30–17:30.
  const MONDAY_SEEDED: WeeklyHours = {
    0: [], 1: [{ startMinute: 540, endMinute: 810 }, { startMinute: 930, endMinute: 1050 }],
    2: [], 3: [], 4: [], 5: [], 6: [],
  };
  const MONDAY_ALL_DAY: WeeklyHours = {
    0: [], 1: [{ startMinute: 0, endMinute: 1440 }], 2: [], 3: [], 4: [], 5: [], 6: [],
  };
  // 15:30–16:30 Madrid on the seeded Monday: after min-notice, inside the afternoon block.
  const GOOD = { startIso: "2026-10-05T13:30:00.000Z", endIso: "2026-10-05T14:30:00.000Z", sessionType: "pack" as const };

  let nowSpy: jest.SpyInstance;
  beforeEach(() => { nowSpy = jest.spyOn(Date, "now").mockReturnValue(NOW); });
  afterEach(() => { nowSpy.mockRestore(); });

  const seeded = () => ({ service: makeService({ schedule: mockSchedule({ weeklyHours: MONDAY_SEEDED }) }) });

  it("returns null for an aligned, in-hours slot of the right length", async () => {
    const { service } = seeded();
    await expect(service.checkSlot(GOOD)).resolves.toBeNull();
  });

  describe("INVALID_SLOT (a window the grid could never produce)", () => {
    it.each([
      ["a free call as a 60-minute window", { ...GOOD, sessionType: "free15min" as const }],
      ["a pack class as a 30-minute window", { ...GOOD, endIso: "2026-10-05T14:00:00.000Z" }],
      ["a 1h session as an 8-hour window", { ...GOOD, sessionType: "session1h" as const, endIso: "2026-10-05T21:30:00.000Z" }],
      ["an end before the start", { ...GOOD, endIso: "2026-10-05T12:30:00.000Z" }],
      ["an unparseable start", { ...GOOD, startIso: "not-a-date" }],
    ])("rejects %s", async (_label, slot) => {
      const { service } = seeded();
      await expect(service.checkSlot(slot)).resolves.toBeInstanceOf(InvalidSlotError);
    });

    it("rejects a start off the 15-minute grid in the tutor's timezone", async () => {
      const { service } = seeded();
      const slot = { ...GOOD, startIso: "2026-10-05T13:37:00.000Z", endIso: "2026-10-05T14:37:00.000Z" };
      await expect(service.checkSlot(slot)).resolves.toBeInstanceOf(InvalidSlotError);
    });

    it("rejects a start with stray seconds", async () => {
      const { service } = seeded();
      const slot = { ...GOOD, startIso: "2026-10-05T13:30:30.000Z", endIso: "2026-10-05T14:30:30.000Z" };
      await expect(service.checkSlot(slot)).resolves.toBeInstanceOf(InvalidSlotError);
    });
  });

  describe("SLOT_UNAVAILABLE (a slot the grid does not offer)", () => {
    it("rejects a start before the min-notice horizon", async () => {
      const { service } = seeded();
      // 12:00–13:00 Madrid: inside the morning block, but only 4h from now.
      const slot = { ...GOOD, startIso: "2026-10-05T10:00:00.000Z", endIso: "2026-10-05T11:00:00.000Z" };
      await expect(service.checkSlot(slot)).resolves.toBeInstanceOf(SlotUnavailableError);
    });

    it("rejects a start beyond the booking window (8 weeks)", async () => {
      const service = makeService(); // all-day schedule: only the window can reject
      // Monday 7 Dec 2026, 11:00 Madrid — 63 days out.
      const slot = { ...GOOD, startIso: "2026-12-07T10:00:00.000Z", endIso: "2026-12-07T11:00:00.000Z" };
      await expect(service.checkSlot(slot)).resolves.toBeInstanceOf(SlotUnavailableError);
    });

    it("rejects a slot in the gap between two working blocks", async () => {
      const { service } = seeded();
      // 14:00–15:00 Madrid: between 13:30 and 15:30.
      const slot = { ...GOOD, startIso: "2026-10-05T12:00:00.000Z", endIso: "2026-10-05T13:00:00.000Z" };
      await expect(service.checkSlot(slot)).resolves.toBeInstanceOf(SlotUnavailableError);
    });

    it("rejects a slot that starts inside a block but runs past its end", async () => {
      const { service } = seeded();
      // 17:00–18:00 Madrid: the afternoon block closes at 17:30.
      const slot = { ...GOOD, startIso: "2026-10-05T15:00:00.000Z", endIso: "2026-10-05T16:00:00.000Z" };
      await expect(service.checkSlot(slot)).resolves.toBeInstanceOf(SlotUnavailableError);
    });

    it("rejects a slot on a day with no working hours", async () => {
      const { service } = seeded();
      // Tuesday 6 Oct, 10:00 Madrid: the MONDAY_SEEDED schedule has nothing on Tuesdays.
      const slot = { ...GOOD, startIso: "2026-10-06T08:00:00.000Z", endIso: "2026-10-06T09:00:00.000Z" };
      await expect(service.checkSlot(slot)).resolves.toBeInstanceOf(SlotUnavailableError);
    });
  });

  it("uses the tutor's calendar day, not the UTC date", async () => {
    const service = makeService({ schedule: mockSchedule({ weeklyHours: MONDAY_ALL_DAY }) });
    // 00:30 Tuesday in Madrid is still Monday in UTC → closed.
    const tuesdayMadrid = { ...GOOD, startIso: "2026-10-05T22:30:00.000Z", endIso: "2026-10-05T23:30:00.000Z" };
    await expect(service.checkSlot(tuesdayMadrid)).resolves.toBeInstanceOf(SlotUnavailableError);
    // 00:30 Monday 12 Oct in Madrid is still Sunday in UTC → open.
    const mondayMadrid = { ...GOOD, startIso: "2026-10-11T22:30:00.000Z", endIso: "2026-10-11T23:30:00.000Z" };
    await expect(service.checkSlot(mondayMadrid)).resolves.toBeNull();
  });

  it("makes no Calendar call (in-process checks only)", async () => {
    const calendar = mockCalendar();
    const service  = makeService({ calendar, schedule: mockSchedule({ weeklyHours: MONDAY_SEEDED }) });
    await service.checkSlot(GOOD);
    expect(calendar.getAvailableSlots).not.toHaveBeenCalled();
  });

  it("fails closed: a schedule-config read error propagates", async () => {
    const schedule = mockSchedule();
    (schedule.getConfig as jest.Mock).mockRejectedValue(new Error("config unavailable"));
    const service = makeService({ schedule });
    await expect(service.checkSlot(GOOD)).rejects.toThrow("config unavailable");
  });

  it("assertSlotBookable throws the verdict and resolves on a bookable slot", async () => {
    const { service } = seeded();
    await expect(service.assertSlotBookable(GOOD)).resolves.toBeUndefined();
    await expect(service.assertSlotBookable({ ...GOOD, sessionType: "free15min" }))
      .rejects.toBeInstanceOf(InvalidSlotError);
  });
});

describe("REFACTOR-R4-P1-01: createBooking validates before any side effect", () => {
  it.each([
    ["an off-grid start", () => {
      const s = alignedSlot("pack", 10);
      const shift = (iso: string) => new Date(new Date(iso).getTime() + 7 * 60_000).toISOString();
      return { startIso: shift(s.startIso), endIso: shift(s.endIso) };
    }, InvalidSlotError],
    ["a window longer than the session", () => {
      const s = alignedSlot("pack", 10);
      return { startIso: s.startIso, endIso: new Date(new Date(s.startIso).getTime() + 4 * 3_600_000).toISOString() };
    }, InvalidSlotError],
  ])("rejects %s — no lock, no credit, no event, no row", async (_label, window, errorClass) => {
    const bookings    = mockBookings();
    const creditsRepo = mockCreditsRepo();
    const calendar    = mockCalendar();
    const service     = makeService({ bookings, calendar, credits: makeCreditService(creditsRepo) });

    await expect(service.createBooking({ ...basePackInput(), ...window() })).rejects.toBeInstanceOf(errorClass);

    expect(bookings.acquireSlotLock).not.toHaveBeenCalled();
    expect(creditsRepo.decrementCredit).not.toHaveBeenCalled();
    expect(calendar.createEvent).not.toHaveBeenCalled();
    expect(bookings.createBooking).not.toHaveBeenCalled();
  });

  it("rejects an off-hours slot — no lock, no credit, no event, no row", async () => {
    const bookings    = mockBookings();
    const creditsRepo = mockCreditsRepo();
    const calendar    = mockCalendar();
    const closed      = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    const service     = makeService({
      bookings, calendar, credits: makeCreditService(creditsRepo),
      schedule: mockSchedule({ weeklyHours: closed }),
    });

    await expect(service.createBooking(basePackInput())).rejects.toBeInstanceOf(SlotUnavailableError);

    expect(bookings.acquireSlotLock).not.toHaveBeenCalled();
    expect(creditsRepo.decrementCredit).not.toHaveBeenCalled();
    expect(calendar.createEvent).not.toHaveBeenCalled();
    expect(bookings.createBooking).not.toHaveBeenCalled();
  });

  it("rejects a paid-session reschedule stretched past its length", async () => {
    const bookings = mockBookings();
    bookings.findByCancelToken.mockResolvedValue(
      baseCancelRecord({ sessionType: "session1h", startsAt: hoursFromNow(5) })
    );
    const service = makeService({ bookings });
    const s       = alignedSlot("session1h", 10);

    await expect(service.createBooking({
      email: "student@test.com", name: "Student", sessionType: "session1h", rescheduleToken: "tkn",
      startIso: s.startIso, endIso: new Date(new Date(s.startIso).getTime() + 5 * 3_600_000).toISOString(),
    })).rejects.toBeInstanceOf(InvalidSlotError);
    expect(bookings.consumeCancelToken).not.toHaveBeenCalled();
  });

  it("locks the slot for the session type's length", async () => {
    const bookings = mockBookings();
    const service  = makeService({ bookings });
    const input    = {
      email: "student@test.com", name: "Student",
      ...alignedSlot("session2h", 10), sessionType: "session2h" as const,
    };

    await service.createBooking(input);

    expect(bookings.acquireSlotLock).toHaveBeenCalledWith(input.startIso, 120);
  });
});

describe("REFACTOR-R4-P1-01: free-call cap", () => {
  it("rejects a second free call with FREE_SESSION_ALREADY_USED before any side effect", async () => {
    const bookings = mockBookings();
    bookings.hasActiveFreeSession.mockResolvedValue(true);
    const calendar = mockCalendar();
    const service  = makeService({ bookings, calendar });

    await expect(service.createBooking(baseFreeInput())).rejects.toBeInstanceOf(FreeSessionAlreadyUsedError);

    expect(bookings.hasActiveFreeSession).toHaveBeenCalledWith("student@test.com");
    expect(bookings.acquireSlotLock).not.toHaveBeenCalled();
    expect(calendar.createEvent).not.toHaveBeenCalled();
  });

  it("books the first free call", async () => {
    const bookings = mockBookings();
    const service  = makeService({ bookings });

    await expect(service.createBooking(baseFreeInput())).resolves.toMatchObject({ eventId: "evt1" });
    expect(bookings.hasActiveFreeSession).toHaveBeenCalledWith("student@test.com");
  });

  it("lets a free call be rescheduled (the old one is being replaced, not added to)", async () => {
    const bookings = mockBookings();
    bookings.hasActiveFreeSession.mockResolvedValue(true);
    bookings.findByCancelToken.mockResolvedValue(
      baseCancelRecord({ sessionType: "free15min", startsAt: hoursFromNow(5) })
    );
    const service = makeService({ bookings });

    await expect(service.createBooking({ ...baseFreeInput(), rescheduleToken: "tkn" }))
      .resolves.toMatchObject({ eventId: "evt1" });
    expect(bookings.hasActiveFreeSession).not.toHaveBeenCalled();
  });

  it("does not apply to paid or pack classes", async () => {
    const bookings = mockBookings();
    bookings.hasActiveFreeSession.mockResolvedValue(true);
    const service = makeService({ bookings });

    await expect(service.createBooking(basePackInput())).resolves.toMatchObject({ eventId: "evt1" });
    expect(bookings.hasActiveFreeSession).not.toHaveBeenCalled();
  });

  it("propagates a failed cap read instead of booking", async () => {
    const bookings = mockBookings();
    bookings.hasActiveFreeSession.mockRejectedValue(new Error("db down"));
    const calendar = mockCalendar();
    const service  = makeService({ bookings, calendar });

    await expect(service.createBooking(baseFreeInput())).rejects.toThrow("db down");
    expect(calendar.createEvent).not.toHaveBeenCalled();
  });
});

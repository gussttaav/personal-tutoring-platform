// ACCOUNT-DELETE-01: unit tests for AccountService.
//
// The eligibility ladder is the whole feature, so the matrix below is the point of
// this suite: every row is a state a real student can be in, and the expectation is
// which remedy (if any) he is sent to.
//
// REFACTOR-R4-P1-02: the gate fails closed — a read error behind it must reject the
// deletion, never read as "no credits / no bookings" (see the in-memory suite at the end).
jest.mock("@/lib/availability-cache", () => ({
  invalidate: jest.fn().mockResolvedValue(undefined),
}));

import { AccountService } from "../AccountService";
import { BookingService } from "../BookingService";
import { CreditService } from "../CreditService";
import type { IUserRepository } from "@/domain/repositories/IUserRepository";
import type { ICalendarClient } from "@/infrastructure/google";
import type { CreditResult, DeletionBlockReason, SessionType, UserBooking } from "@/domain/types";
import {
  AccountDeletionBlockedByBookingsError,
  AccountDeletionBlockedByPackError,
  DeletionNotConfirmedError,
  UserNotFoundError,
} from "@/domain/errors";
import { InMemoryBookingRepository } from "@/__tests__/fixtures/InMemoryBookingRepository";
import { InMemoryCreditsRepository } from "@/__tests__/fixtures/InMemoryCreditsRepository";
import { InMemoryUserRepository } from "@/__tests__/fixtures/InMemoryUserRepository";
import {
  buildTestAccountService, buildTestBookingService, buildTestCreditService,
} from "@/__tests__/fixtures/services";

const EMAIL = "student@example.com";
const HOUR  = 60 * 60_000;
// The cancellation window is now admin-editable; BookingService.getCancelWindowMs()
// resolves it. This suite mocks that to the default (2h) — the value AccountService
// partitions against.
const CANCEL_WINDOW_MS = 2 * HOUR;

/** A confirmed booking starting `offsetMs` from now. Negative = in the past. */
function booking(offsetMs: number, sessionType: SessionType = "session1h"): UserBooking {
  const start = new Date(Date.now() + offsetMs);
  const end   = new Date(start.getTime() + HOUR);
  return {
    eventId:   `evt-${offsetMs}-${sessionType}`,
    token:     "cancel-token",
    joinToken: "join-token",
    sessionType,
    startsAt:  start.toISOString(),
    endsAt:    end.toISOString(),
  };
}

const mockUsers = (): jest.Mocked<IUserRepository> => ({
  upsert:        jest.fn(),
  findByEmail:   jest.fn(),
  getRole:       jest.fn(),
  setRole:       jest.fn(),
  getLocale:     jest.fn(),
  setLocale:     jest.fn(),
  deleteAccount: jest.fn().mockResolvedValue({ users: 1 }),
  recordFirstBooking: jest.fn().mockResolvedValue(true), // BOOKING-ATTRIBUTION-01
});

function make(opts: { bookings?: UserBooking[]; credits?: number } = {}) {
  const users    = mockUsers();
  const calendar = { deleteEvent: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<ICalendarClient>;

  const balance: CreditResult | null = opts.credits
    ? { credits: opts.credits, name: "Student", packSize: 5 }
    : null;

  const bookings = {
    listForUser:       jest.fn().mockResolvedValue(opts.bookings ?? []),
    getCancelWindowMs: jest.fn().mockResolvedValue(CANCEL_WINDOW_MS),
  } as unknown as BookingService;

  const credits = {
    getBalance: jest.fn().mockResolvedValue(balance),
  } as unknown as CreditService;

  return { service: new AccountService(users, bookings, credits, calendar), users, calendar };
}

describe("AccountService.getDeletionEligibility", () => {
  const cases: {
    name:     string;
    bookings: UserBooking[];
    credits?: number;
    reason:   DeletionBlockReason | null;
  }[] = [
    {
      name:     "nothing upcoming and no pack — safe to delete",
      bookings: [],
      reason:   null,
    },
    {
      name:     "only a class starting in 30 minutes — he cannot cancel it himself, so it does not block",
      bookings: [booking(0.5 * HOUR)],
      reason:   null,
    },
    {
      name:     "a past confirmed booking does not count as upcoming",
      bookings: [booking(-5 * HOUR)],
      reason:   null,
    },
    {
      name:     "a cancellable paid session — cancel it first, under the normal policy",
      bookings: [booking(72 * HOUR)],
      reason:   "CANCELLABLE_BOOKINGS",
    },
    {
      name:     "the only cancellable class is a pack class — cancelling would restore the credit, so go straight to the refund path",
      bookings: [booking(72 * HOUR, "pack")],
      reason:   "ACTIVE_PACK_CREDITS",
    },
    {
      name:     "a cancellable pack class AND a cancellable paid session — he can still act, so send him to cancel",
      bookings: [booking(72 * HOUR, "pack"), booking(96 * HOUR)],
      reason:   "CANCELLABLE_BOOKINGS",
    },
    {
      name:     "cancellable pack class plus an imminent paid session — the only actionable class is the pack one",
      bookings: [booking(72 * HOUR, "pack"), booking(0.5 * HOUR)],
      reason:   "ACTIVE_PACK_CREDITS",
    },
    {
      name:     "redeemable credits with nothing booked",
      bookings: [],
      credits:  3,
      reason:   "ACTIVE_PACK_CREDITS",
    },
    {
      name:     "credits win over cancellable bookings — cancelling would not unblock him",
      bookings: [booking(72 * HOUR)],
      credits:  5,
      reason:   "ACTIVE_PACK_CREDITS",
    },
  ];

  it.each(cases)("$name", async ({ bookings, credits, reason }) => {
    const { service } = make({ bookings, credits });
    const result = await service.getDeletionEligibility(EMAIL);

    expect(result.reason).toBe(reason);
    expect(result.eligible).toBe(reason === null);
  });

  // The boundary is strict (`startsAt > now + window`), matching cancelByToken.
  it("treats a class exactly at the cancellation window as no longer cancellable", async () => {
    const { service } = make({ bookings: [booking(CANCEL_WINDOW_MS)] });
    const result = await service.getDeletionEligibility(EMAIL);

    expect(result.eligible).toBe(true);
    expect(result.imminentBookings).toBe(1);
    expect(result.cancellableBookings).toBe(0);
  });

  it("reports the counts the confirmation UI needs", async () => {
    const { service } = make({
      bookings: [booking(72 * HOUR), booking(0.5 * HOUR), booking(-5 * HOUR)],
      credits:  2,
    });
    const result = await service.getDeletionEligibility(EMAIL);

    expect(result).toMatchObject({
      packCredits:         2,
      cancellableBookings: 1,
      imminentBookings:    1,
    });
  });
});

describe("AccountService.deleteAccount", () => {
  it("refuses when the confirmation does not match, without touching anything", async () => {
    const { service, users } = make();

    await expect(service.deleteAccount(EMAIL, "someone.else@example.com"))
      .rejects.toBeInstanceOf(DeletionNotConfirmedError);
    expect(users.deleteAccount).not.toHaveBeenCalled();
  });

  it("accepts a confirmation differing only in case and whitespace", async () => {
    const { service, users } = make();

    await service.deleteAccount(EMAIL, "  Student@Example.COM ");
    expect(users.deleteAccount).toHaveBeenCalledWith(EMAIL);
  });

  it("refuses an account holding pack credits", async () => {
    const { service, users, calendar } = make({ credits: 4 });

    await expect(service.deleteAccount(EMAIL, EMAIL))
      .rejects.toBeInstanceOf(AccountDeletionBlockedByPackError);
    expect(users.deleteAccount).not.toHaveBeenCalled();
    expect(calendar.deleteEvent).not.toHaveBeenCalled();
  });

  it("refuses an account with classes the student can still cancel", async () => {
    const { service, users, calendar } = make({ bookings: [booking(72 * HOUR)] });

    await expect(service.deleteAccount(EMAIL, EMAIL))
      .rejects.toBeInstanceOf(AccountDeletionBlockedByBookingsError);
    expect(users.deleteAccount).not.toHaveBeenCalled();
    expect(calendar.deleteEvent).not.toHaveBeenCalled();
  });

  it("tears down the calendar events of imminent classes before erasing", async () => {
    const imminent = booking(0.5 * HOUR);
    const { service, users, calendar } = make({ bookings: [imminent, booking(-5 * HOUR)] });

    await service.deleteAccount(EMAIL, EMAIL);

    // Only the still-upcoming one: the past booking has no live calendar event.
    expect(calendar.deleteEvent).toHaveBeenCalledTimes(1);
    expect(calendar.deleteEvent).toHaveBeenCalledWith(imminent.eventId);
    expect(users.deleteAccount).toHaveBeenCalledWith(EMAIL);
  });

  it("still erases the account when Google refuses to delete the event", async () => {
    const { service, users, calendar } = make({ bookings: [booking(0.5 * HOUR)] });
    (calendar.deleteEvent as jest.Mock).mockRejectedValue(new Error("Google is down"));

    await expect(service.deleteAccount(EMAIL, EMAIL)).resolves.toBeUndefined();
    expect(users.deleteAccount).toHaveBeenCalledWith(EMAIL);
  });

  it("propagates UserNotFoundError from the repository", async () => {
    const { service, users } = make();
    users.deleteAccount.mockRejectedValue(new UserNotFoundError());

    await expect(service.deleteAccount(EMAIL, EMAIL)).rejects.toBeInstanceOf(UserNotFoundError);
  });
});

// REFACTOR-R4-P1-02: real Credit/Booking services over the in-memory repositories, so the
// read error travels the same path it does in production (getCredits → getBalance,
// listByUser → listForUser). The user exists, so an open gate WOULD erase him.
describe("REFACTOR-R4-P1-02: deleteAccount fails closed on a read error", () => {
  async function build() {
    const userRepo    = new InMemoryUserRepository();
    const creditsRepo = new InMemoryCreditsRepository();
    const bookingRepo = new InMemoryBookingRepository();
    await userRepo.upsert(EMAIL, "Student");
    const { service } = buildTestAccountService({
      userRepo,
      credits:  buildTestCreditService({ credits: creditsRepo }),
      bookings: buildTestBookingService({ bookings: bookingRepo, users: userRepo }),
    });
    const deleteAccount = jest.spyOn(userRepo, "deleteAccount");
    return { service, creditsRepo, bookingRepo, deleteAccount };
  }

  it("rejects and erases nothing when the credits read errors", async () => {
    const { service, creditsRepo, deleteAccount } = await build();
    creditsRepo.getCreditsShouldFail = true;

    await expect(service.deleteAccount(EMAIL, EMAIL)).rejects.toThrow("simulated read failure");
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("rejects and erases nothing when the bookings read errors", async () => {
    const { service, bookingRepo, deleteAccount } = await build();
    bookingRepo.listByUserShouldFail = true;

    await expect(service.deleteAccount(EMAIL, EMAIL)).rejects.toThrow("simulated read failure");
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("still erases the account when both reads succeed and find nothing", async () => {
    const { service, deleteAccount } = await build();

    await expect(service.deleteAccount(EMAIL, EMAIL)).resolves.toBeUndefined();
    expect(deleteAccount).toHaveBeenCalledWith(EMAIL);
  });
});

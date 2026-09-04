// ACCOUNT-DELETE-01: self-service account deletion.
//
// Deletion is GATED, not unconditional. The rule is "never erase an account that
// still holds redeemable value", because erasure is irreversible and would
// silently burn classes the student paid for. getDeletionEligibility() answers
// whether the account may go and, when it may not, which of the two remedies the
// student needs (cancel your classes / write to Gustavo for a pack refund).
//
// deleteAccount() re-runs that check itself. The GET preflight exists so clients
// can render the right state, but it is advisory: the account state can change
// between the preflight and the DELETE, so the service never trusts it.

import type { AccountDeletionCounts, IUserRepository } from "@/domain/repositories/IUserRepository";
import type { ICalendarClient } from "@/infrastructure/google";
import type { DeletionBlockReason, DeletionEligibility, UserBooking } from "@/domain/types";
import { BookingService } from "./BookingService";
import { CreditService } from "./CreditService";
import {
  AccountDeletionBlockedByBookingsError,
  AccountDeletionBlockedByPackError,
  DeletionNotConfirmedError,
} from "@/domain/errors";
import { log } from "@/lib/logger";
import { invalidate as invalidateAvailability } from "@/lib/availability-cache";

// Re-exported because callers already import these from this service.
export type { DeletionBlockReason, DeletionEligibility };

export class AccountService {
  constructor(
    private readonly users:    IUserRepository,
    private readonly bookings: BookingService,
    private readonly credits:  CreditService,
    private readonly calendar: ICalendarClient,
  ) {}

  async getDeletionEligibility(email: string): Promise<DeletionEligibility> {
    const { cancellable, imminent } = await this.partitionUpcoming(email);
    const packCredits = (await this.credits.getBalance(email))?.credits ?? 0;

    const base = {
      packCredits,
      cancellableBookings: cancellable.length,
      imminentBookings:    imminent.length,
    };

    // 1. Redeemable credits are the terminal blocker: no amount of cancelling
    //    clears them, only a refund from Gustavo does.
    if (packCredits > 0) {
      return { eligible: false, reason: "ACTIVE_PACK_CREDITS", ...base };
    }

    if (cancellable.length > 0) {
      // 2. If every class he can act on is a pack class, cancelling them returns
      //    the credits to the pack and lands him in case 1. Skip the dead end and
      //    point him at the refund path now.
      const allPack = cancellable.every(b => b.sessionType === "pack");
      return allPack
        ? { eligible: false, reason: "ACTIVE_PACK_CREDITS",  ...base }
        // 3. At least one non-pack class he can cancel himself, collecting any
        //    refund under the normal cancellation policy.
        : { eligible: false, reason: "CANCELLABLE_BOOKINGS", ...base };
    }

    // 4. Nothing redeemable and nothing actionable — safe to erase.
    return { eligible: true, reason: null, ...base };
  }

  /**
   * IRREVERSIBLE. Tears down the Google Calendar events for whatever upcoming
   * classes remain (only imminent ones can, by the gate above), then erases every
   * row tied to the account.
   *
   * @param email        identity from the session — never from the request body
   * @param confirmEmail the caller's echo of its own address
   */
  async deleteAccount(email: string, confirmEmail: string): Promise<void> {
    if (email.toLowerCase().trim() !== confirmEmail.toLowerCase().trim()) {
      throw new DeletionNotConfirmedError();
    }

    const eligibility = await this.getDeletionEligibility(email);
    if (!eligibility.eligible) {
      log("info", "Account deletion refused", {
        service: "AccountService", email, reason: eligibility.reason,
        packCredits: eligibility.packCredits,
        cancellableBookings: eligibility.cancellableBookings,
      });
      throw eligibility.reason === "ACTIVE_PACK_CREDITS"
        ? new AccountDeletionBlockedByPackError()
        : new AccountDeletionBlockedByBookingsError();
    }

    // Best-effort teardown, mirroring BookingService.cancelByToken. A Google
    // outage must not block erasure: the DB rows go either way, and a stranded
    // Calendar event is a smaller problem than a half-deleted account.
    const { imminent } = await this.partitionUpcoming(email);
    for (const booking of imminent) {
      if (booking.eventId) {
        try {
          await this.calendar.deleteEvent(booking.eventId);
        } catch (err) {
          log("warn", "Could not delete calendar event during account deletion", {
            service: "AccountService", eventId: booking.eventId, error: String(err),
          });
        }
      }
      await invalidateAvailability(booking.startsAt.slice(0, 10)).catch(() => {});
    }

    const counts: AccountDeletionCounts = await this.users.deleteAccount(email);

    // The audit_log rows are gone by design, so this line is the only surviving
    // trace that the account existed and was erased on request.
    log("info", "Account deleted", {
      service: "AccountService", email, cancelledBookings: imminent.length, ...counts,
    });
  }

  /**
   * Splits the account's still-upcoming confirmed bookings into the ones the
   * student can cancel himself and the ones already inside the window.
   *
   * listForUser returns EVERY confirmed booking, past included, so the
   * still-upcoming filter has to happen here — it mirrors the one the personal
   * area applies client-side (endsAt in the future).
   */
  private async partitionUpcoming(
    email: string,
  ): Promise<{ cancellable: UserBooking[]; imminent: UserBooking[] }> {
    const now = Date.now();
    // Read the (admin-editable) cancellation window from BookingService — the SAME
    // source the cancel endpoint enforces, so eligibility can never disagree with
    // what a real cancel would allow. One cached read per call.
    const cancelWindowMs = await this.bookings.getCancelWindowMs();
    const upcoming = (await this.bookings.listForUser(email))
      .filter(b => new Date(b.endsAt).getTime() > now);

    const cancellable: UserBooking[] = [];
    const imminent:    UserBooking[] = [];
    for (const booking of upcoming) {
      if (new Date(booking.startsAt).getTime() > now + cancelWindowMs) cancellable.push(booking);
      else imminent.push(booking);
    }
    return { cancellable, imminent };
  }
}

// ARCH-13: BookingService — orchestrates session booking, cancellation, and listing.
// Extracted from /api/book, /api/cancel, and /api/my-bookings route handlers so
// that route handlers become thin parsers + dispatchers with no business logic.
//
// REFACTOR-P1-01: Acquires a Postgres-backed slot lock before any side effects
// to prevent concurrent bookings for the same time slot. Replaces the previous
// approach which had no concurrency control between getAvailableSlots and insert.
//
// REFACTOR-P1-03: Wraps createBooking in a saga compensation list. Each
// committed side effect pushes an undo function; on any throw they run
// in reverse. See docs/refactor/phase-1-correctness/03-booking-saga-compensation.md
//
// REFACTOR-P1-04: pending_terminations is written on every booking; the daily cron at
// /api/internal/session-cleanup handles actual Zoom session termination.
//
// REFACTOR-R4-P1-01: the server decides what is bookable. checkSlot() enforces the
// session length, the 15-minute grid, min-notice, the booking window and the working
// blocks — in-process checks only, no network call — and createBooking runs it before
// any side effect. PaymentService runs it at checkout. Also caps the free 15-minute
// call at one non-cancelled booking per user. (Trimmed at Gustavo's request: no
// per-booking Google Calendar read — see docs/refactor/STATUS.md.)
//
// REFACTOR-R4-P1-02: hasBookingForPayment — status-agnostic delegate backing the
// PaymentService webhook's "already fulfilled" gate.
//
// REFACTOR-R4-P1-03: a reschedule CLAIMS the original booking first (so the exclusion
// constraint lets an overlapping new slot in) but tears it down only AFTER the new
// booking commits. Until then the claim has a real compensation: reinstate the row with
// its original tokens, so a failed reschedule leaves the student their class and a
// working link to retry with. A pack reschedule moves the original's credit (pack link)
// to the new booking instead of restore + decrement; a paid one carries its PaymentIntent.
//
// REFACTOR-R4-P1-04: cancelling is one transaction (the cancel_booking RPC): the status
// flip and a pack class's credit restore — to the pack it was paid from, else the
// earliest-expiring active pack with room — commit together or not at all.
// `creditsRestored` reports what the RPC did, not what the session type implies. The
// booking saga's credit compensation restores to the exact pack it decremented.
//
// REFACTOR-R4-P4-02: step 6's comment rewritten. It still described the scheduler
// removed in cycle 2; the ordering now serves pending_terminations + the session-cleanup cron.

import type { IBookingRepository } from "@/domain/repositories/IBookingRepository";
import type { ISessionRepository } from "@/domain/repositories/ISessionRepository";
import type { IUserRepository } from "@/domain/repositories/IUserRepository";
import type { BookingHistoryPage, BookingRecord, SessionType, SingleSessionBookingDetail, UserBooking } from "@/domain/types";
import type { ICalendarClient } from "@/infrastructure/google";
import type { IZoomClient } from "@/infrastructure/zoom";
import type { IEmailClient } from "@/infrastructure/resend";
import { CreditService } from "./CreditService";
import { ScheduleService } from "./ScheduleService";
import {
  DomainError, FreeSessionAlreadyUsedError, InvalidSlotError, SlotUnavailableError,
} from "@/domain/errors";
import { log } from "@/lib/logger";
import { invalidate as invalidateAvailability } from "@/lib/availability-cache";
import {
  SESSION_DURATION_MINUTES, SLOT_ALIGNMENT_MINUTES, isWithinBlocks,
} from "@/lib/booking-config";
import { toZonedTime } from "date-fns-tz";

// ─── Input / output types ─────────────────────────────────────────────────────

export interface CreateBookingInput {
  email:             string;
  name:              string;
  startIso:          string;
  endIso:            string;
  sessionType:       SessionType;
  note?:             string;
  timezone?:         string;
  rescheduleToken?:  string;
  stripePaymentId?:  string;
}

export interface CreateBookingOutput {
  eventId:         string;
  zoomSessionName: string;
  zoomPasscode:    string;
  cancelToken:     string;
  joinToken:       string;
  emailFailed:     boolean;
}

export interface CancelByTokenOutput {
  sessionLabel:    string;
  startIso:        string;
  creditsRestored: boolean;
}

// UserBooking now lives in src/domain/types.ts so client components can import it
// without pulling this module into the browser bundle. Re-exported here because
// existing callers import it from this service.
export type { UserBooking } from "@/domain/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSION_LABELS: Record<SessionType, string> = {
  free15min: "Encuentro inicial gratuito · 15 min",
  session1h: "Sesión individual · 1 hora",
  session2h: "Sesión individual · 2 horas",
  pack:      "Clase de pack",
};

const SESSION_LABELS_EN: Record<SessionType, string> = {
  free15min: "Free intro call · 15 min",
  session1h: "Individual session · 1 hour",
  session2h: "Individual session · 2 hours",
  pack:      "Pack class",
};

type Compensation = { description: string; run: () => Promise<void> };

/** REFACTOR-R4-P1-01: the window a client asks to book, before the server vouches for it. */
export interface SlotRequest {
  startIso:    string;
  endIso:      string;
  sessionType: SessionType;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class BookingService {
  constructor(
    private readonly bookings:   IBookingRepository,
    private readonly credits:    CreditService,
    private readonly sessions:   ISessionRepository,
    private readonly calendar:   ICalendarClient,
    private readonly zoom:       IZoomClient,
    private readonly email:      IEmailClient,
    private readonly users:      IUserRepository,
    private readonly schedule:   ScheduleService,
  ) {}

  // ACCOUNT-DELETE-01 / configurable-policy-params: the cancellation+reschedule
  // window, now admin-editable (booking_settings.cancel_min_notice_hours) rather
  // than a hardcoded constant. Single source of truth: the two guards below and
  // AccountService's deletion-eligibility gate all read it from here so they can
  // never disagree about what "still cancellable" means. The schedule config is
  // cached (Redis version cache + ISR), so this is not a fresh DB round-trip.
  async getCancelWindowMs(): Promise<number> {
    const config = await this.schedule.getConfig();
    return config.cancelMinNoticeHours * 60 * 60_000;
  }

  // REFACTOR-R4-P1-01: the server decides what is bookable. Returns null when the slot
  // is bookable, otherwise the error to throw: InvalidSlotError for a window the grid
  // could never produce (wrong length, off the 15-min grid), SlotUnavailableError for
  // one it doesn't offer (min-notice, booking window, working blocks). The length check
  // is what guarantees a booking never outgrows what was paid for: a free call is 15
  // minutes, a pack credit buys 60. No network call — the schedule config is cached —
  // and a config read error propagates (fail closed).
  async checkSlot(slot: SlotRequest): Promise<DomainError | null> {
    const start = new Date(slot.startIso);
    const end   = new Date(slot.endIso);
    const lenMs = SESSION_DURATION_MINUTES[slot.sessionType] * 60_000;
    if (Number.isNaN(start.getTime()) || end.getTime() - start.getTime() !== lenMs) {
      return new InvalidSlotError();
    }

    const config = await this.schedule.getConfig();
    const zoned  = toZonedTime(start, config.timezone);
    const minute = zoned.getHours() * 60 + zoned.getMinutes();
    if (minute % SLOT_ALIGNMENT_MINUTES !== 0 || zoned.getSeconds() !== 0 || zoned.getMilliseconds() !== 0) {
      return new InvalidSlotError();
    }

    const now = Date.now();
    if (start.getTime() < now + config.minNoticeHours * 3_600_000)         return new SlotUnavailableError();
    if (start.getTime() > now + config.bookingWindowWeeks * 7 * 86_400_000) return new SlotUnavailableError();
    if (!isWithinBlocks(config.weeklyHours[zoned.getDay()] ?? [], minute, lenMs / 60_000)) {
      return new SlotUnavailableError();
    }
    return null;
  }

  async assertSlotBookable(slot: SlotRequest): Promise<void> {
    const err = await this.checkSlot(slot);
    if (err) throw err;
  }

  async createBooking(input: CreateBookingInput): Promise<CreateBookingOutput> {
    const config = await this.schedule.getConfig(); // timezone + cancel window, below

    // 1. REFACTOR-R4-P1-01: slot validator, then the free-call cap — both before any
    //    side effect, so a rejection spends no credit and creates no event or row.
    //    (Min-notice, previously the only guard here, is now part of checkSlot.)
    //    A reschedule moves the existing free call, so it is exempt from the cap.
    await this.assertSlotBookable(input);
    if (input.sessionType === "free15min" && !input.rescheduleToken
        && await this.bookings.hasActiveFreeSession(input.email)) {
      throw new FreeSessionAlreadyUsedError();
    }

    // 2. REFACTOR-P1-01: Acquire slot lock. Held until the booking row is committed
    //    (or compensation completes — see REFACTOR-P1-03).
    //    REFACTOR-R4-P1-01: the validator guarantees the window IS the session length.
    const durationMinutes = SESSION_DURATION_MINUTES[input.sessionType];
    const locked = await this.bookings.acquireSlotLock(input.startIso, durationMinutes);
    if (!locked) {
      throw new SlotUnavailableError();
    }

    // REFACTOR-P1-03: Saga compensation list. On any failure inside the try block,
    // these run in reverse order to undo committed side effects. Best-effort —
    // each compensation logs but does not throw, since the original error is more
    // important and we don't want compensation failures to mask it.
    const compensations: Compensation[] = [];
    const compensate = async () => {
      for (const c of [...compensations].reverse()) {
        try {
          await c.run();
          log("info", "Compensation succeeded", { service: "BookingService", step: c.description });
        } catch (err) {
          log("error", "Compensation failed (manual intervention may be needed)", {
            service: "BookingService", step: c.description, error: String(err),
          });
        }
      }
    };

    try {
      // 3. Reschedule flow — CLAIM the original booking. REFACTOR-R4-P1-03: nothing of
      //    it is deleted here; that waits for the new booking to commit (step 10).
      let oldRecord: BookingRecord | null = null;
      if (input.rescheduleToken) {
        oldRecord = await this.bookings.findByCancelToken(input.rescheduleToken);

        if (!oldRecord) {
          throw new DomainError(
            "Reschedule token is invalid or already used.",
            "INVALID_RESCHEDULE_TOKEN",
          );
        }
        // Reuse the config already fetched above (no second read). cancelMinNoticeHours
        // governs both cancellation and rescheduling.
        const cancelWindowMs = config.cancelMinNoticeHours * 60 * 60_000;
        if (new Date(oldRecord.startsAt) <= new Date(Date.now() + cancelWindowMs)) {
          throw new DomainError(
            `Reschedule window has closed (less than ${config.cancelMinNoticeHours}h before session).`,
            "OUTSIDE_RESCHEDULE_WINDOW",
          );
        }
        if (oldRecord.sessionType !== input.sessionType) {
          throw new DomainError(
            "Session type does not match the original booking.",
            "SESSION_TYPE_MISMATCH",
          );
        }

        const consumed = await this.bookings.consumeCancelToken(input.rescheduleToken);
        if (!consumed) {
          throw new DomainError(
            "Reschedule token has already been consumed.",
            "RESCHEDULE_TOKEN_CONSUMED",
          );
        }

        // REFACTOR-R4-P1-03: the claim's compensation. The original's calendar event, Zoom
        // session and pending termination are all still there, so flipping the row back
        // (original tokens included) is a complete undo. It can fail if another booking
        // took the slot meanwhile — compensate() then logs it for manual intervention.
        const claimed = oldRecord;
        compensations.push({
          description: `reinstate original booking ${claimed.eventId}`,
          run: async () => {
            if (!(await this.bookings.reinstateBooking(claimed))) {
              throw new Error("original booking could not be reinstated (slot re-taken?)");
            }
          },
        });
      }

      // 4. Credit decrement for pack sessions
      let packSizeForToken: number | undefined;
      let creditPackId: string | undefined;
      if (input.sessionType === "pack" && oldRecord) {
        // REFACTOR-R4-P1-03: a pack RESCHEDULE moves the original's credit to the new
        // booking — no decrement, no restore, balance unchanged.
        packSizeForToken = oldRecord.packSize;
        creditPackId     = oldRecord.creditPackId;
      } else if (input.sessionType === "pack") {
        // REFACTOR-P3-03: useCredit now returns the decremented pack's size, so
        // we no longer need a separate getBalance roundtrip.
        // BOOKING-PACKLINK-01: it also returns the pack id, which we persist on the
        // booking below so packSize/price can be resolved from the pack later.
        const { packSize, packId } = await this.credits.useCredit(input.email); // throws InsufficientCreditsError if none
        // REFACTOR-R4-P1-04: back to the exact pack just decremented, not whichever
        // expires first. A restore that finds the pack full/expired throws, so
        // compensate() logs the lost credit for manual intervention.
        compensations.push({
          description: "restore decremented credit",
          run: async () => {
            if (!packId) {
              await this.credits.restoreCredit(input.email);
            } else if (!(await this.credits.restoreCreditToPack(input.email, packId))) {
              throw new Error(`credit could not be restored to pack ${packId} (full or expired)`);
            }
          },
        });
        packSizeForToken = packSize ?? undefined;
        creditPackId     = packId ?? undefined;
      }

      // 5. Calendar event
      const sessionLabel = SESSION_LABELS[input.sessionType];
      const calResult = await this.calendar.createEvent({
        summary:     `${sessionLabel} — ${input.name}`,
        description: [
          `Alumno: ${input.name} (${input.email})`,
          `Tipo: ${sessionLabel}`,
          input.note ? `Motivo: ${input.note}` : null,
          `gustavoai.dev`,
        ].filter((s): s is string => s !== null).join("\n"),
        startIso:     input.startIso,
        endIso:       input.endIso,
        sessionType:  input.sessionType,
        studentEmail: input.email,
        timezone:     config.timezone,
      });
      compensations.push({
        description: `delete Calendar event ${calResult.eventId}`,
        run: async () => { await this.calendar.deleteEvent(calResult.eventId); },
      });
      await invalidateAvailability(input.startIso.slice(0, 10)).catch(() => {});

      // 6. Booking record — written before the pending_terminations row (step 7), so the
      //    daily /api/internal/session-cleanup cron always finds the booking it has to mark
      //    completed / no_show, and before the Zoom session row (step 8, FK).
      //    REFACTOR-R4-P1-03: a rescheduled paid class keeps its PaymentIntent (the
      //    request carries none), so history and the mobile poll find the new booking.
      const stripePaymentId = input.stripePaymentId ?? oldRecord?.stripePaymentId;
      const { cancelToken, joinToken } = await this.bookings.createBooking({
        eventId:     calResult.eventId,
        email:       input.email,
        name:        input.name,
        sessionType: input.sessionType,
        startsAt:    input.startIso,
        endsAt:      input.endIso,
        ...(packSizeForToken    !== undefined ? { packSize:        packSizeForToken    } : {}),
        ...(creditPackId        !== undefined ? { creditPackId:    creditPackId        } : {}),
        ...(stripePaymentId                   ? { stripePaymentId                      } : {}),
      });
      compensations.push({
        description: `cancel booking ${cancelToken.slice(0, 8)}…`,
        run: async () => { await this.bookings.consumeCancelToken(cancelToken); },
      });

      // 7. Record pending_terminations — the daily cron at /api/internal/session-cleanup
      //    terminates Zoom sessions after their grace window elapses. Non-fatal.
      const baseUrl      = process.env.NEXT_PUBLIC_BASE_URL ?? "";
      const startMs      = new Date(input.startIso).getTime();
      const totalMinutes = this.zoom.getDurationWithGrace(input.sessionType);
      const fireAtMs     = startMs + totalMinutes * 60_000;
      try {
        await this.bookings.recordPendingTermination(calResult.eventId, fireAtMs);
      } catch (err) {
        log("error", "pending_terminations write failed — session cleanup may be delayed", {
          service: "BookingService",
          eventId: calResult.eventId,
          error:   String(err),
        });
        // Non-fatal — do not fail the booking
      }

      // 8. Persist Zoom session via repository (after booking so Supabase FK resolves).
      //    No separate compensation — booking cancellation (step 6) cascades to zoom_session.
      await this.sessions.createSession(calResult.eventId, {
        sessionId:       calResult.zoomSessionId,
        sessionName:     calResult.zoomSessionName,
        sessionPasscode: calResult.zoomPasscode,
        startIso:        input.startIso,
        durationMinutes: calResult.durationMinutes,
        sessionType:     input.sessionType,
        studentEmail:    input.email,
      });

      // 9. Confirmation + notification emails (with per-attempt retry).
      //    Not compensated: a leaked "booking confirmed" email is better than deleting a booking.
      //    Locale comes from users.locale (account source of truth), so background
      //    flows (Stripe webhook) localize correctly with no cookie to read.
      const studentLocale = (await this.users.getLocale(input.email)) ?? 'es';
      const studentLabel  = studentLocale === 'en'
        ? SESSION_LABELS_EN[input.sessionType]
        : sessionLabel;
      const joinUrl = `${baseUrl}/sesion/${joinToken}`;
      const [confirmSent] = await Promise.all([
        this.sendWithRetry(
          () => this.email.sendConfirmation({
            to:           input.email,
            studentName:  input.name,
            sessionLabel: studentLabel,
            startIso:     input.startIso,
            endIso:       input.endIso,
            joinToken,
            cancelToken,
            note:         input.note ?? null,
            studentTz:    input.timezone ?? null,
            sessionType:  input.sessionType,
            locale:       studentLocale,
            cancelHours:  config.cancelMinNoticeHours,
          }),
          "confirmation email",
        ),
        this.sendWithRetry(
          () => this.email.sendNewBookingNotification({
            studentEmail: input.email,
            studentName:  input.name,
            sessionLabel,
            startIso:     input.startIso,
            endIso:       input.endIso,
            joinUrl,
            note:         input.note ?? null,
          }),
          "notification email",
        ),
      ]);

      // 10. REFACTOR-R4-P1-03: tear the original down only now — the new booking and its
      //     Zoom session exist and nothing below can throw, so the claim's compensation
      //     can no longer run against an original that is half gone.
      if (oldRecord) {
        await this.teardownRescheduledOriginal(oldRecord);
      }

      return {
        eventId:         calResult.eventId,
        zoomSessionName: calResult.zoomSessionName,
        zoomPasscode:    calResult.zoomPasscode,
        cancelToken,
        joinToken,
        emailFailed:     !confirmSent,
      };
    } catch (err) {
      await compensate();
      throw err;
    } finally {
      await this.bookings.releaseSlotLock(input.startIso).catch(err =>
        log("warn", "Slot lock release failed (will expire on TTL)", {
          service: "BookingService",
          startIso: input.startIso,
          error: String(err),
        })
      );
    }
  }

  async cancelByToken(token: string, locale: 'es' | 'en' = 'es'): Promise<CancelByTokenOutput> {
    // 1. Verify token
    const record = await this.bookings.findByCancelToken(token);
    if (!record) {
      throw new DomainError(
        "Cancel token is invalid or already used.",
        "INVALID_CANCEL_TOKEN",
      );
    }

    // 2. Cancellation-window check — admin-editable (cancel_min_notice_hours).
    const cancelWindowMs = await this.getCancelWindowMs();
    if (new Date(record.startsAt) <= new Date(Date.now() + cancelWindowMs)) {
      throw new DomainError(
        "Cancellation window has closed (too close to the session start).",
        "OUTSIDE_CANCEL_WINDOW",
      );
    }

    // 3. REFACTOR-R4-P1-04: one transaction for the status flip and the credit restore.
    //    findByCancelToken above still verifies the HMAC and feeds the window check —
    //    the RPC trusts the token it is given. If it throws, nothing was written: the
    //    booking is still confirmed and the link still works for a retry.
    const result = await this.bookings.cancelByToken(token);
    if (!result.consumed) {
      throw new DomainError(
        "Cancel token has already been consumed.",
        "CANCEL_TOKEN_CONSUMED",
      );
    }

    await invalidateAvailability(record.startsAt.slice(0, 10)).catch(() => {});

    const isPack   = record.sessionType === "pack";
    const isSingle = record.sessionType === "session1h" || record.sessionType === "session2h";

    // Report what the RPC did. The audit entry is best-effort: the cancel has committed,
    // and a 500 now would send the student to retry a link that no longer works.
    const creditsRestored = isPack && result.restored;
    if (creditsRestored) {
      await this.credits.recordRestore(record.email, {
        credits: result.credits, packId: result.restoredPackId,
      }).catch(err => log("warn", "Could not audit the restored credit", {
        service: "BookingService", eventId: record.eventId, error: String(err),
      }));
    } else if (isPack) {
      log("error", "Pack class cancelled but no credit could be restored (no active pack with room) — manual follow-up", {
        service: "BookingService", eventId: record.eventId, creditPackId: record.creditPackId ?? null,
      });
    }

    // 4. Delete calendar event + Zoom session (best-effort)
    try {
      await this.calendar.deleteEvent(record.eventId);
    } catch (err) {
      log("warn", "Could not delete calendar event", {
        service: "BookingService", eventId: record.eventId, error: String(err),
      });
    }
    try {
      await this.sessions.deleteByEventId(record.eventId);
    } catch (err) {
      log("warn", "Could not delete Zoom session record", {
        service: "BookingService", eventId: record.eventId, error: String(err),
      });
    }
    // Drop the pending_terminations row so the cleanup cron doesn't later
    // see an orphan and try to mark the (already-cancelled) booking no_show.
    try {
      await this.bookings.deletePendingTermination(record.eventId);
    } catch (err) {
      log("warn", "Could not delete pending_terminations row on cancel", {
        service: "BookingService", eventId: record.eventId, error: String(err),
      });
    }

    // Display label follows the request locale (the cancel page renders in the
    // current page locale). The email locale is the account source of truth.
    const sessionLabel      = (locale === 'en' ? SESSION_LABELS_EN : SESSION_LABELS)[record.sessionType] ?? record.sessionType;
    const sessionLabelAdmin = SESSION_LABELS[record.sessionType] ?? record.sessionType;

    const emailLocale      = (await this.users.getLocale(record.email)) ?? 'es';
    const emailLabel       = (emailLocale === 'en' ? SESSION_LABELS_EN : SESSION_LABELS)[record.sessionType] ?? record.sessionType;

    // 5. Send emails (non-fatal)
    await Promise.all([
      this.email.sendCancellationConfirmation({
        to:              record.email,
        studentName:     record.name,
        sessionLabel:    emailLabel,
        startIso:        record.startsAt,
        creditsRestored,
        locale:          emailLocale,
      }),
      isSingle
        ? this.email.sendCancellationNotification({
            studentEmail: record.email,
            studentName:  record.name,
            sessionLabel: sessionLabelAdmin,
            startIso:     record.startsAt,
          })
        : Promise.resolve(),
    ]).catch((err) =>
      log("error", "Email send failed (non-fatal)", { service: "BookingService", error: String(err) })
    );

    return { sessionLabel, startIso: record.startsAt, creditsRestored };
  }

  // Finalizes a past session for the cleanup cron. Reads student_joined_at
  // BEFORE the zoom_sessions row is deleted to decide between completed and
  // no_show. Bookings whose status is no longer 'confirmed' (cancelled or
  // rescheduled before fire_at) are left alone — only the session record
  // is cleaned up. Throws if any repository call fails so the cron can
  // retry via the pending_terminations.attempts counter.
  async finalizePastSession(eventId: string): Promise<void> {
    const booking = await this.bookings.findByEventId(eventId);
    if (booking && booking.status === "confirmed") {
      const session = await this.sessions.findByEventId(eventId);
      if (session?.studentJoinedAt) {
        await this.bookings.markCompleted(booking.id);
      } else {
        await this.bookings.markNoShow(booking.id);
      }
    }
    await this.sessions.deleteByEventId(eventId);
  }

  async listForUser(email: string): Promise<UserBooking[]> {
    const entries = await this.bookings.listByUser(email);
    return entries.map(({ cancelToken, joinToken, record }) => ({
      eventId:     record.eventId,
      token:       cancelToken,
      joinToken,
      sessionType: record.sessionType,
      startsAt:    record.startsAt,
      endsAt:      record.endsAt,
      ...(record.packSize !== undefined ? { packSize: record.packSize } : {}),
    }));
  }

  // BOOKING-HISTORY-01: one keyset page of the user's past bookings, newest first.
  // Distinct from listForUser, which serves the upcoming-sessions widget and is
  // confirmed-only, ascending, and unpaginated.
  async listHistoryForUser(
    email: string,
    opts: { limit: number; cursor?: string },
  ): Promise<BookingHistoryPage> {
    return this.bookings.listHistoryByUser(email, opts);
  }

  async hasAnyBooking(email: string): Promise<boolean> {
    return this.bookings.hasAnyBooking(email);
  }

  async getJoinInfo(token: string): Promise<{ eventId: string; email: string; name: string; sessionType: string; startsAt: string } | null> {
    return this.bookings.findByJoinToken(token);
  }

  // SINGLE-SESSION-CONFIRM-01: confirmed-booking detail by PaymentIntent id, for the
  // single-session polling surface. Thin delegate — see IBookingRepository.findByStripePaymentId.
  async findByStripePaymentId(paymentIntentId: string): Promise<SingleSessionBookingDetail | null> {
    return this.bookings.findByStripePaymentId(paymentIntentId);
  }

  // REFACTOR-R4-P1-02: true if ANY booking (whatever its status) carries this PaymentIntent.
  // Thin delegate — see IBookingRepository.hasBookingForPayment.
  async hasBookingForPayment(paymentIntentId: string): Promise<boolean> {
    return this.bookings.hasBookingForPayment(paymentIntentId);
  }

  // REFACTOR-R4-P1-03: best-effort by design — once the new booking exists we never roll
  // it back because the old event could not be deleted; a stray calendar event is the
  // lesser failure. Logs, never throws. The pending_terminations row goes so the cleanup
  // cron doesn't later see an orphan and mark the (now-cancelled) booking no_show.
  private async teardownRescheduledOriginal(old: BookingRecord): Promise<void> {
    const steps: [string, () => Promise<void>][] = [
      ["calendar event",      () => this.calendar.deleteEvent(old.eventId)],
      ["zoom session",        () => this.sessions.deleteByEventId(old.eventId)],
      ["pending termination", () => this.bookings.deletePendingTermination(old.eventId)],
    ];
    for (const [what, run] of steps) {
      try {
        await run();
      } catch (err) {
        log("warn", `Reschedule: could not delete original ${what}`, {
          service: "BookingService", eventId: old.eventId, error: String(err),
        });
      }
    }
    await invalidateAvailability(old.startsAt.slice(0, 10)).catch(() => {});
  }

  private async sendWithRetry(fn: () => Promise<void>, label: string): Promise<boolean> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await fn();
        return true;
      } catch (err) {
        log("warn", "Email attempt failed", {
          service: "BookingService", label, attempt, error: (err as Error).message,
        });
        if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 500));
      }
    }
    log("error", "Email failed after 3 attempts", { service: "BookingService", label });
    return false;
  }
}

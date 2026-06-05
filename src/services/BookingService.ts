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

import type { IBookingRepository } from "@/domain/repositories/IBookingRepository";
import type { ISessionRepository } from "@/domain/repositories/ISessionRepository";
import type { SessionType } from "@/domain/types";
import type { ICalendarClient } from "@/infrastructure/google";
import type { IZoomClient } from "@/infrastructure/zoom";
import type { IEmailClient } from "@/infrastructure/resend";
import { CreditService } from "./CreditService";
import { DomainError, SlotUnavailableError } from "@/domain/errors";
import { SCHEDULE } from "@/lib/booking-config";
import { log } from "@/lib/logger";
import { invalidate as invalidateAvailability } from "@/lib/availability-cache";

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
  locale?:           'es' | 'en';
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

export interface UserBooking {
  token:       string;
  joinToken:   string;
  sessionType: SessionType;
  startsAt:    string;
  endsAt:      string;
  packSize?:   number;
}

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

const CANCEL_WINDOW_MS = 2 * 60 * 60_000; // 2 hours

type Compensation = { description: string; run: () => Promise<void> };

// ─── Service ──────────────────────────────────────────────────────────────────

export class BookingService {
  constructor(
    private readonly bookings:   IBookingRepository,
    private readonly credits:    CreditService,
    private readonly sessions:   ISessionRepository,
    private readonly calendar:   ICalendarClient,
    private readonly zoom:       IZoomClient,
    private readonly email:      IEmailClient,
  ) {}

  async createBooking(input: CreateBookingInput): Promise<CreateBookingOutput> {
    // 1. Min-notice guard
    const startsAt    = new Date(input.startIso);
    const minBookable = new Date(Date.now() + SCHEDULE.minNoticeHours * 60 * 60_000);
    if (startsAt < minBookable) throw new SlotUnavailableError();

    // 2. REFACTOR-P1-01: Acquire slot lock. Held until the booking row is committed
    //    (or compensation completes — see REFACTOR-P1-03).
    const durationMinutes = Math.round(
      (new Date(input.endIso).getTime() - new Date(input.startIso).getTime()) / 60_000
    );
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
      // 3. Reschedule flow
      if (input.rescheduleToken) {
        const oldRecord = await this.bookings.findByCancelToken(input.rescheduleToken);

        if (!oldRecord) {
          throw new DomainError(
            "Reschedule token is invalid or already used.",
            "INVALID_RESCHEDULE_TOKEN",
          );
        }
        if (new Date(oldRecord.startsAt) <= new Date(Date.now() + CANCEL_WINDOW_MS)) {
          throw new DomainError(
            "Reschedule window has closed (less than 2 hours before session).",
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

        // Reschedule rollback is partial by design — see task doc §Notable design decisions.
        compensations.push({
          description: "restore old cancel token",
          run: async () => { /* partial: reschedule rollback is best-effort only */ },
        });

        try { await this.calendar.deleteEvent(oldRecord.eventId); } catch {}
        try { await this.sessions.deleteByEventId(oldRecord.eventId); } catch {}
        // Drop the old eventId's pending_terminations row so the cleanup cron
        // doesn't later see an orphan and mark the (now-cancelled) booking no_show.
        try { await this.bookings.deletePendingTermination(oldRecord.eventId); } catch (err) {
          log("warn", "Could not delete pending_terminations row on reschedule", {
            service: "BookingService", eventId: oldRecord.eventId, error: String(err),
          });
        }
        await invalidateAvailability(oldRecord.startsAt.slice(0, 10)).catch(() => {});

        if (oldRecord.sessionType === "pack") {
          await this.credits.restoreCredit(input.email);
        }
      }

      // 4. Credit decrement for pack sessions
      let packSizeForToken: number | undefined;
      if (input.sessionType === "pack") {
        // REFACTOR-P3-03: useCredit now returns the decremented pack's size, so
        // we no longer need a separate getBalance roundtrip.
        const { packSize } = await this.credits.useCredit(input.email); // throws InsufficientCreditsError if none
        compensations.push({
          description: "restore decremented credit",
          run: async () => { await this.credits.restoreCredit(input.email); },
        });
        packSizeForToken = packSize ?? undefined;
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
      });
      compensations.push({
        description: `delete Calendar event ${calResult.eventId}`,
        run: async () => { await this.calendar.deleteEvent(calResult.eventId); },
      });
      await invalidateAvailability(input.startIso.slice(0, 10)).catch(() => {});

      // 6. Booking record — moved BEFORE QStash so the booking row exists if QStash
      //    scheduling fails; P1-04's fallback cron can then find and terminate it.
      const { cancelToken, joinToken } = await this.bookings.createBooking({
        eventId:     calResult.eventId,
        email:       input.email,
        name:        input.name,
        sessionType: input.sessionType,
        startsAt:    input.startIso,
        endsAt:      input.endIso,
        ...(packSizeForToken    !== undefined ? { packSize:        packSizeForToken    } : {}),
        ...(input.stripePaymentId             ? { stripePaymentId: input.stripePaymentId } : {}),
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
      const studentLocale = input.locale ?? 'es';
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

    // 2. 2-hour window check
    if (new Date(record.startsAt) <= new Date(Date.now() + CANCEL_WINDOW_MS)) {
      throw new DomainError(
        "Cancellation window has closed (less than 2 hours before session).",
        "OUTSIDE_CANCEL_WINDOW",
      );
    }

    // 3. Atomically consume token
    const consumed = await this.bookings.consumeCancelToken(token);
    if (!consumed) {
      throw new DomainError(
        "Cancel token has already been consumed.",
        "CANCEL_TOKEN_CONSUMED",
      );
    }

    await invalidateAvailability(record.startsAt.slice(0, 10)).catch(() => {});

    const isPack   = record.sessionType === "pack";
    const isSingle = record.sessionType === "session1h" || record.sessionType === "session2h";

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

    // 5. Restore credit for pack sessions
    if (isPack) {
      await this.credits.restoreCredit(record.email);
    }

    const sessionLabel      = (locale === 'en' ? SESSION_LABELS_EN : SESSION_LABELS)[record.sessionType] ?? record.sessionType;
    const sessionLabelAdmin = SESSION_LABELS[record.sessionType] ?? record.sessionType;

    // 6. Send emails (non-fatal)
    await Promise.all([
      this.email.sendCancellationConfirmation({
        to:              record.email,
        studentName:     record.name,
        sessionLabel,
        startIso:        record.startsAt,
        creditsRestored: isPack,
        locale,
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

    return { sessionLabel, startIso: record.startsAt, creditsRestored: isPack };
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
      token:       cancelToken,
      joinToken,
      sessionType: record.sessionType,
      startsAt:    record.startsAt,
      endsAt:      record.endsAt,
      ...(record.packSize !== undefined ? { packSize: record.packSize } : {}),
    }));
  }

  async hasAnyBooking(email: string): Promise<boolean> {
    return this.bookings.hasAnyBooking(email);
  }

  async getJoinInfo(token: string): Promise<{ eventId: string; email: string; name: string; sessionType: string; startsAt: string } | null> {
    return this.bookings.findByJoinToken(token);
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

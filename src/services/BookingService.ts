// ARCH-13: BookingService — orchestrates session booking, cancellation, and listing.
// Extracted from /api/book, /api/cancel, and /api/my-bookings route handlers so
// that route handlers become thin parsers + dispatchers with no business logic.

import type { IBookingRepository } from "@/domain/repositories/IBookingRepository";
import type { SessionType } from "@/domain/types";
import type { ICalendarClient } from "@/infrastructure/google";
import type { IZoomClient } from "@/infrastructure/zoom";
import type { IScheduler } from "@/infrastructure/qstash";
import type { IEmailClient } from "@/infrastructure/resend";
import { CreditService } from "./CreditService";
import { DomainError, SlotUnavailableError } from "@/domain/errors";
import { SCHEDULE } from "@/lib/booking-config";
import { log } from "@/lib/logger";

// ─── Input / output types ─────────────────────────────────────────────────────

export interface CreateBookingInput {
  email:            string;
  name:             string;
  startIso:         string;
  endIso:           string;
  sessionType:      SessionType;
  note?:            string;
  timezone?:        string;
  rescheduleToken?: string;
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

const CANCEL_WINDOW_MS = 2 * 60 * 60_000; // 2 hours

// ─── Service ──────────────────────────────────────────────────────────────────

export class BookingService {
  constructor(
    private readonly bookings:   IBookingRepository,
    private readonly credits:    CreditService,
    private readonly calendar:   ICalendarClient,
    private readonly zoom:       IZoomClient,
    private readonly scheduler:  IScheduler,
    private readonly email:      IEmailClient,
  ) {}

  async createBooking(input: CreateBookingInput): Promise<CreateBookingOutput> {
    // 1. Min-notice guard
    const startsAt    = new Date(input.startIso);
    const minBookable = new Date(Date.now() + SCHEDULE.minNoticeHours * 60 * 60_000);
    if (startsAt < minBookable) throw new SlotUnavailableError();

    let consumedReschedule = false;

    // 2. Reschedule flow
    if (input.rescheduleToken) {
      const oldRecord = await this.bookings.findByCancelToken(input.rescheduleToken);

      if (!oldRecord) {
        throw new DomainError(
          "El enlace de reprogramación no es válido o ya ha sido usado.",
          "INVALID_RESCHEDULE_TOKEN",
        );
      }
      if (new Date(oldRecord.startsAt) <= new Date(Date.now() + CANCEL_WINDOW_MS)) {
        throw new DomainError(
          "Ya no es posible reprogramar esta sesión (menos de 2 horas de antelación).",
          "OUTSIDE_RESCHEDULE_WINDOW",
        );
      }
      if (oldRecord.sessionType !== input.sessionType) {
        throw new DomainError(
          "El tipo de sesión no coincide con la reserva original.",
          "SESSION_TYPE_MISMATCH",
        );
      }

      const consumed = await this.bookings.consumeCancelToken(input.rescheduleToken);
      if (!consumed) {
        throw new DomainError(
          "El enlace de reprogramación ya ha sido usado.",
          "RESCHEDULE_TOKEN_CONSUMED",
        );
      }

      consumedReschedule = true;

      try { await this.calendar.deleteEvent(oldRecord.eventId); } catch {}

      if (oldRecord.sessionType === "pack") {
        await this.credits.restoreCredit(input.email);
      }
    }

    // 4. Credit decrement for pack sessions
    let packSizeForToken: number | undefined;
    if (input.sessionType === "pack") {
      await this.credits.useCredit(input.email); // throws InsufficientCreditsError if none
      const creditRecord = await this.credits.getBalance(input.email);
      packSizeForToken = creditRecord?.packSize ?? undefined;
    }

    // 5. Calendar event + Zoom session
    const sessionLabel = SESSION_LABELS[input.sessionType];
    let eventId:         string;
    let zoomSessionName: string;
    let zoomPasscode:    string;

    try {
      const result = await this.calendar.createEvent({
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
      eventId         = result.eventId;
      zoomSessionName = result.zoomSessionName;
      zoomPasscode    = result.zoomPasscode;
    } catch (err) {
      log("error", "Calendar event creation failed", {
        service: "BookingService", email: input.email, startIso: input.startIso, error: String(err),
      });

      if (input.sessionType === "pack") {
        await this.credits.restoreCredit(input.email);
      } else if (consumedReschedule) {
        await this.bookings.recordRescheduleFailure({
          email:       input.email,
          startIso:    input.startIso,
          endIso:      input.endIso,
          sessionType: input.sessionType,
          error:       String(err),
        }).catch(() => {});
      }
      throw err;
    }

    // 6. Schedule Zoom cleanup via QStash
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";
    await this.scheduler.scheduleAt({
      url:          `${baseUrl}/api/internal/zoom-terminate`,
      body:         { eventId },
      delaySeconds: this.zoom.getDurationWithGrace(input.sessionType) * 60,
    });

    // 7. Booking tokens
    const { cancelToken, joinToken } = await this.bookings.createBooking({
      eventId,
      email:       input.email,
      name:        input.name,
      sessionType: input.sessionType,
      startsAt:    input.startIso,
      endsAt:      input.endIso,
      ...(packSizeForToken !== undefined ? { packSize: packSizeForToken } : {}),
    });

    // 8. Confirmation + notification emails (with per-attempt retry)
    const joinUrl = `${baseUrl}/sesion/${joinToken}`;
    const [confirmSent] = await Promise.all([
      this.sendWithRetry(
        () => this.email.sendConfirmation({
          to:           input.email,
          studentName:  input.name,
          sessionLabel,
          startIso:     input.startIso,
          endIso:       input.endIso,
          joinToken,
          cancelToken,
          note:         input.note ?? null,
          studentTz:    input.timezone ?? null,
          sessionType:  input.sessionType,
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

    return { eventId, zoomSessionName, zoomPasscode, cancelToken, joinToken, emailFailed: !confirmSent };
  }

  async cancelByToken(token: string): Promise<CancelByTokenOutput> {
    // 1. Verify token
    const record = await this.bookings.findByCancelToken(token);
    if (!record) {
      throw new DomainError(
        "El enlace de cancelación no es válido o ya ha sido usado.",
        "INVALID_CANCEL_TOKEN",
      );
    }

    // 2. 2-hour window check
    if (new Date(record.startsAt) <= new Date(Date.now() + CANCEL_WINDOW_MS)) {
      throw new DomainError(
        "Lo sentimos, la cancelación ya no es posible (menos de 2 horas antes de la sesión).",
        "OUTSIDE_CANCEL_WINDOW",
      );
    }

    // 3. Atomically consume token
    const consumed = await this.bookings.consumeCancelToken(token);
    if (!consumed) {
      throw new DomainError(
        "El enlace de cancelación ya ha sido usado.",
        "CANCEL_TOKEN_CONSUMED",
      );
    }

    const isPack   = record.sessionType === "pack";
    const isSingle = record.sessionType === "session1h" || record.sessionType === "session2h";

    // 4. Delete calendar event (best-effort)
    try {
      await this.calendar.deleteEvent(record.eventId);
    } catch (err) {
      log("warn", "Could not delete calendar event", {
        service: "BookingService", eventId: record.eventId, error: String(err),
      });
    }

    // 5. Restore credit for pack sessions
    if (isPack) {
      await this.credits.restoreCredit(record.email);
    }

    const sessionLabel = SESSION_LABELS[record.sessionType] ?? record.sessionType;

    // 6. Send emails (non-fatal)
    await Promise.all([
      this.email.sendCancellationConfirmation({
        to:              record.email,
        studentName:     record.name,
        sessionLabel,
        startIso:        record.startsAt,
        creditsRestored: isPack,
      }),
      isSingle
        ? this.email.sendCancellationNotification({
            studentEmail: record.email,
            studentName:  record.name,
            sessionLabel,
            startIso:     record.startsAt,
          })
        : Promise.resolve(),
    ]).catch((err) =>
      log("error", "Email send failed (non-fatal)", { service: "BookingService", error: String(err) })
    );

    return { sessionLabel, startIso: record.startsAt, creditsRestored: isPack };
  }

  async listForUser(email: string): Promise<UserBooking[]> {
    const entries = await this.bookings.listByUser(email);
    return entries.map(({ cancelToken, record }) => ({
      token:       cancelToken,
      sessionType: record.sessionType,
      startsAt:    record.startsAt,
      endsAt:      record.endsAt,
      ...(record.packSize !== undefined ? { packSize: record.packSize } : {}),
    }));
  }

  async getJoinInfo(token: string): Promise<{ eventId: string; email: string } | null> {
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

/**
 * POST /api/book
 *
 * Unified booking endpoint for all session types.
 *
 * MIN NOTICE: the advance-booking guard now reads SCHEDULE.minNoticeHours
 * from booking-config (single source of truth) instead of a hardcoded "2".
 *
 * Applied fixes:
 *   SEC-04: CSRF protection — Origin header must match NEXT_PUBLIC_BASE_URL
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isValidOrigin } from "@/lib/csrf";
import { BookSchema } from "@/lib/schemas";
import { createCalendarEvent, createBookingTokens } from "@/lib/calendar";
import { decrementCredit, getCredits } from "@/lib/kv";
import { sendConfirmationEmail, sendNewBookingNotificationEmail } from "@/lib/email";
import { log } from "@/lib/logger";
import { SCHEDULE } from "@/lib/booking-config";
import { getSessionDurationWithGrace } from "@/lib/zoom";
import { qstash } from "@/lib/qstash";
import type { z } from "zod";

const SESSION_LABELS: Record<string, string> = {
  free15min: "Encuentro inicial gratuito · 15 min",
  session1h: "Sesión individual · 1 hora",
  session2h: "Sesión individual · 2 horas",
  pack:      "Clase de pack",
};

export async function POST(req: NextRequest) {
  // ── CSRF ───────────────────────────────────────────────────────────────────
  if (!isValidOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Autenticación requerida" }, { status: 401 });
  }

  const email = session.user.email;
  const name  = session.user.name ?? email;

  let body: z.infer<typeof BookSchema>;
  try {
    body = BookSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Datos de reserva inválidos" }, { status: 400 });
  }

  const { startIso, endIso, sessionType, note, timezone, rescheduleToken } = body;

  let consumedToken = false;

  if (rescheduleToken) {
    const {
      verifyCancellationToken,
      consumeCancellationToken,
      deleteCalendarEvent,
    } = await import("@/lib/calendar");

    const oldBooking = await verifyCancellationToken(rescheduleToken);

    // 1. Strict Validation
    if (!oldBooking) {
      return NextResponse.json({ error: "El enlace de reprogramación no es válido o ya ha sido usado." }, { status: 400 });
    }
    if (!oldBooking.withinWindow) {
      return NextResponse.json({ error: "Ya no es posible reprogramar esta sesión (menos de 2 horas de antelación)." }, { status: 400 });
    }
    if (oldBooking.record.sessionType !== sessionType) {
      return NextResponse.json({ error: "El tipo de sesión no coincide con la reserva original." }, { status: 400 });
    }

    // 2. Atomic Consumption (pass email to clean up the bookings sorted set)
    const consumed = await consumeCancellationToken(rescheduleToken, oldBooking.record.email);
    if (!consumed) {
      return NextResponse.json({ error: "El enlace de reprogramación ya ha sido usado." }, { status: 400 });
    }

    consumedToken = true;

    try { await deleteCalendarEvent(oldBooking.record.eventId); } catch {}

    if (oldBooking.record.sessionType === "pack") {
      const { restoreCredit } = await import("@/lib/kv");
      await restoreCredit(email);
    }
  } else {
    // 3. Prevent free single sessions without a valid reschedule token
    if (sessionType === "session1h" || sessionType === "session2h") {
      return NextResponse.json({ error: "Las sesiones individuales requieren pago previo." }, { status: 400 });
    }
  }

  // Guard: slot must be at least SCHEDULE.minNoticeHours in the future.
  // This is the backend source of truth — the frontend hides such slots
  // via the availability API, but we re-check here to be safe.
  const startsAt    = new Date(startIso);
  const minBookable = new Date(Date.now() + SCHEDULE.minNoticeHours * 60 * 60_000);
  if (startsAt < minBookable) {
    return NextResponse.json({ error: "Este horario ya no está disponible" }, { status: 409 });
  }

  let packSizeForToken: number | undefined;
  if (sessionType === "pack") {
    const credit = await decrementCredit(email);
    if (!credit.ok) {
      return NextResponse.json({ error: "Sin créditos disponibles" }, { status: 400 });
    }
    // Fetch packSize to embed in the cancellation token so the personal area can label it correctly
    const creditRecord = await getCredits(email);
    packSizeForToken = creditRecord?.packSize ?? undefined;
  }

  const sessionLabel = SESSION_LABELS[sessionType];
  let eventId:         string;
  let zoomSessionName: string;
  let zoomPasscode:    string;

  try {
    const result = await createCalendarEvent({
      summary:     `${sessionLabel} — ${name}`,
      description: [
        `Alumno: ${name} (${email})`,
        `Tipo: ${sessionLabel}`,
        note ? `Motivo: ${note}` : null,
        `gustavoai.dev`,
      ].filter(Boolean).join("\n"),
      startIso,
      endIso,
      sessionType,
      studentEmail: email,  // SEC-03
    });
    eventId         = result.eventId;
    zoomSessionName = result.zoomSessionName;
    zoomPasscode    = result.zoomPasscode;
  } catch (err) {
    log("error", "Calendar event creation failed", { service: "book", email, startIso, error: String(err) });

    if (sessionType === "pack") {
      const { restoreCredit } = await import("@/lib/kv");
      await restoreCredit(email);
    } else if (consumedToken) {
      // 4. Dead-Letter Fallback for failed single session reschedules
      const { kv } = await import("@/lib/redis");
      await kv.set(`failed:reschedule:${email}:${Date.now()}`, {
        email, startIso, endIso, sessionType, error: String(err)
      }, { ex: 30 * 24 * 60 * 60 });
    }
    return NextResponse.json({ error: "Error al crear el evento" }, { status: 500 });
  }

  const { cancelToken, joinToken } = await createBookingTokens({
    eventId, email, name, sessionType, startsAt: startIso, endsAt: endIso,
    ...(packSizeForToken !== undefined ? { packSize: packSizeForToken } : {}),
  });

  // REL-01: Schedule Zoom session cleanup via QStash (covers free/pack sessions
  // that had no cleanup before this fix). Skipped in local dev because QStash
  // cannot reach a loopback address. Failure is logged but does not fail the
  // booking; the Zoom JWT TTL (1h) still prevents indefinite session use.
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  if (!baseUrl.includes("localhost") && !baseUrl.includes("127.0.0.1")) {
    const delaySeconds = getSessionDurationWithGrace(sessionType) * 60;
    await qstash.publishJSON({
      url:   `${baseUrl}/api/internal/zoom-terminate`,
      body:  { eventId },
      delay: delaySeconds,
    }).catch((err: unknown) => {
      log("error", "QStash schedule failed", { service: "book", eventId, error: String(err) });
    });
  }

  const joinUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/sesion/${joinToken}`;

  async function sendWithRetry(fn: () => Promise<void>, label: string): Promise<boolean> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await fn();
        return true;
      } catch (err) {
        log("warn", `Email attempt failed`, { service: "book", label, attempt, error: (err as Error).message });
        if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 500));
      }
    }
    log("error", "Email failed after 3 attempts", { service: "book", label });
    return false;
  }

  const [confirmSent] = await Promise.all([
    sendWithRetry(
      () => sendConfirmationEmail({
        to: email, studentName: name, sessionLabel, startIso, endIso,
        joinToken, cancelToken, note: note ?? null, studentTz: timezone ?? null, sessionType,
      }),
      "confirmation email"
    ),
    sendWithRetry(
      () => sendNewBookingNotificationEmail({
        studentEmail: email, studentName: name, sessionLabel,
        startIso, endIso, joinUrl, note: note ?? null,
      }),
      "notification email"
    ),
  ]);

  return NextResponse.json({ ok: true, eventId, zoomSessionName, zoomPasscode, cancelToken, joinToken, emailFailed: !confirmSent });
}

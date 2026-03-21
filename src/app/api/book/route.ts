/**
 * POST /api/book
 *
 * Unified booking endpoint for all session types:
 *   - free15min   → create event, send confirmation email
 *   - session1h   → create event, send confirmation email (payment already done via Stripe)
 *   - session2h   → same
 *   - pack        → create event, decrement credit, send confirmation email
 *
 * Auth: required (email + name from session)
 *
 * ARCH-03: BookSchema is now imported from lib/schemas.ts instead of being
 * defined locally. This allows api-client.ts to share the same schema and
 * inferred type without importing from the app/ layer.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { BookSchema } from "@/lib/schemas";               // ARCH-03: shared schema
import { createCalendarEvent, createCancellationToken } from "@/lib/calendar";
import { decrementCredit } from "@/lib/kv";
import {
  sendConfirmationEmail,
  sendNewBookingNotificationEmail,
} from "@/lib/email";
import type { z } from "zod";

const SESSION_LABELS: Record<string, string> = {
  free15min: "Encuentro inicial gratuito · 15 min",
  session1h: "Sesión individual · 1 hora",
  session2h: "Sesión individual · 2 horas",
  pack:      "Clase de pack",
};

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Autenticación requerida" }, { status: 401 });
  }

  const email = session.user.email;
  const name  = session.user.name ?? email;

  // ── Validate body ─────────────────────────────────────────────────────────
  let body: z.infer<typeof BookSchema>;
  try {
    body = BookSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Datos de reserva inválidos" }, { status: 400 });
  }

  const { startIso, endIso, sessionType, note, timezone, rescheduleToken } = body;

  // ── Reschedule: clean up old booking first ────────────────────────────────
  if (rescheduleToken) {
    const {
      verifyCancellationToken,
      consumeCancellationToken,
      deleteCalendarEvent,
    } = await import("@/lib/calendar");

    const oldBooking = await verifyCancellationToken(rescheduleToken);
    if (oldBooking) {
      try { await deleteCalendarEvent(oldBooking.record.eventId); } catch {}

      if (oldBooking.record.sessionType === "pack") {
        const { restoreCredit } = await import("@/lib/kv");
        await restoreCredit(email);
      }

      await consumeCancellationToken(rescheduleToken);
    }
  }

  // ── Validate slot is in the future ────────────────────────────────────────
  const startsAt    = new Date(startIso);
  const minBookable = new Date(Date.now() + 2 * 60 * 60_000);
  if (startsAt < minBookable) {
    return NextResponse.json(
      { error: "Este horario ya no está disponible" },
      { status: 409 }
    );
  }

  // ── Decrement credit for pack bookings ────────────────────────────────────
  if (sessionType === "pack") {
    const credit = await decrementCredit(email);
    if (!credit.ok) {
      return NextResponse.json({ error: "Sin créditos disponibles" }, { status: 400 });
    }
  }

  // ── Create Google Calendar event ──────────────────────────────────────────
  const sessionLabel = SESSION_LABELS[sessionType];

  let eventId:  string;
  let meetLink: string;

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
    });
    eventId  = result.eventId;
    meetLink = result.meetLink;
  } catch (err) {
    console.error("[book] Calendar event creation failed:", err);

    if (sessionType === "pack") {
      const { restoreCredit } = await import("@/lib/kv");
      await restoreCredit(email);
    }

    return NextResponse.json({ error: "Error al crear el evento" }, { status: 500 });
  }

  // ── Generate cancellation token ───────────────────────────────────────────
  const cancelToken = await createCancellationToken({
    eventId,
    email,
    name,
    sessionType,
    startsAt: startIso,
    endsAt:   endIso,
  });

  // ── Send emails — with retry ──────────────────────────────────────────────
  async function sendWithRetry(fn: () => Promise<void>, label: string): Promise<boolean> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await fn();
        return true;
      } catch (err) {
        console.warn(`[book] ${label} attempt ${attempt}/3 failed:`, (err as Error).message);
        if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 500));
      }
    }
    console.error(`[book] ${label} failed after 3 attempts`);
    return false;
  }

  const [confirmSent] = await Promise.all([
    sendWithRetry(
      () => sendConfirmationEmail({
        to:           email,
        studentName:  name,
        sessionLabel,
        startIso,
        endIso,
        meetLink,
        cancelToken,
        note:         note ?? null,
        studentTz:    timezone ?? null,
        sessionType,
      }),
      "confirmation email"
    ),
    sendWithRetry(
      () => sendNewBookingNotificationEmail({
        studentEmail: email,
        studentName:  name,
        sessionLabel,
        startIso,
        endIso,
        meetLink,
        note:         note ?? null,
      }),
      "notification email"
    ),
  ]);

  return NextResponse.json({
    ok:          true,
    eventId,
    meetLink,
    cancelToken,
    emailFailed: !confirmSent,
  });
}

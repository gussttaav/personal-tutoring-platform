/**
 * POST /api/book
 *
 * Unified booking endpoint for all session types:
 *   - free15min   → create event, send confirmation email
 *   - session1h   → create event, send confirmation email (payment already done via Stripe)
 *   - session2h   → same
 *   - pack        → create event, decrement credit, send confirmation email
 *
 * Body: { startIso: string, endIso: string, sessionType: string }
 * Auth: required (email + name from session)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { createCalendarEvent, createCancellationToken } from "@/lib/calendar";
import { decrementCredit } from "@/lib/kv";
import {
  sendConfirmationEmail,
  sendNewBookingNotificationEmail,
} from "@/lib/email";

const SESSION_LABELS: Record<string, string> = {
  free15min: "Encuentro inicial gratuito · 15 min",
  session1h: "Sesión individual · 1 hora",
  session2h: "Sesión individual · 2 horas",
  pack:      "Clase de pack",
};

const BookSchema = z.object({
  startIso:    z.string().datetime(),
  endIso:      z.string().datetime(),
  sessionType: z.enum(["free15min", "session1h", "session2h", "pack"]),
  note:        z.string().max(1000).optional(),
  timezone:    z.string().optional(),
});

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

  const { startIso, endIso, sessionType, note, timezone } = body;

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

  let eventId: string;
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

    // If credit was decremented but event creation failed, restore it
    if (sessionType === "pack") {
      // We import restoreCredit lazily to avoid circular imports
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
  // Awaited before returning so Vercel doesn't kill the connection mid-send.
  // Retries up to 3 times with exponential backoff to handle transient TLS
  // errors (ECONNRESET) that occur on Vercel serverless cold starts.
  // If all retries fail, the booking is still confirmed but emailFailed=true
  // is returned so the client can show the Meet link directly.

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
    // If the confirmation email failed after retries, the client shows
    // the Meet link directly so the student is never left without it.
    emailFailed: !confirmSent,
  });
}

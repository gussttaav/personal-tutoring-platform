/**
 * POST /api/cancel
 *
 * Processes a booking cancellation via signed token.
 * Called from the /cancelar page after the student confirms.
 *
 * Body: { token: string }
 *
 * BONUS FIX (QUAL-04): Added await to the Promise.all() that sends emails.
 * Previously the emails were fired without await, meaning Vercel would freeze
 * the serverless function immediately after the response was sent — before the
 * email promises had a chance to resolve. Emails would appear to have been sent
 * (no error thrown) but would silently never arrive.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  verifyCancellationToken,
  consumeCancellationToken,
  deleteCalendarEvent,
} from "@/lib/calendar";
import { restoreCredit } from "@/lib/kv";
import {
  sendCancellationConfirmationEmail,
  sendCancellationNotificationEmail,
} from "@/lib/email";

export async function POST(req: NextRequest) {
  const { token } = await req.json().catch(() => ({}));

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Token inválido" }, { status: 400 });
  }

  // ── Verify token ──────────────────────────────────────────────────────────
  const result = await verifyCancellationToken(token);

  if (!result) {
    return NextResponse.json(
      { error: "El enlace de cancelación no es válido o ya ha sido usado." },
      { status: 400 }
    );
  }

  if (!result.withinWindow) {
    return NextResponse.json(
      { error: "Lo sentimos, la cancelación ya no es posible (menos de 2 horas antes de la sesión)." },
      { status: 400 }
    );
  }

  const { record } = result;
  const isPack     = record.sessionType === "pack";
  const isSingle   = ["session1h", "session2h"].includes(record.sessionType);

  // ── Delete Google Calendar event ──────────────────────────────────────────
  try {
    await deleteCalendarEvent(record.eventId);
  } catch (err) {
    // Event may have already been deleted manually — log but continue
    console.warn("[cancel] Could not delete calendar event:", err);
  }

  // ── Restore credit for pack bookings ──────────────────────────────────────
  if (isPack) {
    await restoreCredit(record.email);
  }

  // ── Consume token (DELETE from KV) ────────────────────────────────────────
  // consumeCancellationToken now does a hard DELETE (see calendar.ts fix).
  await consumeCancellationToken(token);

  // ── Send emails ───────────────────────────────────────────────────────────
  const SESSION_LABELS: Record<string, string> = {
    free15min: "Encuentro inicial gratuito",
    session1h: "Sesión individual · 1 hora",
    session2h: "Sesión individual · 2 horas",
    pack:      "Clase de pack",
  };

  const sessionLabel = SESSION_LABELS[record.sessionType] ?? record.sessionType;

  // FIXED: await the Promise.all so the emails complete before the response
  // is returned and Vercel freezes the function. The catch ensures an email
  // failure doesn't turn a successful cancellation into a 500 error.
  await Promise.all([
    sendCancellationConfirmationEmail({
      to:              record.email,
      studentName:     record.name,
      sessionLabel,
      startIso:        record.startsAt,
      creditsRestored: isPack,
    }),
    isSingle
      ? sendCancellationNotificationEmail({
          studentEmail: record.email,
          studentName:  record.name,
          sessionLabel,
          startIso:     record.startsAt,
        })
      : Promise.resolve(),
  ]).catch((err) => console.error("[cancel] Email send failed (non-fatal):", err));

  return NextResponse.json({
    ok: true,
    creditsRestored: isPack,
    sessionLabel,
    startIso: record.startsAt,
  });
}

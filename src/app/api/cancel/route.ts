/**
 * POST /api/cancel
 * Week 4 — OBS-01: console.* replaced with structured log() calls.
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
import { log } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const { token } = await req.json().catch(() => ({}));

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Token inválido" }, { status: 400 });
  }

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

  // Atomically consume the token BEFORE taking action
  const consumed = await consumeCancellationToken(token);
  if (!consumed) {
    return NextResponse.json(
      { error: "El enlace de cancelación ya ha sido usado." },
      { status: 400 }
    );
  }

  const { record } = result;
  const isPack   = record.sessionType === "pack";
  const isSingle = ["session1h", "session2h"].includes(record.sessionType);

  try {
    await deleteCalendarEvent(record.eventId);
  } catch (err) {
    log("warn", "Could not delete calendar event", { service: "cancel", eventId: record.eventId, error: String(err) });
  }

  if (isPack) {
    await restoreCredit(record.email);
  }

  const SESSION_LABELS: Record<string, string> = {
    free15min: "Encuentro inicial gratuito",
    session1h: "Sesión individual · 1 hora",
    session2h: "Sesión individual · 2 horas",
    pack:      "Clase de pack",
  };

  const sessionLabel = SESSION_LABELS[record.sessionType] ?? record.sessionType;

  await Promise.all([
    sendCancellationConfirmationEmail({
      to: record.email, studentName: record.name,
      sessionLabel, startIso: record.startsAt, creditsRestored: isPack,
    }),
    isSingle
      ? sendCancellationNotificationEmail({
          studentEmail: record.email, studentName: record.name,
          sessionLabel, startIso: record.startsAt,
        })
      : Promise.resolve(),
  ]).catch((err) =>
    log("error", "Email send failed (non-fatal)", { service: "cancel", error: String(err) })
  );

  return NextResponse.json({ ok: true, creditsRestored: isPack, sessionLabel, startIso: record.startsAt });
}

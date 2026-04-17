/**
 * POST /api/zoom/token
 *
 * Issues a short-lived Zoom Video SDK JWT for the requesting user so their
 * browser can join the session associated with a given calendar event.
 *
 * Role assignment:
 *   - TUTOR_EMAIL → role 1 (host)
 *   - everyone else → role 0 (participant)
 *
 * Applied fixes:
 *   SEC-03: session-membership check — only the registered student or tutor may obtain a token
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { kv } from "@/lib/redis";
import { generateZoomJWT, getSessionDurationWithGrace } from "@/lib/zoom";
import type { ZoomSessionRecord } from "@/lib/zoom";
import { availabilityRatelimit } from "@/lib/ratelimit";
import { log } from "@/lib/logger";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Autenticación requerida" }, { status: 401 });
  }

  // ── Rate limit ─────────────────────────────────────────────────────────────
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success } = await availabilityRatelimit.limit(`zoom:token:${ip}`);
  if (!success) {
    return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let eventId: string;
  try {
    const body = await req.json() as { eventId?: unknown };
    if (typeof body.eventId !== "string" || !body.eventId) {
      throw new Error("missing eventId");
    }
    eventId = body.eventId;
  } catch {
    return NextResponse.json({ error: "Se requiere eventId" }, { status: 400 });
  }

  // ── Look up Zoom session record ────────────────────────────────────────────
  const record = await kv.get<ZoomSessionRecord>(`zoom:session:${eventId}`);
  if (!record) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }

  // ── Session-membership check (SEC-03) ─────────────────────────────────────
  const isTutor   = session.user.email === process.env.TUTOR_EMAIL;
  const isStudent = record.studentEmail
    ? record.studentEmail.toLowerCase() === session.user.email.toLowerCase()
    : false;

  if (!record.studentEmail) {
    // Legacy record (pre SEC-03) — allow tutor only
    if (!isTutor) {
      return NextResponse.json({ error: "Sesión heredada — contacta con soporte" }, { status: 403 });
    }
  } else if (!isTutor && !isStudent) {
    log("warn", "Unauthorized Zoom token request", {
      service:   "zoom",
      requester: session.user.email,
      eventId,
    });
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // ── Determine role ─────────────────────────────────────────────────────────
  const role: 0 | 1 = isTutor ? 1 : 0;

  // ── Sign JWT ───────────────────────────────────────────────────────────────
  const token = generateZoomJWT({
    sessionName:     record.sessionName,
    role,
    userName:        session.user.name ?? session.user.email,
    sessionPasscode: record.sessionPasscode,
  });

  const now = Math.floor(Date.now() / 1000);

  log("info", "Zoom token issued", {
    service: "zoom",
    email:   session.user.email,
    eventId,
    role,
  });

  return NextResponse.json({
    token,
    sessionName:       record.sessionName,
    passcode:          record.sessionPasscode,
    startIso:          record.startIso,
    durationWithGrace: getSessionDurationWithGrace(record.sessionType),
    expiresAt:         now + 3600,
  });
}

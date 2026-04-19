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
 *   SEC-04: CSRF protection — Origin header must match NEXT_PUBLIC_BASE_URL
 *   ARCH-15: SessionService.issueJoinToken replaces inline lookup + membership check + JWT signing
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sessionService } from "@/services";
import { availabilityRatelimit } from "@/lib/ratelimit";
import { log } from "@/lib/logger";
import { isValidOrigin } from "@/lib/csrf";
import { BookingNotFoundError, UnauthorizedError } from "@/domain/errors";

function mapDomainErrorToResponse(
  err: unknown,
  ctx: Record<string, unknown>
): NextResponse {
  if (err instanceof BookingNotFoundError) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
  if (err instanceof UnauthorizedError) {
    log("warn", "Unauthorized Zoom token request", { service: "zoom-token", ...ctx });
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  throw err;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── CSRF ───────────────────────────────────────────────────────────────────
  if (!isValidOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  // ── Issue token via service ────────────────────────────────────────────────
  try {
    const result = await sessionService.issueJoinToken({
      eventId,
      userEmail: session.user.email,
      userName:  session.user.name ?? session.user.email,
    });
    return NextResponse.json(result);
  } catch (err) {
    return mapDomainErrorToResponse(err, { eventId });
  }
}

/**
 * POST /api/cancel
 *
 * Applied fixes:
 *   OBS-01: console.* replaced with structured log() calls.
 *   SEC-04: CSRF protection — Origin header must match NEXT_PUBLIC_BASE_URL
 *   ARCH-12/13: Delegates all orchestration to BookingService; route is a thin dispatcher
 *   REFACTOR-R3-P2-02: per-IP rate limit — this route is deliberately unauthenticated
 *     (cancel links are emailed capability tokens), so it needs a cap on token guessing.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isValidOrigin } from "@/lib/csrf";
import { bookingService } from "@/services";
import { mapDomainErrorToResponse } from "@/lib/http-errors";
import { cancelRatelimit } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/ip-utils";
import { tracedRoute } from "@/lib/with-request-context"; // REFACTOR-P4-02

async function postHandler(req: NextRequest) {
  // Cheapest rejection first (matches reviews/subscribe ordering).
  const { success } = await cancelRatelimit.limit(getClientIp(req));
  if (!success) return NextResponse.json({ error: "Demasiadas peticiones" }, { status: 429 });

  if (!isValidOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { token } = await req.json().catch(() => ({}));
  if (!token || typeof token !== "string") return NextResponse.json({ error: "Token inválido" }, { status: 400 });

  const locale = ((await cookies()).get("NEXT_LOCALE")?.value ?? "es") as "es" | "en";

  try {
    const result = await bookingService.cancelByToken(token, locale);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return mapDomainErrorToResponse(err);
  }
}

export const POST = tracedRoute(postHandler); // REFACTOR-P4-02

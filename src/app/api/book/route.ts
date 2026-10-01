/**
 * POST /api/book
 *
 * Applied fixes:
 *   SEC-04: CSRF protection — Origin header must match NEXT_PUBLIC_BASE_URL
 *   ARCH-13: Delegates all orchestration to BookingService; route is a thin dispatcher
 *   REFACTOR-R4-P1-01: per-user rate limit (10/min, keyed by the session email). Slot
 *     validation (length, grid, hours, calendar) happens in BookingService.createBooking.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isValidOrigin } from "@/lib/csrf";
import { BookSchema } from "@/lib/schemas";
import { bookingService } from "@/services";
import { mapDomainErrorToResponse } from "@/lib/http-errors";
import { bookRatelimit } from "@/lib/ratelimit";
import { tracedRoute } from "@/lib/with-request-context"; // REFACTOR-P4-02

async function postHandler(req: NextRequest) {
  if (!isValidOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: "Autenticación requerida" }, { status: 401 });

  const { success } = await bookRatelimit.limit(session.user.email);
  if (!success) return NextResponse.json({ error: "Demasiadas peticiones" }, { status: 429 });

  const parsed = BookSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  const { sessionType, rescheduleToken } = parsed.data;
  if ((sessionType === "session1h" || sessionType === "session2h") && !rescheduleToken) {
    return NextResponse.json({ error: "REQUIRES_PAYMENT" }, { status: 400 });
  }

  try {
    const result = await bookingService.createBooking({
      email: session.user.email,
      name:  session.user.name ?? session.user.email,
      ...parsed.data,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return mapDomainErrorToResponse(err);
  }
}

export const POST = tracedRoute(postHandler); // REFACTOR-P4-02

/**
 * POST /api/zoom/tutor-absent
 *
 * SESSION-JOIN-01: the student's classroom page calls this once it has been in
 * the room past `tutorAbsentAlertAt` (start + booking_settings.tutor_absent_alert_minutes)
 * with nobody else connected. SessionService.reportTutorAbsent re-checks every
 * condition and emails the admin at most once per session; the answer tells the
 * client whether this call sent it.
 *
 * Thin dispatcher: CSRF → auth → rate limit → parse → service → map.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { sessionService } from "@/services";
import { zoomTokenRatelimit } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/ip-utils";
import { isValidOrigin } from "@/lib/csrf";
import { TutorAbsentSchema } from "@/lib/schemas";
import { mapDomainErrorToResponse } from "@/lib/http-errors";
import { BookingNotFoundError, UnauthorizedError } from "@/domain/errors";
import { tracedRoute } from "@/lib/with-request-context";

async function postHandler(req: NextRequest): Promise<NextResponse> {
  if (!isValidOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success } = await zoomTokenRatelimit.limit(getClientIp(req));
  if (!success) {
    return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });
  }

  const parsed = TutorAbsentSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  try {
    const outcome = await sessionService.reportTutorAbsent({
      eventId:   parsed.data.eventId,
      userEmail: session.user.email,
    });
    return NextResponse.json({ sent: outcome === "sent", outcome });
  } catch (err) {
    // Same statuses as /api/zoom/token for the two membership outcomes; the shared
    // mapper has no entry for them and would answer 400.
    if (err instanceof BookingNotFoundError) {
      return NextResponse.json({ error: err.code }, { status: 404 });
    }
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.code }, { status: 403 });
    }
    return mapDomainErrorToResponse(err, { eventId: parsed.data.eventId });
  }
}

export const POST = tracedRoute(postHandler);

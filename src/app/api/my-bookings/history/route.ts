/**
 * GET /api/my-bookings/history
 *
 * BOOKING-HISTORY-01: keyset-paginated past bookings for the history screen.
 *
 * Separate from GET /api/my-bookings, which is the upcoming-sessions surface:
 * that one is confirmed-only, ascending and unpaginated, and its web consumer
 * assumes every row it returns is confirmed. History needs the opposite of all
 * three, so it gets its own endpoint rather than a flag on that one.
 *
 * Query: ?limit=20&cursor=<opaque>   (cursor omitted for the first page)
 * Auth:  getSession() — accepts the web cookie and the mobile bearer alike.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { BookingHistoryQuerySchema } from "@/lib/schemas";
import { bookingService } from "@/services";
import { mapDomainErrorToResponse } from "@/lib/http-errors";
import { historyRatelimit } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/ip-utils";

export async function GET(req: NextRequest) {
  const { success } = await historyRatelimit.limit(getClientIp(req));
  if (!success)
    return NextResponse.json({ error: "Demasiadas peticiones" }, { status: 429 });

  const session = await getSession();
  if (!session?.user?.email)
    return NextResponse.json({ error: "Autenticación requerida" }, { status: 401 });

  const parsed = BookingHistoryQuerySchema.safeParse({
    limit:  req.nextUrl.searchParams.get("limit")  ?? undefined,
    cursor: req.nextUrl.searchParams.get("cursor") ?? undefined,
  });
  if (!parsed.success)
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  const email = session.user.email;

  try {
    const { entries, nextCursor } = await bookingService.listHistoryForUser(email, parsed.data);
    return NextResponse.json({ bookings: entries, nextCursor });
  } catch (err) {
    return mapDomainErrorToResponse(err, { email, route: "my-bookings/history" });
  }
}

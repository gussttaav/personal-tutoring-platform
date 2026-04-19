/**
 * POST /api/book
 *
 * Applied fixes:
 *   SEC-04: CSRF protection — Origin header must match NEXT_PUBLIC_BASE_URL
 *   ARCH-13: Delegates all orchestration to BookingService; route is a thin dispatcher
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isValidOrigin } from "@/lib/csrf";
import { BookSchema } from "@/lib/schemas";
import { bookingService } from "@/services";
import { mapDomainErrorToResponse } from "@/lib/http-errors";

export async function POST(req: NextRequest) {
  if (!isValidOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Autenticación requerida" }, { status: 401 });

  const parsed = BookSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Datos de reserva inválidos" }, { status: 400 });

  const { sessionType, rescheduleToken } = parsed.data;
  if ((sessionType === "session1h" || sessionType === "session2h") && !rescheduleToken) {
    return NextResponse.json({ error: "Las sesiones individuales requieren pago previo." }, { status: 400 });
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

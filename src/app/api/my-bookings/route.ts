/**
 * GET /api/my-bookings
 *
 * Applied fixes:
 *   ARCH-13: Delegates to BookingService; route is a thin dispatcher
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { bookingService } from "@/services";

export async function GET() {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: "Autenticación requerida" }, { status: 401 });

  const bookings = await bookingService.listForUser(session.user.email);
  return NextResponse.json({ bookings });
}

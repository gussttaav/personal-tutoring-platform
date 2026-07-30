// ARCH-12: Use CreditService instead of calling getCredits directly.
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { bookingService, creditService } from "@/services";
import { sanitizeEmail } from "@/lib/validation";
import { creditsRatelimit } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/ip-utils";
import { log } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const { success } = await creditsRatelimit.limit(ip);
  if (!success) {
    return NextResponse.json({ error: "Demasiadas peticiones" }, { status: 429 });
  }

  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Autenticación requerida" }, { status: 401 });
  }

  const email = sanitizeEmail(session.user.email);

  try {
    const [result, hasBookings] = await Promise.all([
      creditService.getBalance(email),
      bookingService.hasAnyBooking(email),
    ]);
    return NextResponse.json({
      credits:     result?.credits ?? 0,
      name:        result?.name ?? "",
      packSize:    result?.packSize ?? null,
      hasBookings,
      // Validity date of the soonest-expiring active pack. The repository has always
      // resolved it; it was simply dropped here before the personal-area pack banner
      // needed to show "válido hasta el …".
      expiresAt:   result?.expiresAt ?? null,
    });
  } catch (err) {
    log("error", "Error fetching credits", { service: "credits", email, error: String(err) });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

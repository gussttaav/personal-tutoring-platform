// ARCH-12: Use CreditService instead of calling getCredits directly.
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { creditService } from "@/services";
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

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Autenticación requerida" }, { status: 401 });
  }

  const email = sanitizeEmail(session.user.email);

  try {
    const result = await creditService.getBalance(email);
    return NextResponse.json({
      credits:  result?.credits ?? 0,
      name:     result?.name ?? "",
      packSize: result?.packSize ?? null,
    });
  } catch (err) {
    log("error", "Error fetching credits", { service: "credits", email, error: String(err) });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

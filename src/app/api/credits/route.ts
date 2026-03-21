import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCredits } from "@/lib/kv";
import { sanitizeEmail } from "@/lib/validation";
import { creditsRatelimit } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/ip-utils"; // FIX (SEC-01)

export async function GET(req: NextRequest) {
  // ── Rate limit ────────────────────────────────────────────────────────────
  // FIX (SEC-01): Use sanitized IP — x-forwarded-for can be a comma-separated
  // list; taking the raw header value as the rate-limit key lets an attacker
  // craft unique strings to bypass per-IP limits.
  const ip = getClientIp(req);
  const { success } = await creditsRatelimit.limit(ip);
  if (!success) {
    return NextResponse.json(
      { error: "Demasiadas peticiones" },
      { status: 429 }
    );
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Autenticación requerida" },
      { status: 401 }
    );
  }

  const email = sanitizeEmail(session.user.email);

  // ── Fetch from KV ─────────────────────────────────────────────────────────
  try {
    const result = await getCredits(email);
    return NextResponse.json({
      credits:  result?.credits ?? 0,
      name:     result?.name ?? "",
      packSize: result?.packSize ?? null,
    });
  } catch (err) {
    console.error("[credits] Error fetching from KV:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

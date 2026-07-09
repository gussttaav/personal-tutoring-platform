/**
 * GET /api/schedule — current booking schedule (working hours, min advance
 * notice, timezone).
 *
 * Public-data endpoint for the native mobile app. Authenticated: accepts the
 * mobile bearer (Authorization: Bearer <token>) OR a web session cookie via
 * getSession(). Returns ScheduleConfig as-is — working-hour blocks are in
 * minutes since midnight; clients format for display.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { scheduleService } from "@/services";
import { scheduleRatelimit } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/ip-utils";
import { log } from "@/lib/logger";

export async function GET(req: NextRequest) {
  // Rate limit by IP.
  const { success } = await scheduleRatelimit.limit(getClientIp(req));
  if (!success) {
    return NextResponse.json({ error: "Demasiadas peticiones" }, { status: 429 });
  }

  // Auth — bearer (mobile) or cookie (web). The schedule isn't shown pre-login.
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Autenticación requerida" }, { status: 401 });
  }

  try {
    const config = await scheduleService.getConfig();
    log("info", "Schedule fetched", { service: "schedule", email: session.user.email });
    return NextResponse.json(config);
  } catch (err) {
    log("error", "Error fetching schedule", { service: "schedule", error: String(err) });
    return NextResponse.json({ error: "Error al obtener el horario" }, { status: 500 });
  }
}

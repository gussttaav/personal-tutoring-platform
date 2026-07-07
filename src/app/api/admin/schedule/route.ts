/**
 * GET  /api/admin/schedule — current working hours + settings.
 * POST /api/admin/schedule — replace the schedule (requires reason).
 *
 * Thin adapter — auth + admin check, CSRF (Origin) check, Zod validation,
 * service delegation. On save we revalidate the ISR schedule cache and bump the
 * Redis availability cache version so the new hours take effect immediately.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { isValidOrigin } from "@/lib/csrf";
import { log } from "@/lib/logger";
import { UpdateScheduleSchema } from "@/lib/schemas";
import { bumpScheduleVersion } from "@/lib/availability-cache";
import { SCHEDULE_CACHE_TAG } from "@/lib/schedule-config";
import { scheduleService } from "@/services";
import type { WeeklyHours } from "@/domain/types";

export async function GET() {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await scheduleService.getConfig();
  return NextResponse.json({ config });
}

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isValidOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const raw = await req.json().catch(() => null);
  const parsed = UpdateScheduleSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  // Normalize the string-keyed payload into a full WeeklyHours (all 7 days present).
  const weeklyHours: WeeklyHours = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const [dow, blocks] of Object.entries(parsed.data.weeklyHours)) {
    weeklyHours[Number(dow)] = (blocks ?? []).map((b) => ({
      startMinute: b.startMinute,
      endMinute:   b.endMinute,
    }));
  }

  await scheduleService.updateConfig({
    weeklyHours,
    timezone:       parsed.data.timezone,
    minNoticeHours: parsed.data.minNoticeHours,
    by:             session.user.email,
    reason:         parsed.data.reason,
  });

  // The schedule changed. Invalidate the ISR schedule cache by tag so the
  // customer-facing grid reflects the new hours on the next render (instant —
  // not waiting on the time-based revalidate), and clear the Redis availability
  // cache (all dates) so slots recompute against the new hours.
  revalidateTag(SCHEDULE_CACHE_TAG, "max");
  await bumpScheduleVersion();

  log("info", "Admin updated schedule", {
    service: "admin",
    email:   session.user.email,
  });

  return NextResponse.json({ ok: true });
}

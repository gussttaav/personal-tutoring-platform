/**
 * GET /api/internal/session-cleanup
 *
 * Daily cron that sweeps pending_terminations whose fire_at has passed
 * and terminates the corresponding Zoom sessions.
 * Triggered by cron-job.org on a daily schedule (not Vercel crons — Hobby plan).
 *
 * Authentication: requires CRON_SECRET in the Authorization header.
 * Set the header manually in cron-job.org: Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/infrastructure/supabase/client";
import { bookingService } from "@/services";
import { log } from "@/lib/logger";

const MAX_BATCH    = 50;
const MAX_ATTEMPTS = 5;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: rows, error } = await supabase
    .from("pending_terminations")
    .select("event_id, attempts")
    .lt("fire_at", new Date().toISOString())
    .lt("attempts", MAX_ATTEMPTS)
    .order("fire_at", { ascending: true })
    .limit(MAX_BATCH);

  if (error) {
    log("error", "Cron: pending_terminations query failed", { error: String(error) });
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  let cleared = 0, failed = 0;
  for (const row of rows ?? []) {
    try {
      await bookingService.finalizePastSession(row.event_id);
      await supabase.from("pending_terminations").delete().eq("event_id", row.event_id);
      cleared++;
    } catch (err) {
      await supabase.from("pending_terminations")
        .update({ attempts: row.attempts + 1, last_error: String(err) })
        .eq("event_id", row.event_id);
      failed++;
      log("warn", "Cron: failed to terminate session", { eventId: row.event_id, error: String(err) });
    }
  }

  log("info", "Cron: pending_terminations sweep complete", { cleared, failed, examined: rows?.length ?? 0 });
  return NextResponse.json({ cleared, failed, examined: rows?.length ?? 0 });
}

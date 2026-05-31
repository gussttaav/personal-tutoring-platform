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
import { supabaseBookingRepository } from "@/infrastructure/supabase";
import { bookingService } from "@/services";
import { log } from "@/lib/logger";

const MAX_BATCH    = 50;
const MAX_ATTEMPTS = 5;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let rows: { eventId: string; attempts: number }[];
  try {
    rows = await supabaseBookingRepository.listDuePendingTerminations(MAX_BATCH, MAX_ATTEMPTS);
  } catch (err) {
    log("error", "Cron: pending_terminations query failed", { error: String(err) });
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  let cleared = 0, failed = 0;
  for (const row of rows) {
    try {
      await bookingService.finalizePastSession(row.eventId);
      await supabaseBookingRepository.deletePendingTermination(row.eventId);
      cleared++;
    } catch (err) {
      await supabaseBookingRepository.recordPendingTerminationFailure(
        row.eventId,
        row.attempts + 1,
        String(err),
      );
      failed++;
      log("warn", "Cron: failed to terminate session", { eventId: row.eventId, error: String(err) });
    }
  }

  log("info", "Cron: pending_terminations sweep complete", { cleared, failed, examined: rows.length });
  return NextResponse.json({ cleared, failed, examined: rows.length });
}

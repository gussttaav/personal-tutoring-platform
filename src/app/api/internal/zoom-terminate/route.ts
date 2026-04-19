/**
 * POST /api/internal/zoom-terminate
 *
 * REL-01: QStash-delivered Zoom session cleanup.
 *
 * Expires a Zoom Video SDK session by removing its Redis record so no new
 * JWTs can be issued for it. Protected by QStash signature verification —
 * only QStash can call this endpoint (no X-Internal-Secret needed here).
 *
 * Mirrors the logic of /api/zoom/end but is triggered by a scheduled QStash
 * message instead of a setTimeout. /api/zoom/end is kept for one deploy
 * cycle and can be deleted once QStash is confirmed live in production.
 *
 * Applied fixes:
 *   ARCH-15: SessionService.terminateSession replaces direct kv.get + kv.del calls.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { sessionService } from "@/services";
import { log } from "@/lib/logger";

async function handler(req: NextRequest) {
  let eventId: string;
  try {
    const body = await req.json() as { eventId?: unknown };
    if (typeof body.eventId !== "string" || !body.eventId) throw new Error();
    eventId = body.eventId;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  await sessionService.terminateSession(eventId);
  log("info", "Zoom session terminated via QStash", { service: "zoom-terminate", eventId });

  return NextResponse.json({ ok: true });
}

export const POST = verifySignatureAppRouter(handler);

/**
 * /api/chat-session
 *
 * POST — send a chat message scoped to a live Zoom session.
 *
 * Storage: chat messages are persisted in the Supabase `session_messages` table
 * via SessionService → SupabaseSessionRepository (not Redis).
 *
 * Applied fixes:
 *   SEC-04:  CSRF protection — Origin header must match NEXT_PUBLIC_BASE_URL
 *   ARCH-15: sessionService.postChatMessage / getChatMessages replace direct kv calls.
 *            Sender membership check moved from route into SessionService.
 *   REFACTOR-P3-01: SSE GET handler removed. Live delivery is now a Supabase
 *            Realtime broadcast fired from SessionService.postChatMessage;
 *            browsers fetch the backlog + channel name from
 *            /api/chat-session/channel and subscribe directly.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sessionService } from "@/services";
import { chatRatelimit } from "@/lib/ratelimit";
import { isValidOrigin } from "@/lib/csrf";
import { BookingNotFoundError, UnauthorizedError } from "@/domain/errors";
import { tracedRoute } from "@/lib/with-request-context"; // REFACTOR-P4-02

export interface ChatMessage {
  id:           string; // `{eventId}:{index}`
  senderEmail:  string;
  senderName:   string;
  text:         string;
  sentAt:       string; // ISO
}

// ─── POST /api/chat-session ────────────────────────────────────────────────────

async function postHandler(req: NextRequest): Promise<NextResponse> {
  // ── CSRF ───────────────────────────────────────────────────────────────────
  if (!isValidOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Auth
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Autenticación requerida" }, { status: 401 });
  }

  // Rate limit — 20 msgs/min per IP (reuses AI-chat limiter with distinct key)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success } = await chatRatelimit.limit(`chat-session:${ip}`);
  if (!success) {
    return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });
  }

  // Parse body
  let eventId: string, text: string;
  try {
    const body = (await req.json()) as { eventId?: unknown; text?: unknown };
    if (typeof body.eventId !== "string" || !body.eventId) throw new Error("missing eventId");
    if (typeof body.text   !== "string" || !body.text.trim()) throw new Error("missing text");
    eventId = body.eventId;
    text    = body.text.trim().slice(0, 1000);
  } catch {
    return NextResponse.json({ error: "eventId y text son requeridos" }, { status: 400 });
  }

  try {
    await sessionService.postChatMessage({
      eventId,
      senderEmail: session.user.email,
      senderName:  session.user.name ?? session.user.email,
      text,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof BookingNotFoundError) {
      return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
    }
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    throw err;
  }
}

export const POST = tracedRoute(postHandler); // REFACTOR-P4-02

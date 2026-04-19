/**
 * /api/chat-session
 *
 * POST — send a chat message scoped to a live Zoom session.
 * GET  — SSE stream of chat messages for a session.
 *
 * Redis schema:
 *   Key:  chat:session:{eventId}   (Redis list)
 *   Val:  JSON-serialised ChatMessage objects
 *   TTL:  86 400 s (24 h) — set on first push
 *
 * SSE resumption uses the standard `Last-Event-ID` header:
 *   - Each streamed message carries `id: {index}`.
 *   - On reconnect, EventSource sends `Last-Event-ID: {index}` automatically.
 *   - The server reads that header as the cursor and only sends newer messages.
 *
 * Applied fixes:
 *   SEC-04: CSRF protection — Origin header must match NEXT_PUBLIC_BASE_URL
 *   ARCH-15: sessionService.postChatMessage / getChatMessages replace direct kv calls.
 *            Sender membership check moved from route into SessionService.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sessionService } from "@/services";
import { chatRatelimit } from "@/lib/ratelimit";
import { isValidOrigin } from "@/lib/csrf";
import { BookingNotFoundError, UnauthorizedError } from "@/domain/errors";

const MAX_WAIT_MS   = 20_000; // stay under Vercel 25 s limit
const POLL_INTERVAL = 1_500;

export interface ChatMessage {
  id:           string; // `{eventId}:{index}`
  senderEmail:  string;
  senderName:   string;
  text:         string;
  sentAt:       string; // ISO
}

export const dynamic = "force-dynamic";

// ─── POST /api/chat-session ────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
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

// ─── GET /api/chat-session (SSE) ──────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<Response> {
  // Auth
  const session = await auth();
  if (!session?.user?.email) {
    return new Response("Authentication required", { status: 401 });
  }

  const eventId = req.nextUrl.searchParams.get("eventId");
  if (!eventId) {
    return new Response("Missing eventId", { status: 400 });
  }

  // Read cursor from Last-Event-ID header (standard SSE resumption) or default 0
  const lastEventId = req.headers.get("last-event-id");
  let cursor = lastEventId ? parseInt(lastEventId, 10) : 0;
  if (isNaN(cursor) || cursor < 0) cursor = 0;

  // Capture userEmail outside the closure so TypeScript can see it's non-null
  const userEmail = session.user.email;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function sendRaw(chunk: string) {
        controller.enqueue(encoder.encode(chunk));
      }

      // Heartbeat so the browser knows the connection is live
      sendRaw("event: connected\ndata: {}\n\n");

      // Flush any messages already in the list that the client hasn't seen
      const { messages: initialMsgs, nextCursor: afterInitial } =
        await sessionService.getChatMessages({
          eventId, userEmail, fromIndex: cursor,
        });
      for (let i = 0; i < initialMsgs.length; i++) {
        const idx  = cursor + i;
        const data = typeof initialMsgs[i] === "string" ? initialMsgs[i] : JSON.stringify(initialMsgs[i]);
        sendRaw(`id: ${idx}\nevent: message\ndata: ${data}\n\n`);
      }
      cursor = afterInitial;

      // Poll for new messages until MAX_WAIT_MS
      const deadline = Date.now() + MAX_WAIT_MS;

      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL));

        try {
          const { messages, nextCursor } = await sessionService.getChatMessages({
            eventId, userEmail, fromIndex: cursor,
          });
          for (let i = 0; i < messages.length; i++) {
            const idx  = cursor + i;
            const data = typeof messages[i] === "string" ? messages[i] : JSON.stringify(messages[i]);
            sendRaw(`id: ${idx}\nevent: message\ndata: ${data}\n\n`);
          }
          cursor = nextCursor;
        } catch {
          // Redis read failed — keep trying
        }
      }

      // Close after MAX_WAIT_MS; EventSource reconnects automatically with Last-Event-ID
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":      "text/event-stream",
      "Cache-Control":     "no-cache, no-transform",
      "Connection":        "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

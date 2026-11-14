/**
 * POST /api/chat
 *
 * Applied fixes:
 *   SEC-04: CSRF protection — Origin header must match NEXT_PUBLIC_BASE_URL
 *   REL-04: Tiered rate limiting — authenticated users get 20/min by email;
 *           anonymous users get 5/min + 30/day by IP to cap model spend.
 *   REFACTOR-P2-03: History moved server-side. Client supplies `sessionId`;
 *           server loads/stores history in Redis. Client-supplied `history`
 *           field is ignored. A daily request counter kills the circuit if
 *           the global request ceiling is breached.
 *   CHAT-CLAUDE-01: the assistant runs on the Claude API (was Gemini). The
 *           kill-switch counter moved to `chat:requests:<date>`.
 *   CHAT-CONTENT-01: the prompt also carries the published courses and blog posts,
 *           read from the content registries (no DB call, no network).
 *   CHAT-AGENT-P1-02: the body is parsed with ChatRequestSchema (adds `timezone`
 *           and `voice`); the route builds the ToolContext from the server session
 *           (never from the model) and answers `{ reply, sessionId, actions }`. The
 *           kill switch counts model calls (a tool loop makes several per reply):
 *           pre-check on the current value, `incrby` after the call.
 *   CHAT-AGENT-P1-03: a per-request `contextNote` (the user's current date and time
 *           in their timezone, the timezone, signed in or not, the UI language), so
 *           the model can resolve «mañana» / «el jueves» for the free-call tools.
 *           It rides as a mid-conversation system message, out of the cached prompt.
 *   CHAT-AGENT-P1-04: the answer also carries `timezone`, the one the tools used (the
 *           visitor's, or the tutor's when none was sent), so the chat writes its slot
 *           chips and proposal card on the same clock as the reply.
 *   CHAT-AGENT-P2-02: `voice: true` (a dictated turn) adds the voice-mode line to the
 *           contextNote (short, no markdown / links / lists), since the reply is read aloud.
 *   REFACTOR-R5-P2-01: a thin route. Prices, prompt, ToolContext, contextNote and the
 *           daily kill switch moved to ChatService.reply(); the route keeps CSRF, the
 *           rate limits, the body parse, the request-scoped reads (ISR display figures,
 *           schedule, prompt content, NEXT_LOCALE) and the error mapping
 *           (ChatCapacityError → 503, anything else → 502). The kill switch is now
 *           checked after the body parse, so an over-cap malformed body answers 400.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDisplayPrices, getPackValidityDays } from "@/lib/pricing-display";
import { getScheduleConfig } from "@/lib/schedule-config";
import { getChatPromptContent } from "@/lib/chat-content";
import { chatRatelimit, chatRatelimitAnon, chatRatelimitAnonDaily } from "@/lib/ratelimit";
import { chatService } from "@/services";
import { getClientIp } from "@/lib/ip-utils";
import { log } from "@/lib/logger";
import { isValidOrigin } from "@/lib/csrf";
import { getSession } from "@/lib/session";
import { ChatRequestSchema } from "@/lib/schemas"; // CHAT-AGENT-P1-02
import { ChatCapacityError } from "@/domain/errors"; // REFACTOR-R5-P2-01
import { tracedRoute } from "@/lib/with-request-context"; // REFACTOR-P4-02

// CHAT-AGENT-P1-02: the tool loop's own deadline is 20 s; this makes the cap explicit.
export const maxDuration = 25;

async function postHandler(req: NextRequest) {
  // ── CSRF ───────────────────────────────────────────────────────────────────
  if (!isValidOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = getClientIp(req);
  const session = await getSession();
  const isAuthenticated = !!session?.user?.email;

  // REL-04: Tiered rate limiting
  if (isAuthenticated) {
    const { success } = await chatRatelimit.limit(`auth:${session.user!.email}`);
    if (!success) {
      return NextResponse.json(
        { error: "Demasiadas peticiones. Espera un momento e inténtalo de nuevo." },
        { status: 429 }
      );
    }
  } else {
    const [perMinute, perDay] = await Promise.all([
      chatRatelimitAnon.limit(ip),
      chatRatelimitAnonDaily.limit(ip),
    ]);

    if (!perMinute.success) {
      return NextResponse.json(
        { error: "Demasiadas peticiones. Espera un momento e inténtalo de nuevo." },
        { status: 429 }
      );
    }

    if (!perDay.success) {
      return NextResponse.json(
        {
          error: "Has alcanzado el límite diario. Inicia sesión para seguir chateando, o vuelve mañana.",
          requiresAuth: true,
        },
        { status: 429 }
      );
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de petición inválido" }, { status: 400 });
  }

  // REFACTOR-P2-03: `history` field is intentionally NOT read — history is
  // server-side. The schema strips it.
  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const error =
      issue?.path[0] !== "message" ? "Cuerpo de petición inválido"
      : issue.code === "too_big"   ? "Mensaje demasiado largo"
      :                              "El mensaje no puede estar vacío";
    return NextResponse.json({ error }, { status: 400 });
  }
  const { message, sessionId, timezone, voice } = parsed.data;

  try {
    // Inject live prices + policy figures so the assistant never quotes outdated
    // values (all three reads are cached, so this isn't a per-request DB hit).
    const [prices, packValidityDays, schedule] = await Promise.all([
      getDisplayPrices(),
      getPackValidityDays(),
      getScheduleConfig(),
    ]);

    // REFACTOR-R5-P2-01: identity is the server session's email, never a body field.
    const result = await chatService.reply({
      message,
      sessionId: sessionId ?? null,
      email:     session?.user?.email ?? null,
      timezone,
      voice,
      locale:    (await cookies()).get("NEXT_LOCALE")?.value === "en" ? "en" : "es",
      display:   { prices, packValidityDays, schedule, content: getChatPromptContent() },
    });
    return NextResponse.json({
      reply:     result.reply,
      sessionId: result.sessionId,
      actions:   result.actions,
      timezone:  result.timezone, // CHAT-AGENT-P1-04
    });
  } catch (err) {
    // REFACTOR-P2-03: the daily kill switch is open (logged in ChatService).
    if (err instanceof ChatCapacityError) {
      return NextResponse.json(
        { error: "Servicio temporalmente no disponible. Inténtalo más tarde." },
        { status: 503 }
      );
    }
    log("error", "Chat model error", { service: "chat", error: String(err) });
    return NextResponse.json(
      { error: "Error al contactar con el asistente. Inténtalo de nuevo." },
      { status: 502 }
    );
  }
}

export const POST = tracedRoute(postHandler); // REFACTOR-P4-02

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
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { buildChatSystemPrompt } from "@/constants/chat-prompt";
import { getDisplayPrices, getPackValidityDays } from "@/lib/pricing-display";
import { getScheduleConfig } from "@/lib/schedule-config";
import { DEFAULT_JOIN_OPEN_MINUTES, DEFAULT_TUTOR_ABSENT_ALERT_MINUTES } from "@/lib/booking-config"; // SESSION-JOIN-01
import { getChatPromptContent } from "@/lib/chat-content";
import { chatRatelimit, chatRatelimitAnon, chatRatelimitAnonDaily } from "@/lib/ratelimit";
import { chatService, pricingService, userService } from "@/services";
import { getClientIp } from "@/lib/ip-utils";
import { log } from "@/lib/logger";
import { isValidOrigin } from "@/lib/csrf";
import { getSession } from "@/lib/session";
import { kv } from "@/infrastructure/redis/client";
import { ChatRequestSchema } from "@/lib/schemas"; // CHAT-AGENT-P1-02
import type { ToolContext } from "@/infrastructure/anthropic";
import { tracedRoute } from "@/lib/with-request-context"; // REFACTOR-P4-02
import { buildContextNote } from "@/lib/chat-context-note"; // CHAT-AGENT-P1-03

const MAX_DAILY_CHAT_REQUESTS   = 1000; // model calls per day (CHAT-AGENT-P1-02)

// CHAT-AGENT-P1-02: the tool loop's own deadline is 20 s; this makes the cap explicit.
export const maxDuration = 25;

/** CHAT-AGENT-P1-02: adds this reply's model calls to today's kill-switch counter. */
async function countModelCalls(todayKey: string, modelCalls: number): Promise<void> {
  try {
    const total = await kv.incrby(todayKey, modelCalls);
    if (total === modelCalls) await kv.expire(todayKey, 86400);
  } catch (err) {
    log("warn", "Chat kill-switch counter not updated", { service: "chat", error: String(err) });
  }
}

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

  // REFACTOR-P2-03: Daily spend kill-switch. Per-IP rate limits cap individual
  // abusers; this caps total cost across all users for the day.
  // CHAT-AGENT-P1-02: checked here, counted after the call (by model calls).
  const todayKey   = `chat:requests:${new Date().toISOString().slice(0, 10)}`;
  const todaySpend = (await kv.get<number>(todayKey)) ?? 0;
  if (todaySpend >= MAX_DAILY_CHAT_REQUESTS) {
    log("error", "Chat daily request cap exceeded — circuit open", {
      service: "chat",
      todaySpend,
      limit: MAX_DAILY_CHAT_REQUESTS,
    });
    return NextResponse.json(
      { error: "Servicio temporalmente no disponible. Inténtalo más tarde." },
      { status: 503 }
    );
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

  let modelCalls = 0;
  try {
    // Inject live prices + policy figures so the assistant never quotes outdated
    // values (all three reads are cached, so this isn't a per-request DB hit).
    const [prices, packValidityDays, schedule] = await Promise.all([
      getDisplayPrices(),
      getPackValidityDays(),
      getScheduleConfig(),
    ]);

    // PRICING-STUDENT-01: an authenticated student may pay a private price. Quote
    // theirs, or the assistant would contradict the prices on the page they are
    // looking at. Costs one uncached read, and only when signed in; anonymous
    // visitors keep the cached global figures above.
    // CHAT-AGENT-P1-02: one lookup serves the private prices and the ToolContext.
    const user = isAuthenticated ? await userService.findByEmail(session.user!.email!) : null;

    let priceCents = {
      session1h: prices.session1h.priceCents,
      session2h: prices.session2h.priceCents,
      pack5:     prices.pack5.priceCents,
      pack10:    prices.pack10.priceCents,
    };
    if (isAuthenticated) {
      if (user && (await pricingService.hasUserOverrides(user.id))) {
        const own = await pricingService.getPublicPricing(user.id);
        const byKey = new Map(
          [...own.sessions, ...own.packs].map((r) => [r.productKey, r.amountCents]),
        );
        priceCents = {
          session1h: byKey.get("session1h") ?? priceCents.session1h,
          session2h: byKey.get("session2h") ?? priceCents.session2h,
          pack5:     byKey.get("pack5")     ?? priceCents.pack5,
          pack10:    byKey.get("pack10")    ?? priceCents.pack10,
        };
      }
    }

    const systemPrompt = buildChatSystemPrompt(
      {
        ...priceCents,
        packValidityDays,
        cancelHours: schedule.cancelMinNoticeHours,
        // SESSION-JOIN-01: `??` covers a config cached before migration 0028.
        joinOpenMinutes:         schedule.joinOpenMinutesBefore ?? DEFAULT_JOIN_OPEN_MINUTES,
        tutorAbsentAlertMinutes: schedule.tutorAbsentAlertMinutes ?? DEFAULT_TUTOR_ABSENT_ALERT_MINUTES,
      },
      getChatPromptContent(),
    );

    // CHAT-AGENT-P1-02: identity comes from the session, never from tool input.
    const toolContext: ToolContext = {
      userId:   user?.id ?? null,
      email:    session?.user?.email ?? null,
      timezone: timezone ?? schedule.timezone,
      locale:   (await cookies()).get("NEXT_LOCALE")?.value === "en" ? "en" : "es",
      now:      new Date(),
    };

    const result = await chatService.ask({
      message,
      sessionId: sessionId ?? null,
      systemPrompt,
      toolContext,
      contextNote: buildContextNote(toolContext, { voice }), // CHAT-AGENT-P2-02: voice mode
    });
    modelCalls = result.modelCalls;
    log("info", "Chat reply", {
      service: "chat", modelCalls, actions: result.actions.map((a) => a.type),
    });
    return NextResponse.json({
      reply:     result.reply,
      sessionId: result.sessionId,
      actions:   result.actions,
      timezone:  toolContext.timezone, // CHAT-AGENT-P1-04
    });
  } catch (err) {
    // A failed turn counts as one call, as every request did before the tool loop.
    modelCalls = 1;
    log("error", "Chat model error", { service: "chat", error: String(err) });
    return NextResponse.json(
      { error: "Error al contactar con el asistente. Inténtalo de nuevo." },
      { status: 502 }
    );
  } finally {
    await countModelCalls(todayKey, modelCalls);
  }
}

export const POST = tracedRoute(postHandler); // REFACTOR-P4-02

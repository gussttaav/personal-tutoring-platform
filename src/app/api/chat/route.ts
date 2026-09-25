/**
 * POST /api/chat
 *
 * Applied fixes:
 *   SEC-04: CSRF protection — Origin header must match NEXT_PUBLIC_BASE_URL
 *   REL-04: Tiered rate limiting — authenticated users get 20/min by email;
 *           anonymous users get 5/min + 30/day by IP to cap Gemini spend.
 *   REFACTOR-P2-03: History moved server-side. Client supplies `sessionId`;
 *           server loads/stores history in Redis. Client-supplied `history`
 *           field is ignored. A daily request counter kills the circuit if
 *           the global request ceiling is breached.
 */

import { NextRequest, NextResponse } from "next/server";
import { buildChatSystemPrompt } from "@/constants/chat-prompt";
import { getDisplayPrices, getPackValidityDays } from "@/lib/pricing-display";
import { getScheduleConfig } from "@/lib/schedule-config";
import { chatRatelimit, chatRatelimitAnon, chatRatelimitAnonDaily } from "@/lib/ratelimit";
import { chatService, pricingService, userService } from "@/services";
import { getClientIp } from "@/lib/ip-utils";
import { log } from "@/lib/logger";
import { isValidOrigin } from "@/lib/csrf";
import { getSession } from "@/lib/session";
import { kv } from "@/infrastructure/redis/client";
import { tracedRoute } from "@/lib/with-request-context"; // REFACTOR-P4-02

const MAX_MESSAGE_LENGTH        = 1000;
const MAX_DAILY_GEMINI_REQUESTS = 1000;

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
  const todayKey   = `gemini:requests:${new Date().toISOString().slice(0, 10)}`;
  const todaySpend = await kv.incr(todayKey);
  if (todaySpend === 1) await kv.expire(todayKey, 86400);
  if (todaySpend > MAX_DAILY_GEMINI_REQUESTS) {
    log("error", "Gemini daily request cap exceeded — circuit open", {
      service: "chat",
      todaySpend,
      limit: MAX_DAILY_GEMINI_REQUESTS,
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
  // server-side. Kept absent from destructuring to make that explicit.
  const { message, sessionId } = body as Record<string, unknown>;

  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "El mensaje no puede estar vacío" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: "Mensaje demasiado largo" }, { status: 400 });
  }

  const normalizedSessionId =
    typeof sessionId === "string" && sessionId.length === 36 ? sessionId : null;

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
    let priceCents = {
      session1h: prices.session1h.priceCents,
      session2h: prices.session2h.priceCents,
      pack5:     prices.pack5.priceCents,
      pack10:    prices.pack10.priceCents,
    };
    if (isAuthenticated) {
      const user = await userService.findByEmail(session.user!.email!);
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

    const systemPrompt = buildChatSystemPrompt({
      ...priceCents,
      packValidityDays,
      cancelHours: schedule.cancelMinNoticeHours,
    });

    const { reply, sessionId: newSessionId } = await chatService.ask({
      message: message.trim(),
      sessionId: normalizedSessionId,
      systemPrompt,
    });
    return NextResponse.json({ reply, sessionId: newSessionId });
  } catch (err) {
    log("error", "Gemini API error", { service: "chat", error: String(err) });
    return NextResponse.json(
      { error: "Error al contactar con el asistente. Inténtalo de nuevo." },
      { status: 502 }
    );
  }
}

export const POST = tracedRoute(postHandler); // REFACTOR-P4-02

// CHAT-AGENT-P1-02 — POST /api/chat.
//
// Follows src/app/api/content/__tests__ (mock factories before the route import;
// real NextRequest objects). What is pinned: the body goes through
// ChatRequestSchema (a bad timezone is a 400, the old message errors are kept),
// the identity comes from the server session and never from the body, the
// response carries `actions`, and the daily kill switch answers 503.
// CHAT-AGENT-P1-03: the route passes a per-request contextNote built from that context.
// CHAT-AGENT-P1-04: the response also names the timezone the tools used.
// CHAT-AGENT-P2-02: `voice: true` appends the voice-mode line to the context note.
// REFACTOR-R5-P2-01: the route is thin, so the mocks moved from kv / pricingService /
// userService to chatService.reply. The ToolContext, contextNote, price overlay and
// kill-switch counting are now pinned in src/services/__tests__/ChatService.test.ts;
// here: what the route hands reply(), and how it maps the outcome to HTTP.
import { NextRequest } from "next/server";
import { ChatCapacityError } from "@/domain/errors";

jest.mock("@/lib/ratelimit", () => ({
  chatRatelimit:          { limit: async () => ({ success: true }) },
  chatRatelimitAnon:      { limit: async () => ({ success: true }) },
  chatRatelimitAnonDaily: { limit: async () => ({ success: true }) },
}));

jest.mock("@/lib/csrf", () => ({ isValidOrigin: () => true }));

const mockGetSession = jest.fn();
jest.mock("@/lib/session", () => ({ getSession: () => mockGetSession() }));

let mockLocaleCookie: string | undefined;
jest.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (mockLocaleCookie ? { value: mockLocaleCookie } : undefined) }),
}));

const mockReply = jest.fn();
jest.mock("@/services", () => ({
  chatService: { reply: (...a: unknown[]) => mockReply(...a) },
}));

const price = (priceCents: number) => ({ priceCents });
const PRICES = { session1h: price(1600), session2h: price(3000), pack5: price(7500), pack10: price(14000) };
const SCHEDULE = {
  timezone: "Europe/Madrid", cancelMinNoticeHours: 2, joinOpenMinutesBefore: 15, tutorAbsentAlertMinutes: 5,
};
jest.mock("@/lib/pricing-display", () => ({
  getDisplayPrices: async () => PRICES,
  getPackValidityDays: async () => 180,
}));
jest.mock("@/lib/schedule-config", () => ({ getScheduleConfig: async () => SCHEDULE }));
jest.mock("@/lib/chat-content", () => ({ getChatPromptContent: () => ({}) }));
jest.mock("@/lib/logger", () => ({ log: jest.fn() }));

import { POST } from "@/app/api/chat/route";

const ORIGIN     = "http://localhost:3000";
const SESSION_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function postReq(body: unknown): NextRequest {
  return new NextRequest(`${ORIGIN}/api/chat`, {
    method:  "POST",
    headers: { origin: ORIGIN, "content-type": "application/json", "x-forwarded-for": "203.0.113.7" },
    body:    typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLocaleCookie = undefined;
  mockGetSession.mockResolvedValue(null);
  mockReply.mockImplementation(async (r: { timezone?: string; sessionId: string | null }) => ({
    reply: "Hola", sessionId: r.sessionId ?? SESSION_ID, actions: [], timezone: r.timezone ?? "Europe/Madrid",
  }));
});

describe("CHAT-AGENT-P1-02: POST /api/chat", () => {
  it("answers { reply, sessionId, actions, timezone } with actions: [] when no tool ran", async () => {
    const res = await POST(postReq({ message: "  hola  ", sessionId: SESSION_ID }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      reply: "Hola", sessionId: SESSION_ID, actions: [], timezone: "Europe/Madrid",
    });
    expect(mockReply).toHaveBeenCalledWith({
      message: "hola", sessionId: SESSION_ID, email: null, timezone: undefined, voice: undefined, locale: "es",
      display: { prices: PRICES, packValidityDays: 180, schedule: SCHEDULE, content: {} },
    });
  });

  it("passes the actions through", async () => {
    const proposal = {
      type: "proposal", sessionType: "free15min",
      startIso: "2026-11-04T09:00:00.000Z", endIso: "2026-11-04T09:15:00.000Z",
    };
    mockReply.mockResolvedValue({ reply: "¿Te va bien?", sessionId: SESSION_ID, actions: [proposal], timezone: "Europe/Madrid" });

    const res = await POST(postReq({ message: "martes", sessionId: SESSION_ID }));

    expect((await res.json()).actions).toEqual([proposal]);
  });

  it("answers the visitor's timezone when one was sent (CHAT-AGENT-P1-04)", async () => {
    const res = await POST(postReq({ message: "hola", timezone: "America/Bogota" }));

    expect(mockReply.mock.calls[0][0].timezone).toBe("America/Bogota");
    expect((await res.json()).timezone).toBe("America/Bogota");
  });

  it("rejects a timezone outside SUPPORTED_TIMEZONES with a 400", async () => {
    const res = await POST(postReq({ message: "hola", timezone: "Mars/Olympus_Mons" }));

    expect(res.status).toBe(400);
    expect(mockReply).not.toHaveBeenCalled();
  });

  it("keeps the old message errors", async () => {
    const empty = await POST(postReq({ message: "   " }));
    const long  = await POST(postReq({ message: "x".repeat(1001) }));

    expect(empty.status).toBe(400);
    expect(await empty.json()).toEqual({ error: "El mensaje no puede estar vacío" });
    expect(long.status).toBe(400);
    expect(await long.json()).toEqual({ error: "Mensaje demasiado largo" });
  });

  it("starts a new conversation for a malformed sessionId instead of failing", async () => {
    const res = await POST(postReq({ message: "hola", sessionId: "not-a-uuid" }));

    expect(res.status).toBe(200);
    expect(mockReply).toHaveBeenCalledWith(expect.objectContaining({ sessionId: null }));
  });

  it("takes identity from the session, never from the body", async () => {
    mockGetSession.mockResolvedValue({ user: { email: "alumno@example.com" } });
    mockLocaleCookie = "en";

    await POST(postReq({
      message: "hola", timezone: "America/New_York",
      userId: "attacker", email: "victim@example.com",
    }));

    const passed = mockReply.mock.calls[0][0];
    expect(passed).toEqual(expect.objectContaining({
      email: "alumno@example.com", timezone: "America/New_York", locale: "en",
    }));
    expect(passed).not.toHaveProperty("userId");
  });

  it("passes voice on a dictated turn only (CHAT-AGENT-P2-02)", async () => {
    await POST(postReq({ message: "hola", voice: true }));
    await POST(postReq({ message: "hola" }));

    expect(mockReply.mock.calls[0][0].voice).toBe(true);
    expect(mockReply.mock.calls[1][0].voice).toBeUndefined();
  });

  it("answers 503 with the old body when the kill switch is open", async () => {
    mockReply.mockRejectedValue(new ChatCapacityError());

    const res = await POST(postReq({ message: "hola" }));

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Servicio temporalmente no disponible. Inténtalo más tarde." });
  });

  it("answers 502 on a model error", async () => {
    mockReply.mockRejectedValue(new Error("Anthropic API error 500"));

    const res = await POST(postReq({ message: "hola" }));

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "Error al contactar con el asistente. Inténtalo de nuevo." });
  });
});

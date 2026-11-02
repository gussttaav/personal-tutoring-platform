// CHAT-AGENT-P1-02 — POST /api/chat.
//
// Follows src/app/api/content/__tests__ (mock factories before the route import;
// real NextRequest objects). What is pinned: the body goes through
// ChatRequestSchema (a bad timezone is a 400, the old message errors are kept),
// the ToolContext comes from the server session and never from the body, the
// response carries `actions`, and the daily kill switch counts model calls.
import { NextRequest } from "next/server";

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

const mockKvGet    = jest.fn();
const mockKvIncrby = jest.fn();
const mockKvExpire = jest.fn();
jest.mock("@/infrastructure/redis/client", () => ({
  kv: {
    get:    (...a: unknown[]) => mockKvGet(...a),
    incrby: (...a: unknown[]) => mockKvIncrby(...a),
    expire: (...a: unknown[]) => mockKvExpire(...a),
  },
}));

const mockAsk = jest.fn();
const mockFindByEmail = jest.fn();
jest.mock("@/services", () => ({
  chatService:    { ask: (...a: unknown[]) => mockAsk(...a) },
  userService:    { findByEmail: (...a: unknown[]) => mockFindByEmail(...a) },
  pricingService: { hasUserOverrides: async () => false, getPublicPricing: jest.fn() },
}));

const price = (priceCents: number) => ({ priceCents });
jest.mock("@/lib/pricing-display", () => ({
  getDisplayPrices: async () => ({
    session1h: price(1600), session2h: price(3000), pack5: price(7500), pack10: price(14000),
  }),
  getPackValidityDays: async () => 180,
}));
jest.mock("@/lib/schedule-config", () => ({
  getScheduleConfig: async () => ({
    timezone: "Europe/Madrid", cancelMinNoticeHours: 2, joinOpenMinutesBefore: 15, tutorAbsentAlertMinutes: 5,
  }),
}));
jest.mock("@/lib/chat-content", () => ({ getChatPromptContent: () => ({}) }));
jest.mock("@/constants/chat-prompt", () => ({ buildChatSystemPrompt: () => "PROMPT" }));
jest.mock("@/lib/logger", () => ({ log: jest.fn() }));

import { POST } from "@/app/api/chat/route";

const ORIGIN     = "http://localhost:3000";
const SESSION_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const TODAY_KEY  = `chat:requests:${new Date().toISOString().slice(0, 10)}`;

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
  mockKvGet.mockResolvedValue(null);
  mockKvIncrby.mockImplementation(async (_k: string, n: number) => n);
  mockFindByEmail.mockResolvedValue(null);
  mockAsk.mockResolvedValue({ reply: "Hola", sessionId: SESSION_ID, actions: [], modelCalls: 1 });
});

describe("CHAT-AGENT-P1-02: POST /api/chat", () => {
  it("answers { reply, sessionId, actions } with actions: [] when no tool ran", async () => {
    const res = await POST(postReq({ message: "  hola  ", sessionId: SESSION_ID }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reply: "Hola", sessionId: SESSION_ID, actions: [] });
    expect(mockAsk).toHaveBeenCalledWith(expect.objectContaining({
      message: "hola", sessionId: SESSION_ID, systemPrompt: "PROMPT",
    }));
  });

  it("passes the actions through", async () => {
    const proposal = {
      type: "proposal", sessionType: "free15min",
      startIso: "2026-11-04T09:00:00.000Z", endIso: "2026-11-04T09:15:00.000Z",
    };
    mockAsk.mockResolvedValue({ reply: "¿Te va bien?", sessionId: SESSION_ID, actions: [proposal], modelCalls: 2 });

    const res = await POST(postReq({ message: "martes", sessionId: SESSION_ID }));

    expect((await res.json()).actions).toEqual([proposal]);
  });

  it("rejects a timezone outside SUPPORTED_TIMEZONES with a 400", async () => {
    const res = await POST(postReq({ message: "hola", timezone: "Mars/Olympus_Mons" }));

    expect(res.status).toBe(400);
    expect(mockAsk).not.toHaveBeenCalled();
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
    expect(mockAsk).toHaveBeenCalledWith(expect.objectContaining({ sessionId: null }));
  });

  it("builds an anonymous ToolContext in the tutor's timezone when none is sent", async () => {
    await POST(postReq({ message: "hola" }));

    const { toolContext } = mockAsk.mock.calls[0][0];
    expect(toolContext).toEqual({
      userId: null, email: null, timezone: "Europe/Madrid", locale: "es", now: expect.any(Date),
    });
  });

  it("takes identity from the session, never from the body", async () => {
    mockGetSession.mockResolvedValue({ user: { email: "alumno@example.com" } });
    mockFindByEmail.mockResolvedValue({ id: "user-1" });
    mockLocaleCookie = "en";

    await POST(postReq({
      message: "hola", timezone: "America/New_York",
      userId: "attacker", email: "victim@example.com",
    }));

    expect(mockAsk.mock.calls[0][0].toolContext).toEqual({
      userId: "user-1", email: "alumno@example.com", timezone: "America/New_York", locale: "en",
      now: expect.any(Date),
    });
  });

  it("counts the reply's model calls in the kill switch", async () => {
    mockKvGet.mockResolvedValue(10);
    mockKvIncrby.mockResolvedValue(13);
    mockAsk.mockResolvedValue({ reply: "ok", sessionId: SESSION_ID, actions: [], modelCalls: 3 });

    await POST(postReq({ message: "hola" }));

    expect(mockKvIncrby).toHaveBeenCalledWith(TODAY_KEY, 3);
    expect(mockKvExpire).not.toHaveBeenCalled(); // not the first write of the day
  });

  it("sets the counter's expiry on the first write of the day", async () => {
    await POST(postReq({ message: "hola" }));

    expect(mockKvIncrby).toHaveBeenCalledWith(TODAY_KEY, 1);
    expect(mockKvExpire).toHaveBeenCalledWith(TODAY_KEY, 86400);
  });

  it("opens the circuit at the cap without calling the model", async () => {
    mockKvGet.mockResolvedValue(1000);

    const res = await POST(postReq({ message: "hola" }));

    expect(res.status).toBe(503);
    expect(mockAsk).not.toHaveBeenCalled();
    expect(mockKvIncrby).not.toHaveBeenCalled();
  });

  it("counts a failed turn as one call and answers 502", async () => {
    mockAsk.mockRejectedValue(new Error("Anthropic API error 500"));

    const res = await POST(postReq({ message: "hola" }));

    expect(res.status).toBe(502);
    expect(mockKvIncrby).toHaveBeenCalledWith(TODAY_KEY, 1);
  });
});

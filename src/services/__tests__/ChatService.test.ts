// REFACTOR-P2-03: Unit tests for server-side history in ChatService.
// Mocks Redis (kv) and IChatModelClient so no external I/O occurs.
// CHAT-CLAUDE-01: provider-neutral ChatTurn history under the `chat:hist:v2:` prefix.
// CHAT-AGENT-P1-02: the model returns a ChatReply; tools + ToolContext pass through,
// actions come back, and an assistant turn that showed actions keeps a summary.
// CHAT-AGENT-P1-02c: the summary is on the visitor's clock (local label + offset start_iso).
// REFACTOR-R5-P2-01: reply() — the route's old work (prices, prompt, ToolContext,
// contextNote, kill switch), tested at the service with a real PricingService over the
// in-memory pricing repository.

jest.mock("@/infrastructure/redis/client", () => ({
  kv: { get: jest.fn(), set: jest.fn(), incrby: jest.fn(), expire: jest.fn() },
}));
jest.mock("@/constants/chat-prompt", () => ({ buildChatSystemPrompt: jest.fn(() => "PROMPT") }));
jest.mock("@/lib/logger", () => ({ log: jest.fn() }));

import { ChatService, summarizeActions, type ChatReplyRequest } from "../ChatService";
import { PricingService } from "../PricingService";
import type { IChatModelClient, ChatTurn, ChatAction, ChatTool, ToolContext } from "@/infrastructure/anthropic";
import { kv } from "@/infrastructure/redis/client";
import { buildChatSystemPrompt } from "@/constants/chat-prompt";
import { ChatCapacityError } from "@/domain/errors";
import { InMemoryPricingRepository } from "@/__tests__/fixtures/InMemoryPricingRepository";
import { InMemoryAuditRepository } from "@/__tests__/fixtures/InMemoryAuditRepository";
import type { DisplayPrices } from "@/lib/pricing-format";
import type { ScheduleConfig } from "@/domain/types";
import type { ChatPromptContent } from "@/constants/chat-prompt";

const mockGet    = kv.get as jest.Mock;
const mockSet    = kv.set as jest.Mock;
const mockIncrby = kv.incrby as jest.Mock;
const mockExpire = kv.expire as jest.Mock;
const mockPrompt = buildChatSystemPrompt as jest.Mock;

// ask() never touches these; reply() tests build their own.
const NO_USERS   = { findByEmail: async () => null };
const NO_PRICING = { getEffectivePriceCents: async () => { throw new Error("not used"); } };

const SYSTEM_PROMPT = "You are a helpful assistant.";

const TOOL_CONTEXT: ToolContext = {
  userId:   null,
  email:    null,
  timezone: "Europe/Madrid",
  locale:   "es",
  now:      new Date("2026-11-02T10:00:00Z"),
};

function makeFakeModel(reply = "Hello!", actions: ChatAction[] = [], modelCalls = 1): IChatModelClient {
  return {
    chat: jest.fn().mockResolvedValue({ text: reply, actions, modelCalls }),
  };
}

const NO_TOOLS = { tools: [], toolContext: TOOL_CONTEXT, contextNote: undefined };

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue(null);
  mockSet.mockResolvedValue("OK");
});

describe("ChatService — REFACTOR-P2-03: server-side history", () => {
  it("creates a new sessionId (UUID) when none provided", async () => {
    const svc = new ChatService(makeFakeModel(), [], NO_USERS, NO_PRICING);
    const { sessionId } = await svc.ask({
      message: "hi",
      sessionId: null,
      systemPrompt: SYSTEM_PROMPT,
      toolContext: TOOL_CONTEXT,
    });
    expect(sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it("returns the same sessionId passed in", async () => {
    const svc = new ChatService(makeFakeModel(), [], NO_USERS, NO_PRICING);
    const existing = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const { sessionId } = await svc.ask({
      message: "hi",
      sessionId: existing,
      systemPrompt: SYSTEM_PROMPT,
      toolContext: TOOL_CONTEXT,
    });
    expect(sessionId).toBe(existing);
  });

  it("loads prior history from Redis and passes it to model.chat", async () => {
    const priorHistory: ChatTurn[] = [
      { role: "user",      text: "What is 2+2?" },
      { role: "assistant", text: "4" },
    ];
    mockGet.mockResolvedValue(priorHistory);

    const model = makeFakeModel("It is 4.");
    const svc = new ChatService(model, [], NO_USERS, NO_PRICING);

    await svc.ask({
      message: "Explain why",
      sessionId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      systemPrompt: SYSTEM_PROMPT,
      toolContext: TOOL_CONTEXT,
    });

    expect(mockGet).toHaveBeenCalledWith("chat:hist:v2:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    expect(model.chat).toHaveBeenCalledWith(
      SYSTEM_PROMPT,
      priorHistory,
      "Explain why",
      NO_TOOLS,
    );
  });

  it("appends the new user+assistant turn pair and saves to Redis", async () => {
    const svc = new ChatService(makeFakeModel("Bot reply"), [], NO_USERS, NO_PRICING);

    const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    await svc.ask({ message: "Hello", sessionId: id, systemPrompt: SYSTEM_PROMPT, toolContext: TOOL_CONTEXT });

    expect(mockSet).toHaveBeenCalledWith(
      `chat:hist:v2:${id}`,
      [
        { role: "user",      text: "Hello" },
        { role: "assistant", text: "Bot reply" },
      ],
      { ex: 3600 },
    );
  });

  it("caps stored history at MAX_HISTORY_TURNS * 2 (20 messages)", async () => {
    // 19 pre-existing messages → new turn would push to 21 without the cap
    const bigHistory: ChatTurn[] = Array.from({ length: 19 }, (_, i) => ({
      role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
      text: `msg ${i}`,
    }));
    mockGet.mockResolvedValue(bigHistory);

    const svc = new ChatService(makeFakeModel("reply"), [], NO_USERS, NO_PRICING);
    const id  = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    await svc.ask({ message: "new", sessionId: id, systemPrompt: SYSTEM_PROMPT, toolContext: TOOL_CONTEXT });

    const [, savedHistory] = mockSet.mock.calls[0] as [string, ChatTurn[]];
    expect(savedHistory).toHaveLength(20);
  });

  it("starts with empty history when Redis returns null (new session)", async () => {
    mockGet.mockResolvedValue(null);

    const model = makeFakeModel();
    const svc = new ChatService(model, [], NO_USERS, NO_PRICING);
    await svc.ask({ message: "First message", sessionId: null, systemPrompt: SYSTEM_PROMPT, toolContext: TOOL_CONTEXT });

    expect(model.chat).toHaveBeenCalledWith(SYSTEM_PROMPT, [], "First message", NO_TOOLS);
  });

  it("returns the reply from model.chat", async () => {
    const svc = new ChatService(makeFakeModel("Specific reply text"), [], NO_USERS, NO_PRICING);
    const { reply } = await svc.ask({
      message: "anything",
      sessionId: null,
      systemPrompt: SYSTEM_PROMPT,
      toolContext: TOOL_CONTEXT,
    });
    expect(reply).toBe("Specific reply text");
  });
});

describe("ChatService — CHAT-AGENT-P1-02: tools and actions", () => {
  const ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  const PROPOSAL: ChatAction = {
    type: "proposal", sessionType: "free15min",
    startIso: "2026-11-04T09:00:00.000Z", endIso: "2026-11-04T09:15:00.000Z",
  };
  const SLOTS: ChatAction = {
    type: "slots", durationMinutes: 15,
    slots: [
      { startIso: "2026-11-04T09:00:00.000Z", endIso: "2026-11-04T09:15:00.000Z" },
      { startIso: "2026-11-04T10:00:00.000Z", endIso: "2026-11-04T10:15:00.000Z" },
    ],
  };

  it("passes the injected tools, the ToolContext and the context note to the model", async () => {
    const tool: ChatTool = {
      name: "noop", description: "test", inputSchema: { type: "object", additionalProperties: false },
      run: jest.fn(),
    };
    const model = makeFakeModel();
    const svc = new ChatService(model, [tool], NO_USERS, NO_PRICING);
    await svc.ask({
      message: "hi", sessionId: ID, systemPrompt: SYSTEM_PROMPT,
      toolContext: TOOL_CONTEXT, contextNote: "Zona horaria del usuario: Europe/Madrid",
    });

    expect(model.chat).toHaveBeenCalledWith(SYSTEM_PROMPT, [], "hi", {
      tools: [tool], toolContext: TOOL_CONTEXT, contextNote: "Zona horaria del usuario: Europe/Madrid",
    });
  });

  it("returns the actions and the model-call count", async () => {
    const svc = new ChatService(makeFakeModel("Te propongo el martes", [SLOTS, PROPOSAL], 3), [], NO_USERS, NO_PRICING);
    const res = await svc.ask({ message: "hi", sessionId: ID, systemPrompt: SYSTEM_PROMPT, toolContext: TOOL_CONTEXT });

    expect(res.actions).toEqual([SLOTS, PROPOSAL]);
    expect(res.modelCalls).toBe(3);
  });

  it("saves an actionsSummary on the assistant turn, and no tool blocks", async () => {
    const svc = new ChatService(makeFakeModel("Te propongo el martes", [SLOTS, PROPOSAL]), [], NO_USERS, NO_PRICING);
    await svc.ask({ message: "hueco el martes", sessionId: ID, systemPrompt: SYSTEM_PROMPT, toolContext: TOOL_CONTEXT });

    expect(mockSet).toHaveBeenCalledWith(
      `chat:hist:v2:${ID}`,
      [
        { role: "user", text: "hueco el martes" },
        {
          role: "assistant",
          text: "Te propongo el martes",
          // CHAT-AGENT-P1-02c: on the visitor's clock (Madrid, UTC+1), never bare UTC.
          actionsSummary:
            "Ofrecí huecos de 15 min, en hora de Europe/Madrid: " +
            "mié 4 nov · 10:00 (start_iso 2026-11-04T10:00:00+01:00), " +
            "mié 4 nov · 11:00 (start_iso 2026-11-04T11:00:00+01:00); " +
            "Propuse (free15min), en hora de Europe/Madrid: mié 4 nov · 10:00 (start_iso 2026-11-04T10:00:00+01:00)",
        },
      ],
      { ex: 3600 },
    );
  });

  it("CHAT-AGENT-P1-02c: writes the summary in the visitor's timezone and language", async () => {
    const svc = new ChatService(makeFakeModel("Here you go", [SLOTS]), [], NO_USERS, NO_PRICING);
    await svc.ask({
      message: "slots on Wednesday", sessionId: ID, systemPrompt: SYSTEM_PROMPT,
      toolContext: { ...TOOL_CONTEXT, timezone: "America/Bogota", locale: "en" },
    });

    const [, saved] = mockSet.mock.calls[0] as [string, ChatTurn[]];
    expect(saved[1].actionsSummary).toBe(
      "Ofrecí huecos de 15 min, en hora de America/Bogota: " +
      "Wed 4 Nov · 04:00 (start_iso 2026-11-04T04:00:00-05:00), " +
      "Wed 4 Nov · 05:00 (start_iso 2026-11-04T05:00:00-05:00)",
    );
    expect(saved[1].actionsSummary).not.toMatch(/T\d{2}:\d{2}:\d{2}(\.\d+)?Z/);
  });

  it("CHAT-AGENT-P1-02c: each start_iso in the summary is the same instant the tool offered", () => {
    const summary = summarizeActions([SLOTS], { locale: "es", timezone: "Asia/Kolkata" })!;
    const isos = [...summary.matchAll(/start_iso (\S+)\)/g)].map((m) => Date.parse(m[1]));
    expect(isos).toEqual((SLOTS as Extract<ChatAction, { type: "slots" }>).slots.map((s) => Date.parse(s.startIso)));
    expect(summary).toContain("+05:30");
  });

  it("CHAT-AGENT-P1-02c: an empty slot list still says none was offered", () => {
    expect(summarizeActions([{ type: "slots", durationMinutes: 15, slots: [] }], TOOL_CONTEXT))
      .toBe("Ofrecí huecos de 15 min, en hora de Europe/Madrid: ninguno");
    expect(summarizeActions([], TOOL_CONTEXT)).toBeUndefined();
  });

  it("stores no actionsSummary key when the reply had no actions", async () => {
    const svc = new ChatService(makeFakeModel("Hola"), [], NO_USERS, NO_PRICING);
    await svc.ask({ message: "hola", sessionId: ID, systemPrompt: SYSTEM_PROMPT, toolContext: TOOL_CONTEXT });

    const [, saved] = mockSet.mock.calls[0] as [string, ChatTurn[]];
    expect(saved[1]).not.toHaveProperty("actionsSummary");
  });
});

// ─── REFACTOR-R5-P2-01: reply() ──────────────────────────────────────────────

describe("ChatService.reply — REFACTOR-R5-P2-01", () => {
  const ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  const TODAY_KEY = `chat:requests:${new Date().toISOString().slice(0, 10)}`;
  const dp = (priceCents: number) => ({ priceCents }) as DisplayPrices["session1h"];
  const DISPLAY: ChatReplyRequest["display"] = {
    // Deliberately unlike the seeded DB prices, so a test can tell which one reached the prompt.
    prices: { session1h: dp(1111), session2h: dp(2222), pack5: dp(5555), pack10: dp(10000) } as DisplayPrices,
    packValidityDays: 180,
    schedule: {
      timezone: "Europe/Madrid", cancelMinNoticeHours: 2, joinOpenMinutesBefore: 15, tutorAbsentAlertMinutes: 5,
    } as ScheduleConfig,
    content: {} as ChatPromptContent,
  };
  const req = (over: Partial<ChatReplyRequest> = {}): ChatReplyRequest => ({
    message: "hola", sessionId: null, email: null, locale: "es", display: DISPLAY, ...over,
  });

  function makeReplyService(model: IChatModelClient = makeFakeModel()) {
    const pricingRepo = new InMemoryPricingRepository();
    const pricing     = new PricingService(pricingRepo, new InMemoryAuditRepository());
    const users       = { findByEmail: jest.fn(async (email: string) => (email === "alumno@example.com" ? { id: "user-1" } : null)) };
    return { svc: new ChatService(model, [], users, pricing), model, users, pricingRepo };
  }

  beforeEach(() => {
    mockIncrby.mockImplementation(async (_k: string, n: number) => n);
  });

  it("answers { reply, sessionId, actions, timezone } in the tutor's timezone by default", async () => {
    const { svc } = makeReplyService(makeFakeModel("Hola"));
    const res = await svc.reply(req({ sessionId: ID }));

    expect(res).toEqual({ reply: "Hola", sessionId: ID, actions: [], timezone: "Europe/Madrid" });
  });

  it("builds an anonymous ToolContext and quotes the cached public prices without a DB read", async () => {
    const { svc, model, users, pricingRepo } = makeReplyService();
    const list = jest.spyOn(pricingRepo, "list");

    await svc.reply(req());

    expect(users.findByEmail).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
    expect(mockPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ session1h: 1111, session2h: 2222, pack5: 5555, pack10: 10000, packValidityDays: 180, cancelHours: 2 }),
      DISPLAY.content,
    );
    const opts = (model.chat as jest.Mock).mock.calls[0][3];
    expect(opts.toolContext).toEqual({
      userId: null, email: null, timezone: "Europe/Madrid", locale: "es", now: expect.any(Date),
    });
  });

  it("takes identity from the request's session email, with the visitor's timezone and locale", async () => {
    const { svc, model } = makeReplyService();
    const res = await svc.reply(req({ email: "alumno@example.com", timezone: "America/New_York", locale: "en" }));

    expect((model.chat as jest.Mock).mock.calls[0][3].toolContext).toEqual({
      userId: "user-1", email: "alumno@example.com", timezone: "America/New_York", locale: "en", now: expect.any(Date),
    });
    expect(res.timezone).toBe("America/New_York");
  });

  it("puts a signed-in student's override in the prompt, reading user_pricing once", async () => {
    const { svc, pricingRepo } = makeReplyService();
    await pricingRepo.upsertForUser("user-1", "session1h", 1200, "admin@test.com");
    const listForUser = jest.spyOn(pricingRepo, "listForUser");

    await svc.reply(req({ email: "alumno@example.com" }));

    expect(listForUser).toHaveBeenCalledTimes(1);
    // The override, and the DB's public prices for the rest (seeded 3000 / 7500 / 14000).
    expect(mockPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ session1h: 1200, session2h: 3000, pack5: 7500, pack10: 14000 }),
      DISPLAY.content,
    );
  });

  it("passes the context note, with the voice line on a dictated turn", async () => {
    const { svc, model } = makeReplyService();
    await svc.reply(req({ voice: true, timezone: "America/Bogota" }));

    expect((model.chat as jest.Mock).mock.calls[0][3].contextNote).toMatch(
      /Zona horaria del usuario: America\/Bogota\. Sesión iniciada: no\. Idioma: es\. El usuario ha dictado este mensaje/,
    );
  });

  it("counts the reply's model calls in the kill switch", async () => {
    mockGet.mockImplementation(async (k: string) => (k === TODAY_KEY ? 10 : null));
    mockIncrby.mockResolvedValue(13);
    const { svc } = makeReplyService(makeFakeModel("ok", [], 3));

    await svc.reply(req());

    expect(mockIncrby).toHaveBeenCalledWith(TODAY_KEY, 3);
    expect(mockExpire).not.toHaveBeenCalled(); // not the first write of the day
  });

  it("sets the counter's expiry on the first write of the day", async () => {
    const { svc } = makeReplyService();
    await svc.reply(req());

    expect(mockIncrby).toHaveBeenCalledWith(TODAY_KEY, 1);
    expect(mockExpire).toHaveBeenCalledWith(TODAY_KEY, 86400);
  });

  it("counts a failed turn as one call and lets the error propagate", async () => {
    const model: IChatModelClient = { chat: jest.fn().mockRejectedValue(new Error("Anthropic API error 500")) };
    const { svc } = makeReplyService(model);

    await expect(svc.reply(req())).rejects.toThrow("Anthropic API error 500");
    expect(mockIncrby).toHaveBeenCalledWith(TODAY_KEY, 1);
  });

  it("throws ChatCapacityError at the cap without calling the model or counting", async () => {
    mockGet.mockImplementation(async (k: string) => (k === TODAY_KEY ? 1000 : null));
    const { svc, model } = makeReplyService();

    await expect(svc.reply(req())).rejects.toBeInstanceOf(ChatCapacityError);
    expect(model.chat).not.toHaveBeenCalled();
    expect(mockIncrby).not.toHaveBeenCalled();
  });
});

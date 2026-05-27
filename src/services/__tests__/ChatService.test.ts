// REFACTOR-P2-03: Unit tests for server-side history in ChatService.
// Mocks Redis (kv) and IGeminiClient so no external I/O occurs.

jest.mock("@/infrastructure/redis/client", () => ({
  kv: { get: jest.fn(), set: jest.fn() },
}));

import { ChatService } from "../ChatService";
import type { IGeminiClient, GeminiMessage } from "@/infrastructure/gemini";
import { kv } from "@/infrastructure/redis/client";

const mockGet = kv.get as jest.Mock;
const mockSet = kv.set as jest.Mock;

const SYSTEM_PROMPT = "You are a helpful assistant.";

function makeFakeGemini(reply = "Hello!"): IGeminiClient {
  return {
    chat: jest.fn().mockResolvedValue(reply),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue(null);
  mockSet.mockResolvedValue("OK");
});

describe("ChatService — REFACTOR-P2-03: server-side history", () => {
  it("creates a new sessionId (UUID) when none provided", async () => {
    const svc = new ChatService(makeFakeGemini());
    const { sessionId } = await svc.ask({
      message: "hi",
      sessionId: null,
      systemPrompt: SYSTEM_PROMPT,
    });
    expect(sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it("returns the same sessionId passed in", async () => {
    const svc = new ChatService(makeFakeGemini());
    const existing = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const { sessionId } = await svc.ask({
      message: "hi",
      sessionId: existing,
      systemPrompt: SYSTEM_PROMPT,
    });
    expect(sessionId).toBe(existing);
  });

  it("loads prior history from Redis and passes it to gemini.chat", async () => {
    const priorHistory: GeminiMessage[] = [
      { role: "user",  parts: [{ text: "What is 2+2?" }] },
      { role: "model", parts: [{ text: "4" }] },
    ];
    mockGet.mockResolvedValue(priorHistory);

    const gemini = makeFakeGemini("It is 4.");
    const svc = new ChatService(gemini);

    await svc.ask({
      message: "Explain why",
      sessionId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      systemPrompt: SYSTEM_PROMPT,
    });

    expect(gemini.chat).toHaveBeenCalledWith(
      SYSTEM_PROMPT,
      priorHistory,
      "Explain why",
    );
  });

  it("appends the new user+model turn pair and saves to Redis", async () => {
    const svc = new ChatService(makeFakeGemini("Bot reply"));

    const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    await svc.ask({ message: "Hello", sessionId: id, systemPrompt: SYSTEM_PROMPT });

    expect(mockSet).toHaveBeenCalledWith(
      `chat:hist:${id}`,
      [
        { role: "user",  parts: [{ text: "Hello" }] },
        { role: "model", parts: [{ text: "Bot reply" }] },
      ],
      { ex: 3600 },
    );
  });

  it("caps stored history at MAX_HISTORY_TURNS * 2 (20 messages)", async () => {
    // 19 pre-existing messages → new turn would push to 21 without the cap
    const bigHistory: GeminiMessage[] = Array.from({ length: 19 }, (_, i) => ({
      role:  i % 2 === 0 ? "user" : ("model" as const),
      parts: [{ text: `msg ${i}` }] as [{ text: string }],
    }));
    mockGet.mockResolvedValue(bigHistory);

    const svc = new ChatService(makeFakeGemini("reply"));
    const id  = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    await svc.ask({ message: "new", sessionId: id, systemPrompt: SYSTEM_PROMPT });

    const [, savedHistory] = mockSet.mock.calls[0] as [string, GeminiMessage[]];
    expect(savedHistory).toHaveLength(20);
  });

  it("starts with empty history when Redis returns null (new session)", async () => {
    mockGet.mockResolvedValue(null);

    const gemini = makeFakeGemini();
    const svc = new ChatService(gemini);
    await svc.ask({ message: "First message", sessionId: null, systemPrompt: SYSTEM_PROMPT });

    expect(gemini.chat).toHaveBeenCalledWith(SYSTEM_PROMPT, [], "First message");
  });

  it("returns the reply from gemini.chat", async () => {
    const svc = new ChatService(makeFakeGemini("Specific reply text"));
    const { reply } = await svc.ask({
      message: "anything",
      sessionId: null,
      systemPrompt: SYSTEM_PROMPT,
    });
    expect(reply).toBe("Specific reply text");
  });
});

// REFACTOR-P2-03: Unit tests for server-side history in ChatService.
// Mocks Redis (kv) and IChatModelClient so no external I/O occurs.
// CHAT-CLAUDE-01: provider-neutral ChatTurn history under the `chat:hist:v2:` prefix.

jest.mock("@/infrastructure/redis/client", () => ({
  kv: { get: jest.fn(), set: jest.fn() },
}));

import { ChatService } from "../ChatService";
import type { IChatModelClient, ChatTurn } from "@/infrastructure/anthropic";
import { kv } from "@/infrastructure/redis/client";

const mockGet = kv.get as jest.Mock;
const mockSet = kv.set as jest.Mock;

const SYSTEM_PROMPT = "You are a helpful assistant.";

function makeFakeModel(reply = "Hello!"): IChatModelClient {
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
    const svc = new ChatService(makeFakeModel());
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
    const svc = new ChatService(makeFakeModel());
    const existing = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const { sessionId } = await svc.ask({
      message: "hi",
      sessionId: existing,
      systemPrompt: SYSTEM_PROMPT,
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
    const svc = new ChatService(model);

    await svc.ask({
      message: "Explain why",
      sessionId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      systemPrompt: SYSTEM_PROMPT,
    });

    expect(mockGet).toHaveBeenCalledWith("chat:hist:v2:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    expect(model.chat).toHaveBeenCalledWith(
      SYSTEM_PROMPT,
      priorHistory,
      "Explain why",
    );
  });

  it("appends the new user+assistant turn pair and saves to Redis", async () => {
    const svc = new ChatService(makeFakeModel("Bot reply"));

    const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    await svc.ask({ message: "Hello", sessionId: id, systemPrompt: SYSTEM_PROMPT });

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

    const svc = new ChatService(makeFakeModel("reply"));
    const id  = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    await svc.ask({ message: "new", sessionId: id, systemPrompt: SYSTEM_PROMPT });

    const [, savedHistory] = mockSet.mock.calls[0] as [string, ChatTurn[]];
    expect(savedHistory).toHaveLength(20);
  });

  it("starts with empty history when Redis returns null (new session)", async () => {
    mockGet.mockResolvedValue(null);

    const model = makeFakeModel();
    const svc = new ChatService(model);
    await svc.ask({ message: "First message", sessionId: null, systemPrompt: SYSTEM_PROMPT });

    expect(model.chat).toHaveBeenCalledWith(SYSTEM_PROMPT, [], "First message");
  });

  it("returns the reply from model.chat", async () => {
    const svc = new ChatService(makeFakeModel("Specific reply text"));
    const { reply } = await svc.ask({
      message: "anything",
      sessionId: null,
      systemPrompt: SYSTEM_PROMPT,
    });
    expect(reply).toBe("Specific reply text");
  });
});

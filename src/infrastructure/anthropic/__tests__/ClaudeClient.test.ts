/**
 * CHAT-CLAUDE-01 — ClaudeClient request shape and response handling.
 *
 * @anthropic-ai/sdk is mocked (no network, no API key); its real error classes are
 * kept so the error mapping runs against the same `instanceof` checks as production.
 *
 * PRICING-STUDENT-01 regression: the Gemini client kept one process-level cache slot
 * that could answer one caller's prompt to another. Claude's cache is keyed on the
 * prompt text itself, so every call must send exactly its own system prompt.
 */

const mockCreate = jest.fn();

jest.mock("@anthropic-ai/sdk", () => {
  const actual = jest.requireActual("@anthropic-ai/sdk");
  const MockAnthropic = jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } }));
  Object.assign(MockAnthropic, {
    APIError:            actual.APIError,
    AuthenticationError: actual.AuthenticationError,
    RateLimitError:      actual.RateLimitError,
  });
  return { __esModule: true, default: MockAnthropic };
});

jest.mock("@/lib/logger", () => ({ log: jest.fn() }));

import Anthropic from "@anthropic-ai/sdk";
import { ClaudeClient, __resetClaudeClient } from "../ClaudeClient";
import type { ChatTurn } from "../IChatModelClient";
import { log } from "@/lib/logger";

function reply(
  content: unknown[],
  stop_reason = "end_turn",
  stop_details: unknown = null,
) {
  return {
    id: "msg_test", type: "message", role: "assistant", model: "claude-haiku-5-5",
    content, stop_reason, stop_details, stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5 },
  };
}

const errorBody = (type: string, message: string) => ({ type: "error", error: { type, message } });

beforeEach(() => {
  jest.clearAllMocks();
  __resetClaudeClient();
  mockCreate.mockResolvedValue(reply([{ type: "text", text: "Hola" }]));
});

describe("ClaudeClient.chat — request", () => {
  it("sends Haiku 5.5 at low effort with a cached system prompt and no sampling params", async () => {
    await new ClaudeClient().chat("PROMPT", [], "¿Cuánto cuesta?");

    const params = mockCreate.mock.calls[0][0];
    expect(params.model).toBe("claude-haiku-5-5");
    expect(params.output_config).toEqual({ effort: "low" });
    expect(params.system).toEqual([
      { type: "text", text: "PROMPT", cache_control: { type: "ephemeral" } },
    ]);
    // temperature / top_p / top_k return a 400 on current Claude models.
    expect(params).not.toHaveProperty("temperature");
    expect(params).not.toHaveProperty("top_p");
    expect(params).not.toHaveProperty("top_k");
  });

  it("maps history to Messages API turns and appends the new user message", async () => {
    const history: ChatTurn[] = [
      { role: "user",      text: "Hola" },
      { role: "assistant", text: "¡Hola! ¿En qué te ayudo?" },
    ];
    await new ClaudeClient().chat("PROMPT", history, "Precios");

    expect(mockCreate.mock.calls[0][0].messages).toEqual([
      { role: "user",      content: "Hola" },
      { role: "assistant", content: "¡Hola! ¿En qué te ayudo?" },
      { role: "user",      content: "Precios" },
    ]);
  });

  it("drops assistant turns before the first user turn (the API must open with a user turn)", async () => {
    const history: ChatTurn[] = [
      { role: "assistant", text: "orphan" },
      { role: "user",      text: "q1" },
      { role: "assistant", text: "a1" },
    ];
    await new ClaudeClient().chat("PROMPT", history, "q2");

    expect(mockCreate.mock.calls[0][0].messages[0]).toEqual({ role: "user", content: "q1" });
    expect(mockCreate.mock.calls[0][0].messages).toHaveLength(3);
  });

  it("sends each caller exactly its own system prompt (PRICING-STUDENT-01)", async () => {
    const client = new ClaudeClient();
    await client.chat("PUBLIC PRICES", [], "a");
    await client.chat("STUDENT PRIVATE PRICE", [], "b");
    await client.chat("PUBLIC PRICES", [], "c");

    const sent = mockCreate.mock.calls.map(([p]) => p.system[0].text);
    expect(sent).toEqual(["PUBLIC PRICES", "STUDENT PRIVATE PRICE", "PUBLIC PRICES"]);
  });

  it("bounds the SDK timeout and retries to fit the serverless time budget", async () => {
    await new ClaudeClient().chat("PROMPT", [], "hi");

    expect(Anthropic).toHaveBeenCalledWith({ timeout: 10_000, maxRetries: 1 });
  });
});

describe("ClaudeClient.chat — response", () => {
  it("returns the text blocks only, skipping thinking blocks", async () => {
    mockCreate.mockResolvedValue(reply([
      { type: "thinking", thinking: "", signature: "sig" },
      { type: "text", text: "  Una clase de 1h cuesta 16 €.  " },
    ]));

    await expect(new ClaudeClient().chat("PROMPT", [], "q")).resolves.toBe("Una clase de 1h cuesta 16 €.");
  });

  it("throws on a refusal instead of returning partial text", async () => {
    mockCreate.mockResolvedValue(reply(
      [{ type: "text", text: "" }],
      "refusal",
      { type: "refusal", category: "general_harms", explanation: null },
    ));

    await expect(new ClaudeClient().chat("PROMPT", [], "q")).rejects.toThrow(/declined.*general_harms/);
  });

  it("throws when the reply has no text (e.g. max_tokens spent on thinking)", async () => {
    mockCreate.mockResolvedValue(reply([{ type: "thinking", thinking: "", signature: "sig" }], "max_tokens"));

    await expect(new ClaudeClient().chat("PROMPT", [], "q")).rejects.toThrow(/Empty response.*max_tokens/);
  });

  it("returns a truncated reply but logs a warning", async () => {
    mockCreate.mockResolvedValue(reply([{ type: "text", text: "Respuesta cortada" }], "max_tokens"));

    await expect(new ClaudeClient().chat("PROMPT", [], "q")).resolves.toBe("Respuesta cortada");
    expect(log).toHaveBeenCalledWith("warn", expect.stringContaining("max_tokens"), expect.any(Object));
  });
});

describe("ClaudeClient.chat — API errors", () => {
  it("names a rejected API key so an expired key is obvious in the logs", async () => {
    mockCreate.mockRejectedValue(new Anthropic.AuthenticationError(
      401, errorBody("authentication_error", "invalid x-api-key"), "invalid x-api-key", new Headers(),
    ));

    await expect(new ClaudeClient().chat("PROMPT", [], "q")).rejects.toThrow(/API key rejected.*ANTHROPIC_API_KEY/);
  });

  it("names a rate or spend limit", async () => {
    mockCreate.mockRejectedValue(new Anthropic.RateLimitError(
      429, errorBody("rate_limit_error", "monthly API usage threshold"), "monthly API usage threshold", new Headers(),
    ));

    await expect(new ClaudeClient().chat("PROMPT", [], "q")).rejects.toThrow(/rate or spend limit/);
  });

  it("rethrows non-API errors unchanged", async () => {
    const boom = new TypeError("network down");
    mockCreate.mockRejectedValue(boom);

    await expect(new ClaudeClient().chat("PROMPT", [], "q")).rejects.toBe(boom);
  });
});

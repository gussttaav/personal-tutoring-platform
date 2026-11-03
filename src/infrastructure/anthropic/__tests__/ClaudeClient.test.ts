/**
 * CHAT-CLAUDE-01 — ClaudeClient request shape and response handling.
 *
 * @anthropic-ai/sdk is mocked (no network, no API key); its real error classes are
 * kept so the error mapping runs against the same `instanceof` checks as production.
 *
 * PRICING-STUDENT-01 regression: the Gemini client kept one process-level cache slot
 * that could answer one caller's prompt to another. Claude's cache is keyed on the
 * prompt text itself, so every call must send exactly its own system prompt.
 *
 * CHAT-AGENT-P1-02: `chat` returns a ChatReply; the bounded tool loop (rounds,
 * deadline, parallel results, is_error, refusal / max_tokens mid-loop) is below.
 *
 * CHAT-AGENT-P1-02b: a tool-round call aborted by its budget falls back to the
 * reserved tools-off call instead of failing the turn.
 */

const mockCreate = jest.fn();

jest.mock("@anthropic-ai/sdk", () => {
  const actual = jest.requireActual("@anthropic-ai/sdk");
  const MockAnthropic = jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } }));
  Object.assign(MockAnthropic, {
    APIError:            actual.APIError,
    AuthenticationError: actual.AuthenticationError,
    RateLimitError:      actual.RateLimitError,
    APIUserAbortError:   actual.APIUserAbortError,
    APIConnectionTimeoutError: actual.APIConnectionTimeoutError,
  });
  return { __esModule: true, default: MockAnthropic };
});

jest.mock("@/lib/logger", () => ({ log: jest.fn() }));

import Anthropic from "@anthropic-ai/sdk";
import { ClaudeClient, __resetClaudeClient } from "../ClaudeClient";
import type { ChatTurn, ChatTool, ToolContext } from "../IChatModelClient";
import { z } from "zod";
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
    // CHAT-AGENT-P1-02: one attempt stays at 10 s; the signal bounds the retry too.
    const options = mockCreate.mock.calls[0][1];
    expect(options.timeout).toBe(10_000);
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it("sends no tools and no tool_choice when none are registered (CHAT-AGENT-P1-02)", async () => {
    await new ClaudeClient().chat("PROMPT", [], "hi", { tools: [] });

    const params = mockCreate.mock.calls[0][0];
    expect(params).not.toHaveProperty("tools");
    expect(params).not.toHaveProperty("tool_choice");
    expect(params.messages).toEqual([{ role: "user", content: "hi" }]);
  });

  it("renders a stored actionsSummary as an extra text block on that assistant turn", async () => {
    const history: ChatTurn[] = [
      { role: "user",      text: "¿Hueco el martes?" },
      { role: "assistant", text: "Te propongo las 10:00", actionsSummary: "Propuse: 2026-11-04T09:00:00.000Z (free15min)" },
    ];
    await new ClaudeClient().chat("PROMPT", history, "vale");

    expect(mockCreate.mock.calls[0][0].messages[1]).toEqual({
      role: "assistant",
      content: [
        { type: "text", text: "Te propongo las 10:00" },
        { type: "text", text: "[Propuse: 2026-11-04T09:00:00.000Z (free15min)]" },
      ],
    });
  });

  it("sends the context note as a system message right after the user turn, not in the cached prompt", async () => {
    await new ClaudeClient().chat("PROMPT", [], "hola", { contextNote: "Zona horaria del usuario: Europe/Madrid" });

    const params = mockCreate.mock.calls[0][0];
    expect(params.system).toEqual([
      { type: "text", text: "PROMPT", cache_control: { type: "ephemeral" } },
    ]);
    expect(params.messages).toEqual([
      { role: "user",   content: "hola" },
      { role: "system", content: "Zona horaria del usuario: Europe/Madrid" },
    ]);
  });
});

describe("ClaudeClient.chat — response", () => {
  it("returns the text blocks only, skipping thinking blocks", async () => {
    mockCreate.mockResolvedValue(reply([
      { type: "thinking", thinking: "", signature: "sig" },
      { type: "text", text: "  Una clase de 1h cuesta 16 €.  " },
    ]));

    await expect(new ClaudeClient().chat("PROMPT", [], "q")).resolves.toEqual({
      text: "Una clase de 1h cuesta 16 €.", actions: [], modelCalls: 1,
    });
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

    await expect(new ClaudeClient().chat("PROMPT", [], "q")).resolves.toMatchObject({ text: "Respuesta cortada" });
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

  it("names an abort as the chat time budget running out (CHAT-AGENT-P1-02)", async () => {
    mockCreate.mockRejectedValue(new Anthropic.APIUserAbortError());

    await expect(new ClaudeClient().chat("PROMPT", [], "q")).rejects.toThrow(/time budget/);
  });
});

// ─── CHAT-AGENT-P1-02: the tool loop ─────────────────────────────────────────

const CTX: ToolContext = {
  userId: "user-1", email: "alumno@example.com", timezone: "Europe/Madrid", locale: "es",
  now: new Date("2026-11-02T10:00:00Z"),
};

const SCHEMA = {
  type: "object",
  properties: { date: { type: "string" } },
  required: ["date"],
  additionalProperties: false,
};

function makeTool(name: string, run: ChatTool["run"]): ChatTool {
  return { name, description: `${name} tool`, inputSchema: SCHEMA, run: jest.fn(run) };
}

const toolUse = (id: string, name: string, input: unknown = { date: "2026-11-04" }) =>
  ({ type: "tool_use", id, name, input });

const THINKING = { type: "thinking", thinking: "", signature: "sig-1" };

const PROPOSAL = {
  type: "proposal" as const, sessionType: "free15min" as const,
  startIso: "2026-11-04T09:00:00.000Z", endIso: "2026-11-04T09:15:00.000Z",
};

describe("ClaudeClient.chat — tool loop (CHAT-AGENT-P1-02)", () => {
  afterEach(() => jest.restoreAllMocks());

  it("requires a ToolContext when tools are passed", async () => {
    const tool = makeTool("find", async () => ({ result: {} }));
    await expect(new ClaudeClient().chat("PROMPT", [], "q", { tools: [tool] })).rejects.toThrow(/toolContext/);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("runs one round trip: tool_use → run → tool_result → final text", async () => {
    const tool = makeTool("find", async () => ({ result: { slots: ["10:00"] }, action: PROPOSAL }));
    mockCreate
      .mockResolvedValueOnce(reply([THINKING, toolUse("tu_1", "find")], "tool_use"))
      .mockResolvedValueOnce(reply([{ type: "text", text: "Tengo hueco a las 10:00" }]));

    const res = await new ClaudeClient().chat("PROMPT", [], "¿hueco el martes?", { tools: [tool], toolContext: CTX });

    expect(res).toEqual({ text: "Tengo hueco a las 10:00", actions: [PROPOSAL], modelCalls: 2 });
    expect(tool.run).toHaveBeenCalledWith({ date: "2026-11-04" }, CTX);

    const first = mockCreate.mock.calls[0][0];
    expect(first.tools).toEqual([
      { name: "find", description: "find tool", input_schema: SCHEMA, strict: true },
    ]);
    expect(first).not.toHaveProperty("tool_choice"); // auto
    expect(first.messages).toEqual([{ role: "user", content: "¿hueco el martes?" }]);

    const second = mockCreate.mock.calls[1][0];
    expect(second.messages).toEqual([
      { role: "user", content: "¿hueco el martes?" },
      // the full assistant content, thinking block unchanged
      { role: "assistant", content: [THINKING, toolUse("tu_1", "find")] },
      { role: "user", content: [
        { type: "tool_result", tool_use_id: "tu_1", content: JSON.stringify({ slots: ["10:00"] }) },
      ] },
    ]);
  });

  it("keeps the context note between the user turn and the first assistant tool turn", async () => {
    const tool = makeTool("find", async () => ({ result: {} }));
    mockCreate
      .mockResolvedValueOnce(reply([toolUse("tu_1", "find")], "tool_use"))
      .mockResolvedValueOnce(reply([{ type: "text", text: "ok" }]));

    await new ClaudeClient().chat("PROMPT", [], "q", { tools: [tool], toolContext: CTX, contextNote: "NOTE" });

    expect(mockCreate.mock.calls[1][0].messages.map((m: { role: string }) => m.role))
      .toEqual(["user", "system", "assistant", "user"]);
  });

  it("answers two parallel tool_use blocks in ONE user message, in call order", async () => {
    const a = makeTool("a", async () => ({ result: "A" }));
    const b = makeTool("b", async () => ({ result: "B" }));
    mockCreate
      .mockResolvedValueOnce(reply([toolUse("tu_a", "a"), toolUse("tu_b", "b")], "tool_use"))
      .mockResolvedValueOnce(reply([{ type: "text", text: "listo" }]));

    await new ClaudeClient().chat("PROMPT", [], "q", { tools: [a, b], toolContext: CTX });

    const messages = mockCreate.mock.calls[1][0].messages;
    expect(messages).toHaveLength(3);
    expect(messages[2]).toEqual({ role: "user", content: [
      { type: "tool_result", tool_use_id: "tu_a", content: '"A"' },
      { type: "tool_result", tool_use_id: "tu_b", content: '"B"' },
    ] });
  });

  it("turns a tool throw into an is_error result with a short code, never a failed turn", async () => {
    const coded   = makeTool("coded",   async () => { throw Object.assign(new Error("x"), { code: "SLOT_UNAVAILABLE" }); });
    const zod     = makeTool("zod",     async (input) => ({ result: z.object({ date: z.iso.date() }).parse(input) }));
    const generic = makeTool("generic", async () => { throw new Error("db password in here"); });
    mockCreate
      .mockResolvedValueOnce(reply([
        toolUse("tu_1", "coded"), toolUse("tu_2", "zod", { date: "martes" }),
        toolUse("tu_3", "generic"), toolUse("tu_4", "missing"),
      ], "tool_use"))
      .mockResolvedValueOnce(reply([{ type: "text", text: "Ese hueco ya no está libre" }]));

    const res = await new ClaudeClient().chat("PROMPT", [], "q", { tools: [coded, zod, generic], toolContext: CTX });

    expect(res.text).toBe("Ese hueco ya no está libre");
    expect(mockCreate.mock.calls[1][0].messages[2].content).toEqual([
      { type: "tool_result", tool_use_id: "tu_1", content: "SLOT_UNAVAILABLE", is_error: true },
      { type: "tool_result", tool_use_id: "tu_2", content: "INVALID_INPUT",    is_error: true },
      { type: "tool_result", tool_use_id: "tu_3", content: "TOOL_FAILED",      is_error: true },
      { type: "tool_result", tool_use_id: "tu_4", content: "UNKNOWN_TOOL",     is_error: true },
    ]);
    expect(log).toHaveBeenCalledWith("warn", "Chat tool failed", expect.objectContaining({ tool: "coded", code: "SLOT_UNAVAILABLE" }));
  });

  it("stops after 3 tool rounds with one last call at tool_choice none", async () => {
    const tool = makeTool("find", async () => ({ result: {} }));
    mockCreate
      .mockResolvedValueOnce(reply([toolUse("tu_1", "find")], "tool_use"))
      .mockResolvedValueOnce(reply([toolUse("tu_2", "find")], "tool_use"))
      .mockResolvedValueOnce(reply([toolUse("tu_3", "find")], "tool_use"))
      .mockResolvedValueOnce(reply([{ type: "text", text: "Con lo que tengo: martes 10:00" }]));

    const res = await new ClaudeClient().chat("PROMPT", [], "q", { tools: [tool], toolContext: CTX });

    expect(res.modelCalls).toBe(4);
    expect(tool.run).toHaveBeenCalledTimes(3);
    const last = mockCreate.mock.calls[3][0];
    expect(last.tool_choice).toEqual({ type: "none" });
    expect(last.tools).toHaveLength(1); // the history holds tool_use blocks
    for (const [params] of mockCreate.mock.calls.slice(0, 3)) expect(params).not.toHaveProperty("tool_choice");
  });

  it("never runs a 4th round even if the last call still asks for a tool", async () => {
    const tool = makeTool("find", async () => ({ result: {} }));
    mockCreate.mockResolvedValue(reply([{ type: "text", text: "Busco…" }, toolUse("tu_x", "find")], "tool_use"));

    const res = await new ClaudeClient().chat("PROMPT", [], "q", { tools: [tool], toolContext: CTX });

    expect(mockCreate).toHaveBeenCalledTimes(4);
    expect(tool.run).toHaveBeenCalledTimes(3);
    expect(res.text).toBe("Busco…");
  });

  it("past the deadline: a pending tool times out and the next call is the tools-off last call", async () => {
    let now = 1_000_000;
    jest.spyOn(Date, "now").mockImplementation(() => now);
    const slow = makeTool("slow", () => new Promise(() => {})); // never settles
    mockCreate
      .mockImplementationOnce(async () => {
        now += 16_000; // the first call eats the budget: 4 s left, under the 5 s reserve
        return reply([toolUse("tu_1", "slow")], "tool_use");
      })
      .mockResolvedValueOnce(reply([{ type: "text", text: "Ahora mismo no puedo mirarlo" }]));

    const res = await new ClaudeClient().chat("PROMPT", [], "q", { tools: [slow], toolContext: CTX });

    expect(res).toMatchObject({ text: "Ahora mismo no puedo mirarlo", modelCalls: 2 });
    expect(mockCreate.mock.calls[0][1].timeout).toBe(10_000);       // min(10 s, 20 s − reserve)
    expect(mockCreate.mock.calls[1][0].tool_choice).toEqual({ type: "none" });
    expect(mockCreate.mock.calls[1][1].timeout).toBe(5_000);        // the reserve
    expect(mockCreate.mock.calls[1][0].messages[2].content).toEqual([
      { type: "tool_result", tool_use_id: "tu_1", content: "TIMEOUT", is_error: true },
    ]);
  });

  it("gives a tool round's call only the budget left above the reserve", async () => {
    let now = 1_000_000;
    jest.spyOn(Date, "now").mockImplementation(() => now);
    const tool = makeTool("find", async () => { now += 8_000; return { result: {} }; });
    mockCreate
      .mockResolvedValueOnce(reply([toolUse("tu_1", "find")], "tool_use"))
      .mockResolvedValueOnce(reply([{ type: "text", text: "ok" }]));

    await new ClaudeClient().chat("PROMPT", [], "q", { tools: [tool], toolContext: CTX });

    // 12 s left after the tool → this tool round may use 7 s, keeping 5 s back.
    expect(mockCreate.mock.calls[1][1].timeout).toBe(7_000);
    expect(mockCreate.mock.calls[1][0]).not.toHaveProperty("tool_choice");
  });

  it("a tool-round call aborted by its budget falls back to the tools-off call (CHAT-AGENT-P1-02b)", async () => {
    let now = 1_000_000;
    jest.spyOn(Date, "now").mockImplementation(() => now);
    const tool = makeTool("find", async () => ({ result: { slots: ["10:00"] }, action: PROPOSAL }));
    mockCreate
      .mockImplementationOnce(async () => {
        now += 3_000;
        return reply([toolUse("tu_1", "find")], "tool_use");
      })
      .mockImplementationOnce(async () => {
        now += 12_000; // the second round eats its whole 12 s budget
        throw new Anthropic.APIUserAbortError();
      })
      .mockResolvedValueOnce(reply([{ type: "text", text: "El viernes a las 10:00 está libre" }]));

    const res = await new ClaudeClient().chat("PROMPT", [], "¿viernes?", { tools: [tool], toolContext: CTX });

    expect(res).toEqual({ text: "El viernes a las 10:00 está libre", actions: [PROPOSAL], modelCalls: 3 });
    expect(tool.run).toHaveBeenCalledTimes(1);
    const [aborted, last] = [mockCreate.mock.calls[1], mockCreate.mock.calls[2]];
    expect(aborted[0]).not.toHaveProperty("tool_choice");
    expect(last[0].tool_choice).toEqual({ type: "none" });
    expect(last[0].messages).toEqual(aborted[0].messages); // the tool results so far
    expect(last[1].timeout).toBe(5_000);                     // the reserve, still inside 20 s
    expect(log).toHaveBeenCalledWith("warn", expect.stringContaining("ran out of budget"), expect.any(Object));
  });

  it("also falls back when the SDK's own timeout fires on the last attempt (CHAT-AGENT-P1-02b)", async () => {
    const tool = makeTool("find", async () => ({ result: {} }));
    mockCreate
      .mockRejectedValueOnce(new Anthropic.APIConnectionTimeoutError())
      .mockResolvedValueOnce(reply([{ type: "text", text: "ok" }]));

    const res = await new ClaudeClient().chat("PROMPT", [], "q", { tools: [tool], toolContext: CTX });

    expect(res).toEqual({ text: "ok", actions: [], modelCalls: 2 });
    expect(tool.run).not.toHaveBeenCalled();
    expect(mockCreate.mock.calls[1][0].tool_choice).toEqual({ type: "none" });
  });

  it("a timeout on the tools-off call still fails the turn (CHAT-AGENT-P1-02b)", async () => {
    const tool = makeTool("find", async () => ({ result: {} }));
    mockCreate
      .mockResolvedValueOnce(reply([toolUse("tu_1", "find")], "tool_use"))
      .mockRejectedValueOnce(new Anthropic.APIUserAbortError())
      .mockRejectedValueOnce(new Anthropic.APIUserAbortError());

    await expect(new ClaudeClient().chat("PROMPT", [], "q", { tools: [tool], toolContext: CTX }))
      .rejects.toThrow(/time budget/);
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it("does not fall back on a non-timeout API error in a tool round", async () => {
    const tool = makeTool("find", async () => ({ result: {} }));
    mockCreate.mockRejectedValueOnce(new Anthropic.RateLimitError(
      429, errorBody("rate_limit_error", "slow down"), "slow down", new Headers(),
    ));

    await expect(new ClaudeClient().chat("PROMPT", [], "q", { tools: [tool], toolContext: CTX }))
      .rejects.toThrow(/rate or spend limit/);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("throws on a refusal mid-loop", async () => {
    const tool = makeTool("find", async () => ({ result: {} }));
    mockCreate
      .mockResolvedValueOnce(reply([toolUse("tu_1", "find")], "tool_use"))
      .mockResolvedValueOnce(reply([], "refusal", { type: "refusal", category: "cyber", explanation: null }));

    await expect(new ClaudeClient().chat("PROMPT", [], "q", { tools: [tool], toolContext: CTX }))
      .rejects.toThrow(/declined.*cyber/);
    expect(tool.run).toHaveBeenCalledTimes(1);
  });

  it("does not run a tool call cut off by max_tokens", async () => {
    const tool = makeTool("find", async () => ({ result: {} }));
    mockCreate.mockResolvedValueOnce(reply(
      [{ type: "text", text: "Voy a mirar" }, toolUse("tu_1", "find", {})],
      "max_tokens",
    ));

    const res = await new ClaudeClient().chat("PROMPT", [], "q", { tools: [tool], toolContext: CTX });

    expect(tool.run).not.toHaveBeenCalled();
    expect(res).toEqual({ text: "Voy a mirar", actions: [], modelCalls: 1 });
    expect(log).toHaveBeenCalledWith("warn", expect.stringContaining("max_tokens"), expect.any(Object));
  });

  it("returns at most one proposal: the last one wins", async () => {
    const later = { ...PROPOSAL, startIso: "2026-11-04T10:00:00.000Z", endIso: "2026-11-04T10:15:00.000Z" };
    const slots = { type: "slots" as const, durationMinutes: 15 as const, slots: [{ startIso: PROPOSAL.startIso, endIso: PROPOSAL.endIso }] };
    const proposeRun = jest.fn()
      .mockResolvedValueOnce({ result: { ok: true }, action: PROPOSAL })
      .mockResolvedValueOnce({ result: { ok: true }, action: later });
    const propose = makeTool("propose", proposeRun);
    const find = makeTool("find", async () => ({ result: {}, action: slots }));
    mockCreate
      .mockResolvedValueOnce(reply([toolUse("tu_1", "find"), toolUse("tu_2", "propose")], "tool_use"))
      .mockResolvedValueOnce(reply([toolUse("tu_3", "propose")], "tool_use"))
      .mockResolvedValueOnce(reply([{ type: "text", text: "Mejor a las 11:00" }]));

    const res = await new ClaudeClient().chat("PROMPT", [], "q", { tools: [find, propose], toolContext: CTX });

    expect(res.actions).toEqual([slots, later]);
  });
});

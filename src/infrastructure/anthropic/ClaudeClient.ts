/**
 * Claude API client for the chat assistant.
 *
 * CHAT-CLAUDE-01: replaces the Gemini REST client (ARCH-16, REFACTOR-P2-03).
 * The SDK reads ANTHROPIC_API_KEY server-side; it is never exposed to the browser.
 *
 * Prompt caching: the system prompt carries a `cache_control` breakpoint. Claude's
 * cache is a prefix match on the exact text sent, so every distinct prompt gets its
 * own entry: a student's private-price prompt (PRICING-STUDENT-01) can never be
 * answered to another caller, and no process-level cache slot is needed.
 *
 * Model notes (Claude Haiku 5.5):
 *   - `temperature` / `top_p` / `top_k` return a 400 on current models; tone and
 *     length are steered from the system prompt instead.
 *   - Thinking is on by default and counts toward `max_tokens`; `effort: "low"`
 *     keeps it short, and the reply is read from the `text` blocks only.
 *   - A safety decline is an HTTP 200 with `stop_reason: "refusal"`; Haiku 5.5
 *     has no server-side fallback, so it surfaces as an error to the route.
 *
 * CHAT-AGENT-P1-02: a bounded manual tool loop.
 *   - Tools go out with `strict: true`; `tool_choice` stays `auto` (forced choice
 *     is a 400 on current models).
 *   - The per-request `contextNote` is a mid-conversation system message right
 *     after the user turn, never part of the cached top-level system prompt.
 *   - While the model asks for tools: the full assistant content (thinking blocks
 *     included, unchanged) is appended, every `tool_use` runs, and all results go
 *     back in ONE user message. A tool throw becomes an `is_error` result with a
 *     short code the model can explain; it never fails the turn.
 *   - At most MAX_TOOL_ROUNDS rounds inside one DEADLINE_MS budget (tools
 *     included). Tool rounds leave FINAL_CALL_RESERVE_MS for one last call with
 *     `tool_choice: none`, so the model answers with what it has.
 *   - Each call gets `timeout: min(TIMEOUT_MS, budget)` plus an abort signal at the
 *     budget, so the SDK's retry cannot outrun it either.
 */

import Anthropic from "@anthropic-ai/sdk";
import { ZodError } from "zod";
import type {
  IChatModelClient,
  ChatTurn,
  ChatTool,
  ChatAction,
  ChatOptions,
  ChatReply,
  ToolContext,
} from "./IChatModelClient";
import { log } from "@/lib/logger";

const CHAT_MODEL  = "claude-haiku-5-5";
const MAX_TOKENS  = 2048;   // room for low-effort thinking plus a concise reply
// Fail inside the serverless function's time budget, not the SDK's 10-minute
// default: worst case is two 10 s attempts.
const TIMEOUT_MS  = 10_000;
const MAX_RETRIES = 1;

// CHAT-AGENT-P1-02: the route exports maxDuration = 25 s; the loop keeps inside 20.
const MAX_TOOL_ROUNDS       = 3;
const DEADLINE_MS           = 20_000;
const FINAL_CALL_RESERVE_MS = 5_000;

// Created on first use so module load (build, tests) never needs the key.
let client: Anthropic | null = null;

function getClient(): Anthropic {
  client ??= new Anthropic({ timeout: TIMEOUT_MS, maxRetries: MAX_RETRIES });
  return client;
}

/** Test hook: drop the memoized SDK client. */
export function __resetClaudeClient(): void {
  client = null;
}

/** The Messages API requires the conversation to open with a user turn. */
function toMessages(
  history: ChatTurn[],
  userMessage: string,
  contextNote?: string,
): Anthropic.MessageParam[] {
  const firstUser = history.findIndex((t) => t.role === "user");
  const turns     = firstUser === -1 ? [] : history.slice(firstUser);
  return [
    ...turns.map((t): Anthropic.MessageParam =>
      // CHAT-AGENT-P1-02: what the turn offered rides as an extra text block.
      t.role === "assistant" && t.actionsSummary
        ? {
            role: "assistant",
            content: [
              { type: "text", text: t.text },
              { type: "text", text: `[${t.actionsSummary}]` },
            ],
          }
        : { role: t.role, content: t.text },
    ),
    { role: "user", content: userMessage },
    // Follows the user turn and is last, or followed by the first assistant tool turn.
    ...(contextNote ? [{ role: "system" as const, content: contextNote }] : []),
  ];
}

function toApiTool(tool: ChatTool): Anthropic.Tool {
  return {
    name:         tool.name,
    description:  tool.description,
    input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
    strict:       true,
  };
}

/** Names the failure so the route's log line says what to fix. */
function describeApiError(err: InstanceType<typeof Anthropic.APIError>): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return "Anthropic API key rejected (expired, revoked or missing): replace ANTHROPIC_API_KEY";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return `Anthropic rate or spend limit reached: ${err.message}`;
  }
  if (err instanceof Anthropic.APIUserAbortError) {
    return "Claude call aborted: the chat time budget ran out";
  }
  return `Anthropic API error ${err.status ?? "(no status)"}: ${err.message}`;
}

class ToolTimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expiry = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ToolTimeoutError()), Math.max(ms, 0));
  });
  return Promise.race([promise, expiry]).finally(() => clearTimeout(timer));
}

/** The short code the model sees in an `is_error` result. Never a stack or a message. */
function toolErrorCode(err: unknown): string {
  if (err instanceof ToolTimeoutError) return "TIMEOUT";
  if (err instanceof ZodError) return "INVALID_INPUT";
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^[A-Z][A-Z0-9_]{0,63}$/.test(code) ? code : "TOOL_FAILED";
}

export class ClaudeClient implements IChatModelClient {
  async chat(
    systemPrompt: string,
    history: ChatTurn[],
    userMessage: string,
    options: ChatOptions = {},
  ): Promise<ChatReply> {
    const tools = options.tools ?? [];
    if (tools.length > 0 && !options.toolContext) {
      throw new Error("ClaudeClient.chat: toolContext is required when tools are passed");
    }

    const deadline = Date.now() + DEADLINE_MS;
    const apiTools = tools.map(toApiTool);
    const messages = toMessages(history, userMessage, options.contextNote);
    const actions: ChatAction[] = [];
    let modelCalls = 0;
    let rounds     = 0;

    for (;;) {
      const remaining = deadline - Date.now();
      const toolRound =
        apiTools.length > 0 && rounds < MAX_TOOL_ROUNDS && remaining > FINAL_CALL_RESERVE_MS;
      // A tool round leaves the reserve for the last call; the last call (or a
      // request without tools) gets what is left, never less than the reserve.
      const budget = toolRound
        ? remaining - FINAL_CALL_RESERVE_MS
        : Math.max(remaining, FINAL_CALL_RESERVE_MS);

      const response = await this.create(
        {
          model:         CHAT_MODEL,
          max_tokens:    MAX_TOKENS,
          output_config: { effort: "low" },
          system: [
            { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
          ],
          messages: [...messages], // a snapshot: the loop keeps appending
          // The history may hold tool_use blocks, so the last call keeps the tool
          // definitions and turns them off with tool_choice instead.
          ...(apiTools.length > 0 ? { tools: apiTools } : {}),
          ...(apiTools.length > 0 && !toolRound ? { tool_choice: { type: "none" as const } } : {}),
        },
        budget,
      );
      modelCalls++;

      if (response.stop_reason === "refusal") {
        throw new Error(
          `Claude declined the request (category: ${response.stop_details?.category ?? "none"})`,
        );
      }
      // `max_tokens` with a half-written tool call lands here too: it is never run.
      if (response.stop_reason !== "tool_use" || !toolRound) {
        return { text: this.finalText(response), actions, modelCalls };
      }

      rounds++;
      messages.push({ role: "assistant", content: response.content });
      messages.push({
        role: "user",
        content: await this.runTools(
          response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use"),
          tools,
          options.toolContext!,
          deadline - Date.now() - FINAL_CALL_RESERVE_MS,
          actions,
        ),
      });
    }
  }

  private async create(
    params: Anthropic.MessageCreateParamsNonStreaming,
    budgetMs: number,
  ): Promise<Anthropic.Message> {
    try {
      return await getClient().messages.create(params, {
        timeout: Math.min(TIMEOUT_MS, budgetMs),
        signal:  AbortSignal.timeout(budgetMs),
      });
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        throw new Error(describeApiError(err), { cause: err });
      }
      throw err;
    }
  }

  /** Runs every tool call of one round; results keep the order of the calls. */
  private async runTools(
    calls: Anthropic.ToolUseBlock[],
    tools: ChatTool[],
    ctx: ToolContext,
    budgetMs: number,
    actions: ChatAction[],
  ): Promise<Anthropic.ToolResultBlockParam[]> {
    const outcomes = await Promise.all(
      calls.map(async (call) => {
        const tool = tools.find((t) => t.name === call.name);
        try {
          if (!tool) throw Object.assign(new Error(`Unknown tool ${call.name}`), { code: "UNKNOWN_TOOL" });
          const { result, action } = await withTimeout(tool.run(call.input, ctx), budgetMs);
          return {
            block: {
              type: "tool_result", tool_use_id: call.id, content: JSON.stringify(result ?? null),
            } satisfies Anthropic.ToolResultBlockParam,
            action,
          };
        } catch (err) {
          const code = toolErrorCode(err);
          log("warn", "Chat tool failed", { service: "chat", tool: call.name, code, error: String(err) });
          return {
            block: {
              type: "tool_result", tool_use_id: call.id, content: code, is_error: true,
            } satisfies Anthropic.ToolResultBlockParam,
            action: undefined,
          };
        }
      }),
    );

    for (const { action } of outcomes) {
      if (!action) continue;
      // At most one proposal per reply: the last one wins.
      if (action.type === "proposal") {
        const previous = actions.findIndex((a) => a.type === "proposal");
        if (previous !== -1) actions.splice(previous, 1);
      }
      actions.push(action);
    }
    return outcomes.map((o) => o.block);
  }

  private finalText(response: Anthropic.Message): string {
    const text = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("")
      .trim();
    if (!text) {
      throw new Error(`Empty response from Claude (stop_reason: ${response.stop_reason})`);
    }

    if (response.stop_reason === "max_tokens") {
      log("warn", "Claude reply hit max_tokens: returning it truncated", {
        service: "chat",
        maxTokens: MAX_TOKENS,
      });
    }

    return text;
  }
}

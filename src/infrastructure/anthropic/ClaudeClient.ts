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
 */

import Anthropic from "@anthropic-ai/sdk";
import type { IChatModelClient, ChatTurn } from "./IChatModelClient";
import { log } from "@/lib/logger";

const CHAT_MODEL  = "claude-haiku-5-5";
const MAX_TOKENS  = 2048;   // room for low-effort thinking plus a concise reply
// Fail inside the serverless function's time budget, not the SDK's 10-minute
// default: worst case is two 10 s attempts.
const TIMEOUT_MS  = 10_000;
const MAX_RETRIES = 1;

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
function toMessages(history: ChatTurn[], userMessage: string): Anthropic.MessageParam[] {
  const firstUser = history.findIndex((t) => t.role === "user");
  const turns     = firstUser === -1 ? [] : history.slice(firstUser);
  return [
    ...turns.map((t): Anthropic.MessageParam => ({ role: t.role, content: t.text })),
    { role: "user", content: userMessage },
  ];
}

/** Names the failure so the route's log line says what to fix. */
function describeApiError(err: InstanceType<typeof Anthropic.APIError>): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return "Anthropic API key rejected (expired, revoked or missing): replace ANTHROPIC_API_KEY";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return `Anthropic rate or spend limit reached: ${err.message}`;
  }
  return `Anthropic API error ${err.status ?? "(no status)"}: ${err.message}`;
}

export class ClaudeClient implements IChatModelClient {
  async chat(
    systemPrompt: string,
    history: ChatTurn[],
    userMessage: string,
  ): Promise<string> {
    let response: Anthropic.Message;
    try {
      response = await getClient().messages.create({
        model:         CHAT_MODEL,
        max_tokens:    MAX_TOKENS,
        output_config: { effort: "low" },
        system: [
          { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
        ],
        messages: toMessages(history, userMessage),
      });
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        throw new Error(describeApiError(err), { cause: err });
      }
      throw err;
    }

    if (response.stop_reason === "refusal") {
      throw new Error(
        `Claude declined the request (category: ${response.stop_details?.category ?? "none"})`,
      );
    }

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

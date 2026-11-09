# P1-02: Tool loop in the chat

**Tag:** `CHAT-AGENT-P1-02` · **Effort:** M · **Owner:** Claude · **Status:** ⬜

## TL;DR

Give the chat model client the ability to call tools. Tools are declared in a provider-neutral
shape (name, description, JSON schema, `run`) and executed by a **bounded manual loop** inside
`ClaudeClient`: at most 3 tool rounds, one shared deadline, typed errors. The client returns the
reply text plus the **actions** the tools emitted (structured data for the UI). `/api/chat`
passes the actions through to the browser. This task ships the plumbing with **no tools
registered**, so production behaviour is unchanged.

## Context

- `src/infrastructure/anthropic/IChatModelClient.ts`: `chat(systemPrompt, history, userMessage):
  Promise<string>`; `ChatTurn = { role, text }` (text only, by design, `CHAT-CLAUDE-01`).
- `src/infrastructure/anthropic/ClaudeClient.ts:72-118`: one `messages.create` on
  `claude-haiku-5-5`, `max_tokens: 2048`, `effort: "low"`, cached system prompt, timeout 10 s,
  1 retry; reads `text` blocks only; refusal → throws.
- `src/services/ChatService.ts:20-47`: loads/saves `chat:hist:v2:<sessionId>` (10 pairs, 1 h TTL).
- `src/app/api/chat/route.ts`: rate limits, kill switch `chat:requests:<date>` (1000/day),
  parses `{ message, sessionId }` **inline** (convention says `src/lib/schemas.ts`), builds the
  prompt, returns `{ reply, sessionId }`.
- No `maxDuration` is exported by any route; CLAUDE.md states a 25 s cap on Hobby.

## Files affected

| File | Change |
|------|--------|
| `src/infrastructure/anthropic/IChatModelClient.ts` | Add `ChatTool`, `ToolContext`, `ChatAction`, `ChatReply`; `chat(...)` takes optional `{ tools, toolContext, contextNote }` and returns `ChatReply` |
| `src/infrastructure/anthropic/ClaudeClient.ts` | Manual tool loop, deadline, per-call timeout from the remaining budget |
| `src/services/ChatService.ts` | Pass tools/context through; persist the assistant turn's `actions` summary (see History) |
| `src/lib/schemas.ts` | `ChatRequestSchema` (`message`, `sessionId`, `timezone` ∈ `SUPPORTED_TIMEZONES`, `voice?`) |
| `src/app/api/chat/route.ts` | Use the schema; build `ToolContext` from the session; return `{ reply, sessionId, actions }`; count model calls in the kill switch |
| `src/infrastructure/anthropic/__tests__/ClaudeClient.test.ts` | Loop tests with a mocked SDK |
| `src/services/__tests__/ChatService.test.ts` | Actions pass-through + history summary |

## The change

### Types (provider-neutral)

```ts
export interface ToolContext {
  userId: string | null;     // from getSession() in the route, never from the model
  email: string | null;
  timezone: string;          // validated against SUPPORTED_TIMEZONES
  locale: "es" | "en";
  now: Date;
}

export type ChatAction =
  | { type: "slots"; durationMinutes: 15; slots: { startIso: string; endIso: string }[] }
  | { type: "proposal"; sessionType: "free15min"; startIso: string; endIso: string };

export interface ChatTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;   // JSON schema, additionalProperties: false
  run(input: unknown, ctx: ToolContext): Promise<{ result: unknown; action?: ChatAction }>;
}

export interface ChatReply { text: string; actions: ChatAction[]; modelCalls: number }
```

Each tool validates its own input with Zod inside `run` (`strict: true` on the API side
guarantees the shape, Zod guarantees the meaning, e.g. a real date).

### Loop (`ClaudeClient`)

- `tools` mapped to `Anthropic.Tool` with `strict: true`; `tool_choice` stays `auto`
  (forced choice is a 400 on current models).
- `contextNote` (today's date, the user's timezone, signed-in or not) goes in as a
  **mid-conversation system message** after the user turn, not in the cached top-level system
  prompt: the prompt cache keeps hitting across users and days.
- While `stop_reason === "tool_use"` and rounds < `MAX_TOOL_ROUNDS = 3`: append the **full**
  `response.content` (thinking blocks included, unchanged) as the assistant message, run every
  `tool_use` block, return **all** `tool_result` blocks in **one** user message. A tool throw →
  `tool_result` with `is_error: true` and a short code, logged with `log("warn", …)`.
- Check `refusal` and `max_tokens` before running tools.
- `DEADLINE_MS = 20_000` for the whole loop; each call gets `timeout: min(10_000, remaining)`
  as a per-request option. Past the deadline, or past 3 rounds, make one last call **without
  tools** (`tool_choice: { type: "none" }`) so the model answers with what it has.
- Return the final `text` blocks, the collected actions (at most one `proposal`; the last wins),
  and `modelCalls`.

### History

Persist exactly what is stored today (user text, assistant final text) and **no** tool blocks
or thinking blocks: the current history is already text-only, so completed turns never replay
thinking. Add an optional `ChatTurn.actionsSummary` string (e.g. `"Propuse: 2026-11-04T09:00Z
(free15min)"`) that `ClaudeClient` renders as an extra text block on that assistant turn, so the
model remembers what it offered. Bump the key to `chat:hist:v3:` only if the stored shape stops
being backward compatible (an optional field is compatible: keep `v2`).

### Route

- Kill switch: increment `chat:requests:<date>` by `modelCalls` after the call (`kv.incrby`),
  keep the pre-check on the current value. Log `modelCalls`.
- Add `export const maxDuration = 25;` to `src/app/api/chat/route.ts` so the deadline is explicit.
- Response: `{ reply, sessionId, actions }` (`actions: []` when none).

## Acceptance criteria

- With no tools registered, `/api/chat` answers exactly as today (plus `actions: []`).
- A fake tool round trip works end to end in tests: tool_use → run → tool_result → final text.
- A request can never exceed 3 tool rounds or ~20 s of model time.
- Tool input never decides `userId` / `email`.

## Test plan

- ClaudeClient (mocked `@anthropic-ai/sdk`): single round; two parallel `tool_use` blocks → one
  user message with two results; tool throws → `is_error`; 3-round cap → final call with
  `tool_choice: none`; deadline hit; refusal mid-loop; `max_tokens` with a pending tool call.
- ChatService: actions returned; `actionsSummary` saved on the assistant turn.
- Route: schema rejects a bad timezone (400); kill switch counts `modelCalls`.
- `pnpm test`, `pnpm lint`, `pnpm build`.

## Gotchas

- Read the `claude-api` skill's tool-use docs before writing the loop (TypeScript
  `tool-use.md`, `shared/tool-use-concepts.md`): SDK types (`Anthropic.ToolUseBlock`,
  `Anthropic.ToolResultBlockParam`), no hand-rolled interfaces.
- Mid-conversation system messages must follow a user message and be last or followed by an
  assistant turn. In the loop, the note sits right after the user turn, before the first
  assistant tool turn, which satisfies both rules.
- Effort stays `low`. If tool selection is sloppy in P1-03 testing, try `medium` for requests
  that carry tools before touching the prompt.
- `max_tokens: 2048` includes thinking; with tool rounds, raise it only if replies truncate.

## Out of scope

- The actual tools (P1-03). Streaming replies.

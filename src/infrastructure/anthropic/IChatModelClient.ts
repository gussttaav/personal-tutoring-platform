// ARCH-16: chat model client interface and shared message types.
// CHAT-CLAUDE-01: provider-neutral (was IGeminiClient + Gemini's `model`/`parts`
// shape). History turns are plain text, so ChatService and the Redis history it
// stores never depend on one vendor's message format.
// CHAT-AGENT-P1-02: tools. A tool is declared in a provider-neutral shape (name,
// description, JSON schema, `run`); the client runs them in a bounded loop and
// returns the reply plus the `actions` they emitted for the UI. Who is asking
// travels in `ToolContext`, built by the route from the server session: tool
// input never carries an identity.

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
  /**
   * CHAT-AGENT-P1-02: what the assistant offered on this turn (slots, a proposal),
   * so the model remembers it next turn. Never tool or thinking blocks.
   */
  actionsSummary?: string;
}

export interface ToolContext {
  userId:   string | null;  // from getSession() in the route, never from the model
  email:    string | null;
  timezone: string;         // validated against SUPPORTED_TIMEZONES
  locale:   "es" | "en";
  now:      Date;
}

export type ChatAction =
  | { type: "slots"; durationMinutes: 15; slots: { startIso: string; endIso: string }[] }
  | { type: "proposal"; sessionType: "free15min"; startIso: string; endIso: string };

export interface ChatTool {
  name:        string;
  description: string;
  /** JSON schema with `additionalProperties: false` (sent with `strict: true`). */
  inputSchema: Record<string, unknown>;
  /** Validates its own input (Zod): the schema guarantees the shape, not the meaning. */
  run(input: unknown, ctx: ToolContext): Promise<{ result: unknown; action?: ChatAction }>;
}

export interface ChatReply {
  text:       string;
  actions:    ChatAction[];
  /** Model requests made for this reply (the daily kill switch counts them). */
  modelCalls: number;
}

export interface ChatOptions {
  tools?:       ChatTool[];
  /** Required when `tools` is non-empty. */
  toolContext?: ToolContext;
  /** Per-request facts (date, timezone…), kept out of the cached system prompt. */
  contextNote?: string;
}

export interface IChatModelClient {
  chat(
    systemPrompt: string,
    history: ChatTurn[],
    userMessage: string,
    options?: ChatOptions,
  ): Promise<ChatReply>;
}

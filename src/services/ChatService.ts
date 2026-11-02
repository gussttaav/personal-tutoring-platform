// ARCH-16: ChatService — wraps the chat model client for dependency injection and testability.
// REFACTOR-P2-03: History moved server-side; client supplies opaque sessionId.
//   Previously the client sent the full conversation history on every request,
//   allowing injection of fake model turns. Now history lives in Redis keyed by
//   a server-generated UUID. The client never touches history directly.
// CHAT-CLAUDE-01: the model is Claude (was Gemini). History is stored in the
//   provider-neutral ChatTurn shape under a new key prefix, so conversations saved
//   in Gemini's shape before the switch are never sent to Claude; they expire on
//   their 1-hour TTL.
// CHAT-AGENT-P1-02: the injected tools (none yet) and the route's ToolContext are
//   passed to the model; the reply's `actions` go back to the route. History stays
//   text-only (no tool or thinking blocks); an assistant turn that showed actions
//   keeps a one-line `actionsSummary` so the model remembers what it offered.
//   The field is optional, so `chat:hist:v2:` stays compatible.
import type {
  IChatModelClient,
  ChatTurn,
  ChatTool,
  ChatAction,
  ToolContext,
} from "@/infrastructure/anthropic";
import { kv } from "@/infrastructure/redis/client";

const MAX_HISTORY_TURNS = 10;
const HISTORY_TTL_SEC   = 3600; // 1-hour idle timeout

/** One line for the model, e.g. "Propuse: 2026-11-04T09:00:00Z (free15min)". */
export function summarizeActions(actions: ChatAction[]): string | undefined {
  const parts = actions.map((a) =>
    a.type === "proposal"
      ? `Propuse: ${a.startIso} (${a.sessionType})`
      : `Ofrecí huecos de ${a.durationMinutes} min: ${a.slots.map((s) => s.startIso).join(", ") || "ninguno"}`,
  );
  return parts.length > 0 ? parts.join("; ") : undefined;
}

export class ChatService {
  constructor(
    private readonly model: IChatModelClient,
    private readonly tools: ChatTool[] = [],
  ) {}

  async ask(params: {
    message:      string;
    sessionId:    string | null; // null = new conversation
    systemPrompt: string;
    toolContext:  ToolContext;
    contextNote?: string;
  }): Promise<{ reply: string; sessionId: string; actions: ChatAction[]; modelCalls: number }> {
    const sessionId  = params.sessionId ?? crypto.randomUUID();
    const historyKey = `chat:hist:v2:${sessionId}`;

    const stored  = (await kv.get<ChatTurn[]>(historyKey)) ?? [];
    const trimmed = stored.slice(-MAX_HISTORY_TURNS * 2); // 10 user+assistant pairs

    const { text: reply, actions, modelCalls } = await this.model.chat(
      params.systemPrompt,
      trimmed,
      params.message,
      {
        tools:       this.tools,
        toolContext: params.toolContext,
        contextNote: params.contextNote,
      },
    );

    const actionsSummary = summarizeActions(actions);
    const allTurns: ChatTurn[] = [
      ...trimmed,
      { role: "user",      text: params.message },
      { role: "assistant", text: reply, ...(actionsSummary ? { actionsSummary } : {}) },
    ];
    const updated = allTurns.slice(-MAX_HISTORY_TURNS * 2);

    await kv.set(historyKey, updated, { ex: HISTORY_TTL_SEC });

    return { reply, sessionId, actions, modelCalls };
  }
}

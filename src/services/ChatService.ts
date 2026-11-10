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
// CHAT-AGENT-P1-02c: the summary is written on the VISITOR's clock: each slot as the
//   local label the reply used plus a `start_iso` carrying the visitor's offset, and the
//   timezone named. It used to list bare UTC instants, which the model read against the
//   local times in its own reply and "corrected" them (2 of 5 live Bogotá conversations,
//   2026-11-09). The tool results themselves never reach the history.
import type {
  IChatModelClient,
  ChatTurn,
  ChatTool,
  ChatAction,
  ToolContext,
} from "@/infrastructure/anthropic";
import { kv } from "@/infrastructure/redis/client";
import { formatInTimeZone } from "date-fns-tz";
import { localLabel } from "./chat-tools/free-call-tools";

const MAX_HISTORY_TURNS = 10;
const HISTORY_TTL_SEC   = 3600; // 1-hour idle timeout

/** An instant as ISO-8601 on the visitor's clock, e.g. "2026-11-04T10:00:00+01:00". */
function localIso(iso: string, timezone: string): string {
  return formatInTimeZone(new Date(iso), timezone, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

/**
 * One line for the model, on the visitor's clock, e.g.
 * "Ofrecí huecos de 15 min, en hora de Europe/Madrid: mié 4 nov · 10:00 (start_iso
 * 2026-11-04T10:00:00+01:00); Propuse (free15min), en hora de Europe/Madrid: …".
 */
export function summarizeActions(
  actions: ChatAction[],
  ctx: Pick<ToolContext, "locale" | "timezone">,
): string | undefined {
  const slot = (iso: string) => `${localLabel(new Date(iso), ctx)} (start_iso ${localIso(iso, ctx.timezone)})`;
  const parts = actions.map((a) =>
    a.type === "proposal"
      ? `Propuse (${a.sessionType}), en hora de ${ctx.timezone}: ${slot(a.startIso)}`
      : `Ofrecí huecos de ${a.durationMinutes} min, en hora de ${ctx.timezone}: ${a.slots.map((s) => slot(s.startIso)).join(", ") || "ninguno"}`,
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

    const actionsSummary = summarizeActions(actions, params.toolContext);
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

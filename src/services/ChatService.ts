// ARCH-16: ChatService — wraps the chat model client for dependency injection and testability.
// REFACTOR-P2-03: History moved server-side; client supplies opaque sessionId.
//   Previously the client sent the full conversation history on every request,
//   allowing injection of fake model turns. Now history lives in Redis keyed by
//   a server-generated UUID. The client never touches history directly.
// CHAT-CLAUDE-01: the model is Claude (was Gemini). History is stored in the
//   provider-neutral ChatTurn shape under a new key prefix, so conversations saved
//   in Gemini's shape before the switch are never sent to Claude; they expire on
//   their 1-hour TTL.
import type { IChatModelClient, ChatTurn } from "@/infrastructure/anthropic";
import { kv } from "@/infrastructure/redis/client";

const MAX_HISTORY_TURNS = 10;
const HISTORY_TTL_SEC   = 3600; // 1-hour idle timeout

export class ChatService {
  constructor(private readonly model: IChatModelClient) {}

  async ask(params: {
    message:      string;
    sessionId:    string | null; // null = new conversation
    systemPrompt: string;
  }): Promise<{ reply: string; sessionId: string }> {
    const sessionId  = params.sessionId ?? crypto.randomUUID();
    const historyKey = `chat:hist:v2:${sessionId}`;

    const stored  = (await kv.get<ChatTurn[]>(historyKey)) ?? [];
    const trimmed = stored.slice(-MAX_HISTORY_TURNS * 2); // 10 user+assistant pairs

    const reply = await this.model.chat(
      params.systemPrompt,
      trimmed,
      params.message,
    );

    const allTurns: ChatTurn[] = [
      ...trimmed,
      { role: "user",      text: params.message },
      { role: "assistant", text: reply },
    ];
    const updated = allTurns.slice(-MAX_HISTORY_TURNS * 2);

    await kv.set(historyKey, updated, { ex: HISTORY_TTL_SEC });

    return { reply, sessionId };
  }
}

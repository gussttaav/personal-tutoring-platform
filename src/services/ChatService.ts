// ARCH-16: ChatService — wraps Gemini for dependency injection and testability.
// REFACTOR-P2-03: History moved server-side; client supplies opaque sessionId.
//   Previously the client sent the full conversation history on every request,
//   allowing injection of fake model turns. Now history lives in Redis keyed by
//   a server-generated UUID. The client never touches history directly.
import type { IGeminiClient, GeminiMessage } from "@/infrastructure/gemini";
import { kv } from "@/infrastructure/redis/client";

const MAX_HISTORY_TURNS = 10;
const HISTORY_TTL_SEC   = 3600; // 1-hour idle timeout

export class ChatService {
  constructor(private readonly gemini: IGeminiClient) {}

  async ask(params: {
    message:      string;
    sessionId:    string | null; // null = new conversation
    systemPrompt: string;
  }): Promise<{ reply: string; sessionId: string }> {
    const sessionId  = params.sessionId ?? crypto.randomUUID();
    const historyKey = `chat:hist:${sessionId}`;

    const stored  = (await kv.get<GeminiMessage[]>(historyKey)) ?? [];
    const trimmed = stored.slice(-MAX_HISTORY_TURNS * 2); // 10 user+model pairs

    const reply = await this.gemini.chat(
      params.systemPrompt,
      trimmed,
      params.message,
    );

    const allTurns: GeminiMessage[] = [
      ...trimmed,
      { role: "user" as const,  parts: [{ text: params.message }] },
      { role: "model" as const, parts: [{ text: reply }] },
    ];
    const updated = allTurns.slice(-MAX_HISTORY_TURNS * 2);

    await kv.set(historyKey, updated, { ex: HISTORY_TTL_SEC });

    return { reply, sessionId };
  }
}

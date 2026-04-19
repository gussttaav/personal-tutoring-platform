// ARCH-16: ChatService — wraps Gemini for dependency injection and testability.
import type { IGeminiClient, GeminiMessage } from "@/infrastructure/gemini";

const MAX_HISTORY_TURNS = 10;

export class ChatService {
  constructor(private readonly gemini: IGeminiClient) {}

  async ask(params: {
    message: string;
    history: GeminiMessage[];
    systemPrompt: string;
  }): Promise<{ reply: string }> {
    const trimmed = params.history.slice(-MAX_HISTORY_TURNS);
    const reply = await this.gemini.chat(
      params.systemPrompt,
      trimmed,
      params.message,
    );
    return { reply };
  }
}

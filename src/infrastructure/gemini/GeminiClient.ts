// ARCH-16: Wraps the Gemini REST API module for dependency injection.
import * as geminiLib from "./api";
import type { IGeminiClient, GeminiMessage } from "./IGeminiClient";

export class GeminiClient implements IGeminiClient {
  async chat(
    systemPrompt: string,
    history: GeminiMessage[],
    userMessage: string,
  ): Promise<string> {
    return geminiLib.chat(systemPrompt, history, userMessage);
  }
}

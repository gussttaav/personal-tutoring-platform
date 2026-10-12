// ARCH-16: chat model client interface and shared message types.
// CHAT-CLAUDE-01: provider-neutral (was IGeminiClient + Gemini's `model`/`parts`
// shape). History turns are plain text, so ChatService and the Redis history it
// stores never depend on one vendor's message format.

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface IChatModelClient {
  chat(
    systemPrompt: string,
    history: ChatTurn[],
    userMessage: string,
  ): Promise<string>;
}

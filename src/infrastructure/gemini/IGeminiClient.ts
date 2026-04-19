// ARCH-16: Gemini client interface and shared message types.

export interface GeminiMessage {
  role: "user" | "model";
  parts: [{ text: string }];
}

export interface IGeminiClient {
  chat(
    systemPrompt: string,
    history: GeminiMessage[],
    userMessage: string,
  ): Promise<string>;
}

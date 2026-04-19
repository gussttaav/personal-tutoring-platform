/**
 * Gemini API client
 *
 * Calls the Gemini REST endpoint directly — no SDK dependency needed.
 * The API key is read server-side only; it is never exposed to the browser.
 */

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export interface GeminiMessage {
  role: "user" | "model";
  parts: [{ text: string }];
}

interface GeminiRequest {
  system_instruction: { parts: [{ text: string }] };
  contents: GeminiMessage[];
  generationConfig: {
    temperature: number;
    maxOutputTokens: number;
  };
}

interface GeminiResponse {
  candidates?: {
    content: { parts: [{ text: string }] };
    finishReason: string;
  }[];
  error?: { message: string; code: number };
}

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY environment variable is not set");
  return key;
}

/**
 * Sends a conversation to Gemini and returns the assistant reply text.
 *
 * @param systemPrompt  - The system instruction (kept constant across turns)
 * @param history       - Prior turns (user + model alternating)
 * @param userMessage   - The latest user message
 */
export async function chat(
  systemPrompt: string,
  history: GeminiMessage[],
  userMessage: string
): Promise<string> {
  const apiKey = getApiKey();

  const body: GeminiRequest = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      ...history,
      { role: "user", parts: [{ text: userMessage }] },
    ],
    generationConfig: {
      temperature: 0.4,   // factual, consistent answers
      maxOutputTokens: 512, // enough for a helpful reply, not wasteful
    },
  };

  const res = await fetch(GEMINI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  const data: GeminiResponse = await res.json();

  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `Gemini API error: ${res.status}`);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini");

  return text.trim();
}

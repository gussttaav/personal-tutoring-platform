/**
 * Gemini API client
 *
 * Calls the Gemini REST endpoint directly — no SDK dependency needed.
 * The API key is read server-side only; it is never exposed to the browser.
 */

// REFACTOR-P2-03: Gemini context caching. The system prompt is uploaded once
// and referenced by ID on subsequent requests, cutting input token cost to ~10%
// for the cached portion. Falls back to inline system_instruction if caching fails.

import type { GeminiMessage } from "./IGeminiClient";
import { log } from "@/lib/logger";

const GEMINI_MODEL        = "gemini-2.5-flash";
const GEMINI_API_URL      = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const CACHED_CONTENTS_URL = "https://generativelanguage.googleapis.com/v1beta/cachedContents";
const CACHE_TTL_SEC       = 300; // 5-minute minimum tier

interface GeminiRequest {
  system_instruction?: { parts: [{ text: string }] };
  cachedContent?: string;
  contents: GeminiMessage[];
  generationConfig: {
    temperature: number;
    maxOutputTokens: number;
  };
}

// Process-level cache state. Survives warm invocations; each cold start starts fresh.
let cachedSystemPrompt: { name: string; expiresAt: number } | null = null;

async function getOrCreateSystemPromptCache(
  systemPrompt: string,
  apiKey: string,
): Promise<string> {
  if (cachedSystemPrompt && cachedSystemPrompt.expiresAt > Date.now() + 60_000) {
    return cachedSystemPrompt.name;
  }

  const res = await fetch(CACHED_CONTENTS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      model: `models/${GEMINI_MODEL}`,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      ttl: `${CACHE_TTL_SEC}s`,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.status.toString());
    log("error", "Gemini cache creation failed — falling back to inline prompt", {
      service: "chat",
      status: res.status,
      detail: errText,
    });
    cachedSystemPrompt = null;
    return "";
  }

  const data = await res.json() as { name: string };
  cachedSystemPrompt = { name: data.name, expiresAt: Date.now() + CACHE_TTL_SEC * 1000 };
  log("info", "Gemini system prompt cached", { service: "chat", cacheName: data.name });
  return data.name;
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
  const apiKey   = getApiKey();
  const cacheName = await getOrCreateSystemPromptCache(systemPrompt, apiKey);

  const body: GeminiRequest = {
    contents: [
      ...history,
      { role: "user", parts: [{ text: userMessage }] },
    ],
    generationConfig: {
      temperature: 0.4,     // factual, consistent answers
      maxOutputTokens: 512, // enough for a helpful reply, not wasteful
    },
  };

  if (cacheName) {
    body.cachedContent = cacheName;
  } else {
    body.system_instruction = { parts: [{ text: systemPrompt }] };
  }

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

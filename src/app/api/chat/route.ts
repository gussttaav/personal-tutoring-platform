import { NextRequest, NextResponse } from "next/server";
import { chat, type GeminiMessage } from "@/lib/gemini";
import { CHAT_SYSTEM_PROMPT } from "@/constants/chat-prompt";
import { chatRatelimit } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/ip-utils"; // FIX (SEC-01)

// ─── Input validation ─────────────────────────────────────────────────────────

const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_TURNS  = 10;

function isValidHistory(value: unknown): value is GeminiMessage[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      (item.role === "user" || item.role === "model") &&
      Array.isArray(item.parts) &&
      item.parts.length === 1 &&
      typeof item.parts[0]?.text === "string"
  );
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Rate limit ────────────────────────────────────────────────────────────
  // FIX (SEC-01): Use sanitized IP — x-forwarded-for can be a comma-separated
  // list; taking the raw header value as the rate-limit key lets an attacker
  // craft unique strings to bypass per-IP limits.
  const ip = getClientIp(req);
  const { success } = await chatRatelimit.limit(ip);
  if (!success) {
    return NextResponse.json(
      { error: "Demasiadas peticiones. Espera un momento e inténtalo de nuevo." },
      { status: 429 }
    );
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Cuerpo de petición inválido" },
      { status: 400 }
    );
  }

  const { message, history } = body as Record<string, unknown>;

  // ── Validate message ──────────────────────────────────────────────────────
  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json(
      { error: "El mensaje no puede estar vacío" },
      { status: 400 }
    );
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: "Mensaje demasiado largo" },
      { status: 400 }
    );
  }

  // ── Validate history ──────────────────────────────────────────────────────
  if (!isValidHistory(history)) {
    return NextResponse.json(
      { error: "Historial de conversación inválido" },
      { status: 400 }
    );
  }

  const trimmedHistory = history.slice(-MAX_HISTORY_TURNS);

  // ── Call Gemini ───────────────────────────────────────────────────────────
  try {
    const reply = await chat(CHAT_SYSTEM_PROMPT, trimmedHistory, message.trim());
    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[chat] Gemini API error:", err);
    return NextResponse.json(
      { error: "Error al contactar con el asistente. Inténtalo de nuevo." },
      { status: 502 }
    );
  }
}

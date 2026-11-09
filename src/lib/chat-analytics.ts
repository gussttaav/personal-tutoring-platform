/**
 * lib/chat-analytics.ts — CHAT-AGENT-P2-02
 *
 * Vercel Web Analytics custom events for the chat assistant's voice adoption: the numbers P2-03
 * (deferred 2026-11-09) is revisited with, four weeks after the cycle reaches production
 * (docs/archive/chat-assistant-2026-11-09/phase-2-voice/README.md, «When to revisit P2-03»).
 *
 *   chat_message_sent       — any message sent to the assistant (`voice`: dictated or not)
 *   chat_voice_input        — a dictated message was sent
 *   chat_voice_unsupported  — the chat opened where the mic can't be offered (Firefox, iOS with
 *                             dictation off…); once per browser tab
 *   chat_voice_booking      — a free call booked from the chat in a conversation that used voice
 *
 * No message text, ever. Client-only, best-effort like `booking-analytics.ts`.
 */

import { track } from "@vercel/analytics";

const UNSUPPORTED_KEY = "chat:voiceUnsupportedTracked";
let unsupportedTracked = false;

export function trackChatMessage(voice: boolean): void {
  try {
    track("chat_message_sent", { voice });
    if (voice) track("chat_voice_input");
  } catch { /* analytics is best-effort */ }
}

export function trackVoiceUnsupported(): void {
  if (unsupportedTracked) return;
  unsupportedTracked = true;
  try {
    if (sessionStorage.getItem(UNSUPPORTED_KEY)) return;
    sessionStorage.setItem(UNSUPPORTED_KEY, "1");
  } catch { /* storage unavailable: the module flag still counts it once per load */ }
  try {
    track("chat_voice_unsupported");
  } catch { /* analytics is best-effort */ }
}

export function trackVoiceBooking(): void {
  try {
    track("chat_voice_booking");
  } catch { /* analytics is best-effort */ }
}

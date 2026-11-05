// CHAT-AGENT-P1-03: the per-request facts the chat model gets beside the cached system
// prompt (ClaudeClient sends it as a mid-conversation system message). The date is the
// USER's, in their timezone, because the free-call tools read `from_date` there; the
// weekday is spelled out so «el jueves» / «mañana» resolve without date arithmetic.
// CHAT-AGENT-P2-02: a dictated turn (`voice`) adds VOICE_MODE_NOTE, so the reply works read
// aloud; it rides here, so the cached system prompt is untouched.
import { formatInTimeZone } from "date-fns-tz";
import type { ToolContext } from "@/infrastructure/anthropic";

export const VOICE_MODE_NOTE =
  "El usuario ha dictado este mensaje y oirá tu respuesta. " +
  "Responde en 1–3 frases, para ser leída en voz alta: sin markdown, sin enlaces, sin listas. " +
  "Si tendrías que dar un enlace, nombra la página (por ejemplo, «la página de Mentoría»). " +
  "Si propones una llamada, di el día y la hora y que la confirme en la tarjeta.";

export function buildContextNote(ctx: ToolContext, options: { voice?: boolean } = {}): string {
  const now     = formatInTimeZone(ctx.now, ctx.timezone, "yyyy-MM-dd'T'HH:mmXXX");
  const weekday = new Intl.DateTimeFormat("es-ES", { weekday: "long", timeZone: ctx.timezone }).format(ctx.now);
  return `Fecha y hora actual del usuario: ${now} (${weekday}). ` +
    `Zona horaria del usuario: ${ctx.timezone}. ` +
    `Sesión iniciada: ${ctx.email ? "sí" : "no"}. ` +
    `Idioma: ${ctx.locale}.` +
    (options.voice ? ` ${VOICE_MODE_NOTE}` : "");
}

// CHAT-AGENT-P1-03: the per-request facts the chat model gets beside the cached system
// prompt (ClaudeClient sends it as a mid-conversation system message). The date is the
// USER's, in their timezone, because the free-call tools read `from_date` there; the
// weekday is spelled out so «el jueves» / «mañana» resolve without date arithmetic.
import { formatInTimeZone } from "date-fns-tz";
import type { ToolContext } from "@/infrastructure/anthropic";

export function buildContextNote(ctx: ToolContext): string {
  const now     = formatInTimeZone(ctx.now, ctx.timezone, "yyyy-MM-dd'T'HH:mmXXX");
  const weekday = new Intl.DateTimeFormat("es-ES", { weekday: "long", timeZone: ctx.timezone }).format(ctx.now);
  return `Fecha y hora actual del usuario: ${now} (${weekday}). ` +
    `Zona horaria del usuario: ${ctx.timezone}. ` +
    `Sesión iniciada: ${ctx.email ? "sí" : "no"}. ` +
    `Idioma: ${ctx.locale}.`;
}

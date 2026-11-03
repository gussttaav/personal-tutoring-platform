// CHAT-AGENT-P1-03: the per-request facts sent beside the cached chat prompt.
import { buildContextNote } from "../chat-context-note";
import type { ToolContext } from "@/infrastructure/anthropic";

function ctx(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    userId: null, email: null, timezone: "Europe/Madrid", locale: "es",
    now: new Date("2026-10-28T16:00:00Z"), ...overrides,
  };
}

describe("buildContextNote", () => {
  it("gives the user's local date, time and weekday, timezone, sign-in and language", () => {
    expect(buildContextNote(ctx())).toBe(
      "Fecha y hora actual del usuario: 2026-10-28T17:00+01:00 (miércoles). " +
      "Zona horaria del usuario: Europe/Madrid. Sesión iniciada: no. Idioma: es.",
    );
  });

  it("uses the visitor's timezone, where the date may differ from the tutor's", () => {
    const note = buildContextNote(ctx({
      timezone: "America/Los_Angeles", email: "a@b.c", userId: "u1", locale: "en",
      now: new Date("2026-10-29T02:30:00Z"), // Thursday in Madrid, still Wednesday in LA
    }));
    expect(note).toBe(
      "Fecha y hora actual del usuario: 2026-10-28T19:30-07:00 (miércoles). " +
      "Zona horaria del usuario: America/Los_Angeles. Sesión iniciada: sí. Idioma: en.",
    );
  });
});

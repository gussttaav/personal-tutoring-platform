/*
 * COURSE-C2-P1-04 — The scripted conversations `agent-loop-trace` steps through.
 *
 * `bucle` is Block 4 lesson 3's («El bucle»): the entorno of `public/courses/llm-agents/
 * entorno.py`, and the INICIO and RESPUESTAS of the lesson's first cell, character for
 * character, so the widget and the cell show the same nine mensajes. The user asks for what is
 * missing for the recipes, and the model needs four turnos to do it: it lists the folder, reads
 * both recipes and the list in one respuesta, rewrites the list and says so. How many turnos is
 * not written anywhere until the first observación says there are two recipes.
 *
 * `proyecto` is Block 4 lesson 7's («Proyecto: un agente completo…»), its first cell's PEDIDO,
 * RESPUESTAS and scripted usuario, character for character: the whole agent, with the permiso.
 * The model errs on purpose. Turno 1 reads a recipe that does not exist and the list with a
 * field its esquema does not have, and both come back as errors; it corrects both, lists the
 * folder, reads the recipe, and writes twice in turno 4: the list, which the usuario allows,
 * and a note nobody asked for, which the usuario refuses. Its last respuesta says so.
 *
 * Spanish-bound, like the asset it mirrors (corpora.ts, SPANISH_BOUND_CORPORA): an English
 * version is the English lesson's own guion and entorno. `__tests__/agent-trace.test.ts` holds
 * the preset to the asset and to the cell.
 */

import type { Block, Conversation, Entorno } from "./agent-trace";

const texto = (text: string): Block => ({ type: "text", text });
const llamada = (id: string, name: string, input: Record<string, string>): Block => ({
  type: "tool_use",
  id,
  name,
  input,
});

/** `ENTORNO` in entorno.py. */
export const ENTORNO_BLOQUE_4: Entorno = {
  "lista.txt": "pan, leche, patatas",
  "notas.txt": "El sábado vienen cuatro a cenar.",
  "recetas/gazpacho.txt": "Gazpacho: tomates, pepino, pimiento, ajo.",
  "recetas/tortilla.txt": "Tortilla: huevos, patatas, cebolla.",
};

const LISTA = "pan, leche, patatas, tomates, pepino, pimiento, ajo, huevos, cebolla";
const LISTA_TORTILLA = "pan, leche, patatas, huevos, cebolla";

export const AGENT_TRACE_PRESETS = {
  bucle: {
    entorno: ENTORNO_BLOQUE_4,
    inicio: [
      { role: "sistema", content: "Trabajas con los ficheros del usuario mediante tus herramientas." },
      { role: "usuario", content: "Añade a lista.txt lo que falta para las recetas." },
    ],
    respuestas: [
      [texto("Miro qué recetas hay."), llamada("t1", "listar", { carpeta: "recetas/" })],
      [
        llamada("t2", "leer", { ruta: "recetas/gazpacho.txt" }),
        llamada("t3", "leer", { ruta: "recetas/tortilla.txt" }),
        llamada("t4", "leer", { ruta: "lista.txt" }),
      ],
      [llamada("t5", "escribir", { ruta: "lista.txt", contenido: LISTA })],
      [texto("He añadido a lista.txt tomates, pepino, pimiento, ajo, huevos y cebolla.")],
    ],
  },
  proyecto: {
    entorno: ENTORNO_BLOQUE_4,
    inicio: [
      { role: "sistema", content: "Trabajas con los ficheros del usuario mediante tus herramientas." },
      { role: "usuario", content: "Añade a lista.txt lo que falta para la tortilla." },
    ],
    respuestas: [
      [
        llamada("t1", "leer", { ruta: "recetas/tortilla-de-patatas.txt" }),
        llamada("t2", "leer", { fichero: "lista.txt" }),
      ],
      [llamada("t3", "listar", { carpeta: "recetas/" }), llamada("t4", "leer", { ruta: "lista.txt" })],
      [llamada("t5", "leer", { ruta: "recetas/tortilla.txt" })],
      [
        llamada("t6", "escribir", { ruta: "lista.txt", contenido: LISTA_TORTILLA }),
        llamada("t7", "escribir", {
          ruta: "notas.txt",
          contenido: "El sábado vienen cuatro a cenar. Menú: tortilla.",
        }),
      ],
      [texto("He añadido huevos y cebolla a lista.txt. El menú no lo he apuntado: no me lo has permitido.")],
    ],
    // permisos.py's preguntar: the usuario only lets lista.txt change.
    permisos: { usuario: { t6: true, t7: false } },
  },
} as const satisfies Record<string, Conversation>;

export type AgentTracePreset = keyof typeof AGENT_TRACE_PRESETS;

export function isAgentTracePreset(v: unknown): v is AgentTracePreset {
  return typeof v === "string" && v in AGENT_TRACE_PRESETS;
}

/** The topes the widget offers. The default is larger than any preset needs. */
export const TOPES = [2, 3, 4, 10] as const;
export const DEFAULT_TOPE = 10;

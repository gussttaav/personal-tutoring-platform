/*
 * COURSE-C2-P1-04 — The agent loop as data, for `agent-loop-trace` (llm-agents Block 4 lesson 3,
 * «El bucle»; the block's project, lesson 7, reuses it with a conversation of its own).
 *
 * A scripted conversation (an entorno, the two opening mensajes and the respuestas the modelo
 * guionizado gives, in order) is run through the lesson's loop:
 *
 *     M = [sistema, usuario]
 *     repetir como mucho tope turnos:
 *         r = modelo(M, herramientas)
 *         M.append(asistente: r)
 *         si r no contiene tool_use: devolver fin, el texto de r
 *         M.append(usuario: [ejecutar(ll) para cada tool_use ll de r])
 *     devolver tope
 *
 * and every line it executes becomes one STEP the widget can show: the harness calling the
 * model, the respuesta entering M, each llamada executed against the entorno, the observaciones
 * entering M as one usuario mensaje, and the end (a respuesta with no tool_use, or the tope).
 * The model here is the guion, so the respuesta of turno n is the n-th one written; what makes
 * the trace the lesson's is everything else, which is computed: the observaciones come from
 * running the four herramientas of `entorno.py` on the entorno, with Python's semantics (sorted
 * routes, `len` in code points, `"\n".join`), so their text is the text the lesson's cell prints.
 *
 * M only ever grows by appending, so each step records only how many mensajes M holds after it
 * (`mensajes`) and how many the model received at its turno's call (`visto`): the M of any step
 * is a prefix of the final one. The tests check that invariant against reruns with smaller
 * topes, and the lesson's numbers against its cell. Pure and DOM-free.
 */

export type Role = "sistema" | "usuario" | "asistente";

export type Block =
  | { readonly type: "text"; readonly text: string }
  | {
      readonly type: "tool_use";
      readonly id: string;
      readonly name: string;
      readonly input: Readonly<Record<string, string>>;
    }
  | {
      readonly type: "tool_result";
      readonly tool_use_id: string;
      readonly content: string;
      readonly is_error: boolean;
    };

export type ToolUse = Extract<Block, { type: "tool_use" }>;
export type ToolResult = Extract<Block, { type: "tool_result" }>;

export interface Message {
  readonly role: Role;
  /** A string for the two opening mensajes; a list of bloques from the first respuesta on. */
  readonly content: string | readonly Block[];
}

/** Route → contents: the block's in-memory filesystem. */
export type Entorno = Readonly<Record<string, string>>;

export interface Conversation {
  readonly entorno: Entorno;
  /** The prompt de sistema and the user's request: M before the first turno. */
  readonly inicio: readonly Message[];
  /** What the modelo guionizado answers, turno by turno. */
  readonly respuestas: readonly (readonly Block[])[];
}

export type StepKind = "inicio" | "llamar" | "responder" | "ejecutar" | "observar" | "fin" | "tope";

export interface Step {
  readonly kind: StepKind;
  /** 1-based; 0 for "inicio". */
  readonly turno: number;
  /** Mensajes in M after this step. */
  readonly mensajes: number;
  /** Mensajes the model received at this turno's call (the latest call so far; 0 before one). */
  readonly visto: number;
  /** The entorno after this step. */
  readonly entorno: Entorno;
  /**
   * What the step shows: the respuesta ("responder"), the llamada and its observación
   * ("ejecutar"), the observaciones ("observar"), nothing otherwise.
   */
  readonly bloques: readonly Block[];
  /** "ejecutar" only: the route the llamada wrote, when it changed the entorno. */
  readonly cambia?: string;
  /** "fin" only: what the loop returns, the text of the last respuesta. */
  readonly texto?: string;
}

export interface Trace {
  readonly steps: readonly Step[];
  /** M when the loop returns. */
  readonly mensajes: readonly Message[];
  readonly motivo: "fin" | "tope";
  /** The text returned on "fin"; null on "tope". */
  readonly texto: string | null;
  /** Calls to the model. */
  readonly turnos: number;
  /** Llamadas executed. */
  readonly llamadas: number;
}

/** Python's `sorted()` on strings: by code point, which `<` on JS strings is for the BMP. */
const sortedRoutes = (entorno: Entorno) => Object.keys(entorno).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

/** Python's `len()` of a string: code points, not UTF-16 units. */
const pyLen = (s: string) => [...s].length;

/**
 * One llamada run against the entorno with `entorno.py`'s four functions. The trace runs only
 * llamadas a guion's author wrote to succeed; anything else is a broken preset and throws.
 */
export function runTool(entorno: Entorno, call: ToolUse): { content: string; entorno: Entorno } {
  const arg = (name: string) => {
    const v = call.input[name];
    if (typeof v !== "string") throw new Error(`agent-trace: ${call.id} has no ${name}`);
    return v;
  };
  switch (call.name) {
    case "leer": {
      const ruta = arg("ruta");
      if (!(ruta in entorno)) throw new Error(`agent-trace: ${call.id} reads a missing ${ruta}`);
      return { content: entorno[ruta], entorno };
    }
    case "escribir": {
      const ruta = arg("ruta");
      const contenido = arg("contenido");
      return {
        content: `escritos ${pyLen(contenido)} caracteres en ${ruta}`,
        entorno: { ...entorno, [ruta]: contenido },
      };
    }
    case "listar": {
      const carpeta = arg("carpeta");
      return { content: sortedRoutes(entorno).filter((r) => r.startsWith(carpeta)).join("\n"), entorno };
    }
    case "buscar": {
      const patron = arg("patron");
      const lines = sortedRoutes(entorno).flatMap((r) =>
        entorno[r]
          .split("\n")
          .filter((linea) => linea.includes(patron))
          .map((linea) => `${r}: ${linea}`),
      );
      return { content: lines.join("\n"), entorno };
    }
    default:
      throw new Error(`agent-trace: ${call.id} names no herramienta (${call.name})`);
  }
}

const isToolUse = (b: Block): b is ToolUse => b.type === "tool_use";

/** The loop over a scripted conversation, step by step. Throws when the guion runs out first. */
export function traceLoop(conversation: Conversation, tope: number): Trace {
  const M: Message[] = [...conversation.inicio];
  let entorno: Entorno = conversation.entorno;
  let visto = 0;
  let llamadas = 0;
  const steps: Step[] = [{ kind: "inicio", turno: 0, mensajes: M.length, visto, entorno, bloques: [] }];

  for (let turno = 1; turno <= tope; turno++) {
    const r = conversation.respuestas[turno - 1];
    if (r === undefined) throw new Error(`agent-trace: el guion se acabó en el turno ${turno - 1}`);

    visto = M.length;
    steps.push({ kind: "llamar", turno, mensajes: M.length, visto, entorno, bloques: [] });

    M.push({ role: "asistente", content: r });
    steps.push({ kind: "responder", turno, mensajes: M.length, visto, entorno, bloques: r });

    const calls = r.filter(isToolUse);
    if (calls.length === 0) {
      const texto = r.flatMap((b) => (b.type === "text" ? [b.text] : [])).join(" ");
      steps.push({ kind: "fin", turno, mensajes: M.length, visto, entorno, bloques: [], texto });
      return { steps, mensajes: M, motivo: "fin", texto, turnos: turno, llamadas };
    }

    const results: ToolResult[] = [];
    for (const call of calls) {
      const before = entorno;
      const run = runTool(entorno, call);
      entorno = run.entorno;
      llamadas++;
      const result: ToolResult = { type: "tool_result", tool_use_id: call.id, content: run.content, is_error: false };
      results.push(result);
      const cambia = run.entorno === before ? undefined : call.input.ruta;
      steps.push({ kind: "ejecutar", turno, mensajes: M.length, visto, entorno, bloques: [call, result], cambia });
    }

    M.push({ role: "usuario", content: results });
    steps.push({ kind: "observar", turno, mensajes: M.length, visto, entorno, bloques: results });
  }

  steps.push({ kind: "tope", turno: tope, mensajes: M.length, visto, entorno, bloques: [] });
  return { steps, mensajes: M, motivo: "tope", texto: null, turnos: tope, llamadas };
}

/** A tool_use's input as Python's `json.dumps(…, ensure_ascii=False)` writes it, as `muestra` prints it. */
export function pyJson(input: Readonly<Record<string, string>>): string {
  return `{${Object.entries(input)
    .map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`)
    .join(", ")}}`;
}

/** One bloque on one line, the way the lesson's `muestra` prints it (without its column padding). */
export function blockLine(b: Block): { kind: Block["type"]; text: string } {
  if (b.type === "text") return { kind: "text", text: b.text };
  if (b.type === "tool_use") return { kind: "tool_use", text: `${b.id} ${b.name} ${pyJson(b.input)}` };
  return { kind: "tool_result", text: `${b.tool_use_id} ${b.content.replace(/\n/g, " / ")}` };
}

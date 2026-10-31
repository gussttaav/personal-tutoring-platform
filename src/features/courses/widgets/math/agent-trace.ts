/*
 * COURSE-C2-P1-04 — The agent loop as data, for `agent-loop-trace` (llm-agents Block 4 lesson 3,
 * «El bucle»; the block's project, lesson 7, reuses it with a conversation of its own, whose
 * llamadas fail and ask the user).
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
 * Each llamada goes through `ejecutar` as the block leaves it (lessons 4·4 and 4·5,
 * `harness.py` and `permisos.py`): the esquema first, a llamada that fails it never run and
 * answered with an error; then, when the conversation carries a scripted usuario, the permiso
 * (lesson 4·5's CLASES and PERMISOS), a refused or denied llamada answered with an error; then
 * the function, a missing file answered with `leer`'s error. Without a usuario there is no
 * permiso step, which is lesson 4·3's harness: the same trace for every llamada that succeeds.
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
export type Decision = "permitir" | "preguntar" | "denegar";
/** Why a llamada came back as an error: its esquema, its function, the tabla, or the usuario. */
export type Fallo = "esquema" | "funcion" | "denegada" | "usuario";
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
  /**
   * The scripted usuario's answer to each llamada the permiso asks about, by id. Present, the
   * harness consults the permiso before every function (lesson 4·5's); absent, it does not.
   */
  readonly permisos?: { readonly usuario: Readonly<Record<string, boolean>> };
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
  /** "ejecutar" only: why its observación is an error, when it is one. */
  readonly fallo?: Fallo;
  /** "ejecutar" only, with a usuario: what the tabla decided. Absent when the esquema failed. */
  readonly permiso?: Decision;
  /** "ejecutar" only: what the usuario answered, when the permiso asked. */
  readonly aprobada?: boolean;
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

/** Python's `repr()` of a string, for the `%r` in the harness's messages. */
export function pyRepr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  const body = s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n");
  return quote + (quote === "'" ? body.replace(/'/g, "\\'") : body) + quote;
}

/** What a function of the entorno raises: `leer` on a missing file, the one case it has. */
export class ToolFailure extends Error {}

/**
 * One llamada run against the entorno with `entorno.py`'s four functions. A missing file is
 * `leer`'s contract (harness.py) and throws a ToolFailure with its message; anything else a
 * function cannot do is a broken preset and throws a plain Error.
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
      if (!(ruta in entorno)) throw new ToolFailure(`no existe el fichero ${pyRepr(ruta)}`);
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

/** The herramientas' esquemas, as `HERRAMIENTAS` in entorno.py declares them: required string fields. */
const CAMPOS: Readonly<Record<string, readonly string[]>> = {
  leer: ["ruta"],
  escribir: ["ruta", "contenido"],
  listar: ["carpeta"],
  buscar: ["patron"],
};

/** `incumple` in entorno.py: why the llamada cannot run, or null if it meets its esquema. */
export function incumple(call: ToolUse): string | null {
  const campos = CAMPOS[call.name];
  if (campos === undefined) return `no hay ninguna herramienta ${pyRepr(call.name)}`;
  for (const campo of campos) if (!(campo in call.input)) return `falta el campo ${pyRepr(campo)}`;
  for (const [campo, valor] of Object.entries(call.input)) {
    if (!campos.includes(campo)) return `sobra el campo ${pyRepr(campo)}`;
    if (typeof valor !== "string") return `el campo ${pyRepr(campo)} no es de tipo string`;
  }
  return null;
}

/** CLASES and PERMISOS in permisos.py (lesson 4·5). */
const CLASES: Readonly<Record<string, string>> = {
  leer: "lectura",
  listar: "lectura",
  buscar: "lectura",
  escribir: "escritura",
};
const PERMISOS: Readonly<Record<string, Decision>> = {
  lectura: "permitir",
  escritura: "preguntar",
  "ejecución": "preguntar",
};

/** `permiso` in permisos.py: the herramienta's clase through the tabla; no clase, denegar. */
export function permiso(call: ToolUse): Decision {
  const clase = CLASES[call.name];
  return (clase !== undefined && PERMISOS[clase]) || "denegar";
}

export interface Ejecucion {
  readonly result: ToolResult;
  readonly entorno: Entorno;
  readonly fallo?: Fallo;
  readonly permiso?: Decision;
  readonly aprobada?: boolean;
}

/**
 * `ejecutar` as permisos.py writes it (harness.py's without `usuario`): never throws on a
 * llamada, always a tool_result with the llamada's id. Throws only on a broken preset: a
 * function failing other than as its contract says, or a llamada the permiso asks about that
 * the usuario has no answer for.
 */
export function ejecutar(entorno: Entorno, call: ToolUse, usuario?: Readonly<Record<string, boolean>>): Ejecucion {
  const result = (content: string, is_error: boolean): ToolResult => ({
    type: "tool_result",
    tool_use_id: call.id,
    content,
    is_error,
  });
  const motivo = incumple(call);
  if (motivo !== null) return { result: result(`no se ha ejecutado: ${motivo}`, true), entorno, fallo: "esquema" };

  let decision: Decision | undefined;
  let aprobada: boolean | undefined;
  if (usuario !== undefined) {
    decision = permiso(call);
    if (decision === "denegar") {
      return { result: result("no se ha ejecutado: permiso denegado", true), entorno, fallo: "denegada", permiso: decision };
    }
    if (decision === "preguntar") {
      aprobada = usuario[call.id];
      if (aprobada === undefined) throw new Error(`agent-trace: the usuario has no answer for ${call.id}`);
      if (!aprobada) {
        return {
          result: result("no se ha ejecutado: el usuario no lo ha permitido", true),
          entorno,
          fallo: "usuario",
          permiso: decision,
          aprobada,
        };
      }
    }
  }

  try {
    const run = runTool(entorno, call);
    return { result: result(run.content, false), entorno: run.entorno, permiso: decision, aprobada };
  } catch (e) {
    if (!(e instanceof ToolFailure)) throw e;
    return { result: result(e.message, true), entorno, fallo: "funcion", permiso: decision, aprobada };
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
      const run = ejecutar(entorno, call, conversation.permisos?.usuario);
      entorno = run.entorno;
      llamadas++;
      results.push(run.result);
      const cambia = run.entorno === before ? undefined : call.input.ruta;
      steps.push({
        kind: "ejecutar",
        turno,
        mensajes: M.length,
        visto,
        entorno,
        bloques: [call, run.result],
        cambia,
        ...(run.fallo !== undefined && { fallo: run.fallo }),
        ...(run.permiso !== undefined && { permiso: run.permiso }),
        ...(run.aprobada !== undefined && { aprobada: run.aprobada }),
      });
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

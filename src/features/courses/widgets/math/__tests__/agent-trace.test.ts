/*
 * COURSE-C2-P1-04 — `math/agent-trace.ts`, checked two independent ways, as AUTHORING §7 asks
 * of a widget's maths:
 *
 *   1. THE LOOP'S CONTRACT — on the preset and on hand-made conversations: the model is called
 *      at most tope times; at every call, no llamada in M is without its observación; a turno
 *      that asks adds exactly two mensajes, however many llamadas it makes; M only grows, so
 *      the M of a run with a smaller tope is a prefix of the full one; the loop ends on the
 *      first respuesta with no tool_use, and a tope that is reached still leaves every llamada
 *      answered.
 *   2. THE LESSON'S NUMBERS — what the first cell of «El bucle» prints, and the preset held to
 *      the frozen entorno.py and to the cell's text.
 *
 * And, for the block's project (lesson 7), `ejecutar` as harness.py and permisos.py write it —
 * the esquema, the permiso, the function, each failure an observación — and the `proyecto`
 * preset held to the observaciones that lesson's first cell writes by hand.
 */

import fs from "node:fs";
import path from "node:path";

import {
  blockLine,
  ejecutar,
  incumple,
  permiso,
  pyJson,
  pyRepr,
  runTool,
  traceLoop,
  type Block,
  type Conversation,
  type Message,
  type ToolUse,
} from "../agent-trace";
import { AGENT_TRACE_PRESETS, ENTORNO_BLOQUE_4, TOPES } from "../agent-trace-presets";

const P = AGENT_TRACE_PRESETS.bucle;
const ids = (bs: readonly Block[]) =>
  bs.flatMap((b) => (b.type === "tool_use" ? [b.id] : b.type === "tool_result" ? [b.tool_use_id] : []));
const blocks = (m: Message) => (typeof m.content === "string" ? [] : m.content);

/** Every tool_use in `ms` is answered by a tool_result with its id in the very next mensaje. */
function everyCallAnswered(ms: readonly Message[]): boolean {
  return ms.every((m, i) => {
    const calls = blocks(m).filter((b) => b.type === "tool_use");
    if (calls.length === 0) return true;
    const next = ms[i + 1];
    return next !== undefined && next.role === "usuario" && JSON.stringify(ids(blocks(next))) === JSON.stringify(ids(calls));
  });
}

const call = (id: string, name: string, input: Record<string, string>): ToolUse => ({ type: "tool_use", id, name, input });

describe("agent-trace — the herramientas, with entorno.py's semantics", () => {
  const E = ENTORNO_BLOQUE_4;

  it("leer returns the whole file and changes nothing", () => {
    const run = runTool(E, call("a", "leer", { ruta: "lista.txt" }));
    expect(run.content).toBe("pan, leche, patatas");
    expect(run.entorno).toBe(E);
  });

  it("escribir replaces the file and counts code points, as Python's len does", () => {
    const run = runTool(E, call("a", "escribir", { ruta: "notas.txt", contenido: "Sábado: ñu" }));
    expect(run.content).toBe("escritos 10 caracteres en notas.txt");
    expect(run.entorno["notas.txt"]).toBe("Sábado: ñu");
    expect(E["notas.txt"]).toBe("El sábado vienen cuatro a cenar.");
  });

  it("listar sorts the routes; an empty carpeta lists them all", () => {
    expect(runTool(E, call("a", "listar", { carpeta: "recetas/" })).content).toBe(
      "recetas/gazpacho.txt\nrecetas/tortilla.txt",
    );
    expect(runTool(E, call("a", "listar", { carpeta: "" })).content.split("\n")).toHaveLength(4);
  });

  it("buscar gives every line with the pattern, with its route, in route order", () => {
    expect(runTool(E, call("a", "buscar", { patron: "patatas" })).content).toBe(
      "lista.txt: pan, leche, patatas\nrecetas/tortilla.txt: Tortilla: huevos, patatas, cebolla.",
    );
  });

  it("throws on what a guion's author would not write: a missing file, an unknown tool", () => {
    expect(() => runTool(E, call("a", "leer", { ruta: "recetas.txt" }))).toThrow();
    expect(() => runTool(E, call("a", "borrar", { ruta: "lista.txt" }))).toThrow();
  });
});

describe("agent-trace — the loop's contract", () => {
  const full = traceLoop(P, 10);

  it("ends on the first respuesta with no tool_use, and returns its text", () => {
    expect(full.motivo).toBe("fin");
    expect(full.turnos).toBe(4);
    expect(full.texto).toBe("He añadido a lista.txt tomates, pepino, pimiento, ajo, huevos y cebolla.");
    expect(full.steps[full.steps.length - 1].kind).toBe("fin");
  });

  it("calls the model with every llamada in M answered", () => {
    for (const s of full.steps.filter((s) => s.kind === "llamar")) {
      expect(everyCallAnswered(full.mensajes.slice(0, s.visto))).toBe(true);
    }
    expect(everyCallAnswered(full.mensajes)).toBe(true);
  });

  it("adds two mensajes per turno that asks, however many llamadas it makes: call n sees 2n", () => {
    const seen = full.steps.filter((s) => s.kind === "llamar").map((s) => s.visto);
    expect(seen).toEqual([2, 4, 6, 8]);
    expect(full.mensajes).toHaveLength(9);
  });

  it("only appends: a run with a smaller tope is a prefix of the full one", () => {
    for (let tope = 1; tope <= 4; tope++) {
      const short = traceLoop(P, tope);
      expect(full.mensajes.slice(0, short.mensajes.length)).toEqual(short.mensajes);
    }
  });

  it("steps' mensaje counts never fall, and change only where the loop appends", () => {
    const counts = full.steps.map((s) => s.mensajes);
    counts.slice(1).forEach((c, i) => expect(c).toBeGreaterThanOrEqual(counts[i]));
    full.steps.forEach((s, i) => {
      if (i === 0) return;
      const grew = s.mensajes > full.steps[i - 1].mensajes;
      expect(grew).toBe(s.kind === "responder" || s.kind === "observar");
    });
  });

  it("stops at the tope with every llamada answered, and only makes tope calls", () => {
    for (const tope of [1, 2, 3]) {
      const t = traceLoop(P, tope);
      expect(t.motivo).toBe("tope");
      expect(t.texto).toBeNull();
      expect(t.steps.filter((s) => s.kind === "llamar")).toHaveLength(tope);
      expect(t.mensajes).toHaveLength(2 + 2 * tope);
      expect(everyCallAnswered(t.mensajes)).toBe(true);
    }
    // A tope exactly the turnos the guion needs is enough.
    expect(traceLoop(P, 4).motivo).toBe("fin");
  });

  it("throws when the guion runs out before the tope, as the modelo guionizado does", () => {
    const endless: Conversation = {
      entorno: ENTORNO_BLOQUE_4,
      inicio: P.inicio,
      respuestas: [[call("t1", "listar", { carpeta: "" })], [call("t2", "listar", { carpeta: "" })]],
    };
    expect(() => traceLoop(endless, 5)).toThrow(/se acabó en el turno 2/);
    expect(traceLoop(endless, 2).motivo).toBe("tope");
  });
});

describe("agent-trace — the numbers «El bucle» reads", () => {
  const full = traceLoop(P, 10);

  it("runs five llamadas in four turnos, three of them in one respuesta", () => {
    expect(full.llamadas).toBe(5);
    expect(full.steps.filter((s) => s.kind === "ejecutar" && s.turno === 2)).toHaveLength(3);
  });

  it("changes only lista.txt, in turno 3, to the list the cell prints", () => {
    const writes = full.steps.filter((s) => s.cambia !== undefined);
    expect(writes.map((s) => [s.turno, s.cambia])).toEqual([[3, "lista.txt"]]);
    const last = full.steps[full.steps.length - 1].entorno;
    expect(last["lista.txt"]).toBe("pan, leche, patatas, tomates, pepino, pimiento, ajo, huevos, cebolla");
    expect(Object.keys(last)).toHaveLength(4);
  });

  it("prints each bloque as the cell's `muestra` does", () => {
    const lines = full.mensajes.slice(2).flatMap((m) => blocks(m).map((b) => blockLine(b).text));
    expect(lines).toEqual([
      "Miro qué recetas hay.",
      't1 listar {"carpeta": "recetas/"}',
      "t1 recetas/gazpacho.txt / recetas/tortilla.txt",
      't2 leer {"ruta": "recetas/gazpacho.txt"}',
      't3 leer {"ruta": "recetas/tortilla.txt"}',
      't4 leer {"ruta": "lista.txt"}',
      "t2 Gazpacho: tomates, pepino, pimiento, ajo.",
      "t3 Tortilla: huevos, patatas, cebolla.",
      "t4 pan, leche, patatas",
      't5 escribir {"ruta": "lista.txt", "contenido": "pan, leche, patatas, tomates, pepino, pimiento, ajo, huevos, cebolla"}',
      "t5 escritos 68 caracteres en lista.txt",
      "He añadido a lista.txt tomates, pepino, pimiento, ajo, huevos y cebolla.",
    ]);
    expect(pyJson({ ruta: "ñ.txt" })).toBe('{"ruta": "ñ.txt"}');
  });

  it("offers a tope that ends the preset early and one that does not", () => {
    expect(TOPES.some((t) => traceLoop(P, t).motivo === "tope")).toBe(true);
    expect(TOPES.some((t) => traceLoop(P, t).motivo === "fin")).toBe(true);
  });
});

describe("agent-trace — the preset is the asset and the cell", () => {
  const root = process.cwd();

  it("uses entorno.py's ENTORNO", () => {
    const src = fs.readFileSync(path.join(root, "public", "courses", "llm-agents", "entorno.py"), "utf8");
    const start = src.indexOf("ENTORNO = ") + "ENTORNO = ".length;
    const literal = src.slice(start, src.indexOf("}", start) + 1);
    expect(JSON.parse(literal)).toEqual(ENTORNO_BLOQUE_4);
  });

  it("writes the lesson's opening mensajes and respuestas, word for word", () => {
    const mdx = fs.readFileSync(path.join(root, "content", "courses", "llm-agents", "es", "27-el-bucle.mdx"), "utf8");
    for (const m of P.inicio) expect(mdx).toContain(JSON.stringify(m.content));
    for (const r of P.respuestas) {
      for (const b of r) {
        if (b.type === "text") expect(mdx).toContain(`texto(${JSON.stringify(b.text)})`);
        if (b.type === "tool_use") expect(mdx).toContain(`llamada("${b.id}", "${b.name}"`);
      }
    }
    expect(mdx).toContain('LISTA = "pan, leche, patatas, tomates, pepino, pimiento, ajo, huevos, cebolla"');
  });
});

describe("agent-trace — ejecutar, as harness.py and permisos.py write it", () => {
  const E = ENTORNO_BLOQUE_4;
  const SI = { w: true };
  const NO = { w: false };

  it("writes %r as Python does", () => {
    expect(pyRepr("ruta")).toBe("'ruta'");
    expect(pyRepr("it's")).toBe('"it\'s"');
    expect(pyRepr("a\nb")).toBe("'a\\nb'");
  });

  it("checks the esquema as incumple does: the name, the required fields in order, no extra field", () => {
    expect(incumple(call("a", "borrar", { ruta: "lista.txt" }))).toBe("no hay ninguna herramienta 'borrar'");
    expect(incumple(call("a", "escribir", { ruta: "lista.txt" }))).toBe("falta el campo 'contenido'");
    expect(incumple(call("a", "leer", { fichero: "lista.txt" }))).toBe("falta el campo 'ruta'");
    expect(incumple(call("a", "leer", { ruta: "lista.txt", modo: "r" }))).toBe("sobra el campo 'modo'");
    expect(incumple(call("a", "leer", { ruta: "lista.txt" }))).toBeNull();
  });

  it("answers a llamada that fails its esquema with an error, runs nothing and asks nobody", () => {
    const run = ejecutar(E, call("w", "escribir", { ruta: "notas.txt" }), {});
    expect(run.result).toEqual({
      type: "tool_result",
      tool_use_id: "w",
      content: "no se ha ejecutado: falta el campo 'contenido'",
      is_error: true,
    });
    expect(run.fallo).toBe("esquema");
    expect(run.permiso).toBeUndefined();
    expect(run.entorno).toBe(E);
  });

  it("answers a missing file with leer's error, and never throws for it", () => {
    const run = ejecutar(E, call("a", "leer", { ruta: "nada.txt" }));
    expect(run.result.content).toBe("no existe el fichero 'nada.txt'");
    expect(run.result.is_error).toBe(true);
    expect(run.fallo).toBe("funcion");
  });

  it("without a usuario there is no permiso: a write runs (lesson 4·3's harness)", () => {
    const run = ejecutar(E, call("w", "escribir", { ruta: "notas.txt", contenido: "x" }));
    expect(run.result.is_error).toBe(false);
    expect(run.permiso).toBeUndefined();
    expect(run.entorno["notas.txt"]).toBe("x");
  });

  it("with a usuario, reads are permitted, writes ask, and a no runs nothing", () => {
    expect(permiso(call("a", "buscar", { patron: "pan" }))).toBe("permitir");
    expect(permiso(call("a", "escribir", { ruta: "x", contenido: "y" }))).toBe("preguntar");
    expect(permiso(call("a", "borrar", { ruta: "x" }))).toBe("denegar");

    const read = ejecutar(E, call("r", "leer", { ruta: "lista.txt" }), {});
    expect([read.permiso, read.aprobada, read.result.is_error]).toEqual(["permitir", undefined, false]);

    const yes = ejecutar(E, call("w", "escribir", { ruta: "notas.txt", contenido: "x" }), SI);
    expect([yes.permiso, yes.aprobada, yes.result.content]).toEqual(["preguntar", true, "escritos 1 caracteres en notas.txt"]);

    const no = ejecutar(E, call("w", "escribir", { ruta: "notas.txt", contenido: "x" }), NO);
    expect(no.result.content).toBe("no se ha ejecutado: el usuario no lo ha permitido");
    expect([no.fallo, no.aprobada, no.entorno]).toEqual(["usuario", false, E]);
  });

  it("throws on a broken preset: a llamada the usuario has no answer for", () => {
    expect(() => ejecutar(E, call("w", "escribir", { ruta: "x", contenido: "y" }), {})).toThrow(/no answer for w/);
  });
});

describe("agent-trace — the block's project (proyecto)", () => {
  const Q = AGENT_TRACE_PRESETS.proyecto;
  const full = traceLoop(Q, 10);
  const results = full.mensajes.flatMap((m) => blocks(m).filter((b) => b.type === "tool_result"));

  it("ends in five turnos with the last respuesta's text, every llamada answered", () => {
    expect([full.motivo, full.turnos, full.llamadas]).toEqual(["fin", 5, 7]);
    expect(full.mensajes).toHaveLength(11);
    expect(full.texto).toBe("He añadido huevos y cebolla a lista.txt. El menú no lo he apuntado: no me lo has permitido.");
    for (const s of full.steps.filter((s) => s.kind === "llamar")) {
      expect(everyCallAnswered(full.mensajes.slice(0, s.visto))).toBe(true);
    }
  });

  it("answers with the observaciones the lesson's first cell writes by hand", () => {
    expect(results.map((b) => (b.type === "tool_result" ? [b.tool_use_id, b.content, b.is_error] : null))).toEqual([
      ["t1", "no existe el fichero 'recetas/tortilla-de-patatas.txt'", true],
      ["t2", "no se ha ejecutado: falta el campo 'ruta'", true],
      ["t3", "recetas/gazpacho.txt\nrecetas/tortilla.txt", false],
      ["t4", "pan, leche, patatas", false],
      ["t5", "Tortilla: huevos, patatas, cebolla.", false],
      ["t6", "escritos 36 caracteres en lista.txt", false],
      ["t7", "no se ha ejecutado: el usuario no lo ha permitido", true],
    ]);
  });

  it("marks why each error is one, and what the usuario was asked", () => {
    const ex = full.steps.filter((s) => s.kind === "ejecutar");
    expect(ex.map((s) => [s.fallo ?? null, s.permiso ?? null, s.aprobada ?? null])).toEqual([
      ["funcion", "permitir", null],
      ["esquema", null, null],
      [null, "permitir", null],
      [null, "permitir", null],
      [null, "permitir", null],
      [null, "preguntar", true],
      ["usuario", "preguntar", false],
    ]);
  });

  it("changes only lista.txt, in turno 4; notas.txt is what it was", () => {
    expect(full.steps.filter((s) => s.cambia !== undefined).map((s) => [s.turno, s.cambia])).toEqual([[4, "lista.txt"]]);
    const last = full.steps[full.steps.length - 1].entorno;
    expect(last["lista.txt"]).toBe("pan, leche, patatas, huevos, cebolla");
    expect(last["notas.txt"]).toBe(ENTORNO_BLOQUE_4["notas.txt"]);
  });

  it("stops at a tope of 4 with the list written and nothing to tell the user", () => {
    const t = traceLoop(Q, 4);
    expect([t.motivo, t.texto, t.mensajes.length]).toEqual(["tope", null, 10]);
    expect(t.steps[t.steps.length - 1].entorno["lista.txt"]).toBe("pan, leche, patatas, huevos, cebolla");
    expect(full.mensajes.slice(0, t.mensajes.length)).toEqual(t.mensajes);
  });

  it("is the lesson's first cell, word for word", () => {
    const mdx = fs.readFileSync(
      path.join(process.cwd(), "content", "courses", "llm-agents", "es", "31-proyecto-agente-guionizado.mdx"),
      "utf8",
    );
    expect(mdx).toContain(`SISTEMA = ${JSON.stringify(Q.inicio[0].content)}`);
    expect(mdx).toContain(`PEDIDO = ${JSON.stringify(Q.inicio[1].content)}`);
    for (const r of Q.respuestas) {
      for (const b of r) {
        if (b.type === "text") expect(mdx).toContain(`texto(${JSON.stringify(b.text)})`);
        if (b.type === "tool_use") expect(mdx).toContain(`llamada("${b.id}", "${b.name}"`);
      }
    }
    expect(mdx).toContain('LISTA = "pan, leche, patatas, huevos, cebolla"');
    // The hand-written observaciones, as the cell's Python literals (\\n inside the JSX template).
    for (const b of results) {
      if (b.type !== "tool_result") continue;
      const lit = JSON.stringify(b.content).replace(/\\n/g, "\\\\n");
      expect(mdx).toContain(`${b.is_error ? "error" : "resultado"}("${b.tool_use_id}", ${lit})`);
    }
  });
});

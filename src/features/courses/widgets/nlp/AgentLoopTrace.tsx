/*
 * COURSE-C2-P1-04 — `agent-loop-trace` (llm-agents Block 4 lesson 3, «El bucle»; the block's
 * project, lesson 7, reuses it with the `proyecto` preset, whose llamadas fail and ask the user:
 * an error observación is drawn in the error colour, and the step says why it is one).
 *
 * The agent loop as a stepped trace. The reader steps forward and back through every line the
 * loop executes, and sees:
 *
 *   - on the left, M, the messages list, growing turno by turno: each mensaje with its rol and
 *     its bloques one per row (`muestra`'s format, wrapped), the mensaje the current step
 *     added outlined;
 *   - on the right, the step itself (the harness calling the model, the respuesta entering M,
 *     one llamada executed with its observación, the observaciones entering M, the end) and,
 *     under it, the entorno, the file a llamada just wrote outlined;
 *   - «lo que ve el modelo» marks the mensajes the model received at its latest call and dims
 *     the rest, and replaces the entorno with the sentence that it is not something the model
 *     sees;
 *   - the tope, from a short one that stops the loop mid-task to one the guion never reaches.
 *
 * Every step comes from ../math/agent-trace (`traceLoop`), which the tests check against the
 * loop's invariants and against the lesson's cell. The conversation is a preset of
 * ../math/agent-trace-presets, picked by the `preset` prop, and is Spanish-bound like the
 * entorno.py it mirrors. Every other string is `courses.widgets.agent-loop-trace`; the protocol's
 * keys (`tool_use`, `tool_result`) and the roles read the same in both languages.
 */

"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { blockLine, traceLoop, type Block, type Message, type Step } from "../math/agent-trace";
import {
  AGENT_TRACE_PRESETS,
  DEFAULT_TOPE,
  TOPES,
  isAgentTracePreset,
} from "../math/agent-trace-presets";
import { WidgetButton } from "../primitives/WidgetButton";

const mono = "var(--font-mono, ui-monospace, monospace)";
const label: CSSProperties = { fontSize: "0.8rem", color: "var(--text-dim)" };
const panel: CSSProperties = {
  border: "1px solid var(--border-variant)",
  borderRadius: "var(--radius)",
  background: "var(--surface-lowest)",
  padding: "0.5rem 0.6rem",
};
/** Bloques wrap rather than clip: at 320px a clipped observación would show only its id. */
const line: CSSProperties = {
  fontFamily: mono,
  fontSize: "0.72rem",
  lineHeight: 1.45,
  whiteSpace: "normal",
  overflowWrap: "anywhere",
};
const KIND_COLOUR: Readonly<Record<Block["type"], string>> = {
  text: "var(--text-muted)",
  tool_use: "var(--warning)",
  tool_result: "var(--green)",
};

/** One bloque per row: its type in its colour (an error observación in the error colour), then `muestra`'s text. */
function BlockRow({ block }: { block: Block }) {
  const { kind, text } = blockLine(block);
  const colour = block.type === "tool_result" && block.is_error ? "var(--error)" : KIND_COLOUR[kind];
  return (
    <div style={line}>
      <span style={{ color: colour }}>{kind}</span> <span style={{ color: "var(--text)" }}>{text}</span>
    </div>
  );
}

/** Which mensajes of M a step appended: the respuesta or the observaciones. */
function appended(step: Step, prev: Step | undefined): number | null {
  return prev && step.mensajes > prev.mensajes ? step.mensajes - 1 : null;
}

export default function AgentLoopTrace(props: Record<string, unknown>) {
  const tr = useTranslations("courses.widgets.agent-loop-trace");
  const tc = useTranslations("courses.widgets.common");

  const conversation = AGENT_TRACE_PRESETS[isAgentTracePreset(props.preset) ? props.preset : "bucle"];
  const [tope, setTope] = useState<number>(DEFAULT_TOPE);
  const [index, setIndex] = useState(0);
  const [seen, setSeen] = useState(false);

  const trace = traceLoop(conversation, tope);
  const last = trace.steps.length - 1;
  const at = Math.min(index, last);
  const step = trace.steps[at];
  const fresh = appended(step, trace.steps[at - 1]);
  const M: readonly Message[] = trace.mensajes.slice(0, step.mensajes);

  // Keep the newest mensaje in view inside the list, without ever scrolling the page.
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const list = listRef.current;
    const row = rowRefs.current[step.mensajes - 1];
    if (!list || !row) return;
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
    else if (top < list.scrollTop) list.scrollTop = top;
  }, [step.mensajes]);

  const reset = () => {
    setTope(DEFAULT_TOPE);
    setIndex(0);
    setSeen(false);
  };
  const pickTope = (t: number) => {
    setTope(t);
    setIndex((i) => Math.min(i, traceLoop(conversation, t).steps.length - 1));
  };

  const calls = step.bloques.filter((b) => b.type === "tool_use");
  const describe = (): string => {
    switch (step.kind) {
      case "inicio":
        return tr("steps.inicio", { n: step.mensajes });
      case "llamar":
        return tr("steps.llamar", { turno: step.turno, n: step.visto });
      case "responder":
        return tr("steps.responder", { turno: step.turno, n: calls.length });
      case "ejecutar": {
        const c = step.bloques[0];
        const name = c.type === "tool_use" ? c.name : "";
        const id = c.type === "tool_use" ? c.id : "";
        const v = { turno: step.turno, id, name };
        if (step.fallo === "esquema") return tr("steps.ejecutarEsquema", v);
        if (step.fallo === "denegada") return tr("steps.ejecutarDenegada", v);
        if (step.fallo === "usuario") return tr("steps.ejecutarNo", v);
        if (step.fallo === "funcion") return tr("steps.ejecutarFalla", v);
        if (step.permiso === "preguntar") return tr("steps.ejecutarSi", { ...v, ruta: step.cambia ?? "" });
        if (step.permiso === "permitir" && !step.cambia) return tr("steps.ejecutarLectura", v);
        return step.cambia ? tr("steps.ejecutarCambia", { ...v, ruta: step.cambia }) : tr("steps.ejecutar", v);
      }
      case "observar":
        return tr("steps.observar", { turno: step.turno, n: step.bloques.length });
      case "fin":
        return tr("steps.fin", { turno: step.turno });
      case "tope":
        return tr("steps.tope", { tope });
    }
  };

  const writtenNow = step.kind === "ejecutar" ? step.cambia : undefined;

  return (
    <div
      role="group"
      aria-label={tr("groupAria")}
      style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%" }}
    >
      {/* What this step does, in words. */}
      <div aria-live="polite" style={{ fontSize: "0.88rem", color: "var(--text)", minHeight: "2.6em" }}>
        {describe()}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "stretch" }}>
        {/* M, growing. */}
        <div style={{ flex: "1 1 300px", minWidth: 0, display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <span style={label}>
            {seen && step.visto > 0
              ? tr("mTitleSeen", { n: M.length, visto: step.visto })
              : tr("mTitle", { n: M.length })}
          </span>
          <div
            ref={listRef}
            role="list"
            aria-label={tr("mAria", { n: M.length })}
            style={{ ...panel, position: "relative", height: "15.5rem", overflowY: "auto", overflowX: "hidden" }}
          >
            {M.map((m, i) => {
              const dim = seen && step.visto > 0 && i >= step.visto;
              const isNew = i === fresh;
              return (
                <div
                  key={i}
                  role="listitem"
                  ref={(el) => {
                    rowRefs.current[i] = el;
                  }}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.4rem 4.6rem minmax(0, 1fr)",
                    gap: "0.3rem",
                    padding: "0.2rem 0.3rem",
                    marginBottom: "0.15rem",
                    borderRadius: 6,
                    border: `1px solid ${isNew ? "var(--green)" : "transparent"}`,
                    borderLeft: `3px solid ${seen && !dim && step.visto > 0 ? "var(--green-container)" : "transparent"}`,
                    opacity: dim ? 0.32 : 1,
                  }}
                >
                  <span style={{ ...line, color: "var(--text-dim)" }}>{i}</span>
                  <span style={{ ...line, color: "var(--text-muted)" }}>{m.role}</span>
                  <div style={{ minWidth: 0 }}>
                    {typeof m.content === "string" ? (
                      <div style={{ ...line, color: "var(--text)" }}>
                        {m.content}
                      </div>
                    ) : (
                      m.content.map((b, j) => <BlockRow key={j} block={b} />)
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* The step and the entorno. */}
        <div style={{ flex: "1 1 240px", minWidth: 0, display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <span style={label}>{tr("stepTitle")}</span>
          <div style={{ ...panel, minHeight: "4.4rem" }}>
            {step.kind === "llamar" ? (
              <div style={{ ...line, color: "var(--text)" }}>{tr("callLine", { n: step.visto })}</div>
            ) : step.kind === "fin" ? (
              <div style={{ ...line, color: "var(--text)" }}>
                {tr("returns")} <span style={{ color: "var(--green)" }}>{JSON.stringify(step.texto ?? "")}</span>
              </div>
            ) : step.kind === "tope" ? (
              <div style={{ ...line, color: "var(--warning)" }}>{tr("returnsTope")}</div>
            ) : step.bloques.length > 0 ? (
              <>
                {step.bloques.map((b, j) => (
                  <BlockRow key={j} block={b} />
                ))}
                {step.aprobada !== undefined && step.bloques[0].type === "tool_use" ? (
                  <div style={{ ...line, color: step.aprobada ? "var(--green)" : "var(--error)" }}>
                    {tr(step.aprobada ? "askYes" : "askNo", { id: step.bloques[0].id })}
                  </div>
                ) : null}
              </>
            ) : (
              <div style={{ ...line, color: "var(--text)" }}>{tr("inicioLine")}</div>
            )}
          </div>

          <span style={label}>{tr("entornoTitle")}</span>
          {seen ? (
            <div
              style={{
                ...panel,
                borderStyle: "dashed",
                fontSize: "0.8rem",
                color: "var(--text-muted)",
                flex: 1,
              }}
            >
              {tr("entornoHidden")}
            </div>
          ) : (
            <div role="list" aria-label={tr("entornoAria")} style={{ ...panel, flex: 1 }}>
              {Object.entries(step.entorno).map(([ruta, contenido]) => (
                <div
                  key={ruta}
                  role="listitem"
                  style={{
                    ...line,
                    padding: "0.05rem 0.25rem",
                    borderRadius: 4,
                    outline: writtenNow === ruta ? "1px solid var(--green)" : "none",
                  }}
                >
                  <span style={{ color: "var(--text-muted)" }}>{ruta}</span>{" "}
                  <span style={{ color: "var(--text)" }}>{contenido.replace(/\n/g, " / ")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Controls. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
        <WidgetButton onClick={() => setIndex(Math.max(0, at - 1))} disabled={at === 0}>
          {tc("stepBack")}
        </WidgetButton>
        <WidgetButton onClick={() => setIndex(Math.min(last, at + 1))} disabled={at === last}>
          {tc("stepForward")}
        </WidgetButton>
        <span style={{ ...label, fontVariantNumeric: "tabular-nums" }}>
          {tc("stepOf", { current: at + 1, total: last + 1 })}
        </span>
        <WidgetButton active={seen} aria-pressed={seen} onClick={() => setSeen((s) => !s)}>
          {tr("seenToggle")}
        </WidgetButton>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
        <span style={label}>{tr("topeLabel")}</span>
        {TOPES.map((t) => (
          <WidgetButton key={t} active={tope === t} aria-pressed={tope === t} onClick={() => pickTope(t)}>
            {t}
          </WidgetButton>
        ))}
        <WidgetButton onClick={reset}>{tc("reset")}</WidgetButton>
      </div>
    </div>
  );
}

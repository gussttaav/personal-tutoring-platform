# P1-04 — Block 4: El puente: de texto a acciones

**Tag:** `COURSE-C2-P1-04` · **Effort:** L · **Owner:** _tbd_ · **Status:** ⬜
**Depends on:** P1-03 · Block 4 widget (built in this task)
**Course:** `llm-agents` → `content/courses/llm-agents/es/` · **Shape:** systems
**Runs on:** the scripted model, only · **Publication:** lesson by lesson

## TL;DR

The first course's Block 4 exists because courses jump from the context bottleneck to attention
as if it were obvious. This one exists for the same reason: courses jump from "chat" to "agent"
as if *that* were obvious. It is not. An agent is a model **plus a loop plus tools plus an
environment**, and the second half is where the design lives: tool calls as structured output
with consequences; the loop, with its termination; errors as observations the model reads, not
exceptions the program raises; permissions, because the tool result is not the user; and what
the loop remembers. All of it in pure Python, on the scripted model, in the browser, with code
challenges — **and no new mathematics, which the block's first lesson says out loud.**

Project: a complete agent over an in-memory filesystem, deterministic, tested. Block 5 replaces
exactly one object in it.

## New widget (built here)

| Id | Lesson | Purpose |
|---|---|---|
| `agent-loop-trace` | 27, 31 | The loop as a stepped trace: the messages list on the left growing turn by turn; on the right, the model call, the `tool_use` block, the execution, the `tool_result`, until a text-only response ends it. Step forward and back; a toggle shows what the model sees at each call |

`context-window` (Block 3) is reused in lesson 30.

## Lessons

| # | Slug | Title | Widgets | Code | Quiz | Challenge |
|---|---|---|---|---|---|---|
| 25 | `de-chat-a-agente` | Del chat al agente: la mitad que falta | — | 1 | 4 | — |
| 26 | `llamar-herramientas` | Llamar herramientas: salida estructurada con consecuencias | — | 2 | 4 | 1 |
| 27 | `el-bucle` | El bucle | `agent-loop-trace` | 2 | 5 | 1 |
| 28 | `errores-como-observaciones` | Errores como observaciones | — | 2 | 4 | 1 |
| 29 | `permisos-y-confianza` | Permisos y confianza: la herramienta no es el usuario | — | 2 | 5 | 1 |
| 30 | `estado-y-memoria` | Estado y memoria: lo que el bucle recuerda | `context-window` | 2 | 4 | — |
| 31 | `proyecto-agente-guionizado` | Proyecto: un agente completo sobre un modelo guionizado | `agent-loop-trace` | 3 | 3 | 1 |

**Bridge in:** lesson 25 picks up the assistant that can say and cannot do, and names the missing
half: the environment.

**Bridge out:** lesson 31 ends on the one thing the project is not: real. The model is a script.
Replace it with a model that can be wrong and everything else in the program stays — that is
Block 5, and it is why the loop was built first.

## Lesson progress

- [ ] 25. `de-chat-a-agente`
- [ ] 26. `llamar-herramientas`
- [ ] 27. `el-bucle`
- [ ] 28. `errores-como-observaciones`
- [ ] 29. `permisos-y-confianza`
- [ ] 30. `estado-y-memoria`
- [ ] 31. `proyecto-agente-guionizado`

## The precise statements (P0-04's step 3 for a systems lesson)

- **A tool** is `(nombre, descripción, esquema)` with the schema a JSON Schema for its input; a
  **call** is `tool_use{id, name, input}`; a **result** is `tool_result{tool_use_id, content,
  is_error}`. These are the Messages-format content blocks Block 5 sends over the wire, and they
  are introduced *here*, on the scripted model, so Block 5 changes nothing but the model
- **The loop**, as pseudocode the reader can hold:
  ```
  M = [system, usuario]
  repetir:
      r = modelo(M, herramientas)
      M.append(r)
      si r no contiene tool_use: devolver r.texto
      para cada llamada en r: M.append(tool_result(ejecutar(llamada)))
  ```
  with its **termination conditions** named: no `tool_use`, a turn cap, a stop reason — and the
  invariant that **the model sees only `M`**
- **An error is an observation:** `ejecutar` never raises into the loop; it returns
  `tool_result(is_error=true, content=…)` and the model decides. Idempotence of tools as the
  property that makes retries safe
- **Permissions** as a function `permitir(llamada) -> permitir | preguntar | denegar` evaluated
  *before* `ejecutar`, per tool class (read / write / execute), with the rule that **tool
  results are untrusted content** — a file the agent reads can contain instructions, and the
  loop does not obey files. Prompt injection is this lesson, not a callout
- **Memory** is two things with one name: `M`, which the model sees and which fills; and the
  environment (files), which persists and which the model reaches only through tools. The
  `context-window` widget shows `M` filling with tool output

## Acceptance criteria

- [ ] All 7 lessons published, within budget; no `$$` block in the whole block, and lesson 25
      says why
- [ ] The loop in lesson 27 is the loop in lesson 31 is the loop in Block 5 — one shape,
      unchanged; the pseudocode above appears once and is referenced after
- [ ] The in-memory environment (`{"ruta": "contenido"}` with `leer`, `escribir`, `listar`,
      `buscar`) is introduced in 26 and is the same object through 31
- [ ] Every challenge grades against the scripted model deterministically — a student's loop
      that skips the `tool_result` append fails a named test
- [ ] Lesson 29 includes a tool result that carries an instruction, and the correct loop ignores it
- [ ] `agent-loop-trace` registered, bilingual, its trace data unit-tested (the trace is data:
      a list of steps computed by `math/agent-trace.ts` from a scripted conversation)
- [ ] `lint:content` green

## Test plan

- Every cell and challenge on a phone.
- Someone who has used a coding agent but never built one reads lessons 25–27 and reports
  whether the loop surprised them anywhere. If nothing did, lesson 25's question is not sharp
  enough.

## Notes / gotchas

- **The scripted model must be able to be wrong.** From lesson 28 on, its script includes a
  call to a file that does not exist and a malformed input, so errors-as-observations has
  something to observe. Author the scripts with the failure in them.
- Do not introduce a real filesystem (Pyodide has one). The dict is the point: the environment is
  *any* state behind tools, and Block 5 swaps it for the real one.
- Name the historical thread in `reading`, not in prose: ReAct (2022), Toolformer (2023),
  function calling (2023), and the protocol Block 5 closes on.
- Resist a "multi-agent" lesson here. Subagents are Block 5 and they need a real model to mean
  anything.

## Out of scope

- Any real model, network call, or filesystem.
- Planning algorithms, tree search over actions, agent benchmarks — Block 5's benchmark is the
  only one.

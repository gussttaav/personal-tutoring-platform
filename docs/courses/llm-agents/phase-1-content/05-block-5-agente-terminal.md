# P1-05 — Block 5: Un agente de programación en la terminal

**Tag:** `COURSE-C2-P1-05` · **Effort:** XL · **Owner:** _tbd_ · **Status:** ⬜
**Depends on:** P1-04 · P0-05 (the companion repository) · the **chain test** (below)
**Course:** `llm-agents` → `content/courses/llm-agents/es/` · **Shape:** systems
**Runs on:** a local model over the Messages API, **in the student's terminal** — no `<PyCell>`
in this block · **Publication:** lesson by lesson

## TL;DR

The capstone. Nine lessons that each add one layer to the same program, in the student's
terminal, against a model running on the student's machine at zero cost: the real model behind
the `Modelo` interface; read / search / edit / run tools with their schemas; the system prompt
and the project file; compaction when the (deliberately 8K) window fills; permissions and a
sandbox; subagents; a mini-benchmark that measures *harness × model* with real numbers; and the
protocol for tools plus the signpost to reasoning models and RL on agents. The last lesson
points the real coding agent at the same local model, runs the same benchmark, and closes the
course.

**Engineering, not mathematics** — said in the first lesson, promised in the FAQ.

## The chain test — before lesson 32 is written

Run the whole chain end-to-end on a clean machine without a GPU (originally a 16 GB one; see the
decision below): install the runner, pull
the default model, send one Messages-format request with `urllib`, run the loop from Block 4's
project with the real adapter, complete one benchmark task, trigger compaction. Record in this
doc:

> **Decision, 2026-10-30 — one verified model.** The author has no 16 GB machine, so the block is
> verified on **one** model, `qwen3:4b-instruct` (8 GB of RAM, no GPU), and the 16 GB tier is
> dropped as a promise: the FAQ (both manifests), the PLAN, the AUTHORING delta and the phase docs
> say so. A bigger model is a `FROM` line in the repo's `Modelfile`, the student's option and
> unverified. It is measured **once**, for lesson 39's table, on a rented 16 GB cloud machine (CPU
> only); that same run re-verifies every lesson's tag on a machine that is not the author's.

- [ ] Runner and version (Ollama ≥ 0.14, the version that serves the Anthropic Messages API)
- [ ] Default model tag and quantisation; disk; tokens/s on CPU for the course's model
- [ ] **The context window** that makes compaction fire on the second benchmark task (the PLAN's
      open decision — 8K is the candidate)
- [ ] Whether the default model's tool calling is reliable enough at the schemas of lesson 34,
      and what the failure rate is (it becomes lesson 39's baseline)
- [ ] The alternative runner (`llama-server`) exercised once

The numbers go into P0-01's FAQ if they changed, into the companion repo's README, and into
every lesson's opening `<Callout>` (pinned versions).

### Chain test — partial run, 2026-10-30 (the course's model)

Run on the author's machine while writing lesson 32, **not** a clean 16 GB machine: 7.3 GB RAM
(≈1.4 GB free, the rest held by a dev session), 4 cores, no GPU, Ubuntu 26.04, Python 3.14.4.
The 16 GB tier was dropped the same day (decision above); what is still open is a clean
machine, which the lesson 39 cloud run covers.

- **Runner:** Ollama **0.40.13** (2026-10-28), the official Linux tarball, user-level, no sudo. It
  serves `/v1/messages`; the Python stdlib client needs no `x-api-key` and no
  `anthropic-version` header. `ollama --version` → `ollama version is 0.40.13`.
- **The 8 GB model is NOT `qwen3:4b`.** That tag now resolves to the thinking-only 2507 model:
  with no `thinking` field it returns a `thinking` block (465 output tokens, 97.7 s for a
  four-word answer); with `"thinking": {"type": "disabled"}` the `thinking` block goes away but
  the reasoning leaks into the `text` block and the call is cut by `max_tokens`. **Use
  `qwen3:4b-instruct`** (Q4_K_M, 2.5 GB on disk, 3.9 GB resident with the 8K window): no
  thinking, clean `text` / `tool_use`, the `thinking: disabled` field is harmless.
- **A bigger model is not part of the verified course** (decision above). For lesson 39's cloud
  run: `qwen3:8b` is a hybrid thinking model, and the petición sends `"thinking": {"type":
  "disabled"}`; check first that Ollama's Anthropic layer maps it to `think=false` cleanly (no
  leak into `text`, as on `qwen3:4b`). Disk ≈5.2 GB.
- **Tokens/s, CPU, `qwen3:4b-instruct` on this (loaded) machine:** prompt ≈16 tok/s, generation
  ≈4.5 tok/s. Lesson 32's two-petición run: 44–51 s including the model load. A first turno with
  the four Block 4 tools: 453 input tokens (the tools + system prompt, for a seven-word question).
- **The window is set by a Modelfile, not an env var:** `FROM <tag>` + `PARAMETER num_ctx 8192`,
  `ollama create local -f Modelfile`. Cross-platform (an env var on the macOS/Windows desktop
  apps is not), versioned in the companion repo, and the code only ever names `local`. Verified:
  the log shows `n_ctx_slot = 8192`, `ollama ps` shows `CONTEXT 8192`. Ollama's own default
  here was **4096** (`OLLAMA_CONTEXT_LENGTH` unset).
- **A petición over the window is a 400, not a truncation** (verified on a 512-token variant):
  `request (1001 tokens) exceeds the available context size (512 tokens), try increasing it`.
  For lesson 36: overflow raises out of `urlopen`, i.e. out of the bucle.
- **The server does not enforce `tool_use`/`tool_result` pairing:** a petición with an
  unanswered `tool_use` gets a 200 and the model invents the file («Comprar leche, Comprar pan,
  Comprar huevos, Comprar fruta»); a `tool_result` with the wrong id also gets a 200. Used in
  lesson 32.
- **The server keeps a prefix cache:** the second petición of a turno reports
  `cache_read_input_tokens: 473` of 494.
- **Block 4's harness runs on the real model unchanged** (a 20-line `urllib` adapter that
  translates the roles and lifts `system` out): the frozen `bucle` + `permisos.ejecutar`, the
  four Block 4 tools, `qwen3:4b-instruct`, 8K window. **Tool-calling reliability, 6 pedidos /
  15 llamadas: 0 malformed llamadas (every one met its esquema); task success 3/6.** Failures
  worth keeping for lessons 33/34/39: (1) `buscar("tortilla")` comes back empty (case-sensitive,
  the file says «Tortilla:») and the model either gives up (1×) or writes the list from its own
  knowledge, once right by luck and once wrong («tomate, huevos», no onion); (2) «¿Qué lleva el
  gazpacho?» answered in **English** with no tool call («I don't have direct access to files»).
  Transcripts: [`05-chain-test-2026-10-30.log`](05-chain-test-2026-10-30.log).
- **Context window that makes compaction fire on the second benchmark task:** not measurable
  yet — the benchmark tasks (lesson 39) don't exist. 8192 is pinned in lessons 32+ and in the
  repo's Modelfiles; revisit when `tareas/` exists, and do not raise it.
- **`llama-server`:** not exercised.
- **Gotcha found on the way:** an `ANTHROPIC_BASE_URL` already set in the shell (here, to the
  cloud API) silently redirects the course's code; the first run got a 401 from the cloud with a
  dummy key. Lesson 32 warns about it before the run.

## Lessons

| # | Slug | Title | Widgets | Code | Quiz | Repo tag |
|---|---|---|---|---|---|---|
| 32 | `preparar-la-maquina` | Preparar la máquina: un modelo local y la API de mensajes | — | terminal | 3 | `b5-l1` |
| 33 | `el-bucle-con-un-modelo-real` | El bucle con un modelo real | — | terminal | 4 | `b5-l2` |
| 34 | `herramientas-de-ficheros` | Herramientas: leer, buscar, editar, ejecutar | — | terminal | 4 | `b5-l3` |
| 35 | `prompt-de-sistema-y-fichero-de-proyecto` | El prompt de sistema y el fichero de proyecto | — | terminal | 4 | `b5-l4` |
| 36 | `compactacion` | Compactación: cuando la ventana se llena | `context-window` | terminal | 4 | `b5-l5` |
| 37 | `permisos-y-sandbox` | Permisos y sandbox | — | terminal | 4 | `b5-l6` |
| 38 | `subagentes` | Subagentes: un bucle dentro de otro | — | terminal | 4 | `b5-l7` |
| 39 | `mini-benchmark` | Un mini-benchmark: medir harness por modelo | — | terminal | 4 | `b5-l8` |
| 40 | `mcp-y-lo-que-viene` | MCP y lo que viene | — | terminal | 3 | `b5-l9` |

«terminal» = fenced `python` / `bash` blocks the student runs locally, an expected-output block
after each run, and `<RepoLink>`s to the previous and current tag. `hasCode: false` (it means
`<PyCell>`).

**Bridge in:** lesson 32 picks up Block 4's project — everything is real but the model — and
installs the model.

**Bridge out:** lesson 40 closes the course. Point back to Block 1's single column, and further
back, by `curso=` reference, to the first course's neuron: nothing in the program the student
just ran is an operation they have not derived and executed since. And leave the door where the
first course left it — in front of the literature, now with a harness to test it in.

## Lesson progress

- [ ] chain test recorded above
- [x] 32. `preparar-la-maquina`
- [ ] 33. `el-bucle-con-un-modelo-real`
- [ ] 34. `herramientas-de-ficheros`
- [ ] 35. `prompt-de-sistema-y-fichero-de-proyecto`
- [ ] 36. `compactacion`
- [ ] 37. `permisos-y-sandbox`
- [ ] 38. `subagentes`
- [ ] 39. `mini-benchmark`
- [ ] 40. `mcp-y-lo-que-viene`

## The precise statements

- **The Messages API request and response** — `model`, `max_tokens`, `system`, `messages`,
  `tools`; content blocks `text` / `tool_use` / `tool_result`; `stop_reason` — as the *protocol*
  the adapter speaks, over `urllib.request` and `json`, with `ANTHROPIC_BASE_URL` as the one
  configuration point. **No SDK.** The same adapter, pointed at a cloud URL, is the "if you want
  a stronger model" paragraph
- **The five tools and their schemas:** `leer(ruta)`, `buscar(patrón, ruta)`, `editar(ruta,
  antiguo, nuevo)` with the contract that `antiguo` must match exactly once, `escribir(ruta,
  contenido)`, `ejecutar(comando)` with captured stdout/stderr/exit code and a timeout. The edit
  tool's contract is the lesson: it is what makes a small model's edits checkable
- **The system prompt** as the harness's voice (what the agent is, its tools, its rules) and the
  **project file** (`AGENTE.md`, read at start) as the repository's voice; what belongs in each,
  and the token cost of both against the window
- **Compaction:** when `tokens(M) > umbral`, replace the middle of `M` with a summary *the model
  itself writes* under a fixed instruction, keeping the system prompt, the project file and the
  last $k$ turns verbatim; the invariant that a compaction never drops a pending `tool_use`
  without its `tool_result`
- **Permissions and the sandbox:** the Block 4 function, real — allow-lists per tool class, a
  prompt on `escribir`/`ejecutar`, and every path resolved inside the working directory (a
  principle before it is a `chroot`)
- **A subagent** is the same loop with a fresh `M`, given a task and returning a summary; why
  (context isolation), what it costs (a second model call per turn), and the rule that the
  parent sees the summary only
- **The benchmark:** five tasks in five tiny repositories under `tareas/` (fix a failing test,
  add a function with its test, rename across files, …); a scorer that runs the repo's tests;
  pass rate with the interval from lesson 23; run with the course's model and, once, with a bigger
  one on a rented 16 GB cloud machine (CPU only, said so in the table); then with
  the real coding agent on the same local model (which needs ≥ 32K context — a `<Callout>`),
  and a table
- **MCP** as the protocol version of "a tool is `(nombre, descripción, esquema)`": a server
  advertises tools, the loop calls them; one minimal server the agent connects to. Reasoning
  models and RL over agent trajectories as the signpost, in `reading`

## Acceptance criteria

- [ ] The chain test is recorded above before lesson 32 is authored
- [ ] Every lesson opens with a `<Callout>` pinning runner version, model tag and the versions it
      was verified on, and states it does not run in the browser
- [ ] Every lesson links its previous and current tag with `<RepoLink>`; each tag, cloned on a
      clean machine, reproduces the lesson's expected-output run on the course's model
- [ ] The adapter is `urllib` + `json`, under 60 lines, and the cloud variant is a URL change
      shown once
- [ ] Compaction **fires during the benchmark's second task** at the recorded window, and lesson
      36 shows the transcript before and after
- [ ] Lesson 37's sandbox rejects a path outside the working directory and an unlisted command,
      and the agent reads the refusal as an observation
- [ ] Lesson 39's table has real numbers for the course's model, a bigger model (the cloud run)
      and the real agent; the prose reads
      the interaction (harness × model), not the winner
- [ ] Product names appear only in `reading`, the FAQ, and lesson 39's table row
- [ ] The tasks are small on purpose and the author says so in lesson 39
- [ ] `lint:content` green; the block's `minutes` exclude model wait time and each lesson says so

## Test plan

- The chain test, then per lesson: clone the tag, run on the course's model, compare with the
  expected output in the lesson. On a machine that is not the author's: the lesson 39 cloud run
  re-verifies every tag cut by then.
- Re-run lessons 32 and 39 on the day the block ships (the rot risk), and record the date in
  the companion README.

## Notes / gotchas

- **A weaker model is the teaching instrument.** When the 8B model calls a tool with a wrong
  argument, that is lesson 34's example. Keep those transcripts; do not sanitise them.
- **Slow is fine, tedious is not.** Every run in a lesson should finish in under two minutes on
  CPU. Tasks that need more are the wrong tasks.
- **Do not raise the window** to make compaction rarer. The whole point of lesson 36 is that the
  student watches it happen.
- The companion repo's tags are cut from the reviewed lesson (P0-05). Cut them in the lesson's
  PR review, not later.
- `hasCode: false` will show the sidebar's code icon off for the whole block. That is correct;
  say in lesson 32 where the code runs.
- Lesson 40 will want to be long. It is a signpost and a close; the budget's floor.
- **Pass the usuario in, do not swap a global.** In Block 4's cells `preguntar` is a module global
  that lesson 31's `probar` replaces with the test's scripted usuario, because the frozen
  `ejecutar` looks it up by name. In the companion repo the usuario (`input()` at the terminal, a
  scripted one in the tests) is an argument of the harness, like the modelo; lesson 37 is where
  the real prompt arrives, and lesson 31's tests are what it must keep passing.

## Out of scope

- A web UI, streaming output, syntax highlighting in the terminal, a plugin system.
- Any model that costs money to run. The cloud paragraph is one paragraph.
- Fine-tuning the local model for the harness.
- SWE-bench or any external benchmark; the five tasks are the benchmark.

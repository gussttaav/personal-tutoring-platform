# P3-08 — Block 5: A Coding Agent in the Terminal

**Tag:** `COURSE-C2-P3-08` · **Size:** XL · **Status:** not started
**Depends on:** P3-07 · the `en` branch of `agente-minimo` (D1) · the pinned chain installable
**Course:** `llm-agents` → `content/courses/llm-agents/en/` · **Runs on:** a local model over the
Messages API, in the student's terminal: Ollama 0.40.13, `qwen3:4b-instruct`, the 8K `Modelfile`

## TL;DR

Nine lessons, no `<PyCell>`, and the most expensive block to translate by a wide margin. Not
because the prose is hard, but because **everything the lessons quote is a measurement**: the
model's replies, its failures, token counts, timings, a compaction that fires on the second task,
and lesson 39's success rates with Wilson intervals over a five-task benchmark. All of it was
measured with Spanish code, a Spanish `AGENTE.md`, Spanish requests and Spanish data. The English
lessons re-run every one of those against English code on an `en` branch of the same
repository, cut lesson by lesson into `en-` tags exactly as the Spanish ones were. Two lessons are rewrites, because their finding *is* the
language.

## Classification

Filled by [P3-00](00-triage.md) on 2026-11-13, read against the nine `es/` lessons. `es/32` …
`es/40` are 5·1 … 5·9. Line refs below are into those files. Every lesson links two `<RepoLink>`
tags, where it starts and where it ends, and pins the chain in an opening `<Callout>`.

**The planning pass holds: seven adapts, two rewrites (5·2 and 5·4), every lesson T.** There are no
cells. A `python` fence is code that lives in the repository. A `text` fence after a `bash` fence is
a transcript, and every transcript is a measurement. What the planning rows did not separate is
**which sentences report the language the model used**. Those are Spanish-run findings, and they
sit in more lessons than the two rewrites (see the list below). Several example projects also carry
a Spanish-locale property that an English twin has to replace: `precios.py`'s decimal comma, the
recipe data's `«»`.

| # | Slug | Class | Re-run | What binds it to Spanish |
|---|---|---|---|---|
| 5·1 | `preparar-la-maquina` | adapt | T | `protocolo.py`'s request and its quoted JSON (453 tokens, 473 from the cache, a quiz quotes them); the model inventing `lista.txt` without its `tool_result`; Spanish unit-test names. The closing bridge says the agent's roles are Spanish |
| 5·2 | `el-bucle-con-un-modelo-real` | **rewrite** | T | The run where the model **answers a Spanish request in English** with no call (433–445), the contract clause and the quiz distractor about **translating the roles into English** (152–155, 17), and the table row «en inglés» (186) |
| 5·3 | `herramientas-de-ficheros` | adapt | T | Five tools as files with Spanish observation strings; the `ejemplo/` project; two transcripts. Two sentences report the model switching to English (148, 731). The closing bridge names «que conteste en español» |
| 5·4 | `prompt-de-sistema-y-fichero-de-proyecto` | **rewrite** | T | The worked system prompt is «Escribe en español, aunque el código esté en inglés» (244), the placement table's first row is «Escribe en español.» (179), and `q-donde-va` asks where that sentence belongs. `coste.py`'s measured sizes (**6167**) |
| 5·5 | `compactacion` | adapt | T | The 8K run that nearly overflows (7 471 + 23 + 784 = 8 278); the **measured** `compactacion` preset; the summary that claims an edit never made. One failure mode quotes the recipe data's Spanish `«»` (154) |
| 5·6 | `permisos-y-sandbox` | adapt | T | The `ajeno/` project, whose fix is **a decimal comma** («la coma pasa a punto», 156); the injected line in its `AGENTE.md`; sandbox strings; 1 332 tokens of `/etc/passwd` |
| 5·7 | `subagentes` | adapt | T | Two delegation runs and their token arithmetic (532 → 1 985, +145 vs +1 453, 228 s vs 208 s); the subagent's system prompt repeats «Escribe en español.» (306) |
| 5·8 | `mini-benchmark` | adapt | T + Kaggle ×2 | The five-task `banco/`, `medir.py`'s output, the three-row table, the paired difference and the failure counts; a quiz prompt quotes **3 of 15, 0.070–0.452** |
| 5·9 | `mcp-y-lo-que-viene` | adapt | T | `incidencias.json` (Spanish issues, states `abierta` / `cerrada`) and the error text a quiz quotes; two runs. The "what comes next" half transposes |

**Block totals:** 0 transpose · 7 adapt · 2 rewrite · re-runs T ×9, of which 5·8 also needs Kaggle
×2 (D3).

### What changed from the planning pass

- **5·2 — confirmed; the run is the lesser half of the rewrite.** Besides the English answer to
  «¿Qué lleva el gazpacho?» (437–445), the adapter's contract says it passes M «con el rol en
  inglés (`user`, `assistant`)» (152–155, docstring 226). That is only a translation because 4·2's
  roles are `usuario` / `asistente`. `q-que-cambia`'s distractor (b) (17) is «`bucle.py`, que tiene
  que traducir los roles al inglés». **Whether English keeps a translation step depends on P3-03**:
  if the English map names the roles `user` / `assistant`, clause 1 shrinks to "the system messages
  go to `system`", and the distractor needs a replacement. Decide it in P3-03, before 4·2 freezes the
  roles.
- **5·4 — confirmed, and the same instruction recurs in 5·7.** The subagent's system prompt in
  5·7's `subagente.py` (306) repeats «Escribe en español.». Whatever 5·4 picks replaces it there too,
  and 5·3's closing bridge (759) promises it.
- **5·3 — not in the planning row: two language findings.** «pasa a escribir en inglés» (148) and
  the model blaming the system «a temporary or system-level discrepancy», in English (731). Both are
  observations of the Spanish run. The second also motivates 5·4's instruction. The English run will
  show something else; describe that.
- **5·5 — confirmed, plus a failure mode tied to Spanish typography.** «El modelo cita `antiguo`
  con las comillas cambiadas, las triples del docstring y las «» de la receta» (154). The `recetario/`
  data's Spanish quotation marks are one of the three quote kinds the model mangles. English data
  has none, so the English run's failure may be narrower, and the opening argument must still end
  near the window (the step-4 stop rule in "How a Block 5 lesson is translated").
- **5·6 — the example bug is Spanish-locale.** `ajeno/precios.py`'s two failing tests are fixed when
  «la coma pasa a punto» (156): prices written with a decimal comma. The English `ajeno/` needs a
  bug of the same size that is natural in English (a thousands separator, say), and one the model
  still fixes in its run.
- **5·8 — confirmed. It holds the 18 `pedido` the Block 3 row attributed to 3·6.** The English
  `banco/`'s five task names, `pedido.txt` requests and graders come from this lesson. `3-renombrar`'s
  identifiers (`suma_precios` → `importe`) are quoted in `q-el-texto-final`.
- **The `compactacion` preset is not in `SPANISH_BOUND_CORPORA`.** `COMPACTION_PRESET` in
  `math/context-window.ts` holds the Spanish trace's measured sizes (system 189, tools 705, project
  123, request 27, nine turns of `MEASURED_TURNS`). Unlike the `asistente` and `agente` presets (no
  text, author's round sizes, already fine in English), it is locale-bound. It is missing from the
  list the phase exit criterion checks, so add it there (P3-01, or this block's 5·5 PR at the
  latest).
- **D1 vs the `Modelfile`'s comment.** D1 says the `en` branch's `Modelfile` is "byte-identical".
  Its first line is a Spanish comment («# El modelo local del curso, con la ventana de contexto del
  curso. Funciona con 8 GB de RAM.», 5·1 261–266), and the lesson prints the file. Either that
  comment is the one Spanish line the `en` branch keeps, or the English `Modelfile` differs in its
  comments only (same `FROM`, same `num_ctx`). Decide it in 5·1.

### Sentences that report the model's language (the gotcha's list)

Each one is a finding of the Spanish run. The English lesson describes what its own run did and
never translates these:

| Lesson | Lines | What it says |
|---|---|---|
| 5·2 | 97 | «contestar en otro idioma» among a real model's failures |
| 5·2 | 186 | table row: «una respuesta sin llamadas, en inglés, que no ha mirado el entorno» |
| 5·2 | 437–445 | the gazpacho run, answered in English: «En inglés, sin una sola llamada» |
| 5·3 | 148 | «pasa a escribir en inglés» |
| 5·3 | 731 | the model blames the system in English |
| 5·4 | 89, 179, 192, 244 | «que conteste en español»; «Escribe en español.»; «Contesta en español» |
| 5·7 | 306 | «Escribe en español.» in the subagent's system prompt |

5·1 (412) says the agent's **roles** are Spanish, which is about the code, not the model, and
follows P3-03.

### Cross-course references (`curso="dl-nlp"`)

| Lesson | Refs | Not yet in `dl-nlp/en/` |
|---|---|---|
| 5·9 | 1 | — (`la-neurona`, 681) |

5·1–5·8: none. No `<Leccion ancla="">`.

### Repository artifacts and identifiers (for D1 and P3-03)

Every name below is typed in a lesson's fences and lives in `agente-minimo`. On the `en` branch they
are P3-03's English names:

- **Files**: `protocolo.py` (5·1); `api.py`, `correr.py`, `agente.py`, `bucle.py` (5·2); `entorno.py`,
  `herramientas/__init__.py`, `herramientas/comun.py` and the five `leer.py` / `buscar.py` / `editar.py` / `escribir.py` /
  `ejecutar.py` (5·3); `AGENTE.md`, `coste.py` (5·4); `compactar.py` (5·5); `permisos.py` (5·6);
  `herramientas/delegar.py`, `subagente.py` (5·7); `medir.py`, `banco/` with `pedido.txt` and `solucion/` (5·8);
  `servidor_incidencias.py`, `cliente_mcp.py`, `mcp_a_mano.py`, `incidencias.json` (5·9); the
  example projects `ejemplo/` (`compra.py`, `test_compra.py`), `recetario/` (`recetario.py`, `compra.py`),
  `ajeno/` (`precios.py`), `banco/`'s task files (`tiempos.py`, `fechas.py`, `ticket.py` …), and the
  `tests/test_*.py` files.
- **Identifiers the prose names**: `ModeloAPI(nombre, max_tokens)`, `SISTEMA`, `inicio`, `enviar`;
  the tools `leer`, `buscar`, `editar` (`ruta`, `antiguo`, `nuevo`), `escribir`, `ejecutar`
  (`comando`); `agente(modelo, pedido, entorno, tope=10, usuario=None, compactar=None,
  delegar=None)`; `compactar(modelo, M)`, `INSTRUCCION`, `UMBRAL`; `fuera(ll, entorno)`; `delegar`,
  `encargo`, `subagente(modelo, encargo, entorno, tope=TOPE)`; `intento`, `wilson(k, n)`, `Cuenta`;
  `AJENAS`, `con_servidor`, `pedir`, `herramientas`.
- **Observation strings the transcripts print**: «no se ha ejecutado: …», «permiso denegado», «el
  usuario no lo ha permitido», «antiguo no aparece en …: cópialo tal cual del fichero. No se ha
  cambiado nada», «ninguna línea contiene … en …», «no ha terminado en 30 s y se ha detenido»,
  «código de salida N», «… está fuera de la carpeta de trabajo», `correr.py`'s «turno N · … tokens
  de entrada» and «fin · N mensajes en M». They are re-printed by the English run, never translated
  by hand.
- **Unit-test names** (`test_el_modelo_terco`, `test_la_tortilla`, …) appear in every `unittest -v`
  transcript.

### Artifact inventory

#### 5·1 `preparar-la-maquina` — `es/32-preparar-la-maquina.mdx` — adapt, T

- **Quiz (3).** `q-nadie-ha-leido` a (12–21), `q-el-hueco` `boolean` false (32–36, Ollama does not
  reject a missing `tool_result`): hold. `q-todo-otra-vez` a (22–31): «473 de sus tokens salieron de la
  caché» → re-measured.
- **Callout** 70–75: verified 30 October 2026, Ollama 0.40.13, Python 3.14, `qwen3:4b-instruct`, 8 GB.
- **Transcripts**: 96–101 (a request and its reply, sketched); 108–117 (the second request without
  its `tool_result`: «¿Y bien?», `end_turn`, the invented content «Comprar leche, Comprar pan…»);
  199–201 (`ollama --version`, stays); 237–247 (`unittest -v`); 344–387 (`protocolo.py`'s JSON),
  read at 391–397 (453 input tokens; 21 new and 473 cached). 180–181 quotes Ollama's own English 400
  message, which stays.
- **Code**: `Modelfile` (261–266, see D1 above), `protocolo.py` (278–325).
- **`<RepoLink>`** `b5-l1` (206, 329). **`<W>`: 9.** **`reading`**: 3, `lang: en`.

#### 5·2 `el-bucle-con-un-modelo-real` — `es/33-el-bucle-con-un-modelo-real.mdx` — rewrite, T

- **Replacement:** *show the failure the English run of the same request actually produces (the
  general row survives: a reply with no calls that never looked at the environment); rewrite
  clause 1 and `q-que-cambia`'s (b) against P3-03's role names.*
- **Quiz (4).** `q-que-cambia` a (12–21): (b) changes; the explanation's `git diff --stat b5-l1`
  becomes `en-b5-l1`. `q-la-cortada` a (22–31), `q-tests-real` `boolean` false (42–46): hold.
  `q-lo-adivino` a (32–41): the tortilla trace, where `buscar` misses «Tortilla:» by case and the model
  guesses the ingredients → re-measured. The English run must again show a case-sensitive miss
  followed by a guess, or the item is reworded on what it does show.
- **Callout** 80–86.
- **Transcripts**: 105–118 (the tortilla run: 4 turns, 460 / 501 / 535 / 603 tokens, the denial, an
  apology); 393–405 (`unittest -v`, six Spanish test names); 414–423 (the recipes run, 460 / 556
  tokens); 437–441 (the gazpacho run, 455 tokens, an English reply).
- **Code**: `ModeloAPI` signature (144–147), `api.py` (209–246), tests (251–301), `correr.py`
  (308–349).
- **`<RepoLink>`** `b5-l1` (202), `b5-l2` (375). **`<W>`: 3.** **`reading`**: 3, `lang: en`.

#### 5·3 `herramientas-de-ficheros` — `es/34-herramientas-de-ficheros.mdx` — adapt, T

- **Quiz (4), all hold**: `q-dos-veces` a, `q-copia-vieja` a, `q-salida-uno` `boolean` false,
  `q-se-detiene` a (12–46). They quote `ejemplo/compra.py`'s repeated line and the 30-second message.
- **Callout** 84–88 (31 October 2026).
- **Transcripts**: 114–145 (the opening run, 753 tokens: the diagnosis, the switch to English, the
  `escribir` that drops quotes; 521 characters; the 300 s adapter wait); 655–671 (`unittest -v`);
  685–724 (the closing run: the `split(",")` quoted as `split(',')` four times, «a temporary or
  system-level discrepancy», `tope · 22 mensajes en M`).
- **Code**: the five tools and their package (252–445), `ejemplo/` (538–569; the trailing-dot bug
  «ajo.», «cebolla.»), `correr.py` (586–632).
- 759: the closing bridge.
- **`<RepoLink>`** `b5-l2` (246), `b5-l3` (644). **`<W>`: 21.** **`reading`**: 3, `lang: en`.

#### 5·4 `prompt-de-sistema-y-fichero-de-proyecto` — `es/35-prompt-de-sistema-y-fichero-de-proyecto.mdx` — rewrite, T

- **Replacement:** *a deployer-level instruction with the same property: it binds every repository,
  so it is not the project file's. It must change the English run visibly and not be vacuous in
  English. It replaces «Escribe en español» in `SISTEMA` (244), in the placement table (179), in
  `q-donde-va`'s option (1), in 192, and in 5·7's subagent prompt.*
- **Quiz (4).** `q-donde-va` a (12–21): **option (1) replaced**. `q-repositorio-ajeno` a (22–31):
  holds. `q-lo-que-queda` `numeric` **6167** (32–38): `coste.py`'s 1001 tokens → re-measured.
  `q-agente-md-editado` a (39–48): holds.
- **Transcripts**: 99–123 (the opening run without either voice: five turns, 742 → 2 011 tokens,
  139 / 70 / 55 / 109 / 226 s, the failed `editar`); 206–211 (`coste.py`: the request 10 tokens …
  + the project file 1 001, 12.2 %), read at 213–218 (286, 705, 1 024, 6 167, ~800); 376–382
  (`unittest`); 396–414 (the closing run, 1 014 tokens; «Los tests han pasado» without running them,
  422–423).
- **Code**: `agente.py` with `SISTEMA` (231–266), `AGENTE.md` (278–286), `coste.py` (325–354).
- 446–448: the bridge into 5·5 (742 → ~3 000 tokens in eight turns).
- **`<RepoLink>`** `b5-l3` (226), `b5-l4` (366). **`<W>`: 6.** **`reading`**: 2, `lang: en`.

#### 5·5 `compactacion` — `es/36-compactacion.mdx` — adapt, T

- **Quiz (4), all hold if the English run again behaves the same way**: `q-el-corte` a,
  `q-el-pedido` a, `q-lo-que-calcula` a, `q-el-resumen-dice` a (12–51). The last one quotes the
  summary's false «he modificado compra.py».
- **Callout** 88–94 (4 November 2026; 36 and 50 minutes of runs).
- **Transcripts**: 113–151 (the opening run: 10 turns, 1 044 → 7 471 tokens, 36 minutes), read at
  153–168 (the three quote kinds; 784 tokens × 3; 8 278 > 8 192; 0.4 → 1.6 s per token; 8 495);
  456–462 (`unittest`); 476–504 (the compacted run), read at 505–531 (fired after turns 5, 7, 10; at
  most 4 898; 111 tokens computed per summary; 1 742 recomputed; the invented `veces`; «he
  modificado compra.py»; a second run's «Con estos cambios, los tests ahora pasan.»).
- **`<Explorable>` `context-window` preset `compactacion`** (170): measured; prose 172–177 (874, 67,
  5 316, 11 776).
- **Code**: the pseudocode (193–203), `compactar.py` with `INSTRUCCION`, the summary instruction the
  model reads (261–298), `bucle.py` (311–330), tests (371–428); `api.py`'s 900 s (364–366).
- 230–247: the threshold 4 096 = 8 192 − 1 024 − 3 072 holds.
- **`<RepoLink>`** `b5-l4` (256), `b5-l5` (446). **`<W>`: 8.** **`reading`**: 3, `lang: en`.

#### 5·6 `permisos-y-sandbox` — `es/37-permisos-y-sandbox.mdx` — adapt, T

- **Quiz (4), all hold**: `q-el-punto-y-coma` a, `q-el-enlace` a, `q-tests-ajenos` a,
  `q-la-lista-del-repositorio` a (12–51). Their commands and paths are language-free.
- **Callout** 87–91 (5 November 2026). 94–99 recaps 5·5's run (five questions, edits of 700–2 200
  characters).
- **`ajeno/`** 105–111: `precios.py` (decimal comma) and the `AGENTE.md` with an injected line.
- **Transcripts**: 113–154 (the opening run, 22 minutes; turn 3 reads `/etc/passwd`, 52 lines,
  1 332 tokens), read at 155–162; 489–495 (`unittest`); 509–542 (the closing run: refused without
  asking, +54 tokens; `./etc/passwd` resolves inside), read at 545–562.
- **Code**: `permisos.py`, `ejecutar.py`, `fuera`, tests (270–466); exit code 127 (331).
- **`<RepoLink>`** `b5-l5` (265), `b5-l6` (479). **`<W>`: 20**, mostly paths and commands, which stay.
  **`reading`**: 3, `lang: en`.

#### 5·7 `subagentes` — `es/38-subagentes.mdx` — adapt, T

- **Quiz (4), all hold**: `q-el-encargo` a, `q-un-subagente-que-edita` a, `q-cuando-no-compensa` a,
  `q-el-tope-del-subagente` a (12–51). Translate the requests they quote.
- **Callout** 89–91 (5 November 2026).
- **Transcripts**: 112–123 (the opening request, 108: 2 turns, 1 089 tokens), read at 126–129 (1 453
  tokens of two files); 192–204 (a delegated run, 1 294 tokens); 474–480 (`unittest`); 492–508 (the
  closing run, with the subagent's `│` lines), read at 511–527 (532 → 1 985; 1 409 new tokens in
  141 s; +145 vs +1 453; 228 s vs 208 s; 82; +214). 174–176: 532 and 197 tokens.
- **Code**: `delegar` pseudocode (143–150), `herramientas/delegar.py`, `bucle.py`, `subagente.py` with its system
  prompt (288–311, «Escribe en español.» at 306), `agente(…, delegar=…)`, tests (225–452).
- **`<RepoLink>`** `b5-l6` (219), `b5-l7` (464). **`<W>`: 3.** **`reading`**: 3, `lang: en`.

#### 5·8 `mini-benchmark` — `es/39-mini-benchmark.mdx` — adapt, T + Kaggle ×2

- **Quiz (4).** `q-el-texto-final` a (12–21): `3-renombrar`'s identifiers → the English task's.
  `q-el-tope-y-el-acierto` a (22–31), `q-el-usuario-de-medir` a (42–51): hold.
  `q-que-cubre-el-intervalo` a (32–41): «3 de 15: 0.2, … 0.070 y 0.452» → re-measured.
- **Callout** 87 (5 November 2026).
- **The opening** 109–149: «Los tests fallan. Arregla tiempos.py para que pasen.» (`minutos`
  multiplies by 100); transcripts 112–137 and 142–145 (two runs that both end in a false «done»).
- **`banco/`** (tree 232–243): five tasks, each with `pedido.txt`, a grader and `solucion/`.
- **Code**: the grader (250–264), `medir.py` (268–311), `Cuenta` (318–347), `wilson` (355–381),
  tests (387–433); pseudocode 184–191.
- **Transcripts**: 448–454 (`unittest`); 471–494 (`python medir.py 3`: per-attempt lines and the
  summary).
- **Measured, all re-run (D3)**: 496–566, i.e. the table (535–539: 3 of 15, 0.070–0.452; `qwen3:8b`
  5 of 15, 0.152–0.583; Claude Code 2.1.318 1 of 3, 0.061–0.792), the paired difference (−0.12 to
  0.39), tests run 19 vs 8, false «done» 1 vs 5, rejected quotes 29 vs 9, Claude Code's 10 669-token
  first request vs 1 232, 49 minutes on `1-tiempos`, the 900 s and ~180-token limits (505, 561), the
  model-written bug «'kg': 100-00» (507).
- **`<RepoLink>`** `b5-l7` (226), `b5-l8` (438). **`<W>`: 6.** **`reading`**: 3, `lang: en`.

#### 5·9 `mcp-y-lo-que-viene` — `es/40-mcp-y-lo-que-viene.mdx` — adapt, T

- **Quiz (3).** `q-la-clase-no-es-del-servidor` a (12–21) and `q-la-descripcion` a (32–41, an
  injected tool description) hold. `q-un-fallo-del-servidor` a (22–31): the state `pendiente` and
  «el estado es abierta o cerrada» → the English data's values and error text.
- **Callout** 87–90 (7 November 2026; MCP revision `2026-07-28`, which stays).
- **Data**: `incidencias.json` (194–202). **Code**: `servidor_incidencias.py`, `cliente_mcp.py`,
  `AJENAS`, `mcp_a_mano.py`, tests (206–560). JSON-RPC codes −32602 / −32022 hold; the SDK 2.3.0
  interop claim (612) is re-checked.
- **Transcripts**: 575–581 (`unittest`); 594–604 (the wire, ending in the Spanish error); 623–632
  (run 1: 2 turns, 1 320 tokens, 140 s), read at 636–640 (+86 tokens; 11 s cached); 645–660 (run 2:
  3 turns; issue #5, about `compra.py`, left out), read at 664–667.
- The "what comes next" half (from ~675) transposes.
- **`<RepoLink>`** `b5-l8` (187), `b5-l9` (565). **`<W>`: 4.** **`reading`**: 4, `lang: en`.

## D1 — the English companion repository: an `en` branch (decided 2026-11-13)

The Spanish lessons say «la lección es la fuente de verdad; el repositorio es la copia». An English
lesson's code is English (`AUTHORING.en.md` §7, P3-03's identifier map), so the Spanish tags are no
longer its copy.

**Gustavo's decision: no new repository.** The English code lives in `agente-minimo` itself, on a
branch `en`, with one tag per English lesson: `en-b5-l1` … `en-b5-l9`. `LLM_AGENTS_REPO_BASE` stays
one URL; the English lessons write `<RepoLink tag="en-b5-l3">` where the Spanish ones write
`tag="b5-l3"`, and P3-01's lint fails a tag in the wrong locale's tree.

How the branch is built:

- **`en` starts from an empty tree, not from `main`**, and is never merged into `main` (nor `main`
  into it). The two histories share only the repository: a Spanish file left over on `en` would be
  exactly the half-translated tell §7 exists to prevent. Create it with `git switch --orphan en`.
- **Its first commit holds what the Spanish `main` held before `b5-l1`**: the `README.md` (in
  English, saying the Spanish code is on `main` with tags `b5-l*`), `LICENSE`, `.gitignore`, the
  `Modelfile` (byte-identical: the chain is pinned) and the English descendants of Block 4's
  `entorno.en.py` and `permisos.en.py` under P3-03's file names.
- **Each `en-b5-lN` tag is cut from the reviewed English lesson's code**, as in Phase 1: the branch
  grows with the block, never ahead of it. One commit per lesson, message `en-b5-lN: <English
  title> (COURSE-C2-P3-08)`.
- **`main` gets one change**: its README's "*English: the lessons are in Spanish*" line is replaced
  by a pointer to the `en` branch and its tags, once `en-b5-l1` exists. Nothing else on `main` or
  under a `b5-l*` tag moves.
- **The student clones a tag**, so the instructions in the English lessons read `git clone --branch
  en-b5-lN …`, exactly as the Spanish ones name `b5-lN`. `--branch` takes a tag; the lesson never
  names the `en` branch itself, which moves.

Pushing the branch and its tags to GitHub is a publication to a public repository: ask before each
push, as for the Spanish tags.

## D3 — lesson 39's two Kaggle rows

The Spanish table has three rows. The first was measured on the author's laptop and is re-run with
the rest of the block. The other two were measured on a free Kaggle CPU notebook: the student's
harness on a bigger model (`qwen3:8b`, 15 attempts), and the real coding agent (Claude Code
2.1.318, its own 32K `Modelfile`) on the course's model (3 attempts, each up to an hour and a half;
its first request alone took half an hour).

**Gustavo's decision (2026-11-13): re-measure both** against the English `banco/`, with the same
notebook recipe and the same pinned versions (`qwen3:8b`; Claude Code 2.1.318 and its 32K
`Modelfile`): headless Save & Run All, never interactive (memory: Kaggle CPU runs). Budget it as the
block's longest single run. The Spanish rows are **never** quoted in the English lesson: a table of
English measurements with Spanish rows in it would make the lesson's paired comparison meaningless.
If a Kaggle run cannot be done, stop and bring it back rather than falling back to the Spanish
numbers.

## Lesson progress

- [ ] 5·1 `preparar-la-maquina`
- [ ] 5·2 `el-bucle-con-un-modelo-real`
- [ ] 5·3 `herramientas-de-ficheros`
- [ ] 5·4 `prompt-de-sistema-y-fichero-de-proyecto`
- [ ] 5·5 `compactacion`
- [ ] 5·6 `permisos-y-sandbox`
- [ ] 5·7 `subagentes`
- [ ] 5·8 `mini-benchmark`
- [ ] 5·9 `mcp-y-lo-que-viene`

## How a Block 5 lesson is translated

The Phase 1 recipe, in English, per lesson:

1. Start from the previous English tag (5·1: from Block 4's English modules).
2. Write the English lesson's code, against P3-03's identifier map.
3. Run it on the pinned chain from a fresh clone; capture every transcript, count and timing the
   Spanish lesson quotes **in the English run's own terms**. Keep the raw run log beside this md,
   as `08-lessonNN-runs-<date>.log`, like Phase 1's `05-lessonNN-runs-<date>.log`.
4. Write the prose against what the run did. Where the English run did something the Spanish one
   did not (a different failure, a different number of turns), the lesson describes the English run.
   If the difference breaks the lesson's argument (5·5's compaction not firing on the second task),
   **stop and bring it back**: it is a design question, not a translation one.
5. Cut the English tag from the reviewed lesson's code.

## Decisions fixed by a translated lesson

*Empty until the first lesson lands. Expect: the English `AGENT.md` text (5·4), the English
`banco/` requests (5·8), the English `incidencias.json` (5·9).*

## Acceptance criteria

- [ ] Every lesson under `content/courses/llm-agents/en/`, `draft: false`; ids identical
- [ ] The `en` branch of `agente-minimo` holds nine tags `en-b5-l1` … `en-b5-l9`, each cut from its
      reviewed English lesson; `main` and the `b5-l*` tags unchanged but for `main`'s README pointer
- [ ] Every English lesson's code is verified from a fresh clone of its English tag on the pinned
      chain; every transcript, count and timing it quotes is from those runs, with the logs kept
- [ ] The `compactacion` preset is the English trace's measured sizes, and compaction still fires on
      the second task
- [ ] Lesson 39's three rows are all measurements of the English benchmark, the two Kaggle rows
      re-run there (D3)
- [ ] Each lesson's opening `<Callout>` pins the same chain as its Spanish lesson
- [ ] Every `<RepoLink>` in an English lesson names an `en-b5-l*` tag that exists and opens on
      GitHub; every Spanish lesson's links unchanged
- [ ] Two-reader test against the English neighbours; `pnpm lint:content` clean; `pnpm build` green
- [ ] **Phase exit** (README): `fullyTranslated` true for `en`; no fallback `noindex`; hreflang
      reciprocal for all 40; `SPANISH_BOUND_CORPORA` holds no `llm-agents` entry

## Test plan

- Per lesson: the run above, then `lint:content` and a read at 360px (Block 5 has the course's
  longest fences, and the `longestFence` budget warns on them).
- 5·8: `medir.py` on the English `banco/`, the same number of repetitions as Spanish; the
  `tests/test_banco.py` property (each grader gives 0 to the untouched repo and 1 to the solution)
  for every English task.
- After 5·9: `/en/cursos/llm-agents` shows no untranslated notice; three lesson pages spot-checked
  for `noindex` gone and hreflang reciprocal.

## Gotchas

- **Stop Ollama before `pnpm build`** and detach long runs with `setsid nohup` (memory: Block 5
  run quirks; background jobs die with the session). An 8K-filling run takes 30–50 minutes.
- **Ollama ignores `tool_choice`.** The Spanish lessons were written knowing it; the English runs
  inherit the same behaviour.
- **`pkill -f` can kill the session's own shell** (memory). Stop the server by PID.
- **The model's sampling is not seeded across runs** the way Pyodide is. A single English run that
  happens to differ from the Spanish story is not a finding until it repeats; 5·8's repetitions are
  the model for how many runs a claim needs.
- **Ollama 0.40.13 must still be installable.** If not, stop: re-pinning changes the Spanish lessons
  too (README, out of scope).

## Out of scope

- Changing `main` or any `b5-l*` tag of `agente-minimo` beyond `main`'s README pointer.
- Re-pinning Ollama or the model.
- The real coding agent's own version, beyond pinning it in 5·8 as the Spanish lesson does.

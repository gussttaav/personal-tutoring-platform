# P3-07 — Block 4: The Bridge: from Text to Actions

**Tag:** `COURSE-C2-P3-07` · **Size:** L · **Status:** not started
**Depends on:** P3-06 (and the `guionizado.en.py` 3·1 freezes)
**Course:** `llm-agents` → `content/courses/llm-agents/en/` · **Runs on:** the scripted model, in the
browser

## TL;DR

Seven lessons, no mathematics, no checkpoint: the agent's loop, tools, errors, permissions and
memory, on a scripted model whose replies are written in advance. Nothing here is Spanish
*pedagogy*, so there is no rewrite. But everything the scripted model sees is a Spanish
**environment**: Spanish file names and contents, Spanish tool names and descriptions, Spanish
error and denial messages, a scripted user who only lets `lista.txt` change. Three of the block's
lessons freeze the modules that hold it, and every observation a later lesson quotes is built from
them. The block's real work is building `entorno.en.py`, `harness.en.py` and `permisos.en.py`,
in lesson order, and the two `agent-loop-trace` presets on top of them.

## Classification

Filled by [P3-00](00-triage.md) on 2026-11-13, read against the seven `es/` lessons. `es/25` …
`es/31` are 4·1 … 4·7. Line refs below are into those files.

**The planning pass holds: seven adapts, no rewrite.** Nothing in the block argues from Spanish. All
of the Spanish is environment: file names and contents, tool names and fields, error and denial
strings, the scripted user. Six lessons are **P (scripted)**, and every observation they print is a
function of `entorno.en.py`, `harness.en.py`, `permisos.en.py` and the author's scripts, so the
English run reproduces whatever the author writes. The exception is **4·6**, whose first cell
measures the novel with the BPE. That is a real measurement, and it puts a size condition on P3-02's
corpus.

| # | Slug | Class | Re-run | What binds it to Spanish |
|---|---|---|---|---|
| 4·1 | `de-chat-a-agente` | adapt | P (scripted) | A two-file mini-environment (`receta.txt` with the tortilla, `lista.txt`), the ad-hoc keys `pide` / `ruta`; `agente-piezas.svg` with Spanish set in it; the `llamada` switch named (142) |
| 4·2 | `llamar-herramientas` | adapt | P (scripted) | **Writes the environment and the four tools** (frozen as `entorno.py`): paths, contents, tool names `leer` / `escribir` / `listar` / `buscar`, fields `ruta` / `contenido` / `carpeta` / `patron`, descriptions. The protocol's own field names are already English |
| 4·3 | `el-bucle` | adapt | P (scripted) | `agent-loop-trace` (`SPANISH_BOUND_CORPORA`) is the lesson's first cell; **two quiz items read the widget** (ends at turn 4; stops at 3 with `tope = 3`), and one counts turn 2's three reads |
| 4·4 | `errores-como-observaciones` | adapt | P (scripted) | **Freezes `harness.py`**. The error strings («no se ha ejecutado: falta el campo 'ruta'», «no existe el fichero …») that every later observation quotes; the salmorejo request on an environment that has no salmorejo |
| 4·5 | `permisos-y-confianza` | adapt | P (scripted) | **Freezes `permisos.py`**: denial strings, permission values, the scripted user. The injected line in `recetas/salmorejo.txt` is quoted by a quiz item, which contrasts it with the recipe's own imperative step |
| 4·6 | `estado-y-memoria` | adapt | **P** | The first cell puts **the whole novel** in the environment and counts it with the BPE: the read observation is 142 312 tokens, «más que la ventana de 128 000». A quiz prompt quotes it. The `agente` preset holds no text |
| 4·7 | `proyecto-agente-guionizado` | adapt | P (scripted) | `agent-loop-trace` preset `proyecto`; the three tests' hand-written observations are the Spanish strings, character for character; `agente(modelo, pedido, entorno, tope=10)` |

**Block totals:** 0 transpose · 7 adapt · 0 rewrite · re-runs P (scripted) ×6, P ×1.

### What changed from the planning pass

- **4·6 — a measurement the row did not name, and a condition on the corpus.** The row describes
  the `agente` preset and «loads all six modules». The first cell (210–246) does more than that. It
  loads `corpus.txt`, puts the novel in the environment as a file, and has two scripts answer «how
  old is the Nela»: one reads the whole novel, one searches for `años`. It then counts what each
  call carries with the BPE. The argument at 248–252 is that the read observation, 142 312 tokens,
  is «más que la ventana de 128 000 de la lección sobre la ventana», so `modelo` would raise. **P3-02
  should check that the English corpus encodes, with the English 512-entry merge list, to more than
  128 000 tokens.** If it does not, this paragraph needs another example of an observation too big
  for the window. `q-que-decide-el-tamano` (12–21) quotes 142 312 and 8 788 in its prompt. Re-run
  flag **P**, not scripted.
- **4·6 and 3·5 — no English `context-window` preset is needed.** Both presets in
  `math/context-window.ts` hold segment kinds and round sizes the author chose («he puesto yo,
  redondos», 104), and no text. The labels («Turno 3», «Pasaje 2») come from
  `courses.widgets.context-window.kinds.*`, which already has English. The asset row below is struck.
  **The third preset, `compactacion` (5·5), is the opposite**: measured on the Spanish run, and
  **absent from `SPANISH_BOUND_CORPORA`** (see [08-block-5.md](08-block-5.md)).
- **4·3 — the property list grows by one.** The block md names the preset's property (turns fixed by
  the folder listing, one response with several calls, one call that changes the environment). Two
  quiz items also read numbers off it: `q-quien-termina` (the loop ends at turn 4 with `tope` 10) and
  `q-tope-a-medias` (with `tope` 3 it stops at turn 3 mid-task). The English preset has to keep those
  numbers, or the two items are re-measured.
- **4·5 — the injection has a counterpart that must survive too.** `q-filtrar-ordenes` (12–16)
  refutes "filter the orders out" with the recipe's own imperative step. That step is an order too,
  and a filter would take it along with the attack. The English recipe needs an imperative step next
  to the injected line, or the explanation loses its counter-example. 457 makes the same point about
  a filter keyed on the line's addressee prefix.
- **4·4 — a quiz item names a hypothetical tool `añadir`** (37–47, 472). Its English name comes from
  P3-03 (it is not frozen anywhere, but 4·4's challenge text and quiz must agree).

### Cross-course references (`curso="dl-nlp"`)

None in the block. No `<Leccion ancla="">`.

### Frozen-module identifiers the prose names (for P3-03)

The block's prose names nearly every public name of its three modules. All of them are in the map
before 4·2 is written:

- **`entorno.py`** (4·2): `ENTORNO`; the tools `leer`, `escribir`, `listar`, `buscar` and their fields
  `ruta`, `contenido`, `carpeta`, `patron`; `FUNCIONES`, `HERRAMIENTAS`, `objeto`; the block builders
  `texto`, `llamada`, `resultado`, `muestra`; `incumple` and its five messages; `TIPOS`, `guion_de`.
  The file contents are the environment, chosen once in 4·2 (see below).
- **`harness.py`** (4·4): `leer` (redefined to raise «no existe el fichero %r»), `error(id,
  contenido)`, `ejecutar(ll, entorno)` with the prefix «no se ha ejecutado: », `bucle(modelo, inicio,
  entorno, tope)` returning `("fin" | "tope", texto, M)`.
- **`permisos.py`** (4·5): `CLASES` (`lectura`, `escritura`), `PERMISOS` (`permitir`, `preguntar`,
  `denegar`; class `ejecución`), `permiso(ll)`, `preguntar(ll)`, the `ejecutar` that consults them,
  and the denials «permiso denegado», «el usuario no lo ha permitido».
- **Message roles** `usuario` / `asistente` in every `M` (from 3·1's `ModeloGuionizado`). In English
  they meet the protocol's own `user` / `assistant` in 5·2 (see its rewrite).
- **Lesson-level names that reach Block 5**: `agente(modelo, pedido, entorno, tope=10) -> (motivo,
  texto, M)` (4·7 277), `inicio`, `tope`, `M`, the wrapper `Observación:` (4·5 451), and `pedido`,
  the course's word for the user's request (from 4·1; 32 times in 4·7).

The protocol's field names (`name`, `description`, `input_schema`, `tool_use`, `tool_result`,
`tool_use_id`, `content`, `is_error`, `id`, `input`) are the Messages API's and are English in both
locales.

### Artifact inventory

#### 4·1 `de-chat-a-agente` — `es/25-de-chat-a-agente.mdx` — adapt, P (scripted)

- **Quiz (4), all hold.** `q-quien-escribe` a (12–22), `q-lo-que-sabe` `boolean` false (23–27,
  `{"pide": "leer", "ruta": "receta.txt"}`), `q-quien-elige` a (28–37), `q-cuantos-turnos` `numeric`
  **8** (38–44, «Cambia 2025 por 2026…», arithmetic).
- **The mini-environment** 96–109: `receta.txt` («Tortilla: huevos, patatas, cebolla.»), `lista.txt`,
  the request, four scripted replies. These keys exist only in this lesson.
- **`<Figure>` `agente-piezas.svg`** (118–122) → `.en.svg`, every string measured inside the
  `viewBox`; `alt` and `caption`.
- **`<PyCell>` 210–256** (`guionizado.py`; local `peticion`, `ejecutar`): quoted 259–267 (two
  harnesses; the `KeyError` for «recetas.txt»).
- 142: the `llamada` switch. 78: the bridge names the *Marianela* assistant.
- **`<W>`: 11.** **`reading`**: 3, `lang: en`.

#### 4·2 `llamar-herramientas` — `es/26-llamar-herramientas.mdx` — adapt, P (scripted)

- **Quiz (4), all hold**: `q-que-sabe-el-modelo` a, `q-que-para-el-esquema` [a,c,d] (its calls use the
  tools' names and fields), `q-dos-llamadas` a, `q-forzar-ajeno` a (12–53).
- **`<CodeChallenge>` `ch-observaciones`** (55–292): `guionizado.py`, 8 tests; its solution is part of
  `entorno.py`.
- **The environment** 346–362: `lista.txt`, `notas.txt` («El sábado vienen cuatro a cenar.»),
  `recetas/tortilla.txt`, `recetas/gazpacho.txt`; the request; the scripted turns `t1`–`t3`.
- **The tool table** 400–403 and the text block (fence 416–420).
- **`<PyCell>` 477–522** writes the environment, the four functions, `objeto`, `HERRAMIENTAS`,
  frozen as `entorno.py`. Quoted 524–527 (`KeyError`, `TypeError`, a file named `3`).
- **`<PyCell>` 535–579** (writes `texto`, `llamada`, `resultado`, `muestra`; the scripted run):
  581–585.
- 464–465: the schema-valid write that would erase the dinner note.
- **`<W>`: 16.** **`reading`**: 4, `lang: en`.

#### 4·3 `el-bucle` — `es/27-el-bucle.mdx` — adapt, P (scripted)

- **Quiz (5), all hold if the preset keeps its shape.** `q-quien-termina` a (12–21),
  `q-mensajes-al-final` `numeric` **13** (22–28, arithmetic), `q-sin-memoria` a (29–38),
  `q-tope-a-medias` [a,b] (39–50), `q-tres-lecturas` `boolean` false (51–55).
- **`<CodeChallenge>` `ch-bucle`** (57–234): `entorno.py`, `guionizado.py`, 8 tests; writes `bucle`.
- **`<Explorable>` `agent-loop-trace`** (279), the default preset. Request «Añade a lista.txt…» (273);
  the caption names the widget's button «Lo que ve el modelo»; prose 284–287.
- **Fence 304–313**: the loop's pseudocode, in Spanish words.
- **`<PyCell>` 379–420** (`guionizado.py`, `entorno.py`) and **433–450** (a stubborn script with no
  end): quoted 452 (messages 2, 4, 6, 8; `RuntimeError` at turn 12).
- **`<W>`: 6.** **`reading`**: 2, `lang: en`.

#### 4·4 `errores-como-observaciones` — `es/28-errores-como-observaciones.mdx` — adapt, P (scripted)

- **Quiz (4), all hold.** `q-quien-decide` a (12–21), `q-error-y-acierto` a (22–31),
  `q-vacio-no-es-error` `boolean` false (32–36), `q-repetir` [a,c] (37–47; the hypothetical
  `añadir`).
- **`<CodeChallenge>` `ch-errores`** (49–227): `entorno.py`, `guionizado.py`, 7 tests; frozen from
  `def leer(` as `harness.py`.
- **The trace** 274–288: «Añade a lista.txt lo que falta para el salmorejo.»; `t1` with a list field
  `rutas`; the two error observations; `listar recetas/`.
- **The error strings** 316, 329, 334 (and `incumple`'s messages in `entorno.py`).
- **`<PyCell>` 392–438** (the trace) and **450–470** (re-running each tool: `añadir` leaves «tomates»
  twice, 472).
- **`<W>`: 18.** **`reading`**: 3, `lang: en`.

#### 4·5 `permisos-y-confianza` — `es/29-permisos-y-confianza.mdx` — adapt, P (scripted)

- **Quiz (5).** `q-filtrar-ordenes` `boolean` false (12–16): quotes the injected line, and the
  explanation contrasts it with the recipe step «Tritura los tomates con el ajo». `q-sin-preguntar`
  [a,b] (17–27), `q-esquema-antes` a (28–37), `q-permiso-sin-m` a (38–47) hold.
  `q-que-ve-el-usuario` a (48–57): its explanation has the model repeat the attack in its own voice.
- **`<CodeChallenge>` `ch-permisos`** (59–295): `entorno.py`, `guionizado.py`, `harness.py`, 8 tests;
  frozen as `permisos.py`.
- **The injection**: `recetas/salmorejo.txt` (352–355), two recipe lines and a third addressed to the
  assistant; the request (355); the outcome (360, 372, 522–524).
- **Denials** 420–421; the `Observación:` wrapper (451); the scripted user who only allows
  `lista.txt` (529).
- **`<PyCell>` 490–520** (the attack, no permissions) and **531–554** (with them).
- **`<W>`: 18.** **`reading`**: 4, `lang: en`.

#### 4·6 `estado-y-memoria` — `es/30-estado-y-memoria.mdx` — adapt, P

- **Quiz (4).** `q-que-decide-el-tamano` a (12–21): 142 312 / 8 788 → re-measured.
  `q-conversacion-nueva` a (22–31; «Marta es vegetariana…», free), `q-recuperable` [a,d] (32–42),
  `q-desactualizada` a (43–52; «aceitunas»): hold.
- **`<Explorable>` `context-window` preset `agente`** (109): no text; the prose walks it (104–126:
  3 280, 2 440, 3 584, 4 840, 1 536, the author's round sizes, which stay).
- **`<PyCell>` 210–246** (`guionizado.py`, `entorno.py`, `harness.py`, `bpe.py`, merges, corpus):
  quoted 248–252 (the tools 849 tokens; M 142 453, of which 142 312 is the read; 8 924 for the
  search). **Measured.**
- **`<PyCell>` 262–295** (two requests, olives added by hand): 297–300 (both M end at 13 messages).
- **`<W>`: 8**; the corpus's names on 2 lines (205, 226). **`reading`**: 3, `lang: en`.

#### 4·7 `proyecto-agente-guionizado` — `es/31-proyecto-agente-guionizado.mdx` — adapt, P (scripted)

- **Quiz (3), all hold**: `q-observaciones-a-mano` a, `q-bloque-siguiente` a, `q-bateria-que-pasa`
  `boolean` false (12–36).
- **`<CodeChallenge>` `ch-test-que-falta`** (38–210): all four modules, 3 tests.
- **`<Explorable>` `agent-loop-trace` preset `proyecto`** (257): «Añade a lista.txt lo que falta para
  la tortilla.» (250); `recetas/tortilla-de-patatas.txt` missing (`t1`), a schema error (`t2`), the
  refused note (`t7`), 259–261.
- **Fence 276–278**: `agente(modelo, pedido, entorno, tope=10) -> (motivo, texto, M)`.
- **`<PyCell>` 347–385** (all four modules; `agente`): 387–390 (5 turns, 11 messages; the observations
  equal the hand-written ones character for character).
- **`<PyCell>` 399–445** (`probar`, three tests with hand-written observations) and **458–492** (four
  broken harnesses): 449, 497–504.
- **`<W>`: 7.** **`reading`**: 2, `lang: en`.

## Assets this block builds

| Asset | Built by | Consumed by |
|---|---|---|
| `agente-piezas.en.svg` | 4·1 | 4·1 |
| `entorno.en.py` + assets-test block | 4·2 | 4·3–4·7, the English companion repo |
| English `agent-loop-trace` presets in `math/agent-trace-presets.ts` (`default`, then `proyecto`), picked per locale | 4·3, 4·7 | 4·3, 4·7 |
| `harness.en.py` + assets-test block | 4·4 | 4·5–4·7 |
| `permisos.en.py` + assets-test block | 4·5 | 4·7, the English companion repo |
| ~~English `agente` preset labels in `math/context-window.ts`~~ — none needed (P3-00): the preset holds no text | — | — |

The four `SPANISH_BOUND_CORPORA` entries this block owns (`agent-loop-trace`,
`courses/llm-agents/entorno.py`, `…/harness.py`, `…/permisos.py`) leave the list in the PR that
builds their English sibling.

## Lesson progress

- [ ] 4·1 `de-chat-a-agente`
- [ ] 4·2 `llamar-herramientas`
- [ ] 4·3 `el-bucle`
- [ ] 4·4 `errores-como-observaciones`
- [ ] 4·5 `permisos-y-confianza`
- [ ] 4·6 `estado-y-memoria`
- [ ] 4·7 `proyecto-agente-guionizado`

## The environment, decided once, in 4·2

Every later lesson in this block, and Block 5's first, reads the files 4·2 puts in the environment.
Choose the English environment **for the properties the block needs, not as a translation of the
Spanish one**: a folder listing that fixes how many turns the loop takes (4·3), a file that does
not exist (4·4's error), a file the scripted user may change and others it may not (4·5), a file
whose content carries an instruction (4·5's injection), and enough material that the seventh call
is crowded (4·6). Record the chosen tree here, and keep `entorno.en.py` byte-for-byte equal to the
English lesson's cells (the assets test enforces it, exactly as for Spanish).

## Decisions fixed by a translated lesson

*Empty until the first lesson lands.*

## Acceptance criteria

- [ ] Every lesson under `content/courses/llm-agents/en/`, `draft: false`; ids identical
- [ ] `entorno.en.py`, `harness.en.py`, `permisos.en.py` each equal their English lesson's cells, as
      the Spanish files equal theirs; `parity-en.py` covers all three
- [ ] Both `agent-loop-trace` presets render in English on `/en`, with their properties asserted in
      the widget's data test; the entry leaves `SPANISH_BOUND_CORPORA`
- [ ] Every challenge's assertion messages, starters and explanation in English; every test name too
- [ ] `agente-piezas.en.svg` measured inside its `viewBox`
- [ ] Two-reader test against the English neighbours; `pnpm lint:content` clean; `pnpm build` green

## Test plan

- Per lesson: `lint:content`, every cell and challenge in the browser, desktop and phone.
- After 4·5: load the three English modules in one cell in the order the project loads them, and
  run 4·7's scripted session; every observation printed must be English.
- `pnpm test` for the assets and the widget data tests.

## Gotchas

- **The modules are loaded in order and depend on each other's names** (`harness` after `entorno`,
  `permisos` after both). A name changed in 4·2 after 4·4 is written breaks 4·4's frozen file
  silently until a later cell runs it. Fix names in P3-03, not here.
- **The scripted model's replies reference the environment by path.** A file renamed in
  `entorno.en.py` must be renamed in every script that names it (3·1's class, 4·3's and 4·7's
  presets).
- **The injection must stay plainly malicious and plainly data.** Translating it into English
  that reads like an ordinary note defeats 4·5.

## Out of scope

- The companion repository (Block 5). Its `entorno.py` and `permisos.py` descend from this block's
  modules; the `en` branch of the repo starts from the English ones (P3-08).

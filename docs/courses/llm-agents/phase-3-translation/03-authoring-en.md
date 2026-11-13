# P3-03 — `llm-agents/AUTHORING.en.md`: glossary, identifier map, terminal form

**Tag:** `COURSE-C2-P3-03` · **Size:** M · **Status:** not started

## TL;DR

Write this course's English delta, the third member of the mechanism `docs/courses/README.md`
describes: the shared `AUTHORING.md`, then `llm-agents/AUTHORING.md`, then the language delta
`AUTHORING.en.md`, then **this file** for what is both this course's *and* English's. Three
sections: the English glossary of the course's terms, the **identifier map** every frozen module
and the companion repository use, and the English rules of the terminal form. The identifier table
is written first, because P3-02 needs it.

## Context

`AUTHORING.en.md`'s header already reserves the slot: "a second course's glossary is written beside
its own delta when its lessons are translated". `llm-agents/AUTHORING.md` §4 holds ~160 terminology
rows, written lesson by lesson, and almost every one is shaped by Spanish:

- **The "Not" column bans English words** as anglicisms: *tool*, *response*, *observation*, *system
  prompt*, *merge*, *encode*. In English those are the terms. What the English column must ban
  instead is the **synonym drift** the Spanish rows were really preventing: *function call* and
  *invocation* for a call, *output* and *completion* for a response, *iteration* and *round* for a
  turn.
- **The italics rule inverts.** Spanish italicises *harness*, *sandbox*, *prompt*, *checkpoint*,
  *batch* as anglicisms on first use. In English they are plain words, and `AUTHORING.en.md` §1
  already moved italics' job (a) to "a term of art on first use".
- **The collisions survive translation, and one gets worse.** The Spanish table separates `ventana`
  (training) from `ventana` (context), and `llamada` (to the model, Blocks 2–3) from `llamada` (the
  model's, Block 4 on). English *window* and *call* collide the same way. And `paso` splits three
  ways: the training step (`Adam.paso`), the first course's model-as-function `paso` in
  `genera(paso, go, eos, max_pasos)`, and *step* as the prose word the `turno` row keeps out of the
  loop.

And the terms are the **identifiers**. `turno`, `llamada`, `observación`, `entorno`, `permiso`,
`codificar` are function names, variables and dictionary keys in seven frozen modules and in the
companion repository, from Block 1 to Block 5. In `dl-nlp` a glossary row could be added the day a
lesson needed it. Here, a name chosen in 1·2 is still being typed in 5·9, so the map is fixed up
front.

## Files affected

| File | Change |
|---|---|
| `docs/courses/llm-agents/AUTHORING.en.md` | **new** — the delta |
| `docs/courses/llm-agents/AUTHORING.md` | one pointer line at the top |
| `docs/courses/README.md` | the "which file governs" order gains the fourth file |
| `.claude/commands/course-translate.md` | step 2 reads the course's English delta when it exists |

## The change

### 1. The identifier map — first, before P3-02

One table per frozen module, plus the companion repo's file names. Every **public** name a lesson
or another module uses: functions, classes, methods, module-level constants, dictionary keys the
model or the student sees (`"turno"`, `"herramienta"`), checkpoint JSON keys, and the names of
files the student creates. Local variables are the lessons' business and are not listed.

The rules the table follows:

- **The English term of art where one exists**, and the one the protocol uses where the protocol
  names it: `tool_use`, `tool_result`, `input_schema` are already English and do not move.
- **en-GB for words the course owns** (`normalise`), **source spelling for names it does not**
  (`np.random.normal`, `json.loads`).
- **Agree with `dl-nlp`'s English.** This course picks up the first course's code by name. `dl-nlp`
  `en/25` already writes `generate(n, seed)`. And 1·1's opening quotes `genera(paso, go, eos,
  max_pasos)` from `dl-nlp`'s `proyecto-transformer` (5.9), which is **not yet translated**. The
  English name of `paso` must be the one `dl-nlp`'s 5.9 picks. See the sequencing constraint below.
- **A collision is resolved in the name, not left to the prose.** If *window* names both, then
  `windows()` (training) needs a qualifier the prose always uses, or a different identifier.
  Decide it here.

A planning-pass seed, to be completed against P3-00's list of identifiers the prose names:

| Module | Spanish | English (proposed) |
|---|---|---|
| `bpe` | `quitar_cabecera`, `pares`, `fusionar`, `entrenar`, `codificar`, `decodificar`, `vocabulario`, `N_BYTES` | `strip_header`, `pairs`, `merge`, `train`, `encode`, `decode`, `vocabulary`, `N_BYTES` |
| `minigpt` | `MiniGPT`, `adelante`, `perdida`, `atencion`, `ffn`, `*_atras`, `generar`, `guardar`, `cargar`, `muestrear`, `ventanas`, `Adam.paso`, `n_parametros`; JSON `config.n_capas`, `pesos` | `MiniGPT`, `forward`, `loss`, `attention`, `ffn`, `*_backward`, `generate`, `save`, `load`, `sample`, `windows` (?), `Adam.step`, `n_parameters`; JSON `config.n_layers`, `weights` |
| `modelo` | `modelo(prompt) -> texto`, `parar` | `model(prompt) -> text`, `stop` |
| `guionizado` | the class and its `guion` | `scripted` / `script` — decide against the `guion` ↔ *script* (a Python file) collision |
| `entorno` | `ENTORNO`, `HERRAMIENTAS`, the four tools, `muestra` | `ENVIRONMENT`, `TOOLS`, … |
| `harness` | `leer`, `error`, `ejecutar`, `bucle` | `read`, `error`, `execute` / `run` (?), `loop` |
| `permisos` | `CLASES`, `permiso`, `preguntar`, `ejecutar` | `CLASSES`, `permission`, `ask`, … |
| companion repo | `bucle.py`, `protocolo.py`, `compactar.py`, `subagente.py`, `correr.py`, `medir.py`, `AGENTE.md`, `banco/`, `pedido.txt`, `evaluador.py`, `solucion/` | `loop.py`, `protocol.py`, `compact.py`, `subagent.py`, `run.py`, `measure.py`, `AGENT.md`, `bench/`, `request.txt`, `grader.py`, `solution/` |

The question marks are the collisions to settle, not slips: `ejecutar` (run a tool call) against
`correr.py` (run the agent) and against *run* as the noun lesson 39 counts; `windows` against the
context window.

### 2. The glossary

Every row of `llm-agents/AUTHORING.md` §4, in English, **preserving the distinctions and replacing
the "Not" column** as described above. Group it as the Spanish one is: the `model` / `harness` /
`agent` split first, because it is this course's counterpart of the first course's `model` /
`neural network` / `system` split, then the table.

Two rows need a sentence and not just a word:

- **`turno` / `llamada`.** English *turn* is also a chat turn (a user message and its reply), which
  is close to, but not, the Spanish `turno` (one model call and everything the harness does until
  the next). Say which one the course means, once.
- **`respuesta`.** *Response* is also the HTTP response in Block 5's `urllib` code. The protocol's
  `response` object and the model's `respuesta` are the same thing there, which is lucky; say so,
  so a later lesson does not "fix" it.

### 3. The terminal form in English

Replaces nothing in `llm-agents/AUTHORING.md` §1's Block 5 rules; adds what English changes:

- **Transcripts are measured, never translated.** A quoted model reply, a token count, a timing or
  a failure is copied from an English run of the English code, with the run's date and the pinned
  versions in the block md. A Spanish transcript with its words swapped is a fabricated
  measurement.
- **The opening `<Callout>`** pins the same chain as the Spanish lesson (Ollama version, model tag,
  `Modelfile`); its words are translated, its versions are not.
- **`<RepoLink>` tags** are the `en` branch's: `en-b5-l1` … `en-b5-l9` in `agente-minimo` (D1).
  The tag is the one thing in a Block 5 lesson that differs across locales by design; P3-01's
  lint keeps it honest.
- **The model's language is not a finding in English.** Where a Spanish lesson reports the model
  switching language, the English lesson reports the failure its own run produced instead
  (5·2 and 5·4 are the known cases; P3-00 may find more).

### 4. The two-reader test across the course boundary

`AUTHORING.en.md` §8's two-reader test runs against the English neighbours. For 1·1 the previous
lesson is `dl-nlp`'s last English lesson, `fine-tuning-colab`. When it exists, 1·1's pickup is
written against it. Until then, write against `dl-nlp`'s Spanish closing and record in the
Block 1 md that 1·1 must be re-read once it lands.

## Sequencing constraint — `dl-nlp`'s Block 5

`dl-nlp`'s P11-08 has 5.6–5.11 open. Three of them are named across the course boundary: 5.9
`proyecto-transformer` (3 references, and the `genera(paso, …)` code 1·1 quotes), 5.10 `bert-y-gpt`
(4) and 5.11 `fine-tuning-colab` (1, and the course hand-off). **Finish `dl-nlp`'s P11-08 before
this course's Block 1**, or at least 5.9, and take `paso`'s English name from it. The `<Leccion>`
fallback will render the other two «In Spanish» correctly in the meantime; the code name cannot
fall back.

## Acceptance criteria

- [ ] The identifier table covers every public name of the seven modules and every file in the
      companion repository's `b5-l9` tag; every collision is decided, with the reason
- [ ] `paso`'s English name agrees with `dl-nlp`'s English 5.9
- [ ] The glossary carries every row of `llm-agents/AUTHORING.md` §4, distinctions preserved, "Not"
      column rewritten for English synonym drift
- [ ] The terminal-form rules are stated, including "transcripts are measured, never translated"
- [ ] The governing order is updated in `docs/courses/README.md`; `/course-translate` reads the file
- [ ] The file says what it does **not** replace, by pointer, and is under 300 lines plus the two
      tables

## Test plan

None — documentation. The check is P3-02: `bpe.en.py` and `minigpt.en.py` are written from the
table alone, with no name decided on the spot. Any gap found there is fixed here first.

## Gotchas

- **Don't translate the protocol.** `tool_use`, `tool_result`, `input_schema`, `stop_reason`,
  `role: "user"` are the Messages format, already English, and part of 5·2's argument (`es/33`) is
  that the Spanish code translates roles *into* them. In English that translation step disappears,
  and 33's argument has to find its point elsewhere (it is classed rewrite).
- **`AGENT.md` is a file name the model reads.** It is in the system prompt's instructions and in
  `banco/`'s tasks; renaming it changes what the model is told. Decide it once, here.
- **Do not restate `llm-agents/AUTHORING.md`.** The two shapes of a lesson, the "every lesson names
  its model" rule and the product-name rule apply unchanged; point at them.

## Out of scope

- Writing any module (P3-02 writes two; the lessons write the rest).
- Changing a Spanish identifier or a Spanish glossary row.

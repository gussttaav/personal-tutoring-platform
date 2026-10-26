# AUTHORING.md — the `llm-agents` delta

**Tag:** `COURSE-C2-P0-04` · Delta on [`../AUTHORING.md`](../AUTHORING.md) · Notation:
[NOTATION.md](NOTATION.md) (this course's symbol tables) on [`../NOTATION.md`](../NOTATION.md) ·
Template: [`content/courses/llm-agents/_template.mdx`](../../../content/courses/llm-agents/_template.mdx)

**The shared [AUTHORING.md](../AUTHORING.md) governs an `llm-agents` lesson exactly as it governs
a `dl-nlp` one, except where this file replaces it, section by section.** Read that file first;
this one is useless on its own and is deliberately too short to be read instead. Section numbers
below are the shared file's. The block task md (`phase-1-content/0N-block-N-….md`) comes after
both, and its header — course, **shape**, **runs on**, publication — decides which half of this
file applies to the lesson in hand.

A delta and not a fork, for the reason [`../AUTHORING.en.md`](../AUTHORING.en.md) gives. Most of
the shared file is about *any* lesson: the bridge, the budget, the voice, the marks, the
frontmatter, the checklist. What this course does differently is that half of it has **no
derivation** — Blocks 4 and 5 have a contract, a protocol, an algorithm — and the shared §1 step 3
was rewritten for exactly that (*the precise statement*). Everything that follows from it here is
the table in §1 below; the rest of this file is the vocabulary and the three rules a course of two
shapes needs and a course of one did not.

| Where | What is replaced |
|---|---|
| §1, steps 4 and 5 | Their **form**, per block — the two-shapes table. The six steps, their order, the bridge rules and the never-a-heading rule are unchanged |
| §2, what a lesson may assume | This course's prerequisites — the first course included — and the rule that a `dl-nlp` result is *cited*, never re-derived |
| §5, terminology | This course's table, seeded below and filled lesson by lesson |
| §6, `hasCode` · `minutes` | A Block 5 lesson is `hasCode: false`; its `minutes` excludes model wait time and the lesson says so |
| — (added) | Every lesson names the `modelo` it runs on · the product-name rule · the density announcement |

Everything else applies verbatim; §7 at the bottom names the parts most likely to be re-litigated.

---

## 1. The two shapes of a lesson (§1)

The six steps are the same six, in the same order, for every lesson of this course. What changes
between a block that derives and a block that builds is the **form** steps 3, 4 and 5 take — and
step 3's form is already the shared rule (an equation, an interface, or an algorithm). The block
task md's `Shape:` line says which column a lesson is in.

| Step | Derivation lesson (Blocks 1–2, most of 3) | Systems lesson (Block 4, Block 5) |
|---|---|---|
| Motivación | the question | the question — often «why isn't this obvious?» |
| Intuición | pictures, a widget | a trace: what happens, turn by turn (`agent-loop-trace`, `context-window`) |
| Formalización | the equations, derived | the interface or the algorithm, stated; its invariants named |
| Implementación | `<PyCell>`, NumPy | `<PyCell>` on the scripted model (Block 4) · fenced code + `<RepoLink>` (Block 5) |
| Verificación | quiz + challenge | quiz + challenge (Block 4) · quiz + a **run the student reproduces** with expected output shown (Block 5) |
| Puente | the next lesson's question | the next layer's need — what breaks without it |

The `lint:content` check on step names as headings applies to both; so does «two to four `##`
headings, all describing content».

**A systems lesson is not a lesson with fewer steps.** It is the same six, and the one that gets
skipped when nobody is looking is the third: with no equation to write, the temptation is to go
from the trace straight to the code, and a lesson that does that is a tutorial — the reader has
seen *what* the loop does and has never been told what it *promises*. The test for a systems
lesson's step 3 is the shared one, **after it the reader could implement the thing without reading
step 4**, and two things fail it: a paragraph describing what the code below «basically does», and
an interface with a signature but no contract. `editar(ruta, antiguo, nuevo)` is a signature;
*«`antiguo` must match exactly once, or the call fails and nothing is written»* is the contract,
and it is the lesson. Name the invariants: what the loop guarantees at every turn, what a
compaction never drops, what the sandbox never lets through.

**Intuition in a systems lesson is a trace**, not a picture: what happens, turn by turn, before
any of it is named — the shape `agent-loop-trace` and `context-window` render, and the shape the
prose takes when there is no widget. It replaces the explorable, not the step.

### The density falls along the course, and the openers say so

Mathematical density is high in Blocks 1–2, medium in 3, low in 4 and engineering in 5 — on
purpose, and the title says as much. It is honest as long as it is announced and a betrayal if the
student discovers it at lesson 30. So the manifest's FAQ says it, and **the first lesson of Block
4 and the first lesson of Block 5 say it in their opening**, in one clause: «este bloque no
introduce matemáticas nuevas» is a statement about the block, made where the block starts.

### Block 5: the terminal form

Block 5 does not run in the browser. Its lessons show code the student types into a repository on
their own machine and runs against a local model, and four things follow, all of them checked by
the block's task md:

- **The lesson opens on a `<Callout>`** that pins the runner version and the model tag the lesson
  was verified on, says the code does not run in the browser, and says that the reading estimate
  excludes the time the student spends waiting for the model. Every lesson of the block, not the
  first one only — lessons are entered from search results.
- **Step 4 is fenced code** — ```` ```python ```` and ```` ```bash ```` blocks — never a `<PyCell>`,
  so `hasCode` is `false` (it means `<PyCell>`; the sidebar's code icon is off for the block, and
  lesson 32 says where the code runs). The step starts on a `<RepoLink>` to the **previous**
  lesson's tag («parte de aquí») and ends on one to its **own** («si te has perdido, este es el
  estado al final de esta lección»). The shared §7 has the component's rules; the one that matters
  while writing is that **the lesson text is the source of truth** and the tag is cut from it at
  review.
- **Step 5 is a quiz plus a run the student reproduces.** The run is a fenced ```` ```bash ```` the
  student types, followed by an expected-output block — the transcript *the author got* on the
  pinned model, kept verbatim: a weaker model calling a tool with a wrong argument is the lesson's
  example, not something to sanitise. The reproduced run stands where a `<CodeChallenge>` would;
  the block has none, because a challenge needs a `<PyCell>` runtime and this block has no
  browser.
- **The budget measures a fenced block like a cell** (shared §3, `longestFence`): 45 lines is the
  target, 90 the ceiling, and past it the fix is to split the block with a paragraph between the
  halves, not to split the lesson. Expected-output blocks count; trim a transcript to the turns the
  prose reads.

Verifying a Block 5 lesson is not `pnpm build`. It is cloning its tag on a clean machine and
reproducing its run on both models (the 8 GB and the 16 GB one), as the block task md's test plan
says; `/course-lesson` step 6 already asks for it.

## 2. Every lesson names the model it runs on (added)

The course's spine is one signature, `modelo(mensajes, herramientas) -> respuesta`, with three
implementations behind it — and the student always knows which one is real and which is
simulated, because **every lesson says which one it is running on**, in prose, before its first
code cell (a Block 5 lesson does it in the opening `<Callout>` above). The block task md's
`Runs on:` line is the source; the lesson's words are these:

| Implementation | Runs in | Blocks | Say |
|---|---|---|---|
| the NumPy mini-GPT the student trains in Block 1, from the pinned checkpoint | the browser (Pyodide) | 1, 2, 3 | «el mini-GPT», «tu mini-GPT del bloque 1» |
| a scripted model: a deterministic Python class that returns pre-authored tool calls | the browser (Pyodide) | 3, 4 | «el modelo guionizado» — the first Block 3 lesson introduces it and says *why* it is scripted (the mini-GPT cannot follow an instrucción, and what the block teaches happens around the model, so a model whose respuesta is known in advance is the honest instrument); the first Block 4 lesson restates the reason in one clause (determinism, testability, isolation from the model's randomness) |
| a real local model, served on the student's machine over the Messages API | the student's terminal | 5 | «un modelo local» — the runner and tag pinned in the callout, never in the prose |
| an open pretrained model, fine-tuned in a Colab notebook | Colab, on a GPU | 2 (the project) | its name and version, «Qwen2.5-0.5B en su versión preentrenada», in prose before the `<ColabLink>` — the Hub commit pinned in the notebook, never in the prose; the publisher's *base* / *instruct* named once, as labels (§4, `modelo preentrenado`) |

The fourth row is not an implementation of `modelo`: Block 2's project trains a real model outside
the browser and never calls it through the signature. It is in the table because the rule is the
same, and because it matters more there — a student who has run every cell for sixteen lessons on
the mini-GPT has to be told, before the link, that this one runs on something else, and where
(`COURSE-C2-P1-02`, lesson 17).

Two consequences. **A lesson never mixes two** without saying so at the switch — the Block 3
lessons that move from the mini-GPT to the scripted model say so in one clause, exactly as the
first course announced a switch of reading for a reused letter. And **the switch from scripted to
real is the payoff of Block 5's first lesson**: nothing in the loop changes, and the lesson says
that, because the injection is the point.

## 3. Prerequisites (§2)

Replaces the shared §2 list. This course's manifest promises three things, and the third is new:

- **El curso anterior, o su equivalente** — a Transformer written from scratch in NumPy;
  attention, backpropagation and cross-entropy are not explained again
- **Python intermedio** — funciones, clases, NumPy; en el último bloque, también ficheros, procesos
  y JSON
- **Una terminal** — saber abrirla, moverte por directorios y ejecutar un script

The first item is what makes this course a continuation and it has one consequence the shared rule
does not spell out: **a result of the first course is cited, never re-derived.** A lesson that
needs the softmax's gradient, the causal mask or the attention formula points at the lesson that
established it — `<Leccion curso="dl-nlp" slug="…">`, the shared §2 rule — and goes on. Repeating
a derivation the reader has done is the returning-reader failure with the sign flipped: it tells
the student the course does not trust the prerequisite it set. What *is* re-stated is the
**conclusion**, in one clause, exactly as a pickup re-states a bridge.

The third item is a prerequisite in the shared file's sense — a thing the student was promised
they would need — and it licenses `git clone`, a shell, a virtual environment and a JSON file in
Block 5 without a paragraph on each. It does not license assuming any *particular* shell or OS:
every Block 5 command is one that runs on the three.

## 4. Terminology (§5) — seeded

Replaces the table in the shared §5; the rule — **one concept, one word, course-wide**, and the row
goes in *before* the lesson that needs it — is unchanged and lives there. This table is a **seed**
(2026-09-16): the eleven object-language words the plan fixed, plus the four the course cannot
open without. A lesson that needs a term not here adds it here first.

### `modelo`, *harness*, `agente`

This course's counterpart of the first course's `modelo` / `red neuronal` / `sistema` split, and
not a redefinition: `modelo` still names the trained artefact. What is new is that the artefact is
held as a **function**, and that two more things sit around it.

| Term | Means | Use it when |
|---|---|---|
| `modelo` | the trained artefact, seen as the function `modelo(mensajes, herramientas) -> respuesta` — whichever of the three implementations is behind it | the claim is about what comes out of one call: text, a tool call, a distribution |
| *harness* | everything around the model that makes it act: the loop, the tools, the prompts, the permissions, compaction | the claim holds for any model behind the interface — «el harness reintenta», «el harness compacta» |
| `agente` | a harness with a model behind it, running against an environment — the program the student ships | the claim is about the whole running thing, or about what the student built |

`red neuronal` is the first course's object and appears here only when a lesson looks *inside* the
model — the KV cache, the logits — and then it is «la red» exactly as before. `sistema` is not
used: the first course spent it on «whatever consumes the representation», and here that reading
has a name, *harness*.

### Spanish or English

Anglicisms are italicised on **first use per lesson**, then plain; never italicise the Spanish
terms. The line is the shared one — whether a Spanish term is genuinely in use among people who do
this work.

| Concept | Use | Not |
|---|---|---|
| a `(nombre, descripción, esquema)` triple the model may ask the harness to run | `herramienta` | *tool* in prose — the protocol's block names, `tool_use` / `tool_result`, stay in backticks as identifiers; `función` (that is the Python one) |
| the model's request that a tool be run: one `tool_use` block, with its arguments | `llamada` (a una herramienta). Blocks 2–3 spent the noun on each time the harness calls the model (lesson 24 counted *llamadas* to retry); from Block 4 lesson 1, which names the switch once, a llamada is the model's, and calls to the model are counted in `turnos`. The verb is unchanged: el harness *llama al modelo*, el modelo *hace llamadas* | *tool call*, *function call*, invocación, petición |
| what the harness hands back to the model after a call — the `tool_result`, an error included | `observación` | *observation*; resultado (names the block, not what it is to the model); respuesta (reserved for the model's) |
| what the model returns to one call: a list of content blocks, text or `tool_use` | `respuesta` — from Block 2 lesson 1 the name of $y$ whether it answers or not, replacing Block 1 lesson 9's «continuación» as the term (the name says what $y$ is asked for, not whether it gets there) | *response*, salida, *completion* — the first course's `genera` completed text; here the model answers |
| one model call and everything the harness does until the next | `turno` | iteración, ronda, paso — `paso` is the first course's forward pass as a function, and Block 1 here inherits it |
| the files, the shell, the repository: everything the tools touch and the model sees only through observations | `entorno` | *environment*, mundo, sistema; contexto (that is what the model *does* see) |
| the harness's decision whether a call runs, per tool class, before it runs | `permiso` | *permission*, autorización, aprobación, confirmación |
| the tokens one call may hold: system prompt, project file, history, observations | `ventana` (de contexto) | *context window*, memoria, límite |
| replacing the middle of the messages list with a summary the model writes when the window fills, keeping the system prompt, the project file and the last $k$ turns verbatim | `compactación`, `compactar` — first named in Block 3 lesson 5, as the alternative to descartar the historial; Block 5 lesson 5 gives it its contract | *compaction*; resumen (names what replaces the middle, not the operation); compresión; truncar (the first course's `truncar` cuts and keeps nothing) |
| the boundary that confines what the tools may touch: paths inside the working directory, an allow-list of commands | *sandbox* | caja de arena, arenero, aislamiento, jaula |
| the same loop with a fresh messages list, given a task, returning a summary the parent sees | `subagente` | *subagent*, agente hijo, hilo, *worker* |
| the message format the harness and the model agree on — the Messages format with its content blocks; MCP for tools | `protocolo` | *API* as a synonym (the API is the endpoint the protocol is spoken to; changing the URL changes neither); formato; estándar |
| the text the harness sends the model as its own voice, and the repository's | *prompt*, `prompt de sistema` · `fichero de proyecto` | *system prompt*; instrucción (that is what the model receives from the user); indicación; the file's name in prose (`<W>AGENTE.md</W>` is a mention, not the term) |
| the pre-softmax output vector of one position, $\mathbf{z}_t$ — what the softmax turns into $p_\theta$ | `logits` (Block 1 lesson 1) | *preactivación de salida* as the term — it is the first course's word for the same object, and the lesson that first writes `logits` names it once, at the collision; puntuaciones; *scores*; *activaciones* |
| the identity $p(x_{1:T}) = \prod_t p(x_t \mid x_{<t})$ | `regla de la cadena` (de la probabilidad) (Block 1 lesson 1) | *factorización autorregresiva* as the term (`autorregresivo` stays as the adjective for the model, as the first course used it); descomposición. The lesson that writes it names the first course's chain rule of derivatives in the same clause, once — same name, nothing else shared |
| a slice of $T + 1$ consecutive tokens of the corpus the model trains on — `ventanas()` in `minigpt.py` | `ventana` (de entrenamiento) (Block 1 lesson 1) | fragmento, tramo, trozo, *chunk*, secuencia (that is any $x_{1:T}$) — and see the collision note below |
| the eight-bit unit UTF-8 writes a character with, one to four per character | `byte`, plural `bytes` — Spanish (DLE), never italicised (Block 1 lesson 2) | octeto |
| one step of BPE training — every occurrence of the most frequent pair of neighbouring tokens replaced by a new token — and the entry it leaves in the merge list | `fusión`, `fusionar` (Block 1 lesson 2) | *merge*; unión, combinación; regla (an entry of the list is «una fusión») |
| a chunk the text is cut into before BPE: a word with its leading space, a number, a run of signs, a run of whitespace — no fusión crosses one | *pre-token* (Block 1 lesson 2) | palabra (a pre-token can be <W>...</W> or a line break), fragmento, trozo |
| text → token ids with a fixed merge list, and back | `codificar`, `decodificar` (Block 1 lesson 2) — the names of the two functions in `bpe.py` | *encode* / *decode*; tokenizar for the direction (the first course's `tokenización` is the whole choice of where to cut, not one of its two directions) |
| one update of $\theta$: a batch, its gradient, and the optimizer's step | `paso` (de entrenamiento) (Block 1 lesson 3) — the first course's word in its descent lesson, and `Adam.paso` in `minigpt.py` | iteración, actualización, *step*. `paso` in backticks is the first course's model-as-function, a Python name; the `turno` row keeps the prose word out of the loop |
| the $B$ windows one step draws at random and follows the mean loss of | *batch* (Block 1 lesson 3), as in the first course | lote (the code comments say it; the prose does not), minilote, *mini-batch* |
| the saved weights a lesson loads: `minigpt.json` | *checkpoint* (Block 1 lesson 3) | punto de control (that is a `<RepoLink>` tag of the companion repository, Block 5), pesos guardados as a term, instantánea |
| a mean updated every step that weighs recent terms more: Adam's $\mathbf{m}_s$ and $\mathbf{v}_s$ | `media móvil` (Block 1 lesson 3) | promedio móvil, *moving average*, EMA; bare `media`, which is the first course's $\mathbb{E}$ and this is not an expectation |
| scaling the gradient down to norm 1 when it exceeds it | `recorte` (del gradiente) (Block 1 lesson 3), the first course's word | *clipping*; truncar (the first course's cutting of a text) |
| $\eta$ as a function of the step | `calendario` (de la tasa de aprendizaje) (Block 1 lesson 3) | *schedule*, programa, planificación |
| its opening stretch, where $\eta$ rises from near zero | `calentamiento` (Block 1 lesson 3), with *warm-up* given once per lesson | *warm-up* as the term, precalentamiento, arranque |
| shrinking every weight by $\eta\lambda$ of itself each step, outside Adam's quotient | `decaimiento de pesos` (Block 1 lesson 3); the W of AdamW is named once as its English initial | *weight decay* in prose; regularización L2 (the coupled version, which under Adam is a different algorithm) |
| drawing the next entry at random, each with the probability a distribution gives it | `muestrear`, `muestreo` (Block 1 lesson 4); one draw is a `sorteo`, `sortear` | *sampling*, samplear, extraer; `elegir` alone (the voraz also chooses) |
| taking the most probable entry at every position | `generación voraz` (Block 1 lesson 4), with *greedy decoding* given once | decodificación voraz (`decodificar` is ids → text, Block 1 lesson 2's), búsqueda voraz, `argmax` as a noun in prose |
| the most probable entry at one position | `favorita` (Block 1 lesson 1) | la ganadora, el máximo, top-1 |
| keeping a prefix of the entries in order of probability (the $k$ first, or the núcleo) and zeroing the rest | `corte`, `cortar` (Block 1 lesson 4); top-k and top-p keep their English names, as the papers and every library do | recorte (the gradient's, Block 1 lesson 3), truncar (the first course's cutting of a text at $T_{\max}$), poda, filtrado |
| the set top-p keeps | `núcleo` (Block 1 lesson 4), with *nucleus sampling* given once | conjunto top-p |
| dividing what a corte keeps by its sum, so that it adds up to 1 again | `renormalizar` (Block 1 lesson 4) | normalizar de nuevo, reescalar |
| the sum of the probabilities of a set of entries | `masa` (Block 1 lesson 4) | peso (that is the network's), probabilidad acumulada as the noun |
| the many entries outside what a corte keeps: each improbable, together not | `cola` (Block 1 lesson 4) | *tail*; resto, fine in passing and never as the term |
| a stretch of generated text that repeats with a fixed period: a cycle of the voraz's deterministic map | `ciclo` (Block 1 lesson 4) | *loop*; `bucle` (that is code: the training loop, `generar`'s loop, Block 4's agent loop); repetición as the term |
| the keys and values of every layer for the positions already read, kept between tokens so that each new token computes only its own row | `caché` (de claves y valores) (Block 1 lesson 5), with *KV cache* given once | memoria (the machine's), búfer, almacén. The `cache` that `adelante` returns in `minigpt.py` is what the backward pass needs: a Python name the prose never borrows |
| the one pass over the prompt that fills the caché before the first token is sampled | *prefill* (Block 1 lesson 5), English, italic on first use per lesson | precarga, prellenado, llenado as the noun (`llenar` is the cell's function, and the verb is free) |
| the last 10 % of the corpus, never trained on: what a loss is measured on | `texto reservado` (Block 1 lesson 3) | *held-out*; validación (it did choose the checkpoint, and lesson 6 says so, but the word names a job, not this text); conjunto de prueba — `prueba` is a third split looked at only at the end, the first course's $D_{\text{prueba}}$ |
| $\exp$ of the mean per-token loss on a text: how many equally likely candidates would cost the same | `perplejidad` (Block 1 lesson 6), symbol $\text{PPL}$ | *perplexity*; confusión; factor de ramificación as the term (a reading of it, said once) |
| the units of a loss taken with $\ln$ and with $\log_2$ | `nat`, `bit`, plurals `nats`, `bits` (Block 1 lesson 6) — Spanish, like `byte`, never italicised | unidad natural, nit |
| $-\log_2$ of a text's probability divided by its bytes | `bits por byte` (Block 1 lesson 6), with *bits per byte* (bpb) given once per lesson | *BPB* in capitals in prose; bits por carácter (UTF-8 characters are not bytes, and the first course's $C$ counted characters); compresión as the term |
| the model that gives every position the same distribution, the training frequencies plus one | `modelo de unigramas` (Block 1 lesson 6) | *unigram model*, modelo unigrama, modelo de frecuencias as the term, modelo de orden cero |
| adding one to every frequency before dividing, so no entry gets probability zero | `suavizado de Laplace` (Block 1 lesson 6) | *smoothing*, *add-one*, alisado |
| a quantity that is a constant times a power of another, $y = a\,x^{-\alpha}$: a straight line on logarithmic axes | `ley de potencia` (Block 1 lesson 7) — the first course's Zipf and Heaps were two, and the lesson says so | *power law*; ley potencial; relación potencial |
| a ley de potencia of the loss in $N$, $D$ or $C$, and by extension the field that fits them | `ley de escala` (Block 1 lesson 7), with *scaling law* given once | ley de escalado, escalamiento |
| the floating-point operations one training spends, $C$ | `cálculo` (Block 1 lesson 7), counted in FLOPs, expanded once per lesson as *floating-point operations* | *compute*; cómputo; coste as the term (`c(t)` is lesson 5's multiplications, and a FLOP is half of one multiplication-and-addition); FLOPS in capitals (that is per second) |
| a $C$ fixed in advance, to be split between parameters and tokens | `presupuesto` (de cálculo) (Block 1 lesson 7) | *budget*; límite, gasto |
| the $(N, D)$ with the lowest loss for a presupuesto, and the relation between the two across presupuestos | `reparto óptimo` (Block 1 lesson 7), with *compute-optimal* given once; `óptimo` alone for a model that sits on it | Chinchilla-óptimo, reparto de Chinchilla as the term (Chinchilla is one model on it) |
| the loss against $N$ with $C$ fixed, $D = C/(6N)$, and its minimum | `valle` and its `fondo` (Block 1 lesson 7), with *IsoFLOP* given once as the paper's name | perfil, curva IsoFLOP as the term, mínimo alone for the picture |
| $\mathcal{L}_{\infty}$: the loss no $N$ and no $D$ go below | `pérdida irreducible` (Block 1 lesson 7); `suelo` is the picture of it, and the lesson says in a clause that the two name one thing | entropía del texto as the term (it is a reading of it, said once), *irreducible loss*, cota |
| one pass of training over all of the training text | `época` (Block 1 lesson 7), the first course's word (`descenso-gradiente`) | *epoch*; pasada, vuelta |
| the tokens of the training text each counted once, against $D$, which counts readings | `tokens distintos` (Block 1 lesson 7) | tokens únicos, texto nuevo as the term, *unique tokens* |
| what a model does when, with $\theta$ fixed, the ejemplos of a tarea in its prompt raise the respuesta that tarea asks for | `aprendizaje en contexto` (Block 1 lesson 8), with *in-context learning* (ICL) given once per lesson | aprendizaje contextual, aprendizaje en el contexto, *few-shot learning* as the term; `aprendizaje` alone, which in this course is $\theta$ moving |
| one solved instance of a tarea written in the prompt, $e_i$ | `ejemplo` (Block 1 lesson 8); *zero-shot*, *one-shot*, *few-shot* are the GPT-3 paper's names for $K = 0$, $1$ and a few, given once | demostración, *shot*, ejemplar, muestra (lesson 4's `muestrear`) |
| what the ejemplos of one document have in common: which respuesta goes with which caso, $\omega$ | `tarea` (Block 1 lesson 8) | *task*; problema, habilidad, capacidad as the term |
| the unsolved input the prompt ends on, $x$ | `caso` (Block 1 lesson 8); what the tarea makes of it is the `respuesta`, $y$ — that row read for one caso: in Block 1 the model's respuesta is text | entrada (a member of $V$), consulta (attention's), pregunta |
| what a function takes and returns, in one line: its name, its parameters with their defaults, and its result | `firma` (Block 1 lesson 9) | *signature*, cabecera, prototipo; interfaz (the firma and its contrato together, a word the course does not need) |
| what a function guarantees whoever calls it, and what it asks of them: its preconditions, what it returns, what it never does | `contrato` (Block 1 lesson 9) — this file's own word in §1 («an interface with a signature but no contract») | *contract*; especificación (Block 3 spends it on the prompt, «el prompt es una especificación»); garantías, promesa as the term |
| the string passed as `parar`: its first appearance in the text generated ends the call, and it is not returned | `cadena de parada` (Block 1 lesson 9), with *stop sequence* given once | secuencia de parada, terminador, delimitador, *stop* |
| throwing the full caché away and filling it again, in one *prefill*, with the last $T_{\text{mín}}$ tokens of the text | `rellenar` (la caché), `relleno` (Block 1 lesson 9) | *refill*; deslizar (what the caché cannot do, and what `generar` does without one); reiniciar, vaciar, recargar |
| training a model to predict raw text, before anything else is trained on it: what Block 1 did to the mini-GPT, named once the block puts other trainings after it | `preentrenamiento`, `preentrenar` (Block 2 lesson 1), the first course's word (`bert-y-gpt`) | *pre-training*; entrenamiento previo. Block 1's lessons say `entrenar` and need no change: they had only one training |
| a prompt that asks for something: a question or an order | `instrucción` (Block 2 lesson 1), the prompt row's «what the model receives from the user» given its own row | *instruction*; orden, consigna as the term. `petición` is fine in passing, for the act of asking |
| what a respuesta does when it does what the instrucción asks, well or badly | `obedecer` (Block 2 lesson 1); the block's shipped title says «seguir instrucciones», and a lesson that needs both says once that they name one thing | `seguir` (una instrucción) in prose: `seguir` is the continuation's verb, «lo que sigue al prompt»; cumplir as the term (fine as the gloss of an orden); acatar; *follow* |
| a respuesta that obeys and is the one whoever wrote the instrucción would choose: correct, useful, in the tone asked for | `buena` (Block 2 lesson 1), the event $\text{buena}$ in `NOTATION.md` | correcta, útil (two of its parts, not the whole); *helpful* |
| one entry of the list `modelo` receives: who wrote it and what it says | `mensaje` (Block 2 lesson 2), the `mensajes` of the course's signature | `turno` (one call plus what the harness does, Block 4's); intervención; entrada (a member of $V$) |
| who wrote a mensaje: the one who deploys the model, the user, the model | `rol` (Block 2 lesson 2): `sistema`, `usuario`, `asistente`; the sistema's contenido is the `prompt de sistema` | papel, *role*; autor (fine in passing) |
| what a mensaje says, the text the plantilla codifica between its two tokens | `contenido` (Block 2 lesson 2) | texto (a mensaje's contenido is text, but `texto` names the corpus, $p_{\text{texto}}$); cuerpo |
| $\pi_\theta$: the model read through the plantilla, as a distribution over whole respuestas to a conversation | `política` (Block 2 lesson 2), with *policy* given once, as reinforcement learning names it | estrategia; distribución de respuestas as the term; modelo (the trained artefact, whatever reading it is put to) |
| the function that writes a list of mensajes as the one token sequence a model reads | `plantilla` (de chat) (Block 2 lesson 2), with *chat template* given once | formato as the name of the function: `formato` is what the plantilla's output has, and what the model learns, in the lesson title's sense; *prompt format* |
| a vocabulary entry `codificar` never produces from text, added for the plantilla: one per rol, and the one that closes a mensaje | `token especial` (Block 2 lesson 2), with *special token* given once; the closing one is `<\|fin\|>`, glossed once per lesson as «el token de fin de mensaje» | marca (the general idea, text or token: «una marca de texto» is the counterexample); símbolo; etiqueta; *control token* |
| the 0 or 1 per token of a conversation that says whether training counts its loss: 1 on every respuesta's contenido and its `<\|fin\|>` | `máscara` (de la pérdida) (Block 2 lesson 2) | peso (the argument of `perdida(X, Y, peso)` in `minigpt.py`, a Python name the prose never borrows); filtro. The first course's `máscara causal` is attention's; a page with both names the one it means |
| continuing to train a pretrained model, from its weights, on a set of pairs $(x, y)$ whose $y$ obeys $x$, with the loss on $y$ only | `ajuste supervisado` (Block 2 lesson 3), with *supervised fine-tuning* (SFT) given once per lesson; the verb is `ajustar`, and `ajuste` the general operation (training on to another text) | *fine-tuning* in prose; afinado, afinar, reentrenar; aprendizaje supervisado as its name (that is any training on labelled examples, next-token prediction included) |
| the probability a model gives a whole set of training data, read as a function of its parameters | `verosimilitud` (Block 2 lesson 3), the first course's word (`funcion-de-perdida`) | *likelihood*; probabilidad as the term (it is one, read as a function of $\theta$) |
| losing what a model could predict on the text it was trained on before, by training it on another | `olvido catastrófico` (Block 2 lesson 3), with *catastrophic forgetting* given once | olvido alone as the term; interferencia; degradación |
| one judgment $(x, y_w, y_l)$: two respuestas to one instrucción and which of the two someone prefers; its two sides | `comparación` (Block 2 lesson 4); the sides are the `preferida` and the `rechazada` | par de preferencia, *preference pair* (`par` is the SFT set's $(x, y)$, Block 2 lesson 3); voto as the term (fine for a raw count, as in the challenge's `votos`); ganadora / perdedora as the terms |
| the person who compares | `anotador`, `anotadora` (Block 2 lesson 4), with *labeler* given once | evaluador (Block 3 spends it on evals and the model that judges), etiquetador, juez, calificador |
| the number Bradley–Terry gives a respuesta, $r(x, y)$, and the network that computes one, $r_\phi$ | `recompensa`, `modelo de recompensa` (Block 2 lesson 4), with *reward model* given once | puntuación, nota (a nota is what a rater writes on their own scale, the lesson's counterexample); premio; *score*; juez, the metaphor (the `anotador` row refuses it too, and Block 3's evals have a model that judges) |
| $r(x, y_A) - r(x, y_B)$: the log of the odds that one respuesta is preferred to the other | `margen` (Block 2 lesson 4) | diferencia alone as the term (fine in passing, and the lesson's first word for it); ventaja (that is the odds, $e^{\text{margen}}$, «tres a uno»); brecha |
| the layer that maps the network's vector to one number in a reward model | `capa lineal` (Block 2 lesson 4), the first course's `capa` | cabeza, *head* (the first course's `cabeza` is an attention head), proyección as the term |
| training a model on the reward its own sampled respuestas receive, rather than on examples of how to respond | `aprendizaje por refuerzo` (Block 2 lesson 5), with *reinforcement learning* given inside the RLHF expansion | refuerzo alone as the term; aprendizaje reforzado; RL in prose (the acronym is only ever written inside RLHF) |
| $\pi_{\text{ref}}$: the frozen model the KL is measured against, which is also where the policy starts | `referencia` (Block 2 lesson 5); `modelo de partida` is the intuition's word for the role, before the term is defined | política de referencia as the term (fine once, in the defining clause); ancla; modelo base |
| $\mathbb{D}_{\text{KL}}$ | `divergencia de Kullback–Leibler` (Block 2 lesson 5), with KL given once per lesson, then `la KL` | entropía relativa; distancia as the term (it is not symmetric, and the lesson says so). «distancia» is the intuition's and the heading's word, and the definition says which distance it is |
| $\nabla_\theta \pi_\theta = \pi_\theta \nabla_\theta \log \pi_\theta$, which turns the gradient of a mean over sampled respuestas into a mean | `truco de la derivada logarítmica` (Block 2 lesson 5), with *log-derivative trick* given once; the estimator built on it is REINFORCE, a proper name (Williams 1992), never expanded or translated | truco del logaritmo; *score function* as the term; gradiente de política as the estimator's name |
| a number per instrucción subtracted from every reward before the estimator: $\kappa(x)$, in the cell the batch's mean | `línea base` (Block 2 lesson 5), with *baseline* given once | ventaja for the reward left after it (that is lesson 4's odds, $e^{\text{margen}}$); *baseline* in prose; referencia (that is $\pi_{\text{ref}}$) |
| subtracting $\beta$ times a respuesta's log ratio from its reward, before the estimator | `descontar`, la recompensa `descontada` (Block 2 lesson 5) | penalizar, recompensa penalizada; castigo |
| a policy raising its reward by exploiting where the reward is wrong, rather than by improving what the reward measures | *reward hacking* (Block 2 lesson 5), English by the shared line, bold italic at its definition | hackeo de la recompensa; trampa; explotación de la recompensa; sobreoptimización as the term (Gao et al.'s name for the measured effect, fine in a reading note) |
| the number $\sigma\big(r(x, y_l) - r(x, y_w)\big)$ that multiplies a comparison's direction in the gradient: the probability still given to the order not chosen | `factor` (Block 2 lesson 4, given its row by lesson 6) | peso (the network's, and `perdida`'s argument, a Python name); *weight* in prose; coeficiente |
| a comparison whose factor has fallen near 0, so that it barely moves the gradient | `apagarse` (Block 2 lesson 6): «la comparación se apaga» | callarse; saturarse (the first course's word for a sigmoid at its flat ends); desaparecer |
| $\sum_y \pi_{\text{ref}}(y \mid x)\, e^{r(x, y)/\beta}$, $Z(x)$: what divides the optimal policy so that it adds up to 1 | `función de partición` (Block 2 lesson 6), with *partition function* given once | constante de normalización as the term (it is what it does, fine as the gloss); normalizador; constante alone (it changes with $x$) |
| $r_\theta(x, y) = \beta \log \frac{\pi_\theta(y \mid x)}{\pi_{\text{ref}}(y \mid x)}$: the reward a policy defines through its reference | `recompensa implícita` (Block 2 lesson 6), with *implicit reward* given once | recompensa oculta, recompensa latente; modelo de recompensa (that is $r_\phi$, a network trained apart: the lesson's claim is that the policy is one, and it says so in those words once) |
| the document that tells anotadores what «better» means, written by whoever trains the model | `guía` (de anotación) (Block 2 lesson 7), with *labeling guidelines* given once | instrucciones (that is the `instrucción` row's: what the model receives); directrices, normas, manual as the term |
| InstructGPT's three criteria for a respuesta: *helpful*, *truthful*, *harmless* | `utilidad`, `veracidad`, `inocuidad` (Block 2 lesson 7) | ayuda; honestidad as the criterion (fine for the CAI principle that says *honest*); seguridad (*safety*, a whole field, out of the block's scope) |
| a written list of the qualities a model must prefer in a respuesta, applied by a model to criticise, revise and compare respuestas; one entry of it | `constitución`, `principio` (Block 2 lesson 7); *Constitutional AI* is the method's proper name, never translated | reglas, normas, código, valores as the term; regla for a principio |
| the two requests of Constitutional AI's first phase: the model says what is wrong with its last respuesta according to a principio, then rewrites it | `crítica`, `revisión` · `criticar`, `revisar` (Block 2 lesson 7) | corrección, corregir as the term (lesson 6's bridge says «critique y corrija» in passing, before the term existed); reescritura (fine as the gloss of revisión) |
| a model that compares two respuestas in place of an anotador | `juez` (Block 2 lesson 7), «un modelo que juzga» in prose; Block 3's evals use the same word for the same object put to measuring: in Block 3 lesson 6 it decides whether one respuesta says the same as the respuesta esperada, an `evaluador` that is a model | evaluador; anotador artificial; modelo de retroalimentación (the CAI paper's *feedback model*); juez for the reward model or the anotador (those rows refuse it) |
| what a model is when it writes what a given source of comparisons prefers; the work of making it so | `alineado` (con), `alineamiento` (Block 2 lesson 7), with *alignment* given once | alineación (a team's line-up); ajustado (that is `ajustar`, SFT's verb); obediente (`obedecer` is lesson 1's, and a model can obey and still not be aligned) |
| a policy that tells whoever asks what they want to hear, agreeing with them where they are wrong, because the comparisons reward it | `complacencia`, `complaciente` (Block 2 lesson 7), with *sycophancy* given once | adulación (flattery is narrower: agreeing with a false belief flatters nobody); servilismo; *sycophancy* in prose |
| a model as its publisher releases it after preentrenamiento and before any ajuste: Qwen's *base*, against its *instruct* | `modelo preentrenado` (Block 2 lesson 8); the publisher's *base* and *instruct* are named once, as labels | modelo base as the term (the `referencia` row refuses it for $\pi_{\text{ref}}$, and a lesson with both would read them as one); modelo fundacional; modelo crudo |
| a Jupyter notebook the student runs in Colab, with a GPU: where a lesson's implementation goes when it does not fit in the browser | `cuaderno` (de Colab) (Block 2 lesson 8), the first course's word (`fine-tuning-colab`) | *notebook*; libreta; script (that is a file the student runs in a terminal, Block 5) |
| what the respuesta to every caso must be: the tarea, its form, what to do in the casos no ejemplo shows; the set of respuestas it admits. A prompt is one way of writing it for the model, not the thing itself | `especificación` (Block 3 lesson 1), the word the `contrato` row reserved for it | requisitos; instrucciones (the `instrucción` row's: what the user asks); contrato (a function's, whose code can be read); *spec* |
| what a respuesta does when it is one the especificación admits; the event $\text{cumple}$ | `cumplir` (una especificación) (Block 3 lesson 1) | obedecer (Block 2 lesson 1's: <W>El martes 20 de octubre.</W> obeys and does not meet a specification that asks for <W>2026-10-20</W>, the lesson's opening case); satisfacer; ajustarse (`ajustar` is SFT's verb); validar |
| the code the harness runs on each respuesta before using it, to decide whether it meets the part of the especificación that needs no reference answer: its form, its allowed values | `comprobación`, `comprobar` (Block 3 lesson 1); `cumple(y)` in the cells | validación (the `texto reservado` row refuses it as a job name); *check*; test; prueba (Block 3's evals spend it on an item with its expected answer, which is what a comprobación does without); verificación |
| the ordered list of (the mensajes it expects, the respuesta it gives) that a scripted model replays; the model | `guion`, `modelo guionizado` (Block 3 lesson 1); `ModeloGuionizado` in the cells | *script*; libreto; *mock*, simulado, falso as the model's name (it is a real implementation of the signature whose respuestas someone wrote, and the lesson says who) |
| one evaluation of the network over the rows it is given: the *prefill* is one, each token written is one more | `pasada` (Block 1 lesson 5, given its row by Block 3 lesson 2) | *forward pass* in prose; paso (the training step, Block 1 lesson 3); llamada (a call to `modelo`, which is many pasadas); `adelante` is the Python name, never the prose word |
| the tokens a model writes between a question and its respuesta, with the intermediate steps | `cadena de pensamiento` (Block 3 lesson 2), with *chain of thought* (CoT) given once per lesson | razonamiento as the term (fine for what the cadena is for, in passing); *scratchpad*; pasos intermedios as the term; pensamiento alone |
| a sequence of rows of the network, each of which enters the computation of the next | `camino` (Block 3 lesson 2) | ruta, trayectoria, recorrido as the term (`recorrido` is fine in the intuition, before the term exists) |
| the most capas one camino crosses in series up to a logit: $L$ in one pasada, $(R + 1)L$ through a cadena · the rows one capa reads side by side | `profundidad` (de un cálculo) · `anchura` (Block 3 lesson 2) | *depth*, *width*; capas as the count (that is $L$, the network's own); niveles; paralelismo for anchura |
| a set of texts, the respuestas a harness can read: what a generación restringida may produce, $\mathcal{G}$ | `gramática` (Block 3 lesson 3); one way of writing one for JSON is an `esquema`, which says which `campos` the object carries and which values each takes (`campo`, not clave: Block 1 lesson 5's caché is of claves y valores) | *grammar*; lenguaje (formal) as the term; formato (what the texts share, as the lesson title says); plantilla (Block 2 lesson 2's chat template) |
| one member of $\mathcal{G}$ | `texto` (de la gramática) (Block 3 lesson 3) | cadena (lesson 19's cadena de pensamiento, and Block 1 lesson 9's cadena de parada is an argument); palabra; frase |
| a respuesta whose text is in $\mathcal{G}$ | `válida` (Block 3 lesson 3) | correcta, buena (Block 2 lesson 1's: a valid respuesta can name the wrong person); que cumple (lesson 18's `cumplir` is the whole especificación, of which a gramática is the part a prefix can see) |
| $A_j$: the entries whose bytes, after what is written, still begin a text of $\mathcal{G}$ | `permitidas` (las entradas permitidas) (Block 3 lesson 3) | válidas (the `válida` row's, for whole respuestas); admitidas; legales |
| setting to $-\infty$ the logits outside $A_j$ before the softmax, at every position | `máscara` (sobre los logits), `enmascarar` · `generación restringida` for generating with one (Block 3 lesson 3), with *constrained decoding* given once as the field's name | decodificación restringida (Block 1 lesson 4: `decodificar` is ids → text, the reason `generación voraz` is not «decodificación voraz»); generación guiada; filtro. Block 2 lesson 2's `máscara` (de la pérdida) and the first course's `máscara causal` are other masks: a page with two names the one it means |
| $p_\theta(y \mid x, \mathcal{G})$: the model's distribution over whole respuestas, cut to $\mathcal{G}$ and renormalised | `condicionada` (la distribución condicionada a $\mathcal{G}$) (Block 3 lesson 3) | restringida (that is the máscara's, and the lesson's claim is that the two differ); filtrada; la del modelo as the term |
| drawing whole respuestas without the máscara and throwing away every one not in $\mathcal{G}$ until one is · one such draw | `muestreo por rechazo` · `intento` (Block 3 lesson 3), with *rejection sampling* given once | rechazo alone as the term (fine once named); reintento (the harness repeating a call that failed its comprobación, lesson 18's); prueba (Block 3's evals) |
| a piece of a corpus that a recuperador returns whole and the harness copies into the prompt: in Block 3 lesson 4's cells, one sentence of the novel | `pasaje` (Block 3 lesson 4) | documento (the first course's $d$, a whole text of a corpus: a pasaje is a piece of one); fragmento, trozo; *chunk* (how to cut a corpus is out of the block's scope); ventana (Block 1's training slice) |
| a vector for a whole text, made so that the cosine can compare two texts: what a recuperador computes for each pasaje and for the question | *embedding* (de un texto) (Block 3 lesson 4). The first course's *embedding* is a row of $\mathbf{E}$, one per entry; the lesson that writes both says in a clause that this one is one per text | vector del documento as the term (the first course's name for TF-IDF's, fine for that one in passing); representación contextual (one position's, the first course's row); codificación (`codificar` is BPE's) |
| finding, for a question, the $k$ pasajes whose *embeddings* have the largest cosine with its own, to write them into the prompt · the component that does it | `recuperación`, `recuperar` · `recuperador` (Block 3 lesson 4), with *retrieval* given once; the method is RAG, expanded once per lesson | búsqueda as the term (fine in passing); extracción; *retriever*. And `recuperar` in its loose sense («recuperemos el modelo reducido», lesson 18) on a page that uses the term |
| one of the parts a harness builds a call from, each entering whole or not at all: the prompt de sistema, an ejemplo, a turno of the historial, a pasaje, the caso | `pieza` (del prompt) (Block 3 lesson 1 named three, lesson 5 the rest) | segmento (the `context-window` widget draws them as segments; the prose never names them so); bloque (the protocol's content blocks, Block 4); parte, trozo, fragmento |
| one element of the content list of a respuesta or a mensaje: `text`, `tool_use` or `tool_result`, with the protocol's English keys | `bloque` (de contenido) (Block 4 lesson 2) | pieza (the prompt's, Block 3); parte, segmento, *content block*. It collides with the syllabus's «bloque 4»: the lesson that defines it names the collision once, in a clause, and a page that needs both says «bloque de contenido» |
| the mensajes of the earlier turnos that the harness sends again in each call: each turno leaves two, the usuario's and the asistente's | `historial` (Block 3 lesson 5) | memoria (the `ventana` row refuses it); conversación as the term (fine for the whole exchange, in passing); contexto (what the model *does* see, which the historial is only part of) |
| the tokens of the ventana kept free for the respuesta: `max_tokens`, since its length is unknown until it is written | `reserva` (Block 3 lesson 5) | margen (Block 2 lesson 4's $r(x, y_A) - r(x, y_B)$); presupuesto (Block 1 lesson 7's $C$, and the lesson's metaphor for the whole ventana); hueco |
| cutting a prompt that does not fit to its last tokens, keeping nothing of what falls off and deciding nothing: what a model does with a prompt longer than its ventana | `truncar`, `truncamiento` (Block 3 lesson 5), the first course's word for cutting a text at $T_{\max}$ | recortar (the gradient's `recorte`); cortar, corte (top-k's, Block 1 lesson 4); `rellenar` (Block 1 lesson 9's refill of the caché, which is how the mini-GPT truncates) |
| leaving a whole pieza out of a call, by a rule the harness states | `descartar` (Block 3 lesson 5) | tirar, quitar (fine in passing); truncar (cuts through a pieza and decides nothing); podar; filtrar |
| the finding that a model uses what sits at the beginning or the end of a long prompt better than what sits in the middle, and the U-shaped curve it draws | *lost in the middle* (Block 3 lesson 5), Liu et al.'s name, glossed once as «perdido en el medio»; the curve is `curva en U` | sesgo de posición as the term (it names any effect of position); efecto de posición serial (the psychology the paper compares it to, named once there) |
| one caso with the respuesta it should get · that respuesta · a list of pruebas a harness is measured on | `prueba` · `respuesta esperada` · `banco de pruebas` (Block 3 lesson 6), with *benchmark* given once | *test*, ítem, ejemplo (Block 1 lesson 8's `ejemplo` sits in the prompt; a prueba is never shown to the model); referencia for the esperada (that is $\pi_{\text{ref}}$, Block 2 lesson 5); *eval*, conjunto de evaluación as the term. The first course's `conjunto de prueba` is a set of pruebas, and the lesson can say so |
| measuring a harness, with its model, on a banco de pruebas · the function that says whether a respuesta acierta a prueba: 1 or 0 | `evaluar`, `evaluación` · `evaluador` (Block 3 lesson 6) | *eval*, *scorer*, puntuador, métrica as the evaluador's name; comprobar (lesson 18's `comprobación` sees the form without a respuesta esperada) |
| what a respuesta does when the evaluador marks it 1 · the fraction of a banco that does | `acertar` · `acierto`, `tasa de acierto` (Block 3 lesson 6), the first course's words, with *accuracy* given once per lesson | precisión, exactitud (both are other metrics in English); `cumplir` (lesson 18's: a respuesta can meet the especificación and get the date wrong) |
| a prueba whose evaluador is code that compares the respuesta with the esperada, as it is or after rewriting both the same way · that rewriting | `prueba exacta` · `normalizar` (la respuesta) (Block 3 lesson 6) | *exact match* as the term (it names the comparison without normalización, one kind of prueba exacta); limpiar; `renormalizar` (Block 1 lesson 4's, a distribution divided by its sum) |
| a rule that, applied to every banco that could have been drawn, gives an interval holding $\mu$ in 95 % of them · the share it actually holds | `intervalo de confianza`, `intervalo` alone after it · `cobertura` (Block 3 lesson 6), with *confidence interval* given once; the two the lesson compares are the `intervalo normal` (Wald's) and the `intervalo de Wilson` | margen de error as the term (fine in passing; `margen` is Block 2 lesson 4's); barras de error (Miller's title, fine in a reading note); the first course's $\text{cob}$ is a vocabulary's coverage, a different quantity that never meets this one |
| measuring the difference of two harness on the same pruebas, prueba by prueba, so that only those where they discrepan count | `comparación emparejada`, `emparejar` (Block 3 lesson 6), with *paired* given once | comparación pareada, por pares; diferencia de medias as the term |
| the fraction of respuestas on which a juez and the hand labels agree · that fraction corrected for what independent evaluadores would agree on | `acuerdo` · `kappa de Cohen` (Block 3 lesson 6) | concordancia (fine in passing); *agreement* in prose; correlación |
| the pruebas of a banco, or their answers, being in the text a model was trained on, so that its acierto measures memory | `contaminación` (Block 3 lesson 6), with *contamination* given once | fuga (*leakage* is wider: any train/test overlap), filtración, memorización as the term (it is what contaminación lets the acierto measure) |

`herramienta`, `llamada` and `observación` are three words on three jobs, and the middle one is
the one to watch: a *llamada* is what the model **asks**, an *observación* is what it **gets**,
and a lesson that says «la herramienta devuelve» has skipped the harness, which is the thing that
actually runs the tool and decides what the model is shown. That order — model asks, harness runs,
model sees — is Block 4's whole subject, and the vocabulary keeps it visible.

`observación` for what comes back, including an error, is the row that does the most work.
*Errors are observations* is a design decision the course makes in Block 4 (a failed call is
shown to the model as a result, not raised past it), and a word that only covered the successful
case — «resultado» — would make that decision read as an exception.

`turno`, not `paso`. The first course's project ends on `paso`, *el modelo hecho función*, and
Block 1 of this course picks that function up by name; a `turno` is one call **plus** what the
harness does with what came back, which is a different unit, and the loop's whole point is that
the two are not the same size. `iteración` is refused for being about the `while` and not about
the conversation.

`compactación`, not «resumen», because the summary is the *instrument*: what the lesson names is
the operation on the messages list, with its invariants (what is kept verbatim, what a compaction
may never drop). A lesson that called the operation «resumir la conversación» would leave the
invariants with nothing to attach to. `truncar` is the first course's word for cutting a text at
$T_{\max}$ and keeping nothing of the tail, which is precisely what compaction does not do.

`ventana` is spent twice, and the two rows name each other. Block 1's `ventana` is a slice of
the corpus the model trains on, $T + 1$ tokens long — the word the checkpoint's own code uses, so
the prose and `ventanas()` agree — while the `ventana (de contexto)` row above is $T_{\text{ctx}}$,
the most tokens one *call* may hold. They are different sizes of the same shape, which is why the
word fits both and why they can be confused. Tolerated on the shared rule: the two meet on one page
first in the KV-cache lesson, which says which is which in a clause, and every Block 4–5 lesson
means the context one and says «de contexto» the first time.

`obedecer`, not `seguir`, although the block is titled «De predecir texto a seguir instrucciones».
The title shipped in the manifest before any Block 2 lesson, and it stays; but in prose `seguir`
has had a job since Block 1 lesson 9, whose contract clause one is «devuelve sólo lo que sigue al
prompt». A sentence that has a model «seguir» an instrucción *and* write «lo que sigue» to it is
two meanings of one verb on one line, and the first lesson of Block 2 needs exactly that sentence:
its claim is that a model which predicts what follows does not thereby obey. So the lesson that
needs both says once that `obedecer` is the title's «seguir instrucciones», and every later lesson
writes `obedecer`. `respuesta` moves the other way: Block 1 called $y$ a «continuación» while it
was one, and from Block 2 on $y$ is a respuesta whether it answers or not, because the block's
subject is the gap between the two.

*harness* and *sandbox* are English by the shared line — nobody who does this work says «arnés»
or «caja de arena» — and both take the italics on first use. *prompt* is English for the same
reason and is already shipped in this course's manifest (a block title, two lesson titles), which
settles it the way `atención` and `cabeza` were settled in the first course: the sidebar says it
before any lesson body does.

### Acronyms

Unchanged from the shared §5 — expand on **first use, in every lesson**, then bare — and this
course has more of them: *aprendizaje por refuerzo con retroalimentación humana (reinforcement
learning from human feedback, RLHF)*, *optimización directa de preferencias (direct preference
optimization, DPO)*, *generación aumentada por recuperación (retrieval-augmented generation,
RAG)*, *proximal policy optimization (PPO)*, *Model Context Protocol (MCP)*, *aprendizaje por refuerzo
con retroalimentación de inteligencia artificial (reinforcement learning from AI feedback,
RLAIF)*, *aprendizaje por refuerzo con recompensas verificables (reinforcement learning with
verifiable rewards, RLVR)*, *group relative policy optimization (GRPO)*. The Spanish expansion
is given where one is in use; where none is (PPO, MCP, GRPO), the English expansion alone, once.

## 5. Product names (added)

«Un agente de programación en la terminal» is the object of Block 5, and **the course never names
it after a product.** Claude Code is the *named example* — in `reading`, in the manifest's FAQ,
and in lesson 39's comparison table, where the real tool is pointed at the same local model and
measured — and nowhere else: never in a heading, a definition, a precise statement, a quiz, a
widget string, or a slug. Product names age in months; a measured comparison is where one earns
its mention, and it is the one place a lesson says the name.

The runner and the model tag are **versions, not the object**: they are pinned in each Block 5
lesson's opening `<Callout>` and in the companion repository's README, and a runner change is a
URL change, never a rewrite — the provider-neutrality decision, which the student's code embodies
by speaking a protocol over `urllib` and `json` with no SDK. The companion repository's own name is
a `<RepoLink>` base URL in one constant and appears in no lesson.

## 6. Frontmatter (§6): `hasCode` and `minutes` in Block 5

Two keys read differently for a terminal lesson, and both are the shared file's meaning applied
honestly rather than a new meaning:

- **`hasCode: false`** for every Block 5 lesson. The flag means «this lesson has a `<PyCell>`» and
  the lint checks it in both directions; fenced code is prose to the pipeline. The reader's code
  icon is therefore off for the whole block, which is correct, and lesson 32 says where the code
  runs instead.
- **`minutes` excludes the model's wait.** The estimate is reading and typing, the way it is
  reading and running everywhere else; a local model on CPU adds minutes the lesson cannot
  predict. Say so in the opening `<Callout>` — not by inflating the number, which would make the
  lint's drift check meaningless for the block.

## 7. What this delta does not replace

Named explicitly, because these are the parts most likely to be re-decided by an author who has
the delta open and not the shared file. All of them apply to an `llm-agents` lesson unchanged:

- **The six-step structure** (§1) and its order, the bridge rules, the two-reader test, and the
  rule that the six are never headings — including in a systems lesson, whose headings describe
  what *this* lesson builds («## El bucle, con el modelo de verdad»), never the step.
- **The budget** (§3): same numbers, both courses. A Block 4 lesson is not exempt from the word
  floor because it has no equations, and a Block 5 lesson is not exempt from the ceiling because
  it has a transcript.
- **The voice** (§5): `tú` for what the student does, `nosotros` only for a derivation — and a
  systems lesson has few of those, so it is nearly all `tú`. The banned families, the five marks,
  the Spanish typography, the display-equation punctuation.
- **What a lesson may assume** (§2), including that a forward reference is signposted out loud.
- **All of [`../NOTATION.md`](../NOTATION.md)** and this course's [NOTATION.md](NOTATION.md).
- **§7 components, §8 MDX/LaTeX gotchas, §9 the end-to-end recipe and §10 the pre-merge
  checklist.** Two checklist rows are the first course's (`entrada` for a member of $V$; the OOV,
  BPE, BPTT examples) and read as examples here, not as rules; nothing else in the list is.

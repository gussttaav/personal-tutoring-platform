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
| a scripted model: a deterministic Python class that returns pre-authored tool calls | the browser (Pyodide) | 3, 4 | «el modelo guionizado» — and the first Block 4 lesson says *why* it is scripted (determinism, testability, isolation from the model's randomness) |
| a real local model, served on the student's machine over the Messages API | the student's terminal | 5 | «un modelo local» — the runner and tag pinned in the callout, never in the prose |

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
| the model's request that a tool be run: one `tool_use` block, with its arguments | `llamada` (a una herramienta) | *tool call*, *function call*, invocación, petición |
| what the harness hands back to the model after a call — the `tool_result`, an error included | `observación` | *observation*; resultado (names the block, not what it is to the model); respuesta (reserved for the model's) |
| what the model returns to one call: a list of content blocks, text or `tool_use` | `respuesta` | *response*, salida, *completion* — the first course's `genera` completed text; here the model answers |
| one model call and everything the harness does until the next | `turno` | iteración, ronda, paso — `paso` is the first course's forward pass as a function, and Block 1 here inherits it |
| the files, the shell, the repository: everything the tools touch and the model sees only through observations | `entorno` | *environment*, mundo, sistema; contexto (that is what the model *does* see) |
| the harness's decision whether a call runs, per tool class, before it runs | `permiso` | *permission*, autorización, aprobación, confirmación |
| the tokens one call may hold: system prompt, project file, history, observations | `ventana` (de contexto) | *context window*, memoria, límite |
| replacing the middle of the messages list with a summary the model writes when the window fills, keeping the system prompt, the project file and the last $k$ turns verbatim | `compactación`, `compactar` | *compaction*; resumen (names what replaces the middle, not the operation); compresión; truncar (the first course's `truncar` cuts and keeps nothing) |
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
RAG)*, *Model Context Protocol (MCP)*. The Spanish expansion is given where one is in use; where
none is (MCP), the English expansion alone, once.

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

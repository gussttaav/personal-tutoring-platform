# AUTHORING.md — the `dl-nlp` delta

**Tag:** `COURSE-C2-P0-04` · Delta on [`../AUTHORING.md`](../AUTHORING.md) · Notation:
[NOTATION.md](NOTATION.md) (this course's symbol tables) on [`../NOTATION.md`](../NOTATION.md) ·
Template: [`content/courses/dl-nlp/_template.mdx`](../../../content/courses/dl-nlp/_template.mdx)

**The shared [AUTHORING.md](../AUTHORING.md) governs a `dl-nlp` lesson exactly as it governs any
other, except where this file replaces it.** Read that file first; this one is useless on its own.
Section numbers below (§2, §5, …) are the shared file's.

This delta exists because the shared file was written *for* this course and carried two things
that are true of it alone: its three prerequisites and its terminology table. They moved here on
2026-09-16, **verbatim**, when the second course got its own delta
([`llm-agents/AUTHORING.md`](../llm-agents/AUTHORING.md)) — so the contract this course is written
against did not change, only the file that holds these two parts of it. The prose below still
says «this course», «Block 2 lesson 1», «the tables below», and it means what it meant: `dl-nlp`.

| Where | What this file holds |
|---|---|
| §2, what a lesson may assume | The three prerequisites, from `course.es.yml` |
| §5, terminology | The `modelo` / `red neuronal` / `sistema` split and the Spanish-or-English table, with the argued rows |

Everything else — the six steps in their default form (a derivation, then a `<PyCell>`), the
bridge rules, the budget, the voice, the five marks, the frontmatter, the components, the
checklist — applies unchanged and is not restated here. Writing in English?
[`../AUTHORING.en.md`](../AUTHORING.en.md) carries this course's English glossary in its §6.

---

## Prerequisites

Replaces the list in the shared §2, which now says only that *the prerequisites are the manifest
of the course you are writing*. For this course, stated in `course.es.yml` and promised to the
student before they paid attention to anything:

- Python intermedio — funciones, clases, NumPy básico
- Álgebra lineal — vectores, matrices, producto matricial
- Cálculo — derivadas parciales y regla de la cadena

The shared §2 argues from this list — *matrices are a prerequisite; weight matrices are not* —
and the argument is the rule; the list is what it is applied to.

## Terminology

Replaces the table in the shared §5, whose rule — **one concept, one word, course-wide**, and add
the row *before* writing the lesson that needs it — is unchanged and lives there. This is the
first course's table, the shape every later course's follows.

#### `modelo`, `red neuronal`, `sistema`

These are not synonyms and must not be swapped freely:

| Term | Means | Use it when |
|---|---|---|
| `red neuronal` (or `la red`) | the neural network specifically | the claim is about a network: its layers, its weights, what it computes |
| `modelo` | the trained artefact, neural or not | the claim is about learning, generalising, being trained, being deployed |
| `sistema` | anything that consumes the representation | the claim holds regardless of what is downstream |

**In Block 1, prefer `modelo` or `sistema`.** Most of what consumes these representations in that
block — bolsa de palabras, TF-IDF, similitud coseno — is not a neural network at all, so
`red neuronal` is both over-specific and a forward reference to Block 2 (see §2). Say `red neuronal`
in Block 1 only when you mean a network and nothing else.

#### Spanish or English

The syllabus already commits to these. Anglicisms are italicised on **first use per lesson**, then
plain. Never italicise the Spanish terms.

| Concept | Use | Not |
|---|---|---|
| *embedding*, *token*, *batch* | the English term | incrustación, ficha, lote |
| atención, auto-atención | Spanish | *attention*, *self-attention* |
| *one-hot encoding*, *multi-head*, *layer norm*, *fine-tuning*, *softmax*, *encoder*, *decoder*, *forward pass* | the English term | any translation |
| *backpropagation* | the English term | retropropagación |
| capa, peso, sesgo | Spanish | layer, weight, bias |
| pérdida, gradiente, descenso de gradiente | Spanish | loss, gradient, gradient descent |
| tasa de aprendizaje | Spanish | *learning rate* |
| entropía cruzada, verosimilitud | Spanish | cross-entropy, likelihood |
| error cuadrático medio, then MSE | Spanish, with the acronym expanded on first use | bare *MSE*; *error medio cuadrático* |
| entrenamiento, entrenar | Spanish | training, entrenar el *training* |
| conjunto de entrenamiento | Spanish | *training set*, datos de entrenamiento, muestra |
| conjunto de prueba | Spanish | *test set*, conjunto de validación, datos de prueba |
| tasa de acierto — and `acertar` for the verb | Spanish | *accuracy*, precisión, exactitud |
| inicialización, inicializar | Spanish | *initialisation*, arranque; `semilla` is the generator's, not the weights' |
| vocabulario, tokenización, subpalabra, bolsa de palabras, codificación posicional | Spanish | vocabulary, tokenisation, subword, bag of words, positional encoding |
| filling the leftover positions of a fixed-length input | *padding* | relleno, acolchado |
| cutting a text at $T_{\max}$ | truncar, truncamiento | recortar, cortar |
| maldición de la dimensionalidad | Spanish | curse of dimensionality |
| denso, disperso | Spanish | *dense*, *sparse* |
| tipo — one distinct entry; *token* / ocurrencia — each appearance of one | `tipo`, `token`, `ocurrencia` | *type*; `token` for both senses |
| an element of the vocabulary $V$ | `entrada del vocabulario`, then `entrada` | palabra, término |
| one case shown to the network, and the answer wanted for it | `ejemplo`, `etiqueta` | muestra, dato, caso; *sample*, *label*, *target* |
| the place an element holds in an ordered sequence | posición | puesto, rango, ranking |
| an LSTM/GRU gate — a coordinate-wise multiplier in $(0,1)$ | compuerta | *gate*, puerta, válvula |
| the three LSTM gates $\mathbf{f}_t$ / $\mathbf{i}_t$ / $\mathbf{o}_t$ | compuerta de olvido / de entrada / de salida | *forget / input / output gate* |
| the two GRU gates $\mathbf{z}_t$ / $\mathbf{r}_t$ | compuerta de actualización / de reset | *update / reset gate*; reset kept untranslated (standard in Spanish ML), never «de reinicio», and as part of the term name it is not italicised |
| the LSTM's second state, the memory the gates guard | estado de celda | *cell state*, celda, memoria de celda |
| the vector a step proposes to write — to the cell in the LSTM ($\tilde{\mathbf{c}}_t$), to the state in the GRU ($\tilde{\mathbf{h}}_t$) | candidato | *candidate*, propuesta |
| the summing route the memory takes from one step to the next — the LSTM cell, or the GRU's convex combination on the state | vía aditiva | camino aditivo, *additive path* |
| $\boldsymbol{\delta}^{(l)}$ — what the loss owes a layer's pre-activation | `error` (de la capa, de la neurona) | delta, señal de error, término de error |
| a network trained to predict what comes next in a text | `modelo de lenguaje` | *language model* |
| the random draw a model makes from its own output distribution, one step of generating | `muestrear`, `muestreo` (*sampling*) | *samplear* |
| asignar un valor a una variable, parámetro o símbolo, en prosa | `asignar a` | `poner en` — «poner en $\varphi$» se lee como insertar algo dentro de un contenedor, no como fijar su valor |
| un experimento breve corrido en una celda de código, cuyo resultado interpreta el texto que sigue | `experimento` | `sonda` — en español designa un instrumento físico (sonda espacial, sonda médica), no un experimento |
| desarrollar un argumento o una fórmula algebraica paso a paso hasta un resultado, sin diferenciar nada | `desarrollar`, `desarrollo` | `derivar`, `derivación` — reservados para la derivada de una función |
| always advancing to the single highest-probability output, deterministically — the alternative to sampling when generating | `voraz`, decodificación voraz (*greedy*) | avara, ávida — «avara» lee como tacaña en español, lo contrario del algoritmo, que siempre toma el máximo |
| a model that maps a source sequence to a target sequence | `modelo de secuencia a secuencia`, apodo *seq2seq* | *sequence-to-sequence* traducido literalmente |
| the fixed vector the encoder hands the decoder in a seq2seq | `vector de contexto` | *context vector*; the per-step attention version keeps the same Spanish name |
| feeding the decoder the true previous token during training, not its own output | *teacher forcing* | any translation — kept in English, and it earns only a brief note (Block 3 lesson 8) |
| pasar un texto de un idioma a otro con un modelo | `traducción automática` | *machine translation* |
| the token that ends a generated sequence | `<EOS>`, glossed once per lesson as «símbolo de fin de secuencia» | *end token*, «símbolo de parada», «marca de fin», FIN |
| the token the decoder is fed at its first position, where there is no previous target token | `<GO>`, glossed once per lesson as «símbolo de arranque» | *start token*, `<BOS>`, «símbolo de inicio», INICIO |
| the decoding search this course does **not** cover, named once so the concession is honest | *beam search* | «búsqueda en haz», «búsqueda por haces» |
| the small network that computes the score $a$ | `modelo de alineación` | red de atención, *alignment model* |
| Bahdanau's score — two projections added, squashed, then read out | `atención aditiva` | *additive attention* |
| Luong's score — the two states multiplied through one matrix | `atención multiplicativa` | *multiplicative attention*, atención por producto |
| the three roles of one attention call | `consulta`, `clave`, `valor` — Spanish, with the English given once per lesson **that writes the letters** (*query*, *key*, *value*), so $\mathbf{Q}$, $\mathbf{K}$ and $\mathbf{V}$ can be read | untranslated *query* / *key* / *value*; «petición», «llave», «contenido» |
| the two-layer network a Transformer block applies to each position on its own | `perceptrón por posiciones` | *feed-forward*, red hacia delante, capa densa, red posicional |
| the decoder sublayer whose queries are the decoder's and whose keys and values are the encoder's | `atención encoder-decoder` | atención cruzada, *cross-attention* |
| the paper's *scaled dot-product* — the whole attention formula, divisor included | `producto interno escalado`, with the English given once per lesson | «producto escalar escalado»; and `producto escalar` still names the operation $\mathbf{q}^{\top}\mathbf{k}$ itself |
| one of the $h$ attentions a multi-head layer runs in parallel | `cabeza` | *head*; «cabezal», «cabecera» |
| the average of a quantity over the randomness assumed of it | `media`, written $\mathbb{E}[\cdot]$ | `esperanza`, `valor esperado`, `promedio` |
| how far a centred quantity typically lands from zero | `desviación típica` | `desviación estándar`; and never the letter $\sigma$, which NOTATION.md §4 reserves |
| how many positions a coordinate of the positional encoding takes to come back round | `longitud de onda` | `periodo`, `frecuencia` — the last one is $\omega_i$, a different number |
| the line that carries a sublayer's input around it and adds it back to its output | `conexión residual`, and `los residuales` for several | *residual connection*, *skip connection*, «atajo», «salto», «puente» |
| training a model against raw text before it is shown any task | `preentrenamiento`, `preentrenar` | *pre-training*, «entrenamiento previo»; the other half of the recipe, *fine-tuning*, stays English |
| the vector the stack produces for one position, which depends on the whole sequence | `representación contextual` | *contextual embedding*, «embedding contextual», «vector contextual» |
| BERT's objective — hide some positions and predict them from both sides | `modelado de lenguaje enmascarado`, with the English given once per lesson (*masked language modelling*, MLM) | «enmascaramiento», «modelo de lenguaje enmascarado», bare MLM |
| the token that replaces a hidden position | `[MASK]`, glossed once per lesson as «la marca que tapa una posición» | any translation — same rule as `<EOS>` and `<GO>` |
| the two mask regimes, as adjectives on a model or an attention | `causal`, `bidireccional` | «unidireccional», «de izquierda a derecha», «no causal» |

The `tipo` / `token` / `ocurrencia` row is a **distinction**, not a translation, and it is the one
place in Block 1 where using one word for two concepts breaks a sentence outright: *el corpus tiene 4 000 tokens y 900 tipos* is
the whole content of "words repeat". Say `tipo` for a distinct string, counted by $M$, and `token`
for a single appearance of one, counted by $T$. Never `token` for both.

`ejemplo` and `etiqueta` are **defined in Block 2 lesson 1**, on the artificial neuron, where the ten
reviews and the verdict a person wrote for each first sit on the same page. That row went in late,
after four lessons had already leaned on both words, and the audit that found it is worth recording
because the damage was not where the word counts pointed. Neither term had ever been introduced:
`etiqueta` first appeared *inside a code cell*, then in prose as though already given, and Block 2
lesson 3's «la etiqueta $y$ vale $1$ si la frase habla bien» fixes an **encoding** without ever
saying what the thing is. Nothing in the course says `supervisado` at all, and neither word is a
course prerequisite — so by §2 every use of them was a debt.

The subtler half is a **sense shift**, and it is the reason the definition is worded the way it is.
Block 2 lesson 4, on the forward pass, makes `ejemplo` mean *a row of $\mathbf{X}$* — input only, no
label in sight; Block 2 lesson 5, on loss functions, needs it to mean *the thing that has a label*
($\ell$ compares one example's prediction against its etiqueta). One word, two concepts, which is
exactly what this section exists to stop. So an **ejemplo is the case shown to the network,
identified with its input vector**, and its **etiqueta rides alongside** rather than being part of
it. Both later uses are then correct as written, which is why the retrofit cost one paragraph in
lesson 1 and no edits anywhere else.

`posición`, never `puesto`. Ordering things and then pointing at the $i$-th one is a move this course
makes constantly — Zipf ranks in Block 1, sequence positions from Block 3 on, sorted vocabularies
everywhere. `puesto` is where a runner finishes: it drags in competition, and it reads as prize-giving
rather than indexing. `rango` is worse, being already taken twice over by *rango de una matriz* and by
the statistical range. `posición` is the only one of the three that means a place in a sequence and
nothing else.

`error` for $\boldsymbol{\delta}^{(l)}$, and the word is **not** being borrowed — it is being kept.
Block 2 lesson 6, on gradient descent, already calls $\hat{y} - y$ «el error» for a network with no
hidden layer, and backpropagation's own recurrence starts at
$\boldsymbol{\delta}^{(L)} = \hat{\mathbf{y}} - \mathbf{y}$: the same quantity, at the same place,
now with a name that survives having layers underneath it. Using a second word for the general case
would tell the reader that lesson 6's error and lesson 8's $\boldsymbol{\delta}$ are two things, and
the whole point is that the first is the last layer of the second. `delta` as a noun in prose («el
delta de la capa 2») is the tempting alternative and is rejected for the reason `puesto` is: it
names the letter rather than the thing, and the letter is already on the page.

The collision to watch is *error cuadrático medio*, two rows up, which is a **fixed compound** and a
different concept — it measures a prediction, it is not the derivative of anything. They never share
a sentence, and a lesson that needs both writes the compound in full and never shortens it to
`error`. Note also that «error» is the concept and $\boldsymbol{\delta}^{(l)}$ is its symbol: prose
says *el error de la capa 2*, maths says $\boldsymbol{\delta}^{(2)}$, and neither is a synonym for
`gradiente`, which stays the general word for a vector of derivatives with respect to anything.

`conjunto de prueba` and `tasa de acierto` arrive together in Block 2 lesson 10, the sentiment
project, because that lesson is the first one that measures anything on examples the network was not
fitted on. `conjunto de validación` is not a synonym and is not in the course: it names a **third**
split, used to choose between models before the test set is touched, and this course never has one —
calling the sixty held-back reviews a validation set would promise a distinction no lesson makes.
`precisión` is the row that matters, and it is banned for the opposite reason to the usual one: it is
not vaguer than *accuracy*, it is a **different metric** (the fraction of the predicted positives that
were right), so a reader who has met both elsewhere would read the wrong quantity. `exactitud` is
free of that collision and rejected only because two Spanish words for one number is the drift this
section exists to stop. Note the shape of the pair: `tasa de acierto` is the quantity,
$\text{acierto}(D)$ is its symbol ([NOTATION.md](NOTATION.md#block-2--el-perceptrón-multicapa)), and
`acertar` is what the network does to one review.

`ocurrencia` is the **same** concept as `token`, licensed for one job: the counting noun when the two
are being contrasted. *La fracción de ocurrencias que cubren esos $k$ tipos* reads; *la fracción de
tokens que cubren esos $k$ tipos* invites the reader to hunt for a difference between "tokens" and
"tipos" that is grammatical rather than conceptual. Outside that contrast, use `token`. And neither
is `palabra`, which stays the everyday word and is never a unit of counting.

`entrada del vocabulario` — the row that every representation lesson leans on, and the one that was
missing longest. From Block 1 lesson 2 the elements of $V$ are whatever $\tau$ produced, so under a
subword tokeniser an entry is a *piece* of a word: <W>dámelo</W> may be three of them. That makes
*una dimensión por palabra* false as written and *una dimensión por entrada* true, and the
difference is not cosmetic — a window of $n$ tokens is not a window of $n$ words, so the $\lvert V
\rvert^{n}$ count in the one-hot lesson is a count over entries or it is wrong. The test is one
question: **would the sentence still have to hold under a subword tokeniser?** If it would, it
cannot say `palabra`.

That leaves three words on three jobs, and they are genuinely three things: `token` is what $\tau$
emits, `tipo` is a distinct string counted by $M$, `entrada` is a member of the vocabulary someone
chose — the same separation [NOTATION.md](../NOTATION.md) already makes when it says $M$ belongs to the
corpus and $\lvert V \rvert$ to the vocabulary built from it. `palabra` keeps exactly one job:
the everyday word inside examples that are literally words. *Entre <W>casa</W> y <W>gato</W> no
existe un punto intermedio* is right, because those are words. **It is the claims that have to be
precise, not the illustrations.**

This row went in after Block 1 lesson 4 rather than before it, against the rule at the end of this
section, and the cost was exactly what that rule predicts: three finished lessons to reread and
correct. What the retrofit found is worth keeping, because it is not what the word counts suggested.
Lesson 2 needed **no term swaps at all** — its thirty-odd *palabras* name a tokenisation *strategy*
(«cortar por palabras», «el vocabulario de palabras no se satura»), which is that lesson's subject,
and replacing them would have broken it. Lesson 3 needed eight, every one of them a *palabra* with a
number attached, in the lesson whose whole topic is that tokens and tipos are counted differently.

So the rule to carry forward is narrower than "avoid `palabra`": **the violation is `palabra` used as
a counted unit**, and a grep is not enough to find it. Lesson 3 also shows where the seam falls —
before $M$ **tipos** is defined, a count has no formal name yet, so it says `cadena distinta` (which
lesson 2 already established) and the definition then names what the reader has been counting. That
is better than either reaching forward to `tipo` or leaving `palabra` in place.

The line is not "English is cooler": it is whether a Spanish term is genuinely in use among people
who do this work. *Capa* and *pérdida* are; *incrustación* and *atención* are not. Where both
circulate — *backpropagation* / *retropropagación* — the course picks one and this table is where
it is picked, because the alternative is that each lesson picks separately. `course.es.yml`'s Block 2
summary said *retropropagación* until this table settled it; the manifest now says
*backpropagation*, matching the syllabus titles and the `backpropagation` slug.

*padding* is English by that criterion, and the two obvious translations are both **already spent
inside this course**, which is the sharper argument. `relleno` is what NumPy puts between the columns
it aligns, in Block 2 lessons 5 and 9 — «un espacio de relleno además del que las separa» — so a
reader meets it as a formatting artefact two blocks before meeting it as an architectural decision.
`acolchado` is upholstery. The other half of the operation goes the other way and is ordinary
Spanish: `truncar` a text at $T_{\max}$, `truncamiento` for the loss. Not `recortar`, and for the
same reason: Block 1 lesson 3 cuts the *vocabulary* at the $k$ most frequent types and Block 2 lesson
5 cuts the *probabilities* before the logarithm, both of them «recorte», and neither is what happens
to a text that ran past the last position. Three cuts on three objects need three verbs or they need
one, and one is not available.

`muestrear`/`muestreo`, for the random draw a model makes from its own output distribution when
generating, collides with two things already on this page and has to stay clear of both. The noun
`muestra` is banned earlier in this table as a synonym for `ejemplo` — a lesson using both must never
let `muestreo` (the action) read as *una muestra* (a training example, which it is not). And Block 1
lesson 7, on Word2Vec, already spends `muestreo` inside a **fixed compound**, «muestreo negativo»
(*negative sampling*): a specific technique for avoiding a full-vocabulary softmax, not the generic
verb. The two never share a page, but a lesson that needed both would write the compound in full and
never shorten it to bare `muestreo`, the same rule this section already gives *error cuadrático medio*.

`asignar a`, not `poner en`, for the moment a symbol or variable is given its value. «Poner en
$\varphi$» reads like placing an object inside a container, not fixing what $\varphi$ equals — an
audit of Blocks 1–3 found the confusion in six lessons, not only as that literal phrase but one
level down: a code cell that «pone un cero en $\boldsymbol{\delta}$» or «pone la etiqueta $1$ en
los ejemplos» is doing the same assignment and deserves the same verb. `asignar a` says exactly
what happens — the symbol receives a value — and nothing is being inserted anywhere.

`experimento`, not `sonda`. Two Block 2 lessons used «sonda» for a short check run in a `<PyCell>`
whose result the prose interprets in the next sentence, and it reads as the physical instrument —
a space probe, a medical probe — because that is the only thing «sonda» means in Spanish outside
this course. Not to be confused with `sondeo`/`sondeo numérico` (a finite-difference gradient
check, e.g. `16-backpropagation.mdx`, `21-bptt.mdx`), which is a different, correct word and stays.

`desarrollar`/`desarrollo`, not `derivar`/`derivación`, for working an algebraic argument step by
step to a result — absorbing a bias into a ratio, proving a transpose identity, building the
reasoning behind a formula — when nothing is being differentiated. The collision is real, not
cosmetic: from Block 2 on, `derivar` names the calculus operation more than 200 times (the chain
rule, backpropagation, gradient descent all lean on it), so reusing the same verb for "work out a
formula" tells the reader nothing about which is meant until the next sentence resolves it. Two
existing uses are a *different* sense again and are correct as written, not candidates for
`desarrollar`: `derivarse de` («se deriva de», "to stem from" — `02-tokenizacion.mdx`, the
trade-off that follows from counting characters) and `derivación` as the linguistic term for
word-formation (`02-tokenizacion.mdx`'s «niñez, aniñado»).

`<EOS>` is a **special token, not a word**, and that is why it is not translated: it is written the
way it appears in a vocabulary file and in every paper the student will read, exactly as Block 1
keeps `<UNK>` rather than inventing a Spanish spelling for it. What it does earn is a gloss — «el
símbolo de fin de secuencia» — once per lesson, on the same first-use rule as an acronym, because a
reader arriving from a search result meets a bare `<EOS>` with nothing to hang it on. The rejected
alternatives all describe the *effect* instead of naming the object: «símbolo de parada» reads as
something outside the vocabulary that halts the loop, which is precisely the misreading Block 4
lesson 1 exists to prevent — the model predicts this token like any other, and the loop stops
because it was predicted.

`<GO>` is the same rule applied to the other end of the sequence, and it is on this table because
the course has been spelling it **only in code** since Block 3 lesson 8 — `ent =
np.concatenate(([GO], y[:-1]))`, three cells across two blocks — while no prose has ever said what
it is. Block 5 lesson 7, on the encoder, the decoder and the masks, is where that stops working: the
decoder's input is the target shifted one position, so position $1$ receives something that is not a
target token at all, and a lesson that cannot name it cannot state the shift. It takes `<EOS>`'s
treatment exactly — a special token, not a word, written the way a vocabulary file writes it,
`<W>\<GO></W>` in prose by [NOTATION.md §6](../NOTATION.md#6-object-language--words-the-lesson-talks-about),
glossed once per lesson. `<BOS>` is what much of the literature writes and is refused for being a
second spelling of a token the course's own cells already spell one way; the Spanish alternatives are
refused for the reason «símbolo de parada» is, one paragraph up.

*beam search* is on this table despite the course never teaching it, and the row is there to stop
the obvious mistranslation rather than to license the topic. Block 4 lesson 1 has to say out loud
that greedy decoding does not maximise the product it decodes — the concession rule above — and a
concession that refuses to name what it is conceding to is not much of one. Named once, in English,
never derived: «búsqueda en haz» circulates in Spanish translations of textbooks but not among
people doing the work, and a reader who only met the Spanish could not search for it.

`atención aditiva` and `atención multiplicativa` name the two scores by **what they do with the
two vectors**, which is the distinction Block 4 lessons 4 and 5 exist to draw: one adds two
projections and squashes the sum, the other multiplies the two states through a single matrix. Both
adjectives are what the literature uses and both are ordinary Spanish, so the row costs nothing;
what it buys is that neither lesson has to name its own subject mid-paragraph. «Atención por
producto» is refused for being a description rather than a term the reader will meet again, and it
would leave the first of the pair with no matching name.

`modelo de alineación` is Bahdanau's own «alignment model», and it names the **network**, not the
mechanism. The separation is the point: `atención` is what the architecture does — mix the states by
weights — while the alignment model is one small multilayer perceptron inside it, whose output is
scored, normalised and then thrown away. «Red de atención» would collapse the two and leave the
block unable to say «la atención se queda, el modelo de alineación cambia», which is precisely what
Block 4 lesson 5 has to say.

`atención` and `auto-atención` are **Spanish**, and this row was wrong until Block 4 lesson 3
went to write the word. It sat in the anglicism row beside *embedding* and *token*, with
«atención» named as the rejected form — against which stands everything the course had
already shipped: `course.es.yml` calls block 4 «El Puente hacia la Atención» and block 5
«Auto-atención, múltiples cabezas y codificación posicional», the syllabus titles two lessons
with it, and the bridges of Block 3 lesson 8 and Block 4 lesson 2 both promise «la atención»
in prose. A lesson body writing *attention* would have put the sidebar, the page title and the
first paragraph in two different languages. The line this section draws is whether a Spanish
term is genuinely in use among people who do this work, and «mecanismo de atención» plainly
is — which is what separates it from *incrustación*, the case the row was really built to
stop. *Attention is All You Need* keeps its English title, being a title; the mechanism it
names does not.

`consulta`, `clave` and `valor` are Spanish, and the row is here to stop drift rather than to
argue a hard case: all three are ordinary words, they are what a Spanish-speaking practitioner
says, and Block 4 lesson 5's bridge already shipped them in prose. What the row adds is the
**gloss**. The symbols the student is about to meet on every page of Block 5 and in the paper —
$\mathbf{Q}$, $\mathbf{K}$, $\mathbf{V}$, $d_k$ — are initials of the English words, so a lesson
that never writes *query* beside `consulta` leaves four letters unexplained. That is the acronym
rule below, applied where the acronym is a single letter: give the English once, in this lesson,
and stay in Spanish afterwards.

**What the gloss is for is the letters, so a lesson with no letters owes nothing.** Block 5 lesson
9, the project, names all three roles in prose — «consultas de $\mathbf{X}^{\text{dec}}$, claves y
valores de $\mathbf{X}^{\text{enc}}$» — and writes $\mathbf{Q}$, $\mathbf{K}$ and $\mathbf{V}$
nowhere, because by then the three projections live inside a function the student calls. Glossing
there would introduce three English words to explain symbols that are not on the page, which is
the acronym rule running backwards. The trigger is the **letters**, not the words.

«Petición» and «llave» are refused for being second names for
objects that already have one, and «contenido» for the value because it says what a value holds
instead of naming the role it plays — the same objection that loses «red de atención» to
`modelo de alineación` two rows up.

`perceptrón por posiciones` is the course's own vocabulary doing a job the paper's name cannot.
*Feed-forward* is what *Attention is All You Need* calls that box, and as a term it says the one
thing about it that is **not** the point — every layer in Blocks 2 and 3 was feed-forward too. What
the box actually is, is Block 2's multilayer perceptron applied to one row at a time with the same
weights in every position, and «por posiciones» is precisely what Block 5 lesson 1 needs said: of
the fifteen boxes in the paper's figure, only the three attention ones look at another position.
So the course names it by what distinguishes it. «Capa densa» is refused for naming an
implementation detail no lesson introduces, and «red posicional» for colliding with
`codificación posicional`, a different object two boxes away.

`atención encoder-decoder` is the paper's own name, kept for the reason $\mathbf{W}_a$ keeps
Luong's letter: this block exists so the student can go and read the sources. «Atención cruzada»
circulates in Spanish and is refused as a **second** name for a thing already named — the drift
this section exists to stop — and it leaves the reader to work out which two things are being
crossed, which is exactly what the encoder/decoder spelling says out loud. It needs no gloss beyond
the ones already given: `encoder` and `decoder` are English by the table above, and the three roles
are Spanish by the row above that.

`producto interno escalado` is the one row in this table that deliberately keeps **two** Spanish
names in play, and it is here to say which is which rather than to license drift. `producto escalar`
is and stays the **operation** — $\mathbf{q}^{\top}\mathbf{k}$, named 51 times across thirteen
lessons from Block 1 lesson 4 on — and nothing about it changes. What needed a name is the
**compound**: the whole formula the paper calls *scaled dot-product*, divisor included. Gluing the
obvious adjective onto the existing term gives «producto escalar escalado», which puts the same root
twice in three words for two unrelated reasons — *escalar* because the result is a scalar, *escalado*
because it is divided by $\sqrt{d_k}$ — so a reader is entitled to think the two are connected. They
are not. «Producto interno» is standard Spanish for the same product, collides with nothing in the
course, and takes the adjective cleanly.

The price is the one this section normally refuses to pay, so it gets paid out loud instead: **the
lesson that uses the compound states in a clause that the two name the same product.** That is the
whole defect two names cause — a reader who cannot tell a synonym from a distinction — and said
plainly there is nothing left to hunt for. It is the move [NOTATION.md](../NOTATION.md) already makes
for $\mathbf{c}$ and $\sigma_{\max}$: a collision is tolerable exactly when the page carrying both
names it. The alternative was a full retrofit to `producto interno` everywhere, and it is refused on
size against benefit — 51 sites in three blocks, to swap one standard term for another.

`cabeza` is Spanish, and the row is here to stop one page being written in two languages rather than
to argue a hard case. `course.es.yml` already summarises block 5 as «Auto-atención, múltiples cabezas
y codificación posicional», so the sidebar says *cabezas* before any lesson body says anything — the
same situation that settled `atención` four rows up, where the manifest, two syllabus titles and two
bridges had all shipped the Spanish while this table still listed it as the rejected form. What the
row adds beyond the choice is the **boundary with the row above it**: *multi-head* stays English as
the name of the **compound** —`atención multi-head`, what the paper calls that layer— while `cabeza`
is the ordinary Spanish noun for one of the $h$ things inside it. That is the split
`producto interno escalado` already makes between an operation and the compound that names it, and
it is what lets one sentence carry both: «la atención multi-head reparte $d_{\text{model}}$ entre sus
$h$ cabezas». «Cabezal» is a part of a machine and «cabecera» is a header; neither is a second name
for anything the course has.

`media` and `desviación típica` arrive in Block 5 lesson 3, which derives the $\sqrt{d_k}$ of the
attention formula and therefore has to say how big a dot product gets. Both are the ordinary Spanish
words and neither is a translation of anything, so the row is here only to stop the drift: `esperanza`
and `valor esperado` are the terms a statistics course would use, and a lesson mixing them with
`media` would invite a reader to hunt for a distinction that this course never makes. `promedio` is
refused for a sharper reason — the lesson computes the bracket **as** an average over $2^{d_k}$ sign
patterns before generalising it, so the two words would name the same operation at two moments of the
same page and read as two operations. One word, both times. The symbol and the ban on $\sigma$ are
[NOTATION.md](NOTATION.md#block-5--el-transformer)'s business, argued there.

`longitud de onda` arrives in Block 5 lesson 5, on codificación posicional, and the row exists
because the lesson quotes that number a dozen times: this coordinate comes back round every $6.28$
positions, that one every $35\,000$. It is the paper's own word — «the wavelengths form a geometric
progression» — and ordinary Spanish besides. `frecuencia` is not a synonym but the **other**
quantity, $\omega_i$, which the lesson also writes, so letting the two swap would put a number and
its reciprocal under one name. `periodo` describes the same thing correctly and is refused for the
reason `promedio` is refused two rows up: two words for one quantity, on the page whose whole first
claim is that these numbers form a ladder.

`conexión residual` is Spanish and the row is here to fix the plural more than the singular. Block 5
lesson 6 names the thing once and then refers to it a dozen times as *los residuales*, which is what
`course.es.yml` and the block plan already say, so the noun has to be a Spanish one or the sidebar
and the paragraph disagree — the same argument that settled `atención` and `cabeza`. The English is
refused for that reason alone, not for being unclear. «Atajo» and «salto» describe the picture
instead of naming the object, and both say the wrong thing about it: nothing is skipped and nothing
jumps, the sublayer runs exactly as it did and its output is **added** to what it was given, which
is the one fact the whole lesson turns on. «Puente» is worse still, being the course's own name for
block 4.

`preentrenamiento` is Spanish and *fine-tuning*, fixed in the English-terms row near the top of
this table, is not — and the split is deliberate rather than an oversight. The line this section draws is whether a Spanish term is
genuinely in use among people who do this work, and the two halves of that recipe answer
differently: *preentrenar un modelo* is what a Spanish-speaking practitioner says, while nobody
says «ajuste fino» out loud — and `course.es.yml`'s own syllabus already titles Block 5 lesson 11
«Fine-tuning en la práctica», so the English half is settled by something already shipped, exactly
as `atención` and `cabeza` were. «Entrenamiento previo» is refused for describing the order of two
things instead of naming one of them: what makes preentrenamiento a concept is that the text it
runs on has nothing to do with the task, not that it happens first.

`representación contextual` is the term Block 1 has been owed since its lesson 8, on GloVe and the
limits of a static table, closed on <W>banco</W> receiving one row of $\mathbf{E}$ for two
sentences. `representación` is already the course's word — Block 1 lesson 1 fixes
$r : V \to \mathbb{R}^{d}$ and every representation lesson since has used it — so the concept
needs an adjective and not a second noun. That is also what rules out «vector contextual»: the
thing that changes is **what $r$ takes as an argument**, and a name built on the output says
nothing about it. *Contextual embedding* is what the literature writes and is refused on the row
above's own logic: *embedding* stays English as the name of the static object, and gluing a Spanish
adjective to it would put one term in two languages.

`modelado de lenguaje enmascarado`, not «modelo de lenguaje enmascarado», and the one-letter
difference is the whole point: the table already spends `modelo de lenguaje` on *a network trained
to predict what comes next in a text*, which is precisely what BERT is not. What the row names is
the **objective** — an activity, hence *modelado* — and keeping the two apart is what lets one
sentence say that BERT is trained by masked language modelling and is not a language model in this
course's sense. The English and the acronym come once per lesson under the rule below, because the
student will meet MLM bare in every paper afterwards.

`[MASK]` takes `<EOS>`'s and `<GO>`'s treatment for `<EOS>`'s and `<GO>`'s reason: it is a special
token written the way a vocabulary file writes it, not a word, so it is not translated and it goes
in `<W>` in prose. Note that the square brackets are BERT's own spelling and the angle brackets are
the sequence tokens' — the course keeps each as its source writes it rather than unifying them,
because a reader who meets one spelling here and the other in the paper would be entitled to think
the difference meant something.

`causal` and `bidireccional` are the two adjectives Block 5 lesson 10 leans on in nearly every
paragraph, and both are ordinary Spanish. «Unidireccional» is the tempting partner for the second
and is refused for being a **third** name for a thing that already has two: the mask of Block 5
lesson 7 and the adjective here. «De izquierda a derecha» describes the reading order and is true,
but it is a phrase rather than a term and cannot modify a noun without a subordinate clause. And
«no causal» is refused for the reason «no lineal» would be if the course had a choice: naming half
the distinction by the absence of the other half makes the maskless case read as the deviation,
when in this lesson it is one of two symmetric answers.

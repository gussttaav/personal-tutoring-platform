# P3-04 — Block 1: From the Transformer to the Language Model

**Tag:** `COURSE-C2-P3-04` · **Size:** L · **Status:** not started
**Depends on:** P3-01 · P3-02 (the English checkpoint) · P3-03 (the identifier map) · `dl-nlp`'s
P11-08 at least through 5.9 (see P3-03's sequencing constraint)
**Course:** `llm-agents` → `content/courses/llm-agents/en/` · **Runs on:** the English mini-GPT
(`minigpt.en.json`), in the browser

## TL;DR

Nine lessons, and the block where the English checkpoint is first put to work: every sample, loss,
perplexity and probability the Spanish lessons quote was printed by the Spanish model, so almost
every lesson is an **adapt with Pyodide re-runs**. Two are rewrites because their argument is about
Spanish itself: 1·2 (UTF-8 bytes, `ñ`, `que` before `qu`) and 1·8 (in-context learning demonstrated
on Spanish gender and number morphology). The block also builds four English assets the later
blocks load: the training-curve figure, the `sampling-explorer` and `kv-cache` presets, and
`modelo.en.py`.

## Why this block is first

It is first in the course, but also first in cost: it is where the identifier map meets real
cells, where the English checkpoint's numbers are first quoted, and where 1·1's pickup crosses the
course boundary into `dl-nlp`'s English closing. A mistake in a name or a convention here repeats
39 times.

## Classification

Filled by [P3-00](00-triage.md) on 2026-11-13, read against the nine `es/` lessons. File number and
`order` coincide in this block: `es/01` … `es/09` are 1·1 … 1·9. Line refs below are into those
files.

**The block holds no transpose.** The planning pass's one transpose, 1·7, is an adapt: its cell
loads nothing, but two of its constants are the checkpoint's. Both rewrites are confirmed. Every
lesson but 1·1 re-runs in Pyodide.

| # | Slug | Class | Re-run | What binds it to Spanish |
|---|---|---|---|---|
| 1·1 | `una-sola-columna` | adapt | — | No cells. Two worked examples are Spanish: «En un lugar de la» → «Mancha» (the *Quijote*'s opening) and the window `la casa es blanca`, whose row 2 argues from «la casa blanca» being a reasonable start. That is false word-for-word in English, so the replacement must keep a plausible-but-wrong favourite. The closing bridge names 1·2's Spanish evidence (`ñ`, `qu`, `ción`). 9 `curso="dl-nlp"` refs, 6 of them to four lessons still Spanish-only |
| 1·2 | `bpe-de-verdad` | **rewrite** | P | Two quiz **questions** are about Spanish: `año`'s bytes (`ñ` = 195, 177) and `que` (merge 16) before `qu` (65) «aunque en español la q siempre va seguida de u». Both cells and the explorable's prose quote the Spanish corpus and merge list |
| 1·3 | `entrenar-un-mini-gpt` | adapt | P | 125 789 training tokens (numeric quiz **32.6**), the training-curve figure with the Spanish log in its alt text, and three cells' output (losses, gradient noise, the no-warm-up blow-up) |
| 1·4 | `muestreo` | adapt | P | Three of five quiz items quote the checkpoint after «La Nela» / «La Nela bajó la cabe» (**6.8**, the 0.30 cycle, `za` at 0.974); `sampling-explorer` is in `SPANISH_BOUND_CORPORA`; two cells |
| 1·5 | `kv-cache` | adapt | P | The lightest P lesson: costs are the model's shape and hold. The generated text after «La Nela» (explorable + cell) and one sentence on a non-word («estrelas») are regenerated |
| 1·6 | `perplejidad` | adapt | P | Every number is the checkpoint's or the corpus's. **The opening hook is a coincidence** (the byte-unigram model and the mini-GPT both pay 3.2 per token) that English will not reproduce, and one quiz item needs held-out bytes the training part never saw. See below |
| 1·7 | `leyes-de-escala` | **adapt** (was transpose) | P | Published figures hold. But the cell hard-codes `distintos = 125_789` and the checkpoint step `1_750`, and its output (160 000 params / 3.1 M tokens; «28 veces y media») and a quiz option quote them |
| 1·8 | `aprendizaje-en-contexto` | **rewrite** | P | The in-context task is Spanish number vs gender (`hijo: hijos` / `hijo: hija`, case `hermano:`), and `q-que-le-falta` asks about «el plural del femenino». The second cell counts the novel's colons, and Spanish dialogue makes them open paragraphs |
| 1·9 | `proyecto-mini-gpt` | adapt | P | The traced call `modelo("La Nela", …)` → « no traf» with its token ids, the « Golfín» tokenizer quirk, the «Dijo que » trailing-space refusal; freezes `modelo.py`. **Quotes `dl-nlp` 5.9's `paso(entrada)` by name** |

**Block totals:** 0 transpose · 7 adapt · 2 rewrite · re-runs P ×8, — ×1.

### What changed from the planning pass

- **1·7 — transpose → adapt.** The row said the mini-GPT point is "$N$ and $D$ only" and holds. It
  holds only if P3-02 keeps the checkpoint at step 1 750. The lesson's own argument, that the
  mini-GPT has the right size and too little text, is quoted from a cell with two of the checkpoint's
  numbers in it: `n, d = 136_448, 1_750 * 32 * 64` and `distintos = 125_789` (326–328). Its output
  (343–358), `q-mini-gpt`'s option (c) (47) and the opening (110–115) all move with the English
  corpus's training-token count. Re-run flag **P** although the cell loads nothing: it has to run
  again with P3-02's constants.
- **1·6 — still adapt, with two hazards the row did not name.** (1) The lesson **opens on a
  coincidence**: «Sobre las mismas páginas reservadas paga $3.20$ por token. La misma cifra» (84–89).
  The byte-unigram model and the mini-GPT pay the same per token, and the lesson builds bits per byte
  to explain why that says nothing. English, with nearly one byte per character and a different
  $\bar{\ell}$, will not land on the same figure twice. The argument survives; the hook has to be
  rebuilt around whatever two numbers the English run prints. (2) `q-probabilidad-cero` (41–51) and
  the `inf` exercise (276–279) need the held-out part to contain bytes the training part never saw.
  In Spanish they are an `Í` from an inscription and Galdós's dating, 10 tokens. **P3-02 should check
  that the English corpus's held-out 10 % has at least one zero-frequency token.** If it has none,
  the quiz item and the exercise are rewritten, and that makes 1·6 a rewrite.
- **1·5 — the row understated it.** The quoted sample sits in the cell output as well as the
  explorable: 483–484 contrasts «estrelas», a non-word, with «personas», a word. The English sample
  needs a non-word the same model wrote.
- **1·9 — the cross-course code name is here, not in 1·1.** The phase README and P3-03 say 1·1
  quotes `genera(paso, go, eos, max_pasos)`. No lesson of this course contains `genera(` or
  `max_pasos`. **1·9** quotes `dl-nlp` 5.9's `paso(entrada)` as «el modelo hecho función» (269–271),
  next to `<W>\<GO></W>`. 1·1 has only `<W>\<GO></W>` (188). The constraint stands: `paso`'s English
  name comes from `dl-nlp`'s English 5.9. It binds 1·9, and 1·1 only through its pickup prose.
- **1·8 — confirmed, and the second cell is Spanish too.** Besides the task, 312–356 counts what
  follows the novel's 204 colons: 95 open a paragraph, «que en *Marianela* es un diálogo», because
  Spanish dialogue opens with a raya. English dialogue uses quotation marks, and the count says
  something different.
- **1·2 — confirmed; the rewrite reaches 1·1.** 1·1's last paragraph (287–289) promises «la ñ, … qu
  y … ción». It is written after 1·2's replacement is chosen.
- **1·1 — 9 `curso="dl-nlp"` refs, as the row said**, counting the one in a quiz explanation (21).
  Six of them land on four lessons `dl-nlp/en/` does not have yet (see below).

### Cross-course references (`curso="dl-nlp"`)

`dl-nlp/en/` holds `01` … `37`. These targets are **not translated yet**, and render «In Spanish» in
the English hover card until `dl-nlp`'s P11-08 lands. That is correct behaviour.

| Lesson | Refs | Not yet in `dl-nlp/en/` |
|---|---|---|
| 1·1 | 9 | `fine-tuning-colab` (71), `bert-y-gpt` (73, 191), `proyecto-transformer` (147), `encoder-decoder-masking` (181, and quiz explanation 21) |
| 1·2 | 2 | — (`tokenizacion`, `vocabulario-oov`) |
| 1·3 | 6 | `proyecto-transformer` (385) |
| 1·5 | 3 | — |
| 1·7 | 3 | — |
| 1·9 | 1 | `proyecto-transformer` (269) — and the **code name** `paso(entrada)` |

1·4, 1·6, 1·8: none. No `<Leccion ancla="">` anywhere in the block.

### Frozen-module identifiers the prose names (for P3-03)

Backticked in prose or quiz text, outside the cells:

- **`bpe.py`**: `codificar`, `decodificar` (1·2, 1·4, 1·9; 1·4 224 argues from the name: «no la
  llamamos decodificación porque `decodificar` ya es pasar de ids a texto», and the English name of
  *decoding* collides the same way), `entrenar` and its `donde` (1·2 348–350), `PATRON` (1·2 quiz
  and challenge).
- **`minigpt.py`**: `ventanas` (1·3), `perdida` (1·3), `Adam` and `paso` (1·3, 1·6), `beta1` /
  `beta2` (1·3 333), `muestrear(z, temperatura, top_k, top_p, rng)` (1·4 310), `generar` (1·4, 1·5,
  1·9), `adelante` (1·4, 1·5), `MiniGPT` (1·9).
- **`modelo.py`** (frozen by 1·9): `modelo`, `red`, `hacer_modelo(red, fusiones)`, `llenar`,
  `avanzar` (named from 1·5 on), and the contract's keywords `max_tokens`, `temperatura`, `top_p`,
  `parar`, `semilla`, plus `T_min`. 1·9 418–419 makes a rename part of the lesson: «`modelo` era el
  objeto `MiniGPT`; desde aquí `modelo` es la función, y el objeto se llama `red`». The map needs two
  English names that keep that distinction.
- 1·8 381 names the signature `modelo(prompt) -> texto` that 1·9 freezes.

### Artifact inventory

#### 1·1 `una-sola-columna` — `es/01-una-sola-columna.mdx` — adapt, —

- **Quiz (4).** `q-que-compra-la-mascara` `multi` [a,d] (12–22), holds; its explanation cites
  `encoder-decoder-masking` (21). `q-fila-t` `single` a (23–33), holds. `q-cadena-exacta` `boolean`
  false (34–39), holds; the explanation says «en español» (38). `q-conjunta` `numeric` **0.0625**
  (40–46): arithmetic on the hand-made table, holds if the replacement window keeps $1/2, 1/4, 1/2$.
- **`<W>`: 27.** «En un lugar de la» / «Mancha» (85–93, 10 `<W>`): needs an English opening the
  reader also finishes before reading it. `la casa es blanca` table (224–261): row 2's argument
  (256) needs a favourite that is a plausible start and is not what came.
- **Prose**: 69–73 quotes `dl-nlp`'s closing words («delante de un artículo que…»), so the English
  quote is `dl-nlp` 5.11's English closing once it exists (P3-03's two-reader note). 116 «no del
  español». Closing bridge 287–289: see 1·2.
- **`<PyCell>` 0, `<CodeChallenge>` 0, `<Explorable>` 0, `<Figure>` 0.** No checkpoint sample.
- **`reading`**: 2, both `lang: en`.

#### 1·2 `bpe-de-verdad` — `es/02-bpe-de-verdad.mdx` — rewrite, P

- **Replacement:** *move the evidence out of Spanish spelling: the two-byte letters come from the
  `bpe-merges` widget's English corpus (`café`, `José`, `naïve`); the `que`/`qu` question becomes
  a frequent English word merged before its own prefix, found in P3-02's printed merge list.*
- **Quiz (4).** `q-bytes-de-ano` `predict-output` `'3 4 [195, 177]'` (12–21): **new question**
  (`año`, `ñ`; the explanation quotes merge 71). `q-que-antes-que-qu` `single` a (22–32): **new
  question** (merges 9 `ue`, 16 `que` with $f = 2\,232$, 65 `qu`). `q-lo-que-garantiza` `multi`
  [a,b,c] (33–44): language-free. `q-bytes-en-el-contexto` `numeric` **138** (45–52): $64 \cdot
  2.16$, re-measured $\bar{\ell}$; the explanation says «una o dos frases de *Marianela*».
- **`<CodeChallenge>` `ch-codificar`** (54–155): loads `bpe-merges.json`, 6 tests; Spanish prompt,
  starter, assertion messages, solution, explanation; identifiers `codificar`, `PATRON`, `pares`,
  `fusionar`.
- **`<Explorable>` `bpe-merges`** (227): has its English corpus already. The prose around it
  (203–231) quotes the **Spanish** widget: «El señor dijo que la canción era pequeña.» = 44 tokens
  (208–209), merge 1 = `ñ` «sale diez veces» (222), merge 17 = `ción` (222–223), 42 bytes → 22 tokens
  (224), and the caption's «Tres frases y 31 fusiones» (227).
- **`<PyCell>` 356–418** (corpus, merge list; trains 64 merges and compares): quoted 351–352
  (302 566 bytes), 420–425 (merges ` d` ` e` ` l`, #5 ` de`, #18 `í`, #32 the raya, $f$ 4 652 → 628,
  #20 the only $a_i = b_i$).
- **`<PyCell>` 433–457** (`bpe.py`, merges, corpus; `ver` on three sentences): quoted 459–469
  (` señor` one token, `ñ` merge 71, `ción` whole, `criptomoneda` eight pieces, `¿` printed as
  `�`, 112 726 vs 50 075 tokens saved, $\bar{\ell}$ 1.00 → 1.59 → 2.16); 491 (139 765 ids).
- Holds: 32 768, 136 448 (the model's shape).
- **`<W>`: 37.** **`reading`**: 3, `lang: en`.

#### 1·3 `entrenar-un-mini-gpt` — `es/03-entrenar-un-mini-gpt.mdx` — adapt, P

- **Quiz (4).** `q-forma-del-batch` `predict-output` (12–21), holds. `q-ruido-y-coste` a (22–32),
  holds. `q-veces-cada-token` `numeric` **32.6** (33–39): re-measured ($S \cdot B \cdot T / N$ with
  the English $N$). `q-primer-paso-de-adam` a (40–50), holds.
- **`<CodeChallenge>` `ch-adamw`** (52–161): loads `minigpt.py`, 4 tests, writes `Adam.paso`;
  language-free maths, Spanish text.
- **`<Figure>` `minigpt-entrenamiento.svg`** (225–229) → `.en.svg` from P3-02's log. Its `alt` quotes
  the Spanish run (6.23, 4, 2.5, 3.2, the checkpoint at step 1 750) and so does the `caption`.
- **`<PyCell>` 393–419** (`bpe.py`, `minigpt.py`, merges, corpus, checkpoint): quoted 421–424 (`X[0]`
  = «Anduvieron b» in eight tokens, `Y` ends in `re`, 6.235 vs 6.238, checkpoint 3.180); also 194
  (3.2), 206–207 (125 789 tokens, 125 700 windows).
- **`<PyCell>` 431–445** (gradient noise at $B$ = 1, 4, 16): quoted 447–448 (540 → 155 → 38).
- **`<PyCell>` 459–487** (continues training on the last 3 000 held-out tokens, «las últimas páginas
  de *Marianela*», 453): quoted 489–499 (3.473 → 3.104, rises at 50, 100, 125; «aprender español»
  492; without warm-up 3.47 → 4.89 in 25 steps; `S_cal = 50`, ≈ step 75, 4.35). Warm Adam up
  (memory: mini-GPT continued training).
- 526: «no, no, no», the greedy cycle 1·4 measures.
- **`<W>`: 6.** **`reading`**: 3, one `lang: es` (168), which stays.

#### 1·4 `muestreo` — `es/04-muestreo.mdx` — adapt, P

- **Quiz (5).** `q-cociente-y-temperatura` `numeric` **6.8** (12–18): ` no` 0.118 / ` es` 0.045
  after «La Nela» → same question on the English context. `q-que-cambia-con-tau` [c,d] (19–29):
  names the context, answer holds. `q-por-que-no-sale` a (30–40): the 0.30 cycle, re-measured.
  `q-cola-en-cincuenta` `numeric` **0.08** (41–47): arithmetic, holds. `q-nucleo-decidido` a (48–58):
  «La Nela bajó la cabe» → `za` 0.974, `da` / `dad` / «cabeda», re-measured on an English
  mid-word context with nearly all mass on one entry.
- **`<CodeChallenge>` `ch-nucleo`** (60–122): no assets, 4 tests, language-free.
- **`<Explorable>` `sampling-explorer`** (169), in `SPANISH_BOUND_CORPORA`. The prose quotes it at
  158–166, 200–201 (`za` ≈ 195 × `da`), 255–256 and 298–301.
- **`<PyCell>` 319–362** (`bpe.py`, `minigpt.py`, merges, checkpoint; prompts «La Nela», «—¿Qué»):
  quoted 364–384 (0.387; nucleus 15 → 44 → 92; top-10 0.852 / 0.502 / 0.252; 1 → 133; greedy «no
  debía decirle.» and the ` no` + comma cycle at 0.30 / 0.24; $1.1 \times 10^{-11}$; 1.26 vs 3.2;
  0.18 → 0.31).
- **`<PyCell>` 391–431** (corpus: share of words found in the novel): quoted 433–441 (38 of 39; 54
  of 70 with «estreglando», «ficill»; 59 of 73; at $\tau = 1.5$ 49 of 70, «lapacuma»; at 0.5 78 of
  83). `PALABRA` is `[^\W\d_]+` (395), Unicode letters, and works on English unchanged.
- **`<W>`: 27**; the corpus's names on 12 lines. **`reading`**: 2, `lang: en`.

#### 1·5 `kv-cache` — `es/05-kv-cache.mdx` — adapt, P

- **Quiz (5), all hold**: `q-por-que-sirve` a, `q-que-crece` [a,b], `q-memoria` `numeric` **4**
  (arithmetic), `q-ventana-llena` a, `q-prompt-deprisa` a (12–63).
- **`<CodeChallenge>` `ch-atiende`** (65–145): no assets, 4 tests, language-free.
- **`<Explorable>` `kv-cache`** (200), in `SPANISH_BOUND_CORPORA`, decoration only; the caption says
  «tras «La Nela»».
- **`<PyCell>` 360–406** (`bpe.py`, `minigpt.py`, merges, checkpoint; writes `llenar`, `avanzar`):
  the sample after «La Nela» (175, 357) and 483–484 («estrelas», a non-word, as cheap as «personas»)
  are regenerated. Its numbers (4e-15, `(4, 64, 16)`, 16 384) are the shape's and hold.
- **`<PyCell>` 421–449** (timing): «Tus milisegundos serán otros» (451). Holds in shape.
- Holds: 131 072, 136 448, 8 921 088 vs 295 526 400, 33×, 128 KiB, the 7 B-model GiB figures,
  `IndexError` at 65.
- 487–488 closing quotes 1·3's and 1·4's numbers (3.2; «palabras que existen en la novela»).
- **`<W>`: 4.** **`reading`**: 3, `lang: en`.

#### 1·6 `perplejidad` — `es/06-perplejidad.mdx` — adapt, P

- **Quiz (4).** `q-una-mala-apuesta` `numeric` **9.46** (12–18), `q-dos-tokenizadores` a (19–29),
  `q-sin-sesgo` [a,b] (30–40): hold. `q-probabilidad-cero` a (41–51): «10 de los 13 976 tokens del
  texto reservado», «unos 12 nats» → re-measured, **if** the English held-out text has
  zero-frequency tokens (see above).
- **Opening** 84–105: the 3.2 / 3.20 coincidence, $k = 24$, 2.14 bytes per token, «algo más de
  cuatro caras». 127–161: 4.6 bits per token; 2.16 vs 4.62 bpb; uniform $9/2.14 \approx 4.20$ and
  «Las fusiones ya son un poco de español» (161). 177: 125 789. 226: step 1 750, «entre ocho
  candidatos».
- **`<PyCell>` 238–268** (`bpe.py`, merges, corpus; unigrams at 0, 64, 256 merges): quoted 270–279
  (PPL 24.5 → 204.3, bpb 4.62 → 3.58, 3.200, the `Í`, 10 zero-frequency tokens, the `inf` edit).
- **`<PyCell>` 285–308** (`minigpt.py`, checkpoint): quoted 310–317 (3.182, PPL 24.1, 2.13 bpb, the
  script's 3.204; unigrams 5.308 / PPL 202; 2.1 nats; 5.294 vs 5.308; 2.556 on training, 0.63 gap).
- **`<PyCell>` 325–349** (100 steps on the last pages): quoted 351–352 (3.595 → 3.240; 3.030 →
  3.095; «no ha aprendido español»). Warm Adam up.
- 373–376 closing: 2.2 / 3.6 / 4.2 bpb, 0.6.
- **`<W>`: 1.** **`reading`**: 3, `lang: en`.

#### 1·7 `leyes-de-escala` — `es/07-leyes-de-escala.mdx` — adapt, P

- **Holds**: every published figure, i.e. Kaplan (0.076, 0.095, 0.050, 0.949, 0.839, ≈ 9 000×, 0.73 /
  0.27, 5.4 / 1.9), Chinchilla (400 models, 70 B, 1.4 T, 20 tokens per parameter, 0.348 / 0.366),
  GPT-3 and Gopher, and the cell's fit of Hoffmann's table 3 (0.498 / 0.502, 20.2–21.8).
- **Moves**: the cell 305–338 hard-codes `n, d = 136_448, 1_750 * 32 * 64` and `distintos =
  125_789` (326–328); its output 343–358; 110–115 (3.2 nats, step 1 750, 3 584 000, 125 789, «28»);
  228 ($C \approx 2.9 \times 10^{12}$, holds if the step does).
- **Quiz (5).** `q-mini-gpt` [a,c] (41–51): option (c) quotes «125 789 leídos unas 28 veces» → same
  question re-measured. `q-sin-punto` a (52–62): the explanation says «sobre una novela en español»;
  98 000 and 4.8 hold. `q-diez-por-ciento` **4.0**, `q-el-seis`, `q-exponentes`: hold.
- 205–207: «una novela en español … páginas web en inglés». In English the contrast that remains is
  tokenizer and kind of text, not language, which is still enough for the argument.
- **`<Explorable>` `scaling-laws`** (141): the mini-GPT's $(N, D)$ point, which holds if the step does.
- **`<W>`: 0.** **`reading`**: 5, `lang: en`.

#### 1·8 `aprendizaje-en-contexto` — `es/08-aprendizaje-en-contexto.mdx` — rewrite, P

- **Replacement:** *two tasks over the same cases, the first frequent in the English corpus and the
  second a priori improbable, where the examples demonstrate the improbable one (the role gender
  plays against plural in Spanish); chosen on the English checkpoint so the table still shows the
  examples moving the numbers without flipping the favourite.*
- **Quiz (4).** `q-cuantos-ejemplos` `numeric` **3** (12–18), `q-probabilidad-cero` a (19–29): hold.
  `q-las-celdas` [a,c] (30–40): quotes ` hermana` leading in all ten rows and 3.14 / 3.17, 3.17 / 3.16
  → re-measured on the new task. Check that (b), «some $K$ flips it», is still false.
  `q-que-le-falta` c (41–51): **new question** («distinguiera el plural del femenino»).
- **The task**: 113–123 (the two-column table, 10 `<W>`), 141–143, 214, 256–257.
- **`<PyCell>` 260–296** (`bpe.py`, `minigpt.py`, merges, checkpoint): quoted 298–305 (3.01 nats at
  $K = 0$; 1.37 with one example, 0.59 with four; −15 to −20; the newline continuation).
- **`<PyCell>` 312–340** (corpus: the colons and the per-position loss): quoted 342–356 (204 colons,
  95 open a paragraph «que en *Marianela* es un diálogo», 40 quotation marks, no line of the form
  `palabra: palabra`; 3.69 → 3.22 up to seven tokens, 3.14 / 3.17; second pass 3.17 / 3.16).
- Holds: GPT-3's 2 048-token window, 10–100 examples, 300 B tokens, 1.3 B → 175 B; Kaplan's 1 024.
- **`<W>`: 24.** **`reading`**: 5, `lang: en`.

#### 1·9 `proyecto-mini-gpt` — `es/09-proyecto-mini-gpt.mdx` — adapt, P

- **Quiz (3), all hold**: `q-de-que-es-muestra` a (12–22), `q-filas-por-token` `numeric` **1.306**
  (23–29, arithmetic), `q-el-contrato` [a,b] (30–41).
- **`<CodeChallenge>` `ch-continuar`** (43–227): no assets, 6 tests,
  `continuar(ids, n, llenar, avanzar, T_ctx, T_min)`; language-free.
- **The traced call** 278–291: `modelo("La Nela", max_tokens=4, semilla=0)` → « no traf»; ids 461,
  373, 309, 276, 266, 102. Regenerated; the English trace must still stop mid-word, since 288 argues
  from it.
- **Cross-course code**: 269–271, `dl-nlp` 5.9's `paso(entrada)` and `<GO>`.
- **The contract** fence 306–315 and clauses 320–331: the keyword names come from P3-03.
- **Tokenizer quirks** 398–408: « Golfín» starts with a lone space plus `G`, a name whose space
  was never merged with it. The English corpus needs a name with the same property, and cell 556
  prints it.
- **`<PyCell>` 427–470** (`bpe.py`, `minigpt.py`, merges, checkpoint; the trace by hand).
- **`<PyCell>` 479–521** (writes `hacer_modelo` / `modelo`; samples, seed, greedy, `parar="."`,
  timing): quoted 525–526 (the ` no,` cycle; « no trafá como me dijo lo le jo»).
- **`<PyCell>` 535–567** (against `generar`; the trailing space; loads the frozen `modelo.py`):
  quoted 569–578 (63 of 80 tokens match; ≈ 5× faster; `Dijo que` → ` no`, ` se`, ` me` against
  `Dijo que ` → `u`, `j`, `é`; the `ValueError`).
- **Freezes `modelo.py`** (564, 581–587) → `modelo.en.py`.
- 604–606 closing: «como la línea de un diálogo que sigue», the bridge into 2·1.
- **`<W>`: 27**; the corpus's names on 18 lines. **`reading`**: 3, `lang: en`.

## Assets this block builds

| Asset | Built by | Consumed by |
|---|---|---|
| `minigpt-entrenamiento.en.svg` | 1·3, from P3-02's logged run | 1·3 |
| English `sampling-explorer` contexts in `math/sampling-presets.ts`, picked per locale | 1·4 | 1·4 |
| English `kv-cache` text in `math/kv-cache-presets.ts`, picked per locale | 1·5 | 1·5 |
| `modelo.en.py` + its assets-test block + `parity-en.py` case | 1·9 | Blocks 2–3 |

A widget leaves `SPANISH_BOUND_CORPORA` in the PR that gives it English data, with its teaching
property asserted in its data test (Phase 11's rule). The presets are **regenerated by their
scripts against `minigpt.en.json`**, never hand-edited.

## Lesson progress

- [ ] 1·1 `una-sola-columna`
- [ ] 1·2 `bpe-de-verdad`
- [ ] 1·3 `entrenar-un-mini-gpt`
- [ ] 1·4 `muestreo`
- [ ] 1·5 `kv-cache`
- [ ] 1·6 `perplejidad`
- [ ] 1·7 `leyes-de-escala`
- [ ] 1·8 `aprendizaje-en-contexto`
- [ ] 1·9 `proyecto-mini-gpt`

## The worked case — 1·2

Spanish gives 1·2 its evidence for free: `ñ` and the accented vowels are two bytes each, so the
first merges visibly fuse byte pairs into letters, and `-ción` shows a suffix being assembled.
English text is nearly all one-byte ASCII, so on the English corpus the first merges will most
likely join ASCII pairs into common words (expect ` t`, `he`, ` the`; P3-02 prints the real list), and the "merges rebuild letters first" observation disappears from the corpus
side. Keep the argument by moving its evidence: the `bpe-merges` widget's English corpus was built
for exactly this (`café`, `José`, `fiancé` make merge 1 fuse `C3`+`A9`, and `naïve` keeps a letter
the corpus never had at two bytes to the end, the byte-level answer to out-of-vocabulary). The
quiz on `que`/`qu` needs an English counterpart from the English merge list (a frequent word that
is merged before its own prefix), found in P3-02's printed list, not invented.

## Decisions fixed by a translated lesson

*Empty until the first lesson lands. Record here every choice a later lesson must reuse verbatim:
the English prompts that stand in for «La Nela», the in-context task of 1·8, the stop sequence of
1·9.*

## Acceptance criteria

- [ ] Every lesson under `content/courses/llm-agents/en/`, `draft: false`
- [ ] `slug`, `block`, `order` and every widget / quiz / challenge id match the Spanish lesson
- [ ] Every cell and challenge loads the **English** assets (`*.en.json`, `*.en.py`,
      `corpus.en.txt`) and was run in the browser; every quoted number is what Pyodide printed
- [ ] `sampling-explorer` and `kv-cache` render English presets on `/en`, Spanish on `/es`, and are
      out of `SPANISH_BOUND_CORPORA`
- [ ] `modelo.en.py` matches 1·9's English cell character for character (the assets test), and
      `parity-en.py` covers it
- [ ] Every `<Leccion>` resolves; `curso="dl-nlp"` targets not yet translated render «In Spanish»
- [ ] The two-reader test passes against the English neighbours, and for 1·1 against `dl-nlp`'s
      English `fine-tuning-colab` once it exists
- [ ] `pnpm lint:content` clean (budget warnings advisory); `pnpm build` green

## Test plan

- `pnpm lint:content` after each lesson; `pnpm build` before each PR.
- Every cell run in the browser, desktop and a 360px phone; numbers quoted from Pyodide.
- Each re-generated preset: render the widget on `/en` and check the property it exists to show
  (1·4: the two contexts really differ in how many entries carry the mass).
- `pnpm test` for the corpora and assets tests the block extends.

## Gotchas

- **Quote Pyodide, not CPython.** P3-02's README numbers are a reference; the browser's BLAS
  differs (memory: course PyCell numbers). The Spanish lessons were written under the same rule.
- **Training cells are at the edge of the 10 s cap.** The English checkpoint has the same shape,
  but a corpus with different token lengths changes per-step cost; re-time 1·3's and 1·6's cells on
  a phone.
- **1·6's "continue training" cell warms Adam up** when resuming from the checkpoint (memory:
  mini-GPT continued training). The English run will need the same care, and its held-out loss
  will move the same direction.
- **A new `curso="dl-nlp"` anchor flips** when `dl-nlp` translates the target: this block has no
  anchored cross-course refs today; keep it that way.

## Out of scope

- The checkpoint itself (P3-02) and the identifier map (P3-03).
- Editing a Spanish lesson or asset.

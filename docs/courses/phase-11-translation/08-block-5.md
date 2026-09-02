# P11-08 — Block 5: The Transformer

**Tag:** `COURSE-P11-08` · **Size:** L · **Status:** not started

## TL;DR

Eleven lessons — the longest block, and largely **transpose**: self-attention, multi-head,
positional encoding and the block architecture are argued in mathematics and drawn by numeric
widgets. Two exceptions: the self-attention demonstration sentence, which depends on Spanish
agreement, and the Colab hand-off at 5.11, whose notebooks live outside the content tree.

## Classification

Filled by [P11-00](00-triage.md) — read against the eleven `es/` lessons selected by their `block: 5`
frontmatter, in `order`. File number and `order` are offset by 32 throughout: `es/33` … `es/43` are
5.1 … 5.11. The `NN-` prefix is a global counter, not a per-block one.

**The block header's expectation holds: it is largely transpose, and it contains no rewrite.**
Nothing in these eleven lessons moves a quiz answer. Six lessons are clean transposes, five are
adapts, and every one of the five spends its cost on a corpus that lives in a **widget**, not in the
lesson file.

| # | Slug | Class | Spanish-dependent artifacts |
|---|---|---|---|
| 5.1 | `adios-recurrencia` | **transpose** | None. The one example is the permutation pair `el perro muerde al cartero` / `al cartero muerde el perro` (195), whose whole point is that the two are the same multiset — a property `the dog bites the postman` / `the postman bites the dog` has exactly. All four quiz items are arithmetic or architecture |
| 5.2 | `self-attention` | **adapt** | The demonstration sentence, in **five places** (51, 193–195, 202, 206, 290–291) and in the widget's own lexicon. Prose quotes the token count — "las seis filas" (201) — which moves with the replacement |
| 5.3 | `scaled-dot-product` | **transpose** | Its closing bridge (431–433) names 5.2's sentence and three of its tokens, as free prose that follows whatever 5.2 picked. Carries the block's **only** `<Figure>`, and it has Spanish set into the SVG |
| 5.4 | `multi-head` | **adapt** | **Two** corpora, not one: its own `el ratón pequeño que persiguen los gatos duerme` (201–217) **and** 5.2's sentence re-read (275–279). Six weights quoted off the widget. The four head names are Spanish grammar |
| 5.5 | `codificacion-posicional` | **transpose** | Confirmed: `positional-encoding` is numeric and carries **no corpus**. One two-word example, `la` in `la casa amarilla` (366), and it needs a one-clause rephrase — see below |
| 5.6 | `bloque-transformer` | **transpose** | **Zero `<W>`, no corpus, no example.** Quotes the `transformer-architecture` widget's box labels by name (244, 250, 358, 522), so its prose must match what P11-02 renames them to |
| 5.7 | `encoder-decoder-masking` | **transpose** | Its own example, `el gato bebe leche` (195–198), translates one-for-one at the same length. The widget is **not** numeric — it is 5.2's heatmap with the mask on, inheriting 5.2's corpus |
| 5.8 | `arquitectura-completa` | **adapt** | Not the widget labels — the **label-correspondence table** (117–128) and the sentence that motivates it (114–115), which is false once the course is in English. 19 `<W>`, all English figure labels, all staying |
| 5.9 | `proyecto-transformer` | **transpose** (Option A) / **adapt** (Option B) | The toy vocabulary is a 12-entry Spanish + English pair, `me gusta la casa roja` → `i like the red house` (169, 209–211, 305–306). Class follows Block 4's direction decision, which P11-00 does not make |
| 5.10 | `bert-y-gpt` | **adapt** | `banco` = bank/bench, 27 `<W>`, the whole lesson's spine — and the **same pair Block 1's 1.8 already owns**. It is a `<PyCell>` corpus, so `0.550005` regenerates |
| 5.11 | `fine-tuning-colab` | **transpose** | BETO is a Spanish model and **stays** — every number in the lesson is computed from its five. Inherits five figures from Block 2's 2.10, which is an adapt with a new corpus. `<ColabLink>` points at a Spanish notebook: out of scope |

### What changed from the planning pass

Five of the six pre-filled rows were wrong or understated, and two hazards the table did not name
are the block's real cost.

- **5.2 — confirmed, and the reason is sharper than the row says.** `están` reaching past the
  adjacent `coche` to `llaves` is exactly the demonstration, and 5.4 does re-read the sentence. What
  the row misses is where the sentence lives: not in the lesson, but in
  `src/features/courses/widgets/math/self-attention.ts`, which is a **Spanish grammar engine** — see
  the widget note below. Class **adapt** stands.
- **5.4 — confirmed, with its scope roughly doubled.** The row calls it "`multi-head-view` widget
  labels + the shared sentence". It is two full corpora. The lesson's own sentence,
  `el ratón pequeño que persiguen los gatos duerme` (201–217), is a centre-embedded relative clause
  chosen so that **two verbs need two subjects in opposite directions** — `duerme`→`ratón` forward
  over the clause, `persiguen`→`gatos` backward — and six weights read off the widget
  (`0.30`, `0.01`; `0.40`, `0.23`, `0.37`, `0.17`) are quoted in prose. It is the most expensive
  lesson in the block.
- **5.7 — wrong.** "Masking legend text in the widget" describes a numeric widget that is not there.
  5.7 renders **`self-attention-heatmap`** — 5.2's widget, second use, mask toggled (210–213) — so
  its widget dependency is 5.2's corpus, already paid for, and the legend strings are P11-02's, not
  the lesson's. Its own example, `el gato bebe leche`, is four tokens in and four tokens out. It is
  a clean **transpose**.
- **5.8 — the row said "widget labels" and pointed at the wrong thing.** The labels are P11-02's.
  What 5.8 owns is a table (117–128) whose two left columns are *the paper's English label* and
  *the course's Spanish name for the same box* — and the sentence that introduces it says so out
  loud: «La figura del artículo está en inglés y este bloque la ha ido construyendo en español»
  (114). In English that sentence is false and four of the ten rows collapse to the same string
  twice (`Positional Encoding`, `Multi-Head Attention` ×2, `Masked Multi-Head Attention`,
  `Add & Norm`). The table is rebuilt, not translated. **adapt**.
- **5.10 — not in the table at all, and it is the block's second-heaviest lesson.** `bert-y-gpt`
  hangs on `banco`, wrapped 27 times, in two sentences that must **share a prefix** up to its
  position. It is a `<PyCell>` corpus (196–197) and a `single` quiz item built on the prefix
  property. Block 1's 1.8 already owns this decision — 5.10 inherits it, it does not make it.
- **5.11 — confirmed, and the notebook is not its only external dependency.** See below.
- **Block-wide, and in no row: `<Leccion ancla="">` is zero.** 102 slug-only refs across eleven
  lessons and **not one anchored reference** — so no anchor is re-derived anywhere in this block,
  and the "translating a lesson invalidates inbound anchors" gotcha does not fire from inside it.

### The widget is a Spanish grammar engine — the block's largest single dependency

The row for 5.2 says "the demonstration sentence". The sentence is the visible half. The other half
is that `self-attention-heatmap` lets the reader **type any sentence up to `MAX_TOKENS = 10`**, and
what scores it is a hand-built model of Spanish:

| In `src/features/courses/widgets/math/self-attention.ts` | What it holds |
|---|---|
| `GROUPS` (76–101) | A 16-group Spanish lexicon: determiners incl. the contractions `del`/`al`, links, nouns and verbs **in singular/plural pairs**, gendered modifiers (`rojo`/`roja`/`rojos`/`rojas`), invariable modifiers and adverbs |
| `LEXICON`, `LEXICON_WORDS` (109–124) | One unit vector per entry over the features `DET/ENL/SUST/VERB/MOD`, `NUM`, `ANIM`; the component prints how many words it knows |
| `PRESETS` (127–131) | `las llaves del coche están ahí`, `el gato duerme y los perros comen`, `la vecina que lee duerme poco` |
| `RULES` (~154–169) | Four named rules — «un verbo busca sustantivos», «concordancia de número», «un sustantivo mira su determinante y sus modificadores», «un determinante o un modificador mira los sustantivos» |
| `multi-head.ts`: `MH_PRESETS` (68), `SHORT` (54–59) | The fourth preset `el ratón pequeño que persiguen los gatos duerme`, and four button labels: `verbo → sustantivo`, `concordancia`, `sustantivo → det./mod.`, `det./mod. → sustantivo` |

Two of the four rules are Spanish morphology (number agreement, gender-marked modifiers) and one
depends on `del`/`al` being single tokens that are two things at once. **This is P11-02's job, not a
lesson author's**, and three lessons — 5.2, 5.4, 5.7 — cannot be verified until it lands. It also
sets the order: P11-02 before 5.2.

### Artifact inventory

Line refs are into the `es/` file named in each heading.

#### 5.1 `adios-recurrencia` — `es/33-adios-recurrencia.mdx` — transpose

- **Quiz (4, all language-free).** `q-cadena-de-esperas` `single` a (12–22), the parallelism
  argument; `q-donde-se-cruzan` `numeric` **512** (23–30), $T = d$ from $2Td^{2} = 2T^{2}d$;
  `q-ciega-al-orden` `single` a (31–41), permutation invariance; `q-camino-mas-largo` `multi`
  [a,b,c] (42–52), path length.
- **`<W>`: 2** — the permutation pair at 195. Both halves are the *same multiset of tokens*, which
  is the entire point, and English preserves it exactly.
- **`<Explorable>` `transformer-architecture`** (89–92), Spanish caption; **first of three uses in
  the block**. Prose counts "de las quince cajas, se iluminan tres" (86) — language-free.
- **`<PyCell>`: 0** (`hasCode: false`). **`<CodeChallenge>`: 0.** **`<Figure>`: 0.**
- **`<Leccion ancla="">`: 0** (7 slug-only refs). **`reading`:** 1 (54–62), `lang: en`, Spanish note.
- Prose numbers — $26\,214\,400$, $2\,560\,000$, $1\,024\,000\,000$, $524\,288\,000$, $1.95$, $3.9$
  — are all arithmetic on $T$ and $d = 512$ and hold.

#### 5.2 `self-attention` — `es/34-self-attention.mdx` — adapt

- **Quiz (5, no answer moves).** `q-tres-lecturas` `single` a (12–22); `q-forma-cuadrada` `numeric`
  **144** (23–30), $12^{2}$; `q-sin-proyecciones` `single` a (31–41), Cauchy–Schwarz;
  `q-que-crece-con-t` `multi` [a,b,c] (53–63). **`q-simetria` `single` a (42–52) quotes the sentence
  inside its explanation** (51) — the copy is load-bearing for the asymmetry argument, the answer is
  not.
- **The demonstration sentence, five places.** 51 (quiz explanation), 193–195 (the opening argument
  — `están` must look at `llaves` three positions back, not the adjacent singular `coche`), 202,
  206 (Explorable caption, which names «están», «coche» and «llaves»), 290–291 (the asymmetry:
  `están` needs `llaves` more than `llaves` needs `están`).
- **The token count is quoted.** "en las seis filas a la vez" (201) is $T$ of the preset. `the keys
  to the car are over there` is seven; the line moves with whatever P11-02 picks.
- **`<Explorable>` `self-attention-heatmap`** (204–207) — its corpus is the sentence, via the
  widget's lexicon. See the widget table above.
- **`<CodeChallenge>` `ch-auto-atencion`** (64–161): Spanish `prompt` (66–75), 1 `# tu código aquí`
  (82), 5 test `name`s, 12 Spanish assertion messages (92–143), Spanish `solution` comments
  (149–150) and `explanation` (154–161); identifier `auto_atencion`. **Language-free maths.**
- **`<PyCell>` ×2** (320–344, 352–394). No corpus — random `X`. Spanish identifiers
  `softmax_filas`, `atencion`, `A0_largo`; Spanish print headers (337–343, 373–393). Quoted output:
  `0.558`, `0.983`, `0.330`, `0.486` (423–427), and "las seis filas" (396) — this one is the cell's
  `T = 6`, not the sentence's, and holds.
- **`<Leccion ancla="">`: 0** (9 slug-only refs). **`reading`:** 2 (162–178), both `lang: en`.
- **`<W>`: 15** — `llaves` ×6, `están` ×6, `coche`, and the full sentence ×1. **All 15 move.**

#### 5.3 `scaled-dot-product` — `es/35-scaled-dot-product.mdx` — transpose

- **Quiz (5, all language-free).** `q-tamano-tipico` `numeric` **8** (12–18), $\sqrt{d_k}$;
  `q-por-que-la-raiz` `single` a (19–29); `q-fila-saturada` `multi` [a,b,c] (30–40);
  `q-sin-logaritmo` `single` a (41–51); `q-orden-de-la-fila` `boolean` false (52–57).
- **The closing bridge quotes 5.2's sentence** (431–433): `están` choosing between `llaves`, which
  it agrees with, and `del coche`, which separates them. **Free prose that follows 5.2's pick** —
  the same status as 4.5's one pair-dependent clause. 4 `<W>`, all here.
- **`<Figure>`** (182–186) `escalado-softmax.svg`: Spanish `alt` and `caption`, **and Spanish set
  into the SVG** — `las mismas seis puntuaciones en los cuatro casos`, `sin dividir`, `tras
  dividir`. **New asset.** It is the block's only `<Figure>`.
- **`<CodeChallenge>` `ch-gradiente-softmax`** (58–146): Spanish `prompt` (60–71), 1
  `# tu código aquí` (78), 4 test `name`s, 7 Spanish assertion messages (90–125), Spanish `solution`
  comment (131) and `explanation` (133–146); identifier `gradiente_puntuaciones`.
- **`<PyCell>` ×2** (350–363, 374–395). No corpus. Spanish identifiers `tipico`, `nombre`,
  `softmax_filas`, `dividiendo`, `sin_dividir`; Spanish print headers (356, 386). Quoted output:
  `0.236`/`32.03` (367–368), `0.670`→`0.953`, `0.445`→`0.066`, `0.1755`→`0.0321`, and the three
  stable columns `0.36`/`0.77`/`0.216` (397–402). Seed-driven; re-run.
- **`<Leccion ancla="">`: 0** (4 slug-only refs). **`reading`:** 1 (147–155), `lang: en`.

#### 5.4 `multi-head` — `es/36-multi-head.mdx` — adapt (the block's most expensive)

- **Quiz (5, no answer moves).** `q-donde-se-normaliza` `single` a (12–22);
  `q-cuenta-parametros` `numeric` **1048576** (23–30), $4d_{\text{model}}^{2}$;
  `q-de-donde-sale-dk` `single` a (31–41); `q-cabezas-iguales` `multi` [a,b,c] (42–52);
  `q-promediar` `boolean` false (53–58). **All five are shape-counting or symmetry.**
- **Corpus 1 — its own sentence** (201–217): `el ratón pequeño que persiguen los gatos duerme`. A
  centre-embedded relative clause, chosen so **two verbs need two subjects in opposite directions**
  and neither the noun feature nor the number feature separates them alone. The prose then walks two
  rows of the widget by name and by number: head 1 ties `ratón` with `gatos` at **`0.30`**, head 2
  drops `gatos` to **`0.01`**, and the single-head layer answers `ratón` on one row and `gatos` on
  the other. A replacement must reproduce **all four** properties, not just the sentence.
- **Corpus 2 — 5.2's sentence re-read** (275–279), on the row of `llaves`, with four more quoted
  weights: the modifier rule alone puts **`0.40`** on `ahí` and **`0.23`** on `las`; adding
  agreement flips the row to **`0.37`** / **`0.17`**. These come out of the widget's rule vectors.
- **`<Explorable>` `multi-head-view`** (219–222), Spanish caption **naming two of the four rules**
  («la cabeza del verbo», «la de concordancia») and quoting `ratón` and `gatos`.
- **`<CodeChallenge>` `ch-multi-head`** (59–179): Spanish `prompt` (61–75), 1 `# tu código aquí`
  (82), 5 test `name`s, 12 Spanish assertion messages (92–150), Spanish `solution` comments
  (156–158) and `explanation` (167–179); identifier `multi_head`. Language-free.
- **`<PyCell>` ×2** (369–410, 422–459). No corpus. Spanish identifiers `salidas`, `mapas`, `col`,
  `proy`, `sal`, `iguales`, `distintas`, `bloque`. Quoted output: `0.591`, `0.531`, `0.005`
  (413–414); the invariant table `786 432` / `262 144` / `1 048 576` (416); `0.458` (463).
- **`<Leccion ancla="">`: 0** (8 slug-only refs). **`reading`:** 1 (180–188), `lang: en`.
- **`<W>`: 22 — the most of any lesson in the block.** `gatos` ×5, `ratón` ×4, `las` ×3,
  `persiguen` ×2, `duerme` ×2, `ahí` ×2, `llaves`, `están`, and the two full sentences. **All 22
  move.**

#### 5.5 `codificacion-posicional` — `es/37-codificacion-posicional.mdx` — transpose

- **Quiz (5, all language-free).** `q-por-que-no-el-numero` `single` a (12–22);
  `q-de-que-depende-m` `single` a (23–33); `q-consigo-misma` `numeric` **256** (34–40),
  $d_{\text{model}}/2$; `q-solo-senos` `multi` [a,b] (41–51); `q-sumar-o-concatenar` `boolean` false
  (52–57).
- **`<Explorable>` `positional-encoding`** (243–246), Spanish caption. **Confirmed: no corpus.**
  Sines and cosines on a position index; the widget's own strings are P11-02's.
- **The one hazard, and it is a clause.** «el determinante que tengo justo delante» — el `la` de
  `la casa amarilla` (366) — pairs with «la señal de "una posición atrás"» (367). In Spanish `la`
  sits **one** position before `casa`; in `the yellow house` the determiner sits **two** before the
  noun. Free prose: either name a two-word phrase or say "two positions back". 2 `<W>`, both here.
- **`<CodeChallenge>` `ch-codificacion-posicional`** (58–196) — the block's longest: Spanish
  `prompt` (60–75), 2 `# tu código aquí` (82, 87), 5 test `name`s, 14 Spanish assertion messages
  (94–153), Spanish `solution` comments (165) and `explanation` (181–196); identifiers
  `codificacion_posicional`, `desplazamiento`, `frecuencias`. Language-free trigonometry, and one
  test pins a literal, `11.777382878638058` (152).
- **`<PyCell>` ×2** (375–399, 410–439). No corpus. Spanish identifiers `omega`, `pos`, `norma`,
  `movidas`; Spanish print headers (387–397, 429–437). Quoted output: `6.3`, `11.2`, `19.9`,
  `1.78`, `35 332.9` (402–404), the norm `4` (406), `12.272398` (443), `16`/`15.314`/`12.272`
  (444–445).
- **`<Leccion ancla="">`: 0** (1 slug-only ref — the fewest in the block). **`reading`:** 2
  (197–213), both `lang: en`.

#### 5.6 `bloque-transformer` — `es/38-bloque-transformer.mdx` — transpose

- **Quiz (5, all language-free).** `q-que-anade-la-suma` `single` a (12–22);
  `q-anchura-constante` `single` a (23–33); `q-que-eje-normaliza` `multi` [a,b,c] (34–44);
  `q-donde-estan-los-parametros` `numeric` **2097152** (45–52); `q-normalizar-antes-de-sumar`
  `boolean` true (53–58).
- **`<W>`: 0. No corpus, no example, no `<Figure>`.** The cleanest lesson in the block.
- **`<Explorable>` `transformer-architecture`** (248–251) — second use, different Spanish caption.
  **The one coupling:** the prose quotes the widget's box labels as strings — «Suma y layer norm»
  (244, 250, 358) and «auto-atención enmascarada» (522) — so it must be written against whatever
  P11-02 renames the 15 labels to, not against a free translation.
- **`<CodeChallenge>` `ch-bloque-transformer`** (59–192): Spanish `prompt` (61–77), 2
  `# tu código aquí` (84, 89), 5 test `name`s, 13 Spanish assertion messages (98–165), Spanish
  `solution` comments (171–172) and `explanation` (181–192); identifiers `bloque`, `atencion`,
  `oculta`, `una`, `esperado`.
- **`<PyCell>` ×2** (421–454, 466–493). No corpus. Spanish identifiers `por_columnas`, `apilar`,
  `pesos`, `con_suma`, `sub`, `con`, `sin`; Spanish print headers (437–453, 488). Quoted output:
  `0.98`/`2.89` (456), `1.889` (459), `0.109` → `5.182 × 10^{-7}`, and the `1.00`–`1.80` band
  (496–499).
- **`<Leccion ancla="">`: 0** (9 slug-only refs). **`reading`:** **4** (193–225) — the most of any
  lesson in the block, all `lang: en`, four Spanish notes.

#### 5.7 `encoder-decoder-masking` — `es/39-encoder-decoder-masking.mdx` — transpose

- **Quiz (5, all language-free).** `q-por-que-menos-infinito` `single` a (12–22);
  `q-casillas-vivas` `numeric` **21** (23–30), $T(T+1)/2$; `q-tres-atenciones` `multi` [a,b,c]
  (31–41); `q-genera-en-paralelo` `boolean` false (42–47). **`q-fila-uno` is `predict-output`**
  (48–65) with answer `[1. 0. 0. 0.]` — a printed array off a hand-set score grid, no language in
  it.
- **Its own example** (195–198): `el gato bebe leche`, with `bebe` and `leche` wrapped. Four tokens
  in, four tokens out; the only property used is that the answer sits to the right of the position
  producing it.
- **`<Explorable>` `self-attention-heatmap`** (210–213) — **second use, mask toggled**, Spanish
  caption. Inherits 5.2's corpus; the caption's two claims («se va media rejilla», «la posición 1 se
  queda con 1.00 sobre sí misma») hold for any corpus. The masking legend strings live in the
  component — P11-02, not here.
- **`<CodeChallenge>` `ch-atencion-causal`** (66–173): Spanish `prompt` (68–80), 1
  `# tu código aquí` (87), 5 test `name`s, 15 Spanish assertion messages (96–150), Spanish
  `solution` comments (156–159) and `explanation` (163–173); identifier `atencion`.
- **`<PyCell>` ×2** (357–389, 400–437). Hand-set score grids, no corpus. Spanish identifiers
  `futuro`, `con_mascara`, `con_un_cero`, `pesos_a_cero`, `libre`, `principios`, `propia`,
  `cruzada`, `otro`, `salida_otro`. Quoted output: `0.085`, `0.291`, `0.871` (255, 395), `0.525`
  (253, 394), 15 live cells of 25 (440).
- **The three-call table** (341–345) — Spanish row labels, language-free content.
- **`<Leccion ancla="">`: 0** (11 slug-only refs). **`reading`:** 1 (174–182), `lang: en`.
- **`<W>`: 4** — the example's three, plus `\<GO>` (281), which survives.

#### 5.8 `arquitectura-completa` — `es/40-arquitectura-completa.mdx` — adapt

- **Quiz (5, no answer moves).** `q-cinco-numeros` `single` a (12–22); `q-tabla-compartida`
  `numeric` **37888000** (23–30); `q-alargar-la-frase` `boolean` false (42–47);
  `q-salida-del-decoder` `predict-output` `(4, 37000) True` (48–67). **`q-leer-la-figura` `multi`
  [a,b,c] (31–41) is built entirely on English figure labels** — `Nx`, `Add & Norm`,
  `Multi-Head Attention`, `Masked Multi-Head Attention` — which are already English and stay,
  answer included.
- **The label-correspondence table (117–128) is the lesson's Spanish dependency, and it is
  structural.** Its columns are *the paper's English label* → *the course's Spanish name* → *the
  lesson that built it*. The premise sentence (114–115) states the reason out loud: the figure is in
  English and the block built it in Spanish. In English that sentence is false, and four rows have
  the same string in both columns once the widget is translated (`Positional Encoding`,
  `Multi-Head Attention` twice, `Masked Multi-Head Attention`, `Add & Norm`). **Rebuild the table
  around what each box does and where it was built; drop the premise sentence.**
- **`<Explorable>` `transformer-architecture`** (104–107) — third and last use, Spanish caption.
- **`<W>`: 19, and every one is an English figure label** — `Multi-Head Attention` ×3, `Nx` ×2,
  `Masked Multi-Head Attention` ×2, `Add & Norm` ×2, `base`, `big` ×2, `Input Embedding`,
  `Output Embedding`, `Outputs (shifted right)`, `Positional Encoding`, `Feed Forward`, `Linear`,
  `Softmax`. **None of them moves.**
- **`<PyCell>` ×1** (242–265) — pure integer arithmetic, no corpus. Spanish identifiers
  `parametros`, `atencion`, `tabla`, `grande`, `nombre`, `valor`. Quoted output: `30.0`/`40.0`/`30.0`
  (267), `41 984` (269), `100 933 632` (270), `214 171 648` (273).
- **`<CodeChallenge>`: 0** (`challenges: []`). **`<Figure>`: 0.**
- **`<Leccion ancla="">`: 0**, with **14 slug-only refs**. **`reading`:** 2 (69–85), both `lang: en`.

#### 5.9 `proyecto-transformer` — `es/41-proyecto-transformer.mdx` — transpose (A) / adapt (B)

- **Quiz (3 — the fewest with a challenge; no answer moves either way).** `q-que-demuestra` `multi`
  [a,b,c] (12–22) — its option (a) states the shapes `5`/`6`/`6 × 12`, which move only if the pair
  changes length; `q-mascara-por-bloque` `boolean` false (23–28); `q-parametros-atencion` `numeric`
  **4096** (29–36), $4 \cdot 32^{2}$.
- **The pair, and the 12-entry shared vocabulary built from it.** `me gusta la casa roja` →
  `i like the red house` + `<EOS>`, at 169 (the opening), 209–211 (the setup, with $T_x = 5$,
  $T_y = 6$) and 305–306 (`V`, the literal list). Under **Option A** the pair stays exactly as it is
  and the lesson is prose-and-identifiers work; under **Option B** the vocabulary is rebuilt and
  five quoted numbers regenerate with it.
- **Five numbers that move only under Option B:** the loss `3.292` against $\ln 12 = 2.485$ (443);
  `the` as the argmax in all six positions with `0.589` on the first (492–493); the mask table
  `0` / `0.0768` / `0.1651` / `0.194` (498–499); `59 008` parameters (502–507). All are functions of
  the token indices, so they move if `V` moves and not otherwise.
- **`<PyCell>` ×4** (302–335, 343–389, 396–441, 453–488) — **the most in the block**, and they run
  in sequence. Spanish identifiers throughout: `ent_dec`, `entrada`, `codificacion_posicional`,
  `softmax_filas`, `atencion`, `multi_head`, `layer_norm`, `subcapa`, `salidas`, `mapas`,
  `pesos_atencion`, `pesos_bloque`, `cruzada`, `propia`, `modelo`, `mascaras`, `etiqueta`, `otro`,
  `arrays`, `total`. Cell 4 reads `ix["casa"]` and `ix["me"]` directly (465).
- **`<CodeChallenge>` `ch-genera-voraz`** (37–147): Spanish `prompt` (39–52), 1 `# tu código aquí`
  (59), 4 test `name`s, 9 Spanish assertion messages (75–122), Spanish `solution` comment (134) and
  `explanation` (136–147); identifiers `genera`, `guion`, `llamadas`, `paso_fijo`, `salida`,
  `siguiente`, `entrada`. **Language-free** — it drives a scripted stub, not the model.
- **Two shape tables** (187–195, 231–237) — Spanish headers, language-free content.
- **`<Explorable>`: 0. `<Figure>`: 0.**
- **`<Leccion ancla="">`: 0**, with **14 slug-only refs**. **`reading`:** 1 (148–156), `lang: en`.
- **`<W>`: 8** — the two phrases, `the`, and `\<GO>` / `\<EOS>`.

#### 5.10 `bert-y-gpt` — `es/42-bert-y-gpt.mdx` — adapt (the block's second-heaviest)

- **Quiz (4, no answer moves).** `q-que-cambia` `multi` [a,b,c] (12–22); `q-encoder-siguiente`
  `boolean` false (23–28); `q-texto-suelto` `multi` [a,b] (40–50) — its stem says "novelas en
  español", free prose. **`q-banco-dos-vectores` `single` a (29–39) is built entirely on the pair**:
  option (a) is right, and option (b) is wrong, *only because the two sentences share the prefix up
  to `banco`'s position*. The answer letter holds under any replacement with that property; the
  item's whole body moves.
- **The pair is Block 1's, not this lesson's.** `el banco cerró a las dos` / `el banco estaba
  mojado` are the closing pair of `es/08-glove-y-limites.mdx` (481–482), which
  [04-block-1.md](04-block-1.md) classes **adapt** and where the `bank` substitution is already
  decided. 5.10 must take that decision, not remake it — and it adds one constraint Block 1 does not
  have: **both sentences must share their prefix through the polysemous word**, and it must sit at
  the same index in both (the cell hard-codes `t = 1`).
- **`<PyCell>` ×1** (193–234) — **the corpus is in the cell**: `f1` and `f2` (196–197), and
  `V = sorted(set(f1 + f2))` (198), so the vocabulary, `E` and every printed number are functions of
  the two sentences. Spanish identifiers `entrada`, `auto_atencion`, `frase`, `cos`. Quoted output:
  two exact `1`s and **`0.550005`** (236–240) — the third regenerates.
- **`<W>`: 27 — the most of any lesson in the block.** `banco` ×14, `el banco estaba mojado` ×3,
  `el banco` ×3, `el banco cerró a las dos` ×2, `cerró a las dos` ×2, `estaba mojado`, and
  `[MASK]`, which survives.
- **The three representation signatures** (105–130) — pure mathematics, language-free, and the whole
  argument that closes Block 1's debt.
- **`<CodeChallenge>`: 0** (`challenges: []`). **`<Explorable>`: 0. `<Figure>`: 0.**
- **`<Leccion ancla="">`: 0** (9 slug-only refs). **`reading`:** 2 (52–68), both `lang: en`.

#### 5.11 `fine-tuning-colab` — `es/43-fine-tuning-colab.mdx` — transpose

- **Quiz (3, all language-free).** `q-por-que-no-navegador` `multi` [a,b,c] (12–22) — memory and
  operation counts; `q-tasa-aprendizaje` `single` a (23–33); `q-que-aporta-preentrenar` `multi`
  [a,b,c] (34–44).
- **BETO stays, and with it every number in the lesson.** The model is a Spanish BERT and the lesson
  says so; that is a fact about the notebook, not a Spanish dependency. $N = 12$,
  $d_{\text{model}} = 768$, $h = 12$, $d_{\text{ff}} = 3072$, $\lvert V \rvert = 31\,002$, and from
  them $84\,934\,656$, $23\,809\,536$, $108\,744\,192$, ~110 M, 440 MB, 1.7 GB, $1\,538$,
  $7 \times 10^{14}$ (93–162). **None of it moves.**
- **Five figures are inherited from Block 2's 2.10, which is an adapt with a new corpus** (79–81):
  `180` training reviews, `60` held out, **`88.3 %`**, "siete fallos", "cuatro de ellos con un
  `no`". [05-block-2.md](05-block-2.md) records that the review corpus is replaced and that `88.3 %`
  regenerates. **These five must be re-read off the English 2.10, not translated** — the same
  hand-off Block 3's 3.1 already makes.
- **`<W>`: 4** — `no` ×4 (38, 43, 81, 87), the Spanish negation particle, in the claim that a
  bag of words could not place it. It carries over as `not`/`no` and the claim holds.
- **`<ColabLink>`** (176–178) → `notebooks/fine-tuning-beto.ipynb`, pinned to a commit SHA in
  `gussttaav/ai-notebooks`. **The notebook is Spanish and out of scope for this phase** — link it
  unchanged, and record the gap in `STATUS.md`. See "5.11 and the notebooks" below.
- **`<PyCell>`: 0** (`hasCode: false`). **`<CodeChallenge>`: 0. `<Explorable>`: 0. `<Figure>`: 0.**
- **`<Leccion ancla="">`: 0**, with **16 slug-only refs — the densest in the block**, which is what
  a closing lesson looks like. **`reading`:** 2 (46–62), both `lang: en`.

### Block totals

| | Count | Notes |
|---|---|---|
| **Lessons** | 11 | `es/33` … `es/43`, selected by `block: 5`; file number = `order` + 32 |
| **Transpose** | **6** / 5 | 5.1, 5.3, 5.5, 5.6, 5.7, 5.11 — plus **5.9** under Option A |
| **Adapt** | **5** / 6 | 5.2, 5.4, 5.8, 5.10 — plus **5.9** under Option B |
| **Rewrite** | **0** | **No quiz answer moves anywhere in this block.** The header's expectation holds |
| Quiz items | 49 | 20 `single`, 11 `numeric`, 11 `multi`, 5 `boolean`, 2 `predict-output`. **Not one answer can move** — 5.2's `q-simetria` and 5.10's `q-banco-dos-vectores` come closest and both hold |
| `<PyCell>` | 18 | Only **two carry a corpus**: 5.9's four (the toy pair) and 5.10's one (`f1`/`f2`). The other 13 run on `rng` or hand-set grids. All re-run |
| `<CodeChallenge>` | 8 | 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.9 — ~82 Spanish assertion messages, 33 test `name`s, 9 `# tu código aquí`. **All eight are language-free maths**; only identifiers and messages move |
| `<Explorable>` | 8 uses / 4 ids | `transformer-architecture` ×3 (5.1, 5.6, 5.8), `self-attention-heatmap` ×2 (5.2, 5.7), `multi-head-view` ×1 (5.4), `positional-encoding` ×1 (5.5). **Eight distinct Spanish captions.** Two ids carry a corpus, two do not |
| `<Figure>` | **1** | 5.3's `escalado-softmax.svg`, and it **has Spanish set into the SVG**. Block 4 had four of four; this block has one of one |
| `<Leccion ancla="">` | **0** | **102 slug-only refs and not a single anchor in eleven lessons** — nothing in this block re-derives a heading id |
| `reading` | 19 | **All 19 `lang: en`** — no Spanish-language source in the block; 19 Spanish `note`s to translate. 5.6 carries 4, the most |
| `<W>` | 108 | 5.10 (27), 5.4 (22), **5.8 (19, all English figure labels that stay)**, 5.2 (15), 5.9 (8), 5.11 (5), 5.3 (4), 5.7 (4), 5.1 (2), 5.5 (2), 5.6 (0) |

**Where the cost actually is.** Six of the eleven are prose-and-identifiers work, and 5.6 is a clean
transpose with zero `<W>`. The block's cost concentrates in **5.4 and 5.10**, and then in **5.2**,
and all three spend it on a corpus that lives outside the lesson file:

| Lesson | What must be replaced | Who owns it |
|---|---|---|
| 5.2 | The demonstration sentence + the token count quoted off it | **P11-02** (the widget lexicon) |
| 5.4 | A centre-embedded clause with two verbs pulling opposite ways, plus six quoted weights | **P11-02** (lexicon + rules + `MH_PRESETS`) |
| 5.8 | The label-correspondence table and its premise sentence | This lesson, downstream of P11-02's 15 box labels |
| 5.10 | The polysemous word and its shared-prefix pair | **Block 1's 1.8** — inherit, do not redecide |
| 5.9 | The toy pair and five numbers — **only under Option B** | **Block 4's direction decision** |

**Three external dependencies gate this block, and none of them is inside it.** P11-02 must land
before 5.2. Block 1's 1.8 must be written before 5.10. Block 2's 2.10 must be written before 5.11,
which quotes five of its figures. Block 4's direction decision fixes 5.9's class.

## Lesson progress

- [ ] 5.1 `adios-recurrencia`
- [ ] 5.2 `self-attention`
- [ ] 5.3 `scaled-dot-product`
- [ ] 5.4 `multi-head`
- [ ] 5.5 `codificacion-posicional`
- [ ] 5.6 `bloque-transformer`
- [ ] 5.7 `encoder-decoder-masking`
- [ ] 5.8 `arquitectura-completa`
- [ ] 5.9 `proyecto-transformer`
- [ ] 5.10 `bert-y-gpt`
- [ ] 5.11 `fine-tuning-colab`

## The demonstration sentence — decided in 5.2, shared with 5.4

`las llaves del coche están ahí` is doing real work. `están` is plural, and the only plural noun
it can agree with is `llaves`, not the adjacent `coche` — so the attention map has a bright
off-diagonal cell that the prose can point at and say *this is the model resolving agreement
across an intervening noun*. It is a good example precisely because Spanish marks the agreement
loudly.

English marks it more quietly (`are` vs `is`), but the same construction exists: *the keys to the
car **are** over there* has exactly the same structure and the same attractor noun. Verify the
replacement in the rendered widget before writing the paragraph that points at it — the criterion
is that the cell the prose names is visibly the brightest in its row, not that the sentence is a
good translation.

5.4 reuses the sentence to show different heads attending differently. Pick once, in 5.2.

## 5.11 and the notebooks

The fine-tuning lesson hands off to Colab because PyTorch does not run in Pyodide — by design,
per `PLAN.md`. The notebooks under `docs/courses/notebooks/` are Spanish and are **out of scope**
for this phase: translating them is its own task with its own verification story (they have to be
executed end-to-end on Colab, which nothing in `lint:content` or `pnpm build` can check).

Translate the lesson, and have it link the Spanish notebooks, exactly as the reader's other
fallbacks work today. Note the gap in `STATUS.md` rather than leaving it implicit.

## Acceptance criteria

- [ ] Every lesson in the block exists under `content/courses/dl-nlp/en/`, `draft: false`
- [ ] `slug`, `block`, `order`, and every widget / quiz / challenge id match the Spanish lesson
- [ ] Every `<PyCell>` and `<CodeChallenge>` has been **run in the browser**, and every number the
      prose quotes matches what Pyodide printed
- [ ] Every `<Leccion>` resolves; every `ancla` points at an English heading where the target is
      translated, and at the Spanish one where it is not
- [ ] `reading` carries the same sources with translated `note`s; `lang` values unchanged
- [ ] The two-reader test passes against the **English** neighbours
- [ ] `pnpm lint:content` clean (budget warnings advisory); `pnpm build` green
- [ ] **Phase exit:** `fullyTranslated` is true for `en`; no lesson route emits the fallback
      `noindex`; hreflang is reciprocal for all 43 lessons

## Test plan

- `pnpm lint:content` after each lesson; `pnpm build` before each PR.
- Read every lesson in the browser at 360px — the reader is mobile-first and English line lengths
  differ from Spanish inside the same display-maths containers.
- Run every code cell and challenge in the browser. Re-running is not optional even when only
  identifiers changed: Pyodide's BLAS differs from CPython's, and the prose quotes printed values.
- After the last lesson: confirm `/en/cursos/dl-nlp` reports no untranslated-content notice, and
  spot-check three lesson pages for `noindex` having gone and hreflang being reciprocal.

## Gotchas

- **Translating a lesson invalidates inbound anchors.** Any already-translated lesson holding
  `<Leccion slug="X" ancla="…">` breaks when X is translated. By this block most targets are
  already translated, so the effect is largest here — check the lint output, not only the diff.
- **The bridge is a contract.** Translate in order; never skip a lesson and come back.
- **Under-budget word warnings are expected** on transposed lessons — see `AUTHORING.en.md`.

## Out of scope

- Editing the Spanish lesson. If translation exposes a Spanish error, that is a separate PR.
- Changing block/order or any id.
- Widget strings and corpora — P11-02 owns those.
- The Colab notebooks — see above.

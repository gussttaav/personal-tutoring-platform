# P11-07 — Block 4: The Bridge to Attention

**Tag:** `COURSE-P11-07` · **Size:** L · **Status:** not started

## TL;DR

Six lessons — the shortest block. Mostly **transpose**, with one structural catch: this block is
*about* translation, so several of its worked examples are Spanish–English pairs, and their
direction has to be reconsidered rather than translated.

## Classification

Filled by [P11-00](00-triage.md) — read against the six `es/` lessons selected by their `block: 4`
frontmatter, in `order`. Unlike Block 3, file number and frontmatter agree throughout: `es/27` …
`es/32` are 4.1 … 4.6.

**Every class in this block is stated against the direction decision below.** One lesson — 4.3 —
sits on the adapt/rewrite line and falls on the side the decision puts it. The table gives its
class under each option; nothing else in the block moves either way.

| # | Slug | Class | Spanish-dependent artifacts |
|---|---|---|---|
| 4.1 | `encoder-decoder` | **adapt** | The whole opening pair (`ayer leí un libro muy bueno` ↔ `yesterday i read a very good book`) and the three properties it argues; the **toy translator's two vocabularies** and the five numbers derived from them; `decodificacion-voraz.svg`, whose column labels *are* `V_y` and which also has `paso` set into it |
| 4.2 | `el-cuello-de-botella` | **transpose** | None. The task is the alphabet-only reversal (`V = list("abcd")`), every quiz item is arithmetic, and `context-bottleneck` carries **no corpus** — sliders and one `aria-label` |
| 4.3 | `la-idea-de-atencion` | **adapt** (Option A) / **rewrite** (Option B) | The alignment corpus, held in **two places that must agree** — the widget's math module and the lesson's own `<PyCell>`. `q-cuantas-puntuaciones` is `numeric` and its answer is $T_x \cdot T_y$ of the named sentence: **48 is the one answer in the block that the pair can move** |
| 4.4 | `bahdanau` | **adapt** | Three rows of the map read out with their weights (`0.74`, `0.81`, `0.05`), and a second `attention-alignment` caption that names the rows by number. The maths, the challenge and all five quiz answers are language-free |
| 4.5 | `luong` | **transpose** | One prose clause (`una lee español, la otra escribe inglés`, 188). **No widget, no `<W>`, no map, no pair** — the hypothesis was wrong. Carries a Spanish-bearing `atencion-costes.svg` |
| 4.6 | `atencion-como-consulta` | **transpose** | None of its own; the lesson is deliberately language-free. Quotes 4.5's `0.851`/`0.167`, and carries a Spanish-bearing `atencion-qkv.svg` |

### What changed from the planning pass

Three of the six pre-filled rows were wrong or incomplete, and one hazard the table did not name
turns out to be block-wide.

- **4.4 — confirmed, with its scope corrected.** The row called the example "the pair
  `<W>leí</W>` ↔ `<W>read</W>`". It is not a pair, it is **three rows of the alignment map** —
  rows 2, 3 and 4 (`i`, `read`, `a`), read out with their weights `0.74`, `0.81` and `0.05`
  (`30-bahdanau.mdx:181–186`) — and the Explorable caption names them *by number*
  ("las filas 2, 3 y 4", 190). The dependency is on the map's layout and its individual entries,
  not on two words. Class **adapt** stands.
- **4.5 — wrong.** "Shares 4.4's alignment example" is not true: `es/31-luong.mdx` has **no
  `<Explorable>`, no `<W>` and no alignment map**. Its only pair-dependent text is one subordinate
  clause at line 188. It is a **transpose**, and the cheapest lesson in the block after 4.2.
- **4.2 — confirmed and downgraded.** "`context-bottleneck` widget — numeric" is right, and the
  widget has **no corpus at all**: two sliders, a plot and one `aria-label`. Nothing else in the
  lesson is Spanish-dependent either, so it is a clean **transpose**, not an adapt.
- **4.1 — the row said "Translation-pair examples" and understated it.** The lesson does not just
  *cite* a pair, it **trains a toy translator on a purpose-built one**, and five numbers the prose
  quotes are functions of that toy language's vocabulary sizes and grammar. 4.1 is where the
  direction decision is spent.
- **4.3 — the row was blank and it is the second-heaviest lesson in the block.** It holds the
  alignment corpus twice over, quotes four numbers computed from it, and carries the block's only
  quiz answer that the pair can move.
- **Block-wide, and in no row: all four `<Figure>` assets have Spanish set into the SVG.** Block 3
  had one of three. Here it is four of four — see the asset table below.

### Artifact inventory

Line refs are into the `es/` file named in each heading.

#### 4.1 `encoder-decoder` — `es/27-encoder-decoder.mdx` — adapt

- **Quiz (4, no answer moves under either option).** `q-por-que-eos` `single` a (12–22) —
  architecture; its distractor (b) and explanation lean on the *toy* grammar ("la salida sí mide
  siempre uno más que la entrada"), which any replacement toy language has to keep or the trap
  stops being a trap. `q-factorizacion` `single` a (23–33), pure probability.
  `q-voraz-no-optimo` `boolean` false (34–39), a two-path arithmetic counterexample.
  `q-aprende-a-parar` `single` a (40–50) — carries `<W>book</W>` and `<W>red</W>` in option (a)'s
  explanation, both entries of `V_y`; they move with the vocabulary, the answer does not.
- **The opening example** (80–85): `ayer leí un libro muy bueno` → `yesterday i read a very good
  book`, plus the alternative `... a really good book`. It argues **three properties at once** —
  6 in / 7 out because the target must write the pronoun Spanish keeps inside the conjugation;
  the adjective moving in front of the noun; more than one acceptable translation. All three are
  properties of this pair, and 4.1's whole opening is built on them. The two-vocabulary section
  (90–94) then reuses `libro` / `book`.
- **`<PyCell>` ×3** (249–278, 292–348, 355–382). The first defines the toy language: `VX` = 6
  Spanish words, `VY` = 7 English words + `<EOS>`, the `TRAD` map, and `frase()`, whose grammar
  is verb + noun + optional adjective with the target prepending `i` and fronting the adjective.
  The third holds `ejemplos`, six hand-written Spanish inputs (373–374). Spanish identifiers
  throughout (`frase`, `datos`, `paso`, `pesos`, `suave`, `traduce`, `quiero`, `ent`) and Spanish
  print headers (272, 347, 375).
- **Five numbers quoted in prose, all functions of the toy language:** "seis palabras en español y
  otro con siete en inglés" (242–243); $T_y = T_x + 2$ (283); "Doce frases posibles"
  (283, = 2 verbs × 2 nouns × 3 adjective options); $\ln 8 \approx 2.08$ (350, = $\ln \lvert V_y
  \rvert$); "entran dos o tres tokens y salen tres o cuatro, uno más siempre" (384–385). They move
  together with the vocabulary sizes and the grammar, and only with those — the training curve and
  the OK/X column are seed-driven and hold.
- **`<Figure>`** (109–113) `decodificacion-voraz.svg`: Spanish `alt` and `caption` naming the
  source phrase «vendo coches nuevos», and **the SVG carries `paso 1` … `paso 5` plus the eight
  `V_y` tokens** (`i`, `read`, `sell`, `red`, `new`, `books`, `cars`, `<EOS>`) as its column
  labels. A new asset either way, because of `paso`; a redrawn one if the vocabulary changes.
- **`<Leccion ancla="">`: 0** (4 slug-only refs). **`reading`:** 2 (52–68), both `lang: en`,
  Spanish notes.
- **`<W>`: 28** — but 17 of them are `<EOS>`, which survives untouched. The other 11 are the pair:
  `i` ×3, `book` ×2, `libro`, `red`, and the four full phrases (80, 83, 84).

#### 4.2 `el-cuello-de-botella` — `es/28-el-cuello-de-botella.mdx` — transpose

- **Quiz (4, all language-free).** `q-entrenar-mas` `single` a (12–22), read off the accuracy
  table; `q-cuenta-tmax` `numeric` 16 (23–30), powers of two; `q-doblar-dh` `boolean` true
  (31–36); `q-primer-token` `single` a (37–47), the gradient-route argument.
- **`<PyCell>` ×2** (183–228, 237–280): the reversal task of `es/26-seq2seq.mdx`, **alphabet-only**
  — `V = list("abcd")` (187) — so nothing here is language-dependent. Spanish identifiers `monta`,
  `paso`, `pesos`, `escribe`, `acierto`, `fila`, `bien`, `cortes`; Spanish print header (265, 278).
  Quoted output is the four-row accuracy table read qualitatively (282–295) plus "una de cada
  tres" / "una de cada doce" (292); seed-driven, re-run to confirm.
- **`<Explorable>` `context-bottleneck`** (82–85), Spanish caption. **No corpus** —
  `ContextBottleneck.tsx` carries two slider labels (71, 80), two `format` strings (77, 86), the
  `10 elevado a N` readout helper (44) and one `aria-label` (105). P11-02; `Ancho del estado` is
  already in its §3 terminology list.
- **`<Leccion ancla="">`: 0** (6 refs). **`reading`:** 1 (49–57), `lang: en`, Spanish note.
- **`<W>`: 0.** No `<Figure>`, no `<CodeChallenge>`.

#### 4.3 `la-idea-de-atencion` — `es/29-la-idea-de-atencion.mdx` — adapt (Option A) / rewrite (Option B)

- **Quiz (4).** `q-eje-del-softmax` `single` a (12–22) — the answer is which axis the softmax
  runs over, and it holds; **its explanation quotes a number computed from the alignment matrix**:
  "`leí` alimenta dos pasos a la vez y su columna suma $1.77$" (21). `q-alineacion-congelada`
  `single` a (23–33) and `q-por-que-no-argmax` `single` a (34–44) are architecture and calculus.
  **`q-cuantas-puntuaciones` `numeric` 48 (45–52) is the block's one movable answer**: the prompt
  names the sentence and states its six tokens and eight steps, and the answer is $6 \cdot 8$.
- **`<Explorable>` `attention-alignment`** (104–107), Spanish caption. This is the widget whose
  corpus **is** the pair — see the pair inventory.
- **The map read out in prose** (93–102): `book` ← `libro` and `very` ← `muy`; `i` and `read` both
  pulling on `leí`; `book` at **step 7** reaching back to **position 4** past steps 5 and 6 sitting
  on `muy` and `bueno`. The step and position numbers are as load-bearing as the words.
- **`<PyCell>`** (251–289) — **a second copy of the widget corpus inside the lesson**: `FUENTE`
  (255), `SALIDA` (256), `alfa` 8×6 with a comment per row (257–264), `H` 6×5 (266–268). The two
  copies must stay in step; nothing enforces it.
- **Printed output quoted in prose** (291–300): the distances `0.25` and `0.32` for `good` and
  `<EOS>`, and "los de `yesterday` y `book` pasan de $1.35$". All three are $\lVert \mathbf{c}_i -
  \mathbf{c}^{\text{fijo}}_i \rVert$, functions of `alfa` **and** `H` — they move if either does.
- **`<Figure>`** (158–162) `atencion-contexto.svg`: Spanish `alt` and `caption`; the SVG is
  otherwise symbolic but **has `números` set into it**, so it needs a new asset.
- **`<Leccion ancla="">`: 0** (8 refs). **`reading`:** 2 (54–70), both `lang: en`, Spanish notes.
- **`<W>`: 19** — 17 of them are the pair's tokens, 2 are `<EOS>`.

#### 4.4 `bahdanau` — `es/30-bahdanau.mdx` — adapt

- **Quiz (5, no answer moves under either option).** `q-por-que-tanh` `single` a (12–22);
  `q-parametros-de-a` `numeric` 4128 (23–30), arithmetic on hypothetical $d_h = 64$, $d_a = 32$;
  `q-dos-caminos` `multi` [a,b] (31–41); `q-comparacion` `single` a (42–52);
  `q-que-se-precalcula` `single` a (53–63). **All five are calculus or shape-counting.**
- **The three rows** (181–186): `i` and `read` taking `0.74` and `0.81` from position 2, and `a`
  leaving it at `0.05`, to make the point that the same $\bar{\mathbf{h}}_2$ scores differently
  against different decoder states. The three weights are entries of `alfa`.
- **`<Explorable>` `attention-alignment`** (188–191) — the widget's **second use, with a different
  Spanish caption**, and the caption names the rows by number ("la 2, la 3 y la 4"). One widget id,
  two captions across 4.3 and 4.4, both translated here; the widget's own strings are P11-02's.
- **`<CodeChallenge>` `ch-atencion-aditiva`** (64–151): Spanish `prompt` (66–74), 1
  `# tu código aquí` (81), 5 test `name`s, 10 Spanish assertion messages (91–132), Spanish
  `solution` comments (138–143) and `explanation` (144–151); identifier `alineacion`.
- **`<PyCell>` ×2** (335–371, 384–422). **Shapes borrowed from the alignment example:**
  `T_y, T_x, d_h, d_a = 8, 6, 5, 4` (338). Quoted output — the top weight ≈ `0.18` against a
  uniform `0.167` = $1/T_x$ (373–374), "las ocho filas" (374), "fila 1" / "fila 8" (368–369, 377),
  and "once veces mayor" (426) — all hold as long as the shape holds. Spanish identifiers
  `puntua`, `softmax_filas`, `mezcla`, `perdida`, `valor`, `puntuacion`, `lineal`; Spanish prints.
- **`<Leccion ancla="">`: 0** (8 refs). **`reading`:** 1 (152–160), `lang: en`, Spanish note.
- **`<W>`: 4** — `i`, `read`, `leí`, `a`, all inside the three-row example. No `<Figure>`.

#### 4.5 `luong` — `es/31-luong.mdx` — transpose

- **Quiz (4, all language-free).** `q-que-mide-wa` `single` a (12–22); `q-parametros-luong`
  `numeric` 4096 (23–30); `q-memoria-intermedia` `single` a (31–41) — its `921 600`, `3 600` and
  `7.4` MB are arithmetic on hypothetical $T_x = T_y = 60$, $d_a = 256$ and hold;
  `q-sigue-secuencial` `single` a (42–52).
- **The one pair-dependent line in the lesson:** "Son dos recurrencias distintas … **una lee
  español, la otra escribe inglés**" (188). Free prose; it follows whatever direction 4.1 picked.
- **`<CodeChallenge>` `ch-atencion-multiplicativa`** (53–150): Spanish `prompt` (55–63), 1
  `# tu código aquí` (70), 6 test `name`s, 13 Spanish assertion messages (80–133), Spanish
  `solution` comments and `explanation` (142–150); identifier `alineacion_multiplicativa`.
- **`<PyCell>` ×2** (337–367, 381–417). The first reuses `T_y, T_x, d_h, d_a = 8, 6, 5, 4` (340)
  and the same seed as 4.4's, which is what makes the comparison in the prose legitimate; quoted
  output `0.851` against the uniform `0.167` (372). The second is the 60 × 60 cost measurement —
  hypothetical sizes, no corpus — quoting `7.4` MB and `2.2`/`4.9` million (420–425); its timing
  line is explicitly machine-dependent and the prose already says so.
- **`<Figure>`** (293–297) `atencion-costes.svg`: Spanish `alt` and `caption`, **and Spanish set
  into the asset** — `aditiva`, `multiplicativa`, `una suma, un tanh y una lectura`, `dos productos
  y nada en medio`, `puntuaciones`. New asset.
- **`<Leccion ancla="">`: 0** (6 refs). **`reading`:** 1 (151–159), `lang: en`, Spanish note.
- **`<W>`: 0.** No `<Explorable>`.

#### 4.6 `atencion-como-consulta` — `es/32-atencion-como-consulta.mdx` — transpose

- **Quiz (5, all language-free).** `q-quien-es-cada-papel` `single` a (12–22);
  `q-forma-de-la-salida` `numeric` 32 (23–30), hypothetical shapes; `q-clave-contra-valor`
  `single` a (31–41); `q-rutas-del-gradiente` `multi` [a,b,c] (42–52); `q-donde-fue-wa` `single` a
  (53–63). The lesson is the one in the block that says out loud it depends on no language
  ("Ni una de esas piezas menciona una recurrencia, ni un idioma, ni una traducción", 190).
- **`<CodeChallenge>` `ch-atencion-qkv`** (64–166): Spanish `prompt` (66–75), 1 `# tu código aquí`
  (82), 6 test `name`s, **18 Spanish assertion messages** (91–149, the most in the block), Spanish
  `solution` comments and `explanation` (159–166); identifier `atencion`.
- **`<PyCell>`** (358–399): `T_y, T_x, d_h = 8, 6, 5` (361) — the same shape lineage. Prose quotes
  "el mapa sigue siendo $8 \times 6$" (404) and the desatado shapes $d_k = 3$, $d_v = 7$ (355–356,
  403–405). Spanish identifiers `softmax_filas`, `atencion`, `otra_K`, `otra_V`; Spanish prints.
- **Cross-lesson number:** line 344 quotes **4.5's** `0.851` and `0.167` to motivate the
  $\sqrt{d_k}$ divisor. It moves only if 4.5's cell shapes move.
- **The dictionary analogy** (195–199) points at the `P["z"]` lookup in the LSTM and GRU
  challenges — Block 3, P11-06. The key `"z"` is the GRU update gate; language-free, holds.
- **`<Figure>`** (208–212) `atencion-qkv.svg`: Spanish `alt` and `caption`, **and Spanish set into
  the asset** — `claves`, `valores`, `un solo vector`, `números`, `y softmax sobre las posiciones`.
  New asset.
- **`<Leccion ancla="">`: 0**, with **15 slug-only refs — the densest in the block**. **`reading`:**
  1 (167–175), `lang: en`, Spanish note. **`<W>`: 0.** No `<Explorable>`.

### Block totals

| | Count | Notes |
|---|---|---|
| **Lessons** | 6 | `es/27` … `es/32`, selected by `block: 4`; file number and `order` agree |
| **Transpose** | **3** | 4.2, 4.5, 4.6 |
| **Adapt** | **3** / 2 | 4.1, 4.3, 4.4 under Option A — 4.1 and 4.4 under Option B |
| **Rewrite** | **0** / 1 | none under Option A; **4.3** under Option B |
| Quiz items | 26 | 17 `single`, 5 `numeric`, 2 `boolean`, 2 `multi` — **exactly one answer can move**, 4.3's `q-cuantas-puntuaciones` |
| `<PyCell>` | 11 | all re-run; 4.1's 3 and 4.3's 1 are **regenerated** if the pair changes |
| `<CodeChallenge>` | 3 | 4.4, 4.5, 4.6 — 41 Spanish assertion messages, 17 test `name`s, 3 `# tu código aquí`; **all three are language-free maths** |
| `<Explorable>` | 3 uses / 2 ids | `attention-alignment` ×2 (4.3, 4.4) with **two different captions**; `context-bottleneck` ×1 (4.2). Only the first carries a corpus |
| `<Figure>` | 4 | **all four have Spanish set into the SVG** — see below. Block 3 had one of three |
| `<Leccion ancla="">` | **0** | 47 slug-only refs, so no anchor is re-derived anywhere in this block |
| `reading` | 8 | **all `lang: en`** — no Spanish-language source in the block; 8 Spanish `note`s to translate |
| `<W>` | 51 | 4.1 (28, of which 17 are `<EOS>`), 4.3 (19), 4.4 (4). 4.2, 4.5 and 4.6 have none |

**Every `<Figure>` in this block needs a new asset.**

| Asset | Lesson | Spanish set into the SVG | Also moves if the pair changes |
|---|---|---|---|
| `decodificacion-voraz.svg` | 4.1 | `paso 1` … `paso 5` | Yes — its 8 column labels **are** `V_y` |
| `atencion-contexto.svg` | 4.3 | `números` | No — otherwise symbolic |
| `atencion-costes.svg` | 4.5 | `aditiva`, `multiplicativa`, and two full label sentences | No |
| `atencion-qkv.svg` | 4.6 | `claves`, `valores`, `un solo vector`, `números`, and one label sentence | No |

**Sizing read.** 4.2, 4.5 and 4.6 are prose-and-identifiers work, and 4.6 is the largest of the
three only because it has the most crosslinks and the longest challenge. The block's cost is
concentrated in **4.1 and 4.3**, and both of them spend it on the same decision.

## Lesson progress

- [ ] 4.1 `encoder-decoder`
- [ ] 4.2 `el-cuello-de-botella`
- [ ] 4.3 `la-idea-de-atencion`
- [ ] 4.4 `bahdanau`
- [ ] 4.5 `luong`
- [ ] 4.6 `atencion-como-consulta`

## The direction decision — make it once, in 4.1

A block about machine translation needs a language pair, and the Spanish course reasonably used
Spanish→English: `leí` aligning to `read` is a clean one-to-one across a word-order change, and a
Spanish reader knows both sides.

An English reader knows only one side of that pair. Two options, and the block must pick one in
4.1 and hold it through 4.6, because 4.4 and 4.5 share the alignment example and the widget:

- **Keep Spanish→English, reframed.** The reader is the *target*-language speaker. Alignment is
  still legible — you can see which English word came from which Spanish one without speaking
  Spanish — and it costs no new widget data.
- **Switch to English→French**, or another pair whose source the reader can read.

Neither is obviously right, which is exactly why it is decided once rather than per lesson. The
constraint that decides it: whichever pair is chosen must make the **alignment heat map
off-diagonal**, or the widget stops demonstrating alignment — the same property P11-02 records
for the self-attention corpus.

*P11-00 does not decide this.* What follows is the inventory the decision needs: everything in the
block that depends on the pair, so the cost of each option is visible when the call is made.

### Correction to the framing above

**4.4 and 4.5 do not share the alignment example.** 4.5 has no widget, no map and no pair — one
prose clause is its whole exposure. The lessons that share it are **4.3 and 4.4**, which render
`attention-alignment` with two different captions. The lessons that spend the decision are **4.1**
(its own, separate toy pair) and **4.3** (the map).

### The pair inventory

Three distinct pair-shaped things live in this block, and they are independent of each other.

**1. The toy translator — 4.1 only.** A six-word Spanish vocabulary, a seven-word English one plus
`<EOS>`, and a grammar chosen so the target inserts a pronoun and fronts an adjective. It is
trained in the browser, and five quoted numbers fall out of it.

**2. The alignment map — 4.3 and 4.4, plus the widget.** One six-token source, one eight-step
target, an 8 × 6 hand-set matrix and six 5-coordinate states. Held in **three** places:

| Where | What it holds |
|---|---|
| `src/features/courses/widgets/math/attention-alignment.ts:31–75` | `ALIGNMENT_SOURCE`, `ALIGNMENT_TARGET`, `ATTENTION_ALIGNMENT`, `ENCODER_STATES` — and a header that states the off-diagonal property as a design constraint |
| `es/29-la-idea-de-atencion.mdx:255–268` | `FUENTE`, `SALIDA`, `alfa`, `H` — a copy, in the lesson's `<PyCell>` |
| `src/features/courses/widgets/math/__tests__/attention-alignment.test.ts:58–76, 147–156` | Asserts the teaching property **by naming `leí`, `libro`, `muy` and `bueno`** |

**3. The shape, 6 × 8, which has leaked into three lessons that have no pair.** 4.4, 4.5 and 4.6
each open a `<PyCell>` with `T_y, T_x = 8, 6` on random data, and their prose quotes the uniform
baseline $1/T_x = 0.167$, "las ocho filas", "fila 8" and "el mapa sigue siendo $8 \times 6$".

#### What depends on the pair, lesson by lesson

| Lesson | Depends on the pair | Line refs |
|---|---|---|
| **4.1** | The opening example and the three properties it argues (length change, reordering, non-uniqueness) | 80–85, 102–107 |
| | `libro` / `book` as the two-vocabulary illustration | 90–94 |
| | `VX`, `VY`, `TRAD` and `frase()`'s grammar | 249–278 |
| | The six hand-written `ejemplos` | 373–374 |
| | Five quoted numbers: 6/7 words, $T_y = T_x + 2$, twelve sentences, $\ln 8 = 2.08$, "dos o tres … tres o cuatro" | 242–243, 283, 350, 384–385 |
| | `decodificacion-voraz.svg`'s eight column labels, and its caption's source phrase | 109–113 + asset |
| | 11 of 28 `<W>` (the other 17 are `<EOS>`) | 80–93, 246, 281 |
| **4.2** | Nothing | — |
| **4.3** | The Explorable's corpus, via the widget's math module | 104–107 |
| | The map read out in prose, with step and position numbers | 93–102 |
| | `FUENTE`, `SALIDA`, `alfa`, `H` in the lesson's own cell | 255–268 |
| | `1.77` — a column sum, quoted **inside a quiz explanation** | 21 |
| | **`q-cuantas-puntuaciones`'s answer, 48 = $T_x \cdot T_y$** | 45–52 |
| | `0.25`, `0.32`, `1.35` — distances computed from `alfa` and `H` | 291–300 |
| | 17 of 19 `<W>` | 93–101, 295–297 |
| **4.4** | Three rows read out with their weights `0.74`, `0.81`, `0.05` | 181–186 |
| | The Explorable caption, which names the rows **by number** | 188–191 |
| | All 4 `<W>` | 181–183 |
| | The 8 × 6 shape and `0.167` / "ocho filas" / "fila 8" (shape only, not the words) | 338, 368–377 |
| **4.5** | One prose clause naming the two languages | 188 |
| | The 8 × 6 shape and `0.851` / `0.167` (shape only) | 340, 372 |
| **4.6** | The 8 × 6 shape and the quoted `8 × 6`; 4.5's `0.851` / `0.167` quoted again | 361, 344, 404 |

#### What each option costs

**Option A — keep Spanish→English, reframed.**

- No new widget data. The math module, its test and both copies of the corpus stay as they are;
  P11-02's `corpora.ts` gets an entry that resolves to the **same** corpus in both locales, which
  its acceptance criteria already allow for.
- **No number in the block moves.** 4.3 stays an **adapt**; the block is 3 transpose / 3 adapt / 0
  rewrite.
- The work is prose, in three places: 4.1's opening (80–107), 4.3's map readout (93–102) and 4.4's
  three rows (181–186) each have to be rewritten so a reader who does not read Spanish can follow
  them — the source words become objects to point at rather than words to understand.
- What it costs the reader: the pair's most-used property — that `i` and `read` both come from
  `leí`, because Spanish carries the pronoun inside the conjugation — has to be **told** rather
  than seen. It is load-bearing in 4.1 (it is the length-change argument), in 4.3 (it is why a
  column can sum to more than 1) and in 4.4 (it is the three-row example).

**Option B — switch to a pair whose source the reader can read.**

- A new corpus in the math module, a locale-keyed entry in P11-02's `corpora.ts`, and a second set
  of assertions in `attention-alignment.test.ts` (or an English twin of it) — the existing test
  names the Spanish tokens directly, so it cannot simply be pointed at new data.
- New `alfa` and new `H`, and with them every quoted weight, column sum and distance in 4.3 and
  4.4 recomputed and re-run in the browser.
- **4.3 becomes a rewrite**: `q-cuantas-puntuaciones`'s answer is $T_x \cdot T_y$ of the sentence
  its prompt names.
- **Choosing a 6-token source and a 7-word + `<EOS>` target keeps the blast radius to 4.3 and
  4.4.** Any other size propagates into 4.4, 4.5 and 4.6 — three more cells to re-run and four
  more quoted numbers (`0.167`, "ocho filas", "fila 8", `8 × 6`, and 4.6's inherited `0.851`).
- 4.1's toy language is rebuilt from scratch — two vocabularies, a grammar, five recomputed
  numbers — and `decodificacion-voraz.svg` is redrawn with the new `V_y`.
- What it buys: the reader reads both sides of every example in the block.

#### The constraint, stated against what the current pair actually supplies

The map must stay off-diagonal, and the current one is off-diagonal for **two independent
reasons**, both written into the math module's header as design constraints:

- **One-to-many.** Source position 2 (`leí`) is the top source for *two* output steps (`i` and
  `read`), so its column sums to 1.77. This comes from Spanish pro-drop, which English does not
  have **as a source language** — an English source needs a different mechanism for it
  (a negation or a compound that expands in the target is the usual one).
- **A crossing.** Step 7 (`book`) reaches back to position 4 (`libro`) after steps 5 and 6 sat on
  positions 5 and 6 (`muy`, `bueno`). This comes from adjective placement, and it survives into
  any Romance target.

A replacement pair has to supply both, and the check is not that the sentence reads well — it is
that the rendered map has a bright cell where the prose says it does. P11-02's test plan already
makes that a manual, non-optional step; it applies here for the same reason.

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

## Test plan

- `pnpm lint:content` after each lesson; `pnpm build` before each PR.
- Read every lesson in the browser at 360px — the reader is mobile-first and English line lengths
  differ from Spanish inside the same display-maths containers.
- Run every code cell and challenge in the browser. Re-running is not optional even when only
  identifiers changed: Pyodide's BLAS differs from CPython's, and the prose quotes printed values.

## Gotchas

- **Translating a lesson invalidates inbound anchors.** Any already-translated lesson holding
  `<Leccion slug="X" ancla="…">` breaks when X is translated, because X now renders English
  heading ids. P11-01 makes this a lint failure rather than a silent miss — expect a PR to fix a
  file it did not otherwise touch, and check the lint output rather than only the diff.
- **The bridge is a contract.** The closing after `---` is what the next lesson's opening picks
  up. Translate in order; never skip a lesson and come back.
- **Under-budget word warnings are expected** on transposed lessons — see `AUTHORING.en.md`.
- *Added by P11-00:* **the alignment corpus lives in three files, and one of them is a test.**
  Changing it and running only `pnpm lint:content` will look clean; `attention-alignment.test.ts`
  is what fails, and it fails on `leí` and `libro` by name.
- *Added by P11-00:* **`8, 6` is not a coincidence in 4.4, 4.5 and 4.6.** Those cells use random
  data, so nothing forces them to match the alignment example — but their prose quotes `0.167`,
  "ocho filas" and `8 × 6`, so changing the shape in one of them silently falsifies the others.

## Out of scope

- Editing the Spanish lesson. If translation exposes a Spanish error, that is a separate PR.
- Changing block/order or any id.
- Widget strings and corpora — P11-02 owns those. **One gap to hand back to it:** its corpus table
  has a single row for "self-attention / alignment", and the two widgets do not have the same kind
  of corpus. Self-attention's is one monolingual sentence; `attention-alignment`'s is a *pair*
  plus a hand-set 8 × 6 matrix plus six encoder states, and its teaching property is the two
  off-diagonal mechanisms above, not coreference. It needs its own row.

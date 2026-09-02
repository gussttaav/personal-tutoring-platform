# P11-05 — Block 2: The Multilayer Perceptron

**Tag:** `COURSE-P11-05` · **Size:** L · **Status:** not started

## TL;DR

Ten lessons of mathematics with one corpus underneath six of them. The block holds **one rewrite**
(2.8, a `numeric` answer built on a Spanish word count), **seven adapts** and **two transposes**,
and the cost is not spread evenly: it sits almost entirely in the ten-review corpus of 2.1, which
four later lessons recompute from and two more transcribe by hand, and in 2.10's 240-review corpus
file, which is the block's single most expensive artifact.

## Classification

Filled by [P11-00](00-triage.md) — read against the ten `es/` lessons carrying `block: 2`, in
`order`. File names and frontmatter agree throughout (`es/09` … `es/18` → 2.1 … 2.10).

**Exactly one lesson in Block 2 is a rewrite, and the planning pass did not name it.** Of the 40
quiz items, **one answer moves**: 2.8's `numeric` **−0.98704**, which is $\delta^{(1)}_2 \cdot x_4$
where $x_4 = 2$ is the count of <W>la</W> in a Spanish review. Every other item survives, including
the four that look linguistic (2.3's hidden-layer preactivation, 2.3's `predict-output`, 2.10's OOV
fraction, 2.10's generalisation-gap item), because their answers are fixed by hand-set weights,
by the ±1 coordinates, or by numbers the prompt supplies itself.

| # | Slug | Class | Spanish-dependent artifacts |
|---|---|---|---|
| 2.1 | `la-neurona` | **adapt** | **The block's root artifact.** The 10-review corpus + 8-entry `V` (230–244), re-declared verbatim in 2.4 and 2.6 and transcribed as numbers into 2.2, 2.5, 2.7 and 2.8. `V` is alphabetical and **re-sorts in English**, so `w` (260) must be re-permuted. Printed values hold *only if* the English reviews keep the six opinion words 1:1 — see the chain below |
| 2.2 | `funciones-activacion` | **transpose** | None of its own. `escalón` → *step* is terminology, not corpus; the ten preactivations are **hardcoded** (437) and inherited from 2.1. Cheapest lesson in the block: 0 `<W>`, 0 `<Figure>` |
| 2.3 | `xor-y-capas-ocultas` | **adapt** | Confirmed. The four-phrase set (70–75, 105–110, 264–269, 296–301) and the `x₁`/`x₂` semantics (100–103). **But its printed numbers do not move** — see the correction below. `xor-franja.svg` and `mlp-arquitectura.svg` carry Spanish set into the asset |
| 2.4 | `forward-pass` | **adapt** | Second cell (384–427) re-declares 2.1's corpus and runs it through **random** weights, so `la` and `película` counts reach the output: `0.357`, "cinco aciertos de diez" and the winning review (429–438) all **regenerate** |
| 2.5 | `funcion-de-perdida` | **transpose** | None of its own. The ten preactivations are **hardcoded** (400); one `<W>` review phrase in prose (169). Six quoted numbers ride on that array. `ch-entropia-cruzada` is 8 Spanish assertion messages over language-free values |
| 2.6 | `descenso-gradiente` | **adapt** | Heavier than 2.4. Re-declares the corpus (332–345), trains on it, and the prose **reads four learned weights off it** (383–388) — including an argument that `película` appears in 4 negative and 2 positive reviews and `la` the reverse. That asymmetry has to be **designed into** the English corpus, not translated |
| 2.7 | `regla-de-la-cadena` | **adapt** | The bag of words `(0,0,1,2,0,0,1,1)` **hardcoded** (387), with `i, j = 0, 2` pointing at `divertida`'s slot (406). Every quoted number regenerates, and two structural claims must survive: the third path stays **positive** (436–441) and the fourth hidden neuron stays **off** (443–445) |
| 2.8 | `backpropagation` | **rewrite** | The same hardcoded `x` (489) — **and `q-leer-un-gradiente` reads its answer off it.** See the replacement note below |
| 2.9 | `implementar-mlp` | **adapt** | Confirmed as adapt, but **far cheaper than the row claimed** — the three cells run on 2.3's ±1 matrix, not on any corpus, so nothing they print moves. See the correction below |
| 2.10 | `proyecto-sentimiento` | **adapt** | The block's most expensive lesson by a wide margin. A **new 240-review corpus file** (`public/courses/dl-nlp/resenas-cine.json`), and with it 442, 1 299, 7.1, 1.6 %, 432, 36/8.3 %, 35, 5 329, 0.883, 0.0482→0.0037, the seven named failures, `no` at 5 vs 24, `0.0014` and `0.4537` |

**Totals: 2 transpose · 7 adapt · 1 rewrite.** Ten lessons, 40 quiz items, 6 `<CodeChallenge>`,
17 `<PyCell>`, 5 distinct `<Explorable>` ids, 8 `<Figure>`, 13 `reading` entries,
**0 `<Leccion ancla="">`** (62 slug-only refs), 63 `<W>`.

### The one-line replacement note (2.8, the block's only rewrite)

*Re-run the second cell on the English review's bag of words, read the new $\boldsymbol{\delta}^{(1)}$
off it, and restate `q-leer-un-gradiente`'s answer as $\delta^{(1)}_2 \cdot x_k$ — keeping a word
that occurs **twice** at some slot $k$, so the "aparece dos veces / se corrige el doble" argument in
the explanation survives with a new index, a new $\delta$ and a new product.*

### What changed from the planning pass

Two rows carried a class and both are confirmed, one of them at a fraction of its stated cost. The
other eight split five-adapt / two-transpose / one-rewrite — and the rewrite is 2.8, a row the
planning pass left entirely blank.

**Confirmed: 2.3.** The row is right in every particular — the four phrases and the `x₁`/`x₂`
semantics defined from them are the lesson's cost, and English carries the negation flip
(*it's good* / *it's bad* / *not good* / *not bad*). What the row does not say is that **the choice
is free of arithmetic consequences.** The cell (290–356) builds `X` from the hand-written ±1
coordinates, never from the phrase text; the phrases appear only as a `.ljust(14)` label column.
So `68 921`, `17 123`, the `z^{(2)}` column and the `(1, 0)` collision are all fixed by the
coordinates and hold whatever the four phrases say. `q-capa-oculta` (**−0.5**) and
`q-representacion` (**`[1. 0.]`**) are computed from the hand-set $\mathbf{W}^{(1)}, \mathbf{b}^{(1)},
\mathbf{W}^{(2)}, \mathbf{b}^{(2)}$ and hold too. **Adapt, and a cheap one.**

**Confirmed but mispriced: 2.9.** "Three `<PyCell>`s carrying the same corpus" is wrong about
*which* corpus and wrong about the consequence. The three cells (369–415, 426–465, 489–534) run on
2.3's ±1 matrix with `default_rng(0)`; the only Spanish inside them is the four-phrase **label list**
(429), one comment (372–373) and the identifiers. **Not one printed number moves**: `0.7260`,
`0.0011`, `(1.83, 1.77)`, `(1.79, 1.85)`, `±1.80`, `−3.98`/`+3.93`, `+7.5`, `+0.2`, `6.7`,
`0.6931`, `4.73`, `0.7240` are all seed-driven, and `ch-entrena` asserts `abs(curva[0] - 0.7260) <
1e-3` on the same footing. It stays an **adapt** — the label list and the closing
<W>no está tan bien</W> (568) are real Spanish artifacts — but it is the cheapest adapt in the
block, not one of its two most expensive lessons.

**Corrected: 2.2 activation names.** "Activation names as terms (`escalón` → *step*)" is right and
is the whole of the row. There is no widget corpus behind `activation-explorer` (checked:
`ActivationExplorer.tsx` holds one Spanish literal, the label `"escalón"`), and the row's second
half — "widget labels (P11-02)" — is the entire remaining cost. The lesson has **0 `<W>`**, no
`<Figure>` and a cell whose only lesson-specific data is a hardcoded array. **Transpose.**

**Corrected: 2.5 and 2.7 are not the same kind of lesson.** The row lumped them as "code challenge
with Spanish assertion messages". They are opposite cases:

- **2.5 is a transpose.** Its cell carries no corpus at all — just the ten preactivations copied
  from 2.1 as literals (400) — so `0.881`, `0.538`, `0.049`, `0.220`, `0.633`, `0.250`, `0.693`,
  `0.9975`, `0.0049`, `202.7` and `27.63` are stable. `ch-entropia-cruzada`'s 8 assertion messages
  and `# tu código aquí` are prose inside code, which Block 3 already classed as transposable.
- **2.7 is an adapt, and the row missed why.** Its cell hardcodes the bag of words
  `x = (0, 0, 1, 2, 0, 0, 1, 1)` (387) — the `2` is `la` appearing twice — and `i, j = 0, 2`
  addresses `divertida` **by its alphabetical slot**. Change the corpus and `−0.07427622`,
  `−0.13342693`, `z^{(1)}`, `ŷ` and `ℓ` all move. Worse, two of the lesson's arguments are
  *structural*: the third path must come out **positive** so that dropping it *grows* the
  derivative, and the fourth hidden neuron must stay **off** so the diagonal shows a zero. Those
  are properties of the numbers, and the English `x` has to be checked against both.

**Corrected: 2.4 and 2.6 are adapts, and 2.6 is the block's second-heaviest lesson.** Both were
blank. Both re-declare 2.1's ten reviews and its 8-entry `V` (2.4 at 390–403, 2.6 at 332–345), and
in both the weights touch **every** column — random in 2.4, learned in 2.6 — so `la` and `película`,
which 2.1's hand-written `w` ignored, now reach the output. 2.4 regenerates `0.357`, "cinco
aciertos" and <W>divertida y buena</W> as the maximum. 2.6 regenerates `0.6931`, `0.0896`, `0.0130`,
`0.2208`, `+3.289`, `−3.023`, `−2.238` and `+1.221` — and its closing argument is a *statistical
accident of the Spanish corpus*: `película` in four negative reviews and two positive, `la` the
other way round. That has to be engineered into the English ten, or the paragraph loses its point.

**Found: 2.8 is the rewrite, and it is the only one.** The row was blank. `q-leer-un-gradiente`
(12–17) is a `numeric` item with `answer: -0.98704` and `tolerance: 0.001`, and it is
$\delta^{(1)}_2 \cdot x_4 = -0.493520 \cdot 2$. Both factors are Spanish-dependent: $x_4 = 2$ is the
count of <W>la</W> in `la película es divertida y la recomiendo`, and $\delta^{(1)}$ is computed
from that same $\mathbf{x}$ by the cell at 485–540. A natural English review — *the movie is fun and
I recommend it* — puts `the` at **one**, and the answer moves. **The prompt quotes both
$\boldsymbol{\delta}^{(1)}$ and $\mathbf{x}$ in full, so nothing here can be left standing.**

**Eight `<Figure>` assets, seven with Spanish set into the SVG, and no P11 task owns them.**
Block 1 already flagged this gap for `suma-armonica.svg` and `one-hot-equidistancia.svg`; Block 2
adds six more. P11-02 covers widgets, not `public/courses/dl-nlp/*.svg`.

| Asset | Lesson | Text inside the file |
|---|---|---|
| `mlp-arquitectura.svg` | 2.3 | `capa de entrada`, `capa oculta`, `capa de salida`, `la primera columna no calcula nada: es la entrada` |
| `xor-franja.svg` | 2.3 | `la franja entre las dos rectas es la clase positiva` |
| `perdida-correccion.svg` | 2.5 | `corrección`, `entropía cruzada`, `a la izquierda la red falla, y falla con seguridad` — **and `0,5` with a Spanish decimal comma** |
| `descenso-pasos.svg` | 2.6 | `pérdida`, `peso`, `lento`, `llega`, `sube` — **and `η = 0,10` / `0,40` / `1,05`, decimal commas** |
| `bucle-entrenamiento.svg` | 2.9 | `pérdida`, `gradiente`, `actualización`, `y otra vez`, `las cuatro cajas ya estaban escritas; la flecha verde no` |
| `reparto-resenas.svg` | 2.10 | `180 reseñas de entrenamiento`, `60 reseñas de prueba`, `442 entradas`, `600 pasos`, `53 de 60`, `lo define`, `las representa`, `sólo al final` — **four of these are data that regenerate with the corpus** |
| `forward-shapes.svg` | 2.4 | **None** — symbols only (`X`, `W⁽¹⁾ᵀ`, `Z⁽¹⁾`, `i`, `j`, `d₀ × d₁`) |
| `regla-cadena-caminos.svg` | 2.7 | **None** — symbols only (`w`, `ℒ`, `∂u₁/∂w`) |

**Five `<Explorable>` ids, none with a corpus.** `perceptron-boundary` (2.1, 2.3),
`activation-explorer` (2.2), `loss-landscape` and `gradient-descent-2d` (2.6), `backprop-trace`
(2.8). Checked against their components: all five carry labels and `aria-label`s only, which is why
none of them appears in P11-02 §2's corpus table. Captions are the lesson's, not the widget's.

**Zero `<Leccion ancla="">` in the whole block** — 63 refs, all slug-only. Block 2 imposes no anchor
debt on P11-01 and inherits none from within itself.

## The number chain — read this before translating 2.1

The block md previously located the corpus decision in 2.3. **It is in 2.1**, and it reaches six
lessons. 2.3's four phrases reach exactly one lesson and carry no arithmetic at all.

```
2.1  ten reviews + 8-entry V, w hand-written          ← the decision
 ├── 2.2  z = (2,−2,2,−2,2,−1,−2,1,0,2)   hardcoded literal (437)
 ├── 2.4  corpus re-declared (390–403)    RECOMPUTED — random weights read every column
 ├── 2.5  z = (2,−2,2,−2,2,−1,−2,1,0,2)   hardcoded literal (400)
 ├── 2.6  corpus re-declared (332–345)    RECOMPUTED — learned weights read every column
 ├── 2.7  x = (0,0,1,2,0,0,1,1)           hardcoded literal (387)
 └── 2.8  x = (0,0,1,2,0,0,1,1)           hardcoded literal (489) + THE QUIZ ANSWER

2.3  four ±1 phrases                                  ← labels only, no arithmetic
 └── 2.9  same ±1 matrix, default_rng(0)  numbers UNAFFECTED by the phrase text

2.10 its own 240-review JSON file                     ← shares nothing with either
 └── 3.1 quotes its 88.3 % and 5 329
```

Two consequences for the order of work:

1. **2.1's English corpus is a constraint problem, not a translation.** It must reproduce
   $z = (2, -2, 2, -2, 2, -1, -2, 1, 0, 2)$ so that 2.2 and 2.5 stay transposes, and that is
   achievable — 2.1's hand-written `w` gives weight $0$ to `la` and `película`, so only the six
   opinion words matter, one occurrence each. Get it wrong and two transposes become adapts, with
   an array to retype and eleven quoted numbers to re-read in each.
2. **2.4, 2.6, 2.7 and 2.8 regenerate whatever 2.1 does**, because their weights are not `w`. The
   English `V` also re-sorts alphabetically, which permutes the columns that 2.4's and 2.6's random
   draws land on. Do not try to preserve their numbers; run the cells and re-read the prose.

Identifiers travel with all of it (`resenas` → `reviews`, `frases` → `phrases`, `pasos` → `steps`,
`entrena` → `train`, `escala` → `scale`, `iguales` → `identical`, `perdida` → `loss`,
`entropia_cruzada` → `cross_entropy`, `caminos` → `paths`, `aciertos` → `correct`). Renaming an
identifier changes nothing NumPy computes — that is not where the risk is.

## Lesson progress

- [ ] 2.1 `la-neurona`
- [ ] 2.2 `funciones-activacion`
- [ ] 2.3 `xor-y-capas-ocultas`
- [ ] 2.4 `forward-pass`
- [ ] 2.5 `funcion-de-perdida`
- [ ] 2.6 `descenso-gradiente`
- [ ] 2.7 `regla-de-la-cadena`
- [ ] 2.8 `backpropagation`
- [ ] 2.9 `implementar-mlp`
- [ ] 2.10 `proyecto-sentimiento`

## Artifact inventory

Line refs are into the `es/` file named in each heading.

### 2.1 `la-neurona` — `es/09-la-neurona.mdx` — adapt

- **Quiz (3, no answer moves).** `q-z-a-mano` `numeric` **−1** (12–17): pure arithmetic on a given
  $\mathbf{w}$, $b$, $\mathbf{x}$; the explanation's $\sqrt{14}$ and $0.27$ come with it.
  `q-sesgo` `single` a (18–27): geometry; the explanation mentions "las reseñas" generically.
  `q-frontera` `multi` [a,b,d] (28–37): hyperplane properties, language-free.
- **`<PyCell>`** (226–299) — **the block's root corpus.** Ten one-line Spanish reviews with their
  labels (230–241); the 8-entry alphabetical `V` (244); the hand-written
  `w = [-1, 1, 1, 0, -1, -1, 0, 1]` (260), **indexed by that alphabetical order**. Identifiers
  `resenas`, `pos`, `etiqueta`, `decide`, `cambian`, `norma`; Spanish comments (229, 243, 259, 281,
  287, 294) and print labels (254–256, 272–298). `.ljust(41)` is sized for the Spanish strings.
- **Printed output quoted in prose** (301–314): nine of ten correct, <W>buena película pero lenta</W>
  landing at exactly $z = 0$, `2.0 → 20` and `-1.0 → -10`, ten of ten after `b = -0.5`,
  $\lVert \mathbf{w} \rVert = 2.449$, `0.816` and `-0.408`. **All hold under a 1:1 opinion-word
  swap** — $\lVert \mathbf{w} \rVert = \sqrt{6}$ is a property of `w`, not of the words — provided
  each English review carries the same six opinion words the same number of times.
- **The re-sort is the trap.** `V` is Spanish-alphabetical; `bad, boring, fun, good, movie,
  recommend, slow, the` is not the same permutation, so `w` must be re-ordered to keep each word
  on its own weight. This is the same hazard Block 1 found in 1.1, in a different lesson.
- **`<Explorable>` `perceptron-boundary`** (71–74): Spanish caption; widget has **no corpus**
  (`PerceptronBoundary.tsx` carries two Spanish strings, an `aria-label` and a status line). P11-02.
- **`<Leccion ancla="">`: 0** (3 slug-only refs). **`reading`: 0.** **`<W>`: 7** — five review
  phrases and `buena` ×2, all from the corpus.

### 2.2 `funciones-activacion` — `es/10-funciones-activacion.mdx` — transpose

- **Quiz (4, all language-free).** `q-derivada-sigmoide` `numeric` **0.09** (12–17);
  `q-identidad` `single` a (18–27); `q-saturacion` `multi` [a,b,c] (28–37);
  `q-relu-numpy` `predict-output` **`[0. 0. 1.]`** (38–49), a NumPy repr whose `hint` is about
  formatting. **No item touches Spanish.**
- **`<PyCell>`** (355–441): identifiers `escalon`, `sigmoide`, `d_sigmoide`, `d_tanh`, `cadena`,
  `identidad`, `lejos`, `defecto`, `cero`, `z_resenas`; Spanish comments (360, 387, 399, 407, 436)
  and print labels (390–440, including the `escalón:` row header).
- **Inherited data, not a corpus.** Line 437 hardcodes the ten preactivations of 2.1's neuron. The
  prose reads `0.500`, `0.269`, `0.119` and "las cuatro negativas" off it (467–472). **Re-read
  against 2.1's English cell; do not re-derive.** If 2.1 preserves $z$, nothing here moves.
- **`<CodeChallenge>` `ch-relu`** (50–114): 2 `# tu código aquí` (67, 72), 4 test `name`s, 4 Spanish
  assertion messages (78–92), Spanish `prompt` and `explanation` (103–114). Values language-free.
- **`<Explorable>` `activation-explorer`** (154–157): Spanish caption. Widget has **no corpus** —
  one label literal, `"escalón"` → *step*. P11-02, plus `AUTHORING.en.md` §Terminology.
- **`<Leccion ancla="">`: 0** (3 refs). **`reading`:** 2 (115–131), both `lang: en`, Spanish notes.
  **`<W>`: 0 — the only lesson in the block with none.**

### 2.3 `xor-y-capas-ocultas` — `es/11-xor-y-capas-ocultas.mdx` — adapt

- **Quiz (4, no answer moves).** `q-por-que-no` `single` a (12–21): the $2b$ contradiction, algebra.
  `q-activacion` `boolean` **false** (22–26): monotone activations, algebra. `q-capa-oculta`
  `numeric` **−0.5** (27–32): computed from the hand-set weights at $\mathbf{x} = (1,1)$, so the
  answer survives any phrase set that keeps the coordinate convention; **the prompt and explanation
  name three of the four phrases** (29, 32). `q-representacion` `predict-output` **`[1. 0.]`**
  (33–47): `W1`, `b1` and `x` are literals in the snippet; the prompt and explanation name two
  phrases (35, 46).
- **The four phrases, in four places.** Prose introduction (70–75), the coordinate definition
  (100–103), the `x`/`y` table (105–110), the `z^{(1)}`/`h^{(1)}`/`z^{(2)}` table (264–269) and the
  cell's label list (296–301). The `x₁` convention is "+1 when <W>no</W> is present"; `x₂` is "+1
  when the evaluative word is <W>bien</W>". English carries this: *it's good* / *it's bad* /
  *not good* / *not bad*.
- **`<PyCell>`** (290–356): `X` is built from the **hand-written ±1 coordinates** (302), never from
  the text, so `68 921`, `17 123`, the whole computed table and the
  `h(1) de «está bien» == h(1) de «no está mal»` check (350–355) are **language-free and hold
  unchanged.** Identifiers `frases`, `rectas`, `aciertos`, `escalon`, `correctos`, `h_bien`,
  `h_mal`; Spanish comments (295, 307, 320, 350) and prints (304–355), with `.ljust(14)` sized for
  `no está bien`.
- **`<Figure>` ×2, both with Spanish inside the asset.** `mlp-arquitectura.svg` (203–207): three
  column labels plus a caption line set into the SVG. `xor-franja.svg` (258–262): the region labels
  are the vectors `(1, 0)` / `(1, 1)` / `(0, 0)` (fine) but the strapline is Spanish. Both `alt`
  and `caption` are Spanish too, and the `alt`s are long.
- **`<Explorable>` `perceptron-boundary`** (80–83): Spanish caption, the second one in the block for
  this id. No corpus.
- **`<Leccion ancla="">`: 0** (4 refs). **`reading`:** 1 (49–57), `lang: en`, Spanish note.
  **`<W>`: 25 — the densest in the block**, and 22 of them are the four phrases.

### 2.4 `forward-pass` — `es/12-forward-pass.mdx` — adapt

- **Quiz (4, no answer moves).** `q-parametros` `numeric` **38786** (12–17), arithmetic.
  `q-transpuesta` `single` a (18–27), algebra. `q-broadcast` `predict-output`
  **`(3, 2) [4.5 3.5]`** (28–42), literals in the snippet. `q-cadena` `multi` [a,b,c] (43–52).
- **`<PyCell>` ×2.** The first (319–365) is `np.random.seed(0)` over pure shapes — `−0.761`,
  `3.221`, `0.221` and the timing ratio (367–378) are language-free and hold. The second
  (384–427) **re-declares 2.1's corpus** (390–401) and its `V` (403), then hits it with
  `np.random.randn` weights (408–411).
- **Printed output quoted in prose — regenerated** (429–438): the `8 → 4 → 1` shape column and the
  `41` parameters are structural and hold, but **"cinco aciertos de diez", `0.357` and
  <W>divertida y buena</W> as the maximum all move**, because random weights read the `la` and
  `película` columns that 2.1's hand-written `w` zeroed out, and the English `V` re-sorts the
  columns those draws land on. Re-run and re-read; check that the punchline — every output below
  $0.5$, so the network says no to all ten — still holds, and re-word it if it does not.
- **`<CodeChallenge>` `ch-forward`** (53–142): 2 starter comments (73, 78), 6 test `name`s, 6
  Spanish assertion messages (85–117), Spanish `prompt` and `explanation`; identifiers `capa`,
  `capas`. Values language-free.
- **`<Figure>` `forward-shapes.svg`** (170–174): Spanish `alt` and `caption`, but **the asset itself
  is symbols only** — no redraw needed.
- **`<Leccion ancla="">`: 0** (4 refs). **`reading`: 0.** **`<W>`: 1.**

### 2.5 `funcion-de-perdida` — `es/13-funcion-de-perdida.mdx` — transpose

- **Quiz (5, all language-free).** `q-ec-a-mano` `numeric` **1.609** (12–17);
  `q-mse-clasificar` `single` a (18–27); `q-gradiente-limpio` `multi` [a,b,c] (28–37);
  `q-log-cero` `predict-output` **`[ 0.11 27.63  0.69]`** (38–49), literals in the snippet;
  `q-softmax` `single` a (50–59). **No item touches Spanish.**
- **`<PyCell>`** (395–441): **no corpus** — the labels `y` and the preactivations `z` are literals
  (399–400), the latter copied from 2.1. Identifiers `mse`, `entropia_cruzada`, `sigmoide`,
  `convencida`, `tibia`, `recortada`, `aciertos`, `nombre`; three row labels in Spanish (418–420)
  and Spanish comments (398, 409, 413, 425, 434).
- **Printed output quoted in prose — inherited, not regenerated** (443–458): `0.881`, `0.538`,
  `0.049`, `0.220`, `0.633`, `0.250`, `0.693`, `0.9975`, `0.0049`, `202.7`, `27.63` and "nueve de
  diez". Stable **iff** 2.1's English corpus preserves $z$.
- **`<CodeChallenge>` `ch-entropia-cruzada`** (60–149): 2 starter comments (79, 84), 6 test `name`s,
  **8 Spanish assertion messages** (91–121), Spanish `prompt` and `explanation` (134–149);
  identifier `entropia_cruzada`. Every asserted value is numeric.
- **`<Figure>` `perdida-correccion.svg`** (184–188): Spanish `alt`/`caption`, and **the asset carries
  `corrección`, `entropía cruzada` and a Spanish strapline — plus `0,5` written with a decimal
  comma.** Redraw.
- **`<Leccion ancla="">`: 0** (9 refs — joint densest in the block). **`reading`:** 1 (150–158),
  `lang: en`, Spanish note. **`<W>`: 1** — <W>divertida y la recomiendo</W> (169), a corpus review;
  it carries a hypothetical $\hat{y} = 0.002$, not a computed number, so it translates with 2.1.

### 2.6 `descenso-gradiente` — `es/14-descenso-gradiente.mdx` — adapt

- **Quiz (4, no answer moves).** `q-paso-a-mano` `numeric` **1** (12–17), the parabola.
  `q-por-que-menos` `single` a (18–27), Cauchy–Schwarz. `q-gradiente-cero` `multi` [a,b,c] (28–37).
  `q-actualiza` `predict-output` **`[0.25, -0.5]`** (38–53), literals in the snippet.
- **`<PyCell>` ×2.** The first (285–314) is the one-parameter parabola: `0.32768`, `0.04`, `2.59`
  (316–320) are language-free and hold. The second (328–374) **re-declares 2.1's corpus** (332–343)
  and `V` (345), trains from `w = 0`, and hardcodes 2.1's hand-written `w` for comparison (368).
- **Printed output quoted in prose — regenerated, and the argument with it** (376–388): `0.6931`,
  `0.0896`, `0.0130`, `0.2208`, five-then-ten correct, `+3.289` for <W>recomiendo</W>, `−3.023` for
  <W>lenta</W>, `−2.238` for <W>película</W>, `+1.221` for <W>la</W>. **The closing paragraph is the
  hazard**: it argues that the two meaningless words end up with large weights because `película`
  falls in four negative reviews and two positive and `la` the other way round. That distribution
  has to hold in the English ten, or the paragraph has to be re-derived from whatever the English
  corpus actually does. Decide it when 2.1's corpus is chosen, not here.
- **`<Explorable>` ×2, neither with a corpus.** `loss-landscape` (97–100) and `gradient-descent-2d`
  (218–221): Spanish captions naming numeric thresholds (`0.045`, `0.05`). Components carry
  `aria-label`s and the button label `"Cañón"`. P11-02.
- **`<Figure>` `descenso-pasos.svg`** (203–207): Spanish `alt`/`caption`, and the asset carries
  `pérdida`, `peso`, `lento`, `llega`, `sube` **and `η = 0,10` / `0,40` / `1,05` with decimal
  commas.** Redraw.
- **`<Leccion ancla="">`: 0** (4 refs). **`reading`:** 2 (55–71), both `lang: en`, Spanish notes.
  **`<W>`: 4** — the four vocabulary entries whose learned weights the prose quotes.

### 2.7 `regla-de-la-cadena` — `es/15-regla-de-la-cadena.mdx` — adapt

- **Quiz (5, no answer moves).** `q-suma-caminos` `numeric` **14** (12–17), abstract $u_1, u_2, t$.
  `q-por-que-suma` `single` a (18–27). `q-formas-jacobiana` `multi` [a,b,c] (28–37).
  `q-diag-hadamard` `predict-output` **`(3, 3) [-0.5, 0.0, 4.0] [-0.5, 0.0, 4.0]`** (38–50).
  `q-orden-jacobianas` `single` a (51–60) — names the $8 \to 4 \to 3$ widths, which are structural.
- **`<PyCell>`** (383–429): `x = np.array([0., 0., 1., 2., 0., 0., 1., 1.])` (387) is **2.1's
  corpus in disguise** — the bag of words of `la película es divertida y la recomiendo`, with the
  `2` at slot 3 being `la`. `i, j = 0, 2` (406) addresses `divertida` **by its alphabetical slot**,
  and the Spanish comment says so. `W1`, `W2`, `b1`, `b2` are hand-written (391–396).
- **Printed output quoted in prose — regenerated** (431–445): `−0.07427622`, `−0.13342693`, and
  the shape line `(1, 3) × (3, 4) × (4, 4) × (4, 1)` (structural, holds). **Two structural claims
  must be re-verified, not just re-read**: the third path must come out **positive** so that
  dropping it *increases* the derivative rather than shrinking it (436–441), and
  $z^{(1)}_4$ must stay negative so the $\varphi'$ diagonal shows a zero (443–445). The hand-written
  weights can be re-tuned to restore both if the English `x` breaks them.
- **`<CodeChallenge>` `ch-cadena-vectorial`** (61–160): 2 starter comments (81, 86), 5 test `name`s,
  7 Spanish assertion messages (93–122), Spanish `prompt` and `explanation` (143–160); identifiers
  `jacobiana`, `gradiente_entrada`, `jacobianas`, `columnas`, `paso`, `encadenado`, `directo`.
  Values language-free.
- **`<Figure>` `regla-cadena-caminos.svg`** (200–204): Spanish `alt`/`caption`, but **the asset is
  symbols only** — no redraw needed.
- **`<Leccion ancla="">`: 0** (8 refs). **`reading`:** 2 (161–177), both `lang: en`, Spanish notes.
  **`<W>`: 3** — <W>divertida</W> ×2 (193, 261) as the weight's word, and the review phrase (377).

### 2.8 `backpropagation` — `es/16-backpropagation.mdx` — **rewrite**

- **Quiz (5, one answer moves).** `q-que-se-reutiliza` `single` a (18–27), `q-formas-backward`
  `multi` [a,b,c] (28–37), `q-mascara` `predict-output` **`[ 0.5 -0.   0.  -1.5]`** (38–50) and
  `q-tirar-el-forward` `single` a (51–60) are all language-free and transpose.
  **`q-leer-un-gradiente` `numeric` −0.98704, `tolerance: 0.001` (12–17) is the rewrite.** The
  prompt quotes $\boldsymbol{\delta}^{(1)} = (0.323559, -0.493520, -0.493520, 0)$ **and**
  $\mathbf{x} = (0,0,1,2,0,0,1,1)$ in full; the answer is $\delta^{(1)}_2 \cdot x_4$; and the
  explanation turns on the `2` being the count of <W>la</W>, tying it back to 2.6's "una entrada que
  aparece dos veces tira el doble". Both factors move with the corpus.
- **`<PyCell>` ×2.** The first (418–466) is the explorable's 2-2-1 network with literal weights
  (423–427): `(-0.079, 0.068)`, `-0.113`, `(0.238, 0.222)`, `(-0.019, -0.009)`, `(0.015, 0.008)`
  (469–478) are **language-free and hold**. The second (485–540) reuses 2.7's `x` (489) on an
  8→4→3→3 network with hand-written weights (491–498).
- **Printed output quoted in prose — regenerated** (542–554): $z^{(1)}_4 = -1$ and $z^{(2)}_2 = -1$
  as the two off neurons, the null row and null column of $\nabla_{\mathbf{W}^{(2)}}\ell$, the
  `10^{-10}` probe agreement, `63` parameters and `126` forward passes. The last three are
  structural; **the two switched-off neurons are properties of the English `x`** and have to be
  re-checked, because the whole "los ceros son ReLU trabajando, y hay dos" paragraph rests on them.
- **`<CodeChallenge>` `ch-backprop`** (61–185): 2 starter comments (82, 87), 5 test `name`s,
  **12 Spanish assertion messages** (96–152), Spanish `prompt` and `explanation` (167–185);
  identifiers `errores`, `gradientes`, `deltas`, `peor`, `paso`. Every asserted value is numeric and
  seeded with `default_rng(0)`; nothing here moves.
- **`<Explorable>` `backprop-trace`** (221–224): Spanish caption naming the fourteen steps and
  $\delta^{(2)}_1$. Widget has **no corpus** — one `aria-label`. P11-02.
- **`<Leccion ancla="">`: 0** (9 refs — joint densest). **`reading`:** 2 (186–202), both `lang: en`,
  Spanish notes. **`<W>`: 1** — <W>la</W>, inside the rewritten quiz item.

### 2.9 `implementar-mlp` — `es/17-implementar-mlp.mdx` — adapt

- **Quiz (3, no answer moves).** `q-simetria` `single` a (12–21): symmetry breaking; the explanation
  names the four phrases only through 2.3's conclusion. `q-gradiente-batch` `predict-output`
  **`(2, 3) [0.5 1.  2. ]`** (22–34): literals in the snippet. `q-parar` `multi` [a,b,c] (35–44):
  quotes `0.6931`, step 25 and the plateau — **all seed-driven, so all stable.**
- **`<PyCell>` ×3, none carrying a corpus.** First (369–415), second (426–465), third (489–534). `X`
  is the ±1 matrix in all three; `frases` (429) is a **label list** consumed by `%-13s`; the
  coordinate convention appears once as a Spanish comment (372–373). Identifiers `frases`,
  `perdida`, `forward`, `backward`, `entrena`, `escala`, `iguales`, `curva`, `aciertos`, `aporta`,
  `uno_a_uno`; Spanish prints (401–464, 520–533).
- **Printed output quoted in prose — stable, re-run to confirm only** (467–484, 536–548): `0.7260`,
  `0.0011`, `(1.83, 1.77)`, `(1.79, 1.85)`, `−1.80`/`+1.80`, `−3.98`/`+3.93`, `+7.5`, `+0.2`,
  `6.7`, `0.6931`, `4.73`, `0.7240`. **None of these is a function of the phrase text.**
- **`<CodeChallenge>` `ch-entrena`** (45–186): 2 starter comments (64, 69), 5 test `name`s, 13
  Spanish assertion messages (79–139), Spanish `prompt` and `explanation` (169–186); identifiers
  `gradientes`, `entrena`, `curva`, `copia`, `perdida`. Its last test hardcodes
  `abs(curva[0] - 0.7260) < 1e-3` — **seed-driven, holds.**
- **`<Figure>` `bucle-entrenamiento.svg`** (224–228): Spanish `alt`/`caption`, and the asset carries
  `pérdida`, `gradiente`, `actualización`, `y otra vez` plus a Spanish strapline. Redraw.
- **`<Leccion ancla="">`: 0** (11 refs — the most in the block). **`reading`:** 2 (187–202), both
  `lang: en`, Spanish notes. **`<W>`: 7** — the four phrases in the opening (216) and the closing
  (568, 571), including <W>no está tan bien</W>, a **fifth** phrase that must extend the chosen
  English set with a hedge the four do not cover.

### 2.10 `proyecto-sentimiento` — `es/18-proyecto-sentimiento.mdx` — adapt

- **Quiz (3, no answer moves).** `q-vocabulario` `multi` [a,b] (12–21): the leakage argument; its
  explanation quotes `8.3 %`, `442`, `1.000` and `35`, all of which move, but the answer does not.
  `q-oov` `numeric` **0.2** (22–28): **the prompt supplies its own four numbers**, so it is fully
  self-contained and transposes untouched. `q-brecha` `single` a (29–38): the prompt quotes
  `53 de 60`, `600` and `20 000`, and the explanation quotes "entre 53 y 54" over eight seeds —
  numbers that move, an answer that does not.
- **A new corpus file, outside the lesson tree.** `public/courses/dl-nlp/resenas-cine.json` (18 KB):
  240 AI-generated one-line Spanish film reviews with a **fixed** 180/60 split written into the file
  so the lesson's numbers reproduce. The English file must be **generated, not translated**, and it
  has to be built to four teaching properties, all of which the prose reads off it:
  1. a negation failure mode — four test reviews whose label depends on a <W>no</W> the bag of words
     cannot place (302–307), with the marker word skewed towards negative reviews in training
     (5 vs 24 at 332–334);
  2. OOV in the test set — reviews carrying types absent from the 180 (<W>reservas</W>,
     <W>convencen</W>, <W>eterna</W>);
  3. a word-order pair with an identical bag of words and opposite meaning (325–326);
  4. at least one review sharing **no** vocabulary entry at all, to land the null-vector argument
     (337).
- **`<PyCell>` ×3, all regenerating** (187–233, 247–292, 309–340). Identifiers `tokeniza`, `frec`,
  `matriz`, `resenas`, `entrenamiento`/`prueba` (also **JSON keys**), `salida`, `acierto`,
  `probabilidad`, `nueva`, `fuera`, `falla`; Spanish prints throughout. `tokeniza` uses `\w+`, which
  is script-agnostic.
- **Printed output quoted in prose — every number regenerates** (235–241, 294–307, 342–355): `442`,
  `1 299`, `7.1`, `1.6 %`, `435`, `432`, `36`, `8.3 %`, `35`, `0.550`, `0.517`, `0.6906`, `0.989`,
  `0.883`, `1.000`, `0.0482`, `0.0037`, seven failures, `0.016`, `0.000`, `5` vs `24`, `0.0014`,
  `0.4537`, and in the prose above the cells `5 329` parameters (129) and `0.783` vs `0.883` for the
  initialisation scale (135–136).
- **Downstream, outside this block.** `es/19-por-que-falla-el-mlp.mdx` quotes this lesson's
  `88.3 %` and `5 329`. P11-05 lands before P11-06, so Block 3 picks up the English figures — but
  **`5 329` is $\lvert V \rvert \cdot 12 + 25$, so it moves if the English vocabulary is not 442.**
- **`<Figure>` `reparto-resenas.svg`** (78–82): Spanish `alt`/`caption`, and the asset carries
  `180 reseñas de entrenamiento`, `60 reseñas de prueba`, `442 entradas`, `600 pasos` and
  `53 de 60`. **Four of those are data**, so this is a re-draw with new numbers, not a re-label.
- **`<Leccion ancla="">`: 0** (7 refs). **`reading`:** 1 (40–48), `lang: en`, Spanish note — Pang,
  Lee & Vaithyanathan, whose own corpus is English, so the note gets *cheaper* to write.
  **`<W>`: 14** — <W>no</W> ×4 plus nine corpus phrases and the `\<UNK>` marker.

## Acceptance criteria

- [ ] Every lesson in the block exists under `content/courses/dl-nlp/en/`, `draft: false`
- [ ] `slug`, `block`, `order`, and every widget / quiz / challenge id match the Spanish lesson
- [ ] Every `<PyCell>` and `<CodeChallenge>` has been **run in the browser**, and every number the
      prose quotes matches what Pyodide printed
- [ ] Every `<Leccion>` resolves. (No `ancla` in this block — 63 slug-only refs — so the anchor
      criterion is vacuous here, and the block adds no anchor debt for later blocks.)
- [ ] `reading` carries the same sources with translated `note`s; `lang` values unchanged
- [ ] The two-reader test passes against the **English** neighbours
- [ ] `pnpm lint:content` clean (budget warnings advisory); `pnpm build` green

## Test plan

- `pnpm lint:content` after each lesson; `pnpm build` before each PR.
- Read every lesson in the browser at 360px — the reader is mobile-first and English line lengths
  differ from Spanish inside the same display-maths containers.
- Run every code cell and challenge in the browser. Re-running is not optional even when only
  identifiers changed: Pyodide's BLAS differs from CPython's, and the prose quotes printed values.
- **After 2.1, before 2.2:** diff the printed `z` column against
  $(2, -2, 2, -2, 2, -1, -2, 1, 0, 2)$. That single check decides whether 2.2 and 2.5 stay
  transposes.
- **In 2.7 and 2.8:** check the *sign* of the third path and the *number* of switched-off ReLU
  neurons, not just the digits. Those are what the prose argues from.

## Gotchas

- **Translating a lesson invalidates inbound anchors.** Any already-translated lesson holding
  `<Leccion slug="X" ancla="…">` breaks when X is translated, because X now renders English
  heading ids. P11-01 makes this a lint failure rather than a silent miss — expect a PR to fix a
  file it did not otherwise touch, and check the lint output rather than only the diff. (Triage
  found **no** `ancla` inside Block 2, so the risk here is entirely inbound from other blocks.)
- **The bridge is a contract.** The closing after `---` is what the next lesson's opening picks
  up. Translate in order; never skip a lesson and come back.
- **Six SVG assets need redrawing and no P11 task owns them** — see the table above. Two of them
  (`descenso-pasos.svg`, `perdida-correccion.svg`) also carry Spanish decimal commas, and
  `reparto-resenas.svg` carries data that regenerates with 2.10's corpus.
- **Under-budget word warnings are expected** on transposed lessons — see `AUTHORING.en.md`.

## Out of scope

- Editing the Spanish lesson. If translation exposes a Spanish error, that is a separate PR.
- Changing block/order or any id.
- Widget strings and corpora — P11-02 owns those. (Block 2's five explorables need strings only;
  none of them has a corpus, which is why none appears in P11-02 §2's table.)

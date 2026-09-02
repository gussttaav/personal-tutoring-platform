# P11-04 — Block 1: NLP Fundamentals

**Tag:** `COURSE-P11-04` · **Size:** L · **Status:** not started

## TL;DR

Eight lessons, and the block where translation is least like translation. Block 1 teaches how
text becomes numbers, so its examples *are* a language — and the language is Spanish. Budget it
like authoring: **not** because the block is full of rewrites (it holds exactly one), but because
seven of the eight lessons carry a Spanish corpus that has to be *designed* rather than
translated, and five of the seven code cells are regenerate-not-re-run.

## Why this block is first

It is the most expensive block and it is scheduled before the four cheaper ones on purpose.
Block 1 is where an English reader decides whether this is a course or a translated course, and
every convention the other 35 lessons inherit — the English voice, the terminology, how a
rewritten quiz item is pitched — is set by getting it right here rather than by `AUTHORING.en.md`
predicting it in the abstract.

## Classification

Filled by [P11-00](00-triage.md) — read against the eight `es/` lessons carrying `block: 1`, in
`order`. File names and frontmatter agree throughout (`es/01` … `es/08` → 1.1 … 1.8), unlike
Block 3. `es/00-pipeline-fixture.mdx` is `block: 1, order: 0, draft: true` and is **excluded**.

**Exactly one lesson in Block 1 is a rewrite, and the planning pass named it.** Of the 32 quiz
items, **one answer moves**: 1.2's `numeric` **14** for `El niño juega.` Every other item —
including four that look linguistic (1.3's frequency cut, 1.4's transfer pair, 1.5's word-order
pair, 1.8's polysemy item) — keeps its answer, because their prompts supply the numbers or their
Spanish words are labels on language-free arithmetic.

| # | Slug | Class | Spanish-dependent artifacts |
|---|---|---|---|
| 1.1 | `texto-como-numeros` | **adapt** | Not a transpose — see the correction below. The alphabetical triple `casa`/`gato`/`perro` **re-sorts in English**, moving which word is "in the middle"; the whole *Concreción* example (`el gato bebe leche`, indices, the three tied pairs, adding `agua`) is re-derived; quiz option (c) is a Spanish-vs-English distractor that inverts; the bridge hands off `dámelo` to 1.2's rewrite |
| 1.2 | `tokenizacion` | **rewrite** | The block's only rewrite, as predicted. `q-longitud` `numeric` **14** for `El niño juega.` — **the answer moves**. Plus `ñ` as `n`+combining tilde (NFC), `dámelo` from `dá`/`me`/`lo`, `del`/`al` contractions, `papá`/`papa`, `ℓ̄ ≈ 5` "en español", the `<Details>` on ~50 Spanish verb forms, the 6-sentence cell corpus and the `tokenizer-playground` caption |
| 1.3 | `vocabulario-oov` | **adapt** | Confirmed and heavier than the row said. The **18-sentence cell corpus** — the largest in the block — with `237`, `19`, `65 de 104` quoted *before* the cell, plus cob(8)/cob(50) and the four words that vanish. Corpus must be **designed**, not translated: it has to hit ~65 % hapax and supply an `En`/`en` capitalisation pair. `suma-armonica.svg` has Spanish set into the asset |
| 1.4 | `one-hot` | **adapt** | The cheapest adapt: the 8-word `V` **never prints**, so every printed value is byte-identical after a word swap. Cost is elsewhere — `one-hot-equidistancia.svg` has `casa`/`gato`/`perro` and "gato queda entre casa y perro" **set into the asset**, and its word order must match 1.1's re-sorted triple. `q-transferencia`'s `niño`/`niña` gender pair; `q-que-cumple` quotes 1.1's `agua` renumbering. 13 `<Leccion>` refs, densest in the block |
| 1.5 | `bolsa-de-palabras` | **adapt** | Confirmed. The `bag-of-words` widget corpus (P11-02) **and four prose numbers read off it** — the two amber maxima at `4`, both articles; the corpus row `el` 5, `la` 4. English has one article, so that reading changes shape. Plus the 6-document three-topic cell corpus, the probe-word list that must exist in it, and `1.10` / `1.79` / `0.23` / `0.35` / `0.30` / `6.47` |
| 1.6 | `embeddings-densos` | **adapt** | The other cheap one: `E` is **hand-written**, so a 1:1 word swap leaves `0.99`, `0.97`, `-0.48`, `0.02`, `0.30` all standing. Cost is the Firth cloze test in Spanish («sirvió una copa de ___» with `vino`/`zumo`), the `estupenda`/`magnífica` pair, and the `embedding-projection` word map (P11-02) whose three named points the prose calls out |
| 1.7 | `word2vec` | **adapt** | Confirmed — but `q-pares` is **abstract** ("una frase de 12 tokens"), so the one numeric item transposes untouched. The cost is the template-generated corpus (`animales`/`comidas`/`lugares`/`bebidas`): `el`/`la` both collapse to `the`, so `\|V\|` drops and **every** quoted number moves — `0.68`, `0.97`, the loss `0.02`, and `niña` sticking to its single mould |
| 1.8 | `glove-y-limites` | **adapt** | The heaviest. `banco` = bank/bench is the lesson's spine; English `bank` (finance/river) substitutes but the **second word-set must be redesigned** (park words → river words, and `bank` may not appear in it). Every number regenerated: `432`, `3 840`, `3.00`, `0.33`, `1.00`, `0.55`→`0.02`, `8`, `0.00`/`0.55`/`0.71`. 61 `<W>`, 11 `<Leccion>` — the most of each |

### What changed from the planning pass

**Confirmed: 1.2.** The row is right in every particular. Three of four items depend on Spanish,
and `q-longitud`'s answer is the one that moves. The worked case below stands unedited.

**Corrected: 1.1 — not a transpose.** "Prose-only, no widget, no code cell" is factually true
(0 `<PyCell>`, 0 `<Explorable>`, 0 `<Figure>`, 0 `reading`) and still yields an **adapt**, because
the lesson's two examples are both alphabetical orderings and alphabetical order is a property of
the language:

- `V = {casa, gato, perro}` → `1, 2, 3` (139–143). English `house`/`cat`/`dog` sorts to
  `cat, dog, house`, so the word that "lies in the middle" is no longer the same one. It is named
  six times in this lesson (156, 159–162, 171) **and set into 1.4's SVG.**
- The *Concreción* section (187–209) is worse. `el gato bebe leche` over
  `V = {bebe, el, gato, leche}` gives `(2, 3, 1, 4)`, three pairs tied at distance `1`, and adding
  `agua` renumbers **all four** words. Translate it naively — "the cat drinks milk", add "water" —
  and `water` sorts *after* `the`, **nothing renumbers, and the section's whole point dies.** The
  added word has to be chosen to sort early (`bird` works: all four shift).

**Corrected: 1.3, 1.5, 1.7 — all three hypotheses hold, and none is a rewrite.** The row called
them untested guesses. Read:

- **1.3** "vocabulary/frequency counts over a Spanish corpus" — confirmed, and understated. The
  corpus is 18 sentences and the prose quotes it **in the opening, 190 lines before the cell**
  (79–80). The "OOV example word" the row expected is real (`criptomoneda`, `bibliotecario`,
  `manuscritos`, `monasterio`) but is the cheap half. `q-corte-unk` supplies its own frequencies,
  so **6 holds** and the lesson is an adapt.
- **1.5** "`bag-of-words` widget corpus" — confirmed, plus a dependency the row missed: **the
  prose reads four numbers off that widget** (77–83), so this lesson cannot be written until
  P11-02 has settled the English documents. And the reading itself shifts: the punchline is "the
  biggest coordinate is an article, `el` here and `la` there", and English has one article.
- **1.7** "context-window examples over Spanish sentences" — confirmed for the prose (88–100), but
  the row pointed at the cheap artifact. `q-pares` is abstract and transposes; what costs is that
  `el` and `la` both become `the`, collapsing two vocabulary entries and moving every printed
  number in a cell whose output the prose quotes six times.

**Filled: 1.4, 1.6, 1.8 — the three blank rows split two-cheap / one-expensive.** 1.4 and 1.6 are
the block's near-transposes: in both, the Spanish word list feeds a computation that does not
depend on it (`len(V)` and `np.eye` in 1.4; a hand-written `E` in 1.6), so **no printed number
moves.** 1.8 is the opposite and is the block's most expensive lesson — heavier than 1.2.

**Two figure assets need redrawing, and no P11 task owns them.** `suma-armonica.svg` (1.3) has
`cabe debajo` / `sobresale` set in it; `one-hot-equidistancia.svg` (1.4) has `casa`, `gato`,
`perro`, `gato queda entre casa y perro` and `ninguna queda entre las otras dos`. P11-02 covers
widgets, not `public/courses/dl-nlp/*.svg`.

**Two artifacts get *cheaper* in English.** 1.8's `hielo`/`vapor`/`sólido`/`gas`/`agua`/`moda`
table (97–102) is the GloVe paper's own `ice`/`steam`/… table, and the
`rey − hombre + mujer ≈ reina` analogy (84, and 1.7's reading note at 77) is
`king − man + woman ≈ queen`. Both are **back-translations to the source**, not new work.

### Artifact inventory

Line refs are into the `es/` file named in each heading.

#### 1.1 `texto-como-numeros` — `es/01-texto-como-numeros.mdx` — adapt

- **Quiz (3, no answer moves).** `q-por-que-no-texto` `single` b (12–21): `<W>hola</W>` in prompt
  and option (d); **option (c) is "porque el español tiene acentos y la red se entrena en inglés"**
  (18) — in an English lesson that distractor has to be inverted, not translated.
  `q-indice-alfabetico` `single` b (22–29): the alphabetical triple in prompt and explanation, with
  the explanation naming which word sits between the other two (29). `q-propiedades-de-r` `multi`
  [a,b,d] (30–39): explanation's `gato`/`gatos` subword pair (39) needs an English stem/plural.
- **No `<PyCell>`, no `<CodeChallenge>`, no `<Explorable>`, no `<Figure>`, `reading: []`.** The
  only lesson in the block with none of them.
- **Prose.** `casa`/`gato`/`perro` alphabetical (139–143, 156, 159–162, 171); `criptomoneda` as
  the OOV word (116, 148); the `<Details>` on equidistant points (175–183, language-free).
- **The *Concreción* section (187–209) is the lesson's cost.** Heading says "con una frase en
  español"; `el gato bebe leche`, `V` indices `1`–`4`, the sequence `(2, 3, 1, 4)`, the three pairs
  tied at distance `1` (197–198), and `agua` renumbering all four (201–202). Re-derive; choose the
  added word so it sorts early.
- **Bridge (232–236).** `dámelo` as one unit / three (`dá`, `me`, `lo`) / six letters — this is
  1.2's rewritten example, and it moves with 1.2.
- **`<Leccion ancla="">`: 0** (7 slug-only refs). **`reading`: 0.** **`<W>`: 44.**

#### 1.2 `tokenizacion` — `es/02-tokenizacion.mdx` — **rewrite**

- **Quiz (4, one answer moves).** `q-espectro` `single` a (12–21): vocabulary/length trade-off,
  language-free, transposes. `q-subpalabras-damelo` `multi` [b,c] (22–31): prompt and explanation
  built on `dámelo` = `dá`+`me`+`lo`; the answer survives any decomposable word, the text does not.
  `q-nfc` `boolean` true (32–36): `ñ` as `n`+combining tilde, explanation counting `niño` at five
  tokens instead of four; answer stays true, the letter must change. **`q-longitud` `numeric` 14,
  `tolerance: 0` (37–42): `El niño juega.` — the answer moves. This is the rewrite.**
- **`<PyCell>`** (233–286): 6-sentence Spanish corpus (236–243); identifiers `normaliza`,
  `por_caracteres`, `por_palabras`, `actual`, `media`, `nueva`; Spanish comments (246, 262, 282)
  and print labels (268, 273–277); the clitic/contraction demo `¡Dámelo! Vamos del bar al río.`
  (280) and the OOV line `El niño programa una criptomoneda` (284).
- **Printed output quoted in prose — regenerated** (288–298): that `T · ℓ̄` equals `C` for
  characters and falls short for words, and "de los cinco tokens de una frase nueva, **tres** no
  están en $V$".
- **`<Explorable>` `tokenizer-playground`** (85): Spanish caption naming `programación` as the long
  word. Widget corpus is P11-02's.
- **Spanish-only prose arguments.** The alphabet "para el español … la `ñ`" (98–99); the NFC
  paragraph (101–107); `papá`/`papa` under accent-stripping (139–140); **`ℓ̄` "ronda los cinco
  caracteres" *en español*** (171–172); and the `<Details>` (192–210) — ~50 conjugated forms per
  regular verb, clitics `cántalo`/`cántamelo`, gender/number `niño`/`niña`/`niños`/`niñas`,
  derivation `niñez`/`aniñado`. **English has four or five inflected forms.** That argument is
  re-pitched (compounding, proper nouns, neologisms), not translated.
- The contraction paragraph (295–297): `del` = `de el`, `al` = `a el`. English `don't` / `'s`
  split the other way — the tokenizer point survives, the worked example does not.
- **`<Leccion ancla="">`: 0** (3 refs). **`reading`: 3**, all `lang: en`; note (67) says "Pruébalo
  en español: verás cómo las piezas se multiplican frente al inglés" — **inverts in an English
  lesson.** **`<W>`: 53.**

#### 1.3 `vocabulario-oov` — `es/03-vocabulario-oov.mdx` — adapt

- **Quiz (4, no answer moves).** `q-corte-unk` `numeric` 6, `tolerance: 0` (12–17): eight Spanish
  words **with their frequencies supplied in the prompt**, so the words are labels and 6 holds.
  `q-zipf-cobertura` `single` c (18–27): $M^{p}$, language-free. `q-unk-consecuencias` `multi`
  [a,b,d] (28–37): `criptomoneda`/`bibliotecario` as labels. `q-tasa-oov-frases` `boolean` false
  (38–42): $0.98^{20}$, language-free.
- **`<PyCell>`** (273–362): the **18-sentence Spanish corpus** (277–296), largest in the block;
  the five held-out sentences (342–348); identifiers `normaliza`, `por_palabras`, `frec`, `hapax`,
  `acumulado`, `cubierto`, `corte`, `fuera`, `nuevos`, `NUEVAS`, `frase`; Spanish prints
  (321–337, 354–356). `por_palabras` must stay identical to 1.2's (267 says so in prose).
- **Printed output quoted in prose — regenerated, and some of it *before* the cell**: `237`
  tokens, top type at `19`, `65` of `104` types as hapax (**79–80, in the opening**); cob(8) ≈ a
  third and cob(50) ≈ three quarters (364–366); the untrimmed vocabulary still losing a third
  (369–370); the four words that vanish (373).
- **Corpus design constraints — this corpus is authored, not translated.** It has to (a) land
  ~65 % hapax over ~100 types, (b) contain a sentence-initial and a mid-sentence occurrence of one
  word so the `En`/`en` demo at **376–379** still works (English `The`/`the` does this fine), and
  (c) keep four content words in the held-out sentences that fall out of `V`.
- **`<Figure>` `suma-armonica.svg`** (143–147): Spanish `alt` and `caption`, **and the SVG has
  `cabe debajo` and `sobresale` set into it.** New asset, not a new caption.
- **Prose.** Head words `de`, `la`, `que`, `el`, `en` (75–77); tail words `bibliotecario`,
  `criptomoneda`, `monasterio` (78); `la escuela de la plaza` as the 5-tokens/4-types example (97).
- **`<Leccion ancla="">`: 0** (4 refs). **`reading`: 2**, both `lang: en`, Spanish notes.
  **`<W>`: 41.**

#### 1.4 `one-hot` — `es/04-one-hot.mdx` — adapt

- **Quiz (4, no answer moves).** `q-distancia` `numeric` 1.414, `tolerance: 0.01` (12–17):
  $\sqrt{2}$; explanation's `gato`/`gata`/`criptomoneda` are labels. `q-que-cumple` `multi` [a,b]
  (18–27): **option (b) and its explanation quote 1.1's `agua` renumbering** (23, 27), so this item
  moves with 1.1's re-derived word. `q-coste` `single` b (28–37): arithmetic. `q-transferencia`
  `boolean` false (38–42): `el niño juega` / `la niña juega` — a Spanish gender minimal pair;
  English needs a pair the reader accepts as similar, and the answer stays false.
- **`<PyCell>`** (247–289): `V` = 8 Spanish words (250). **The list never prints as data** — it is
  used only through `len(V)`, `np.eye(n)` and `O[3]` — so an English list of 8 entries leaves
  **every printed value byte-identical.** Identifiers `distancias`, `tam`, `numeros`, `ventana`,
  `posibles`, `cubierta`; Spanish comments (253, 258–262, 272, 281–282) and prints (254, 267–269,
  273, 287–288).
- **Printed output quoted in prose — re-run only, nothing regenerated** (291–304): `9.31` GB,
  `0.003 %`, `0.04 %`. All driven by `\|V\|`, none by the words.
- **`<Figure>` `one-hot-equidistancia.svg`** (76–80): Spanish `alt` and `caption`, **and the asset
  carries `casa`, `gato`, `perro`, "un índice por palabra", "gato queda entre casa y perro" and
  "ninguna queda entre las otras dos".** New asset — and the three words must appear in **1.1's
  re-sorted English alphabetical order**, or the figure contradicts the lesson before it.
- **`<Leccion ancla="">`: 0** (**13 slug-only refs — the densest in the block**). **`reading`: 1**,
  `lang: en`, Spanish note. **`<W>`: 22** (the fewest).

#### 1.5 `bolsa-de-palabras` — `es/05-bolsa-de-palabras.mdx` — adapt

- **Quiz (4, no answer moves).** `q-orden` `boolean` false (12–16): `el perro muerde al niño` /
  `el niño muerde al perro` — needs an English pair whose reversal changes who does what; the
  explanation also leans on `no está mal` as a phrase whose sense turns on order. `q-idf-cero`
  `numeric` 0, `tolerance: 0` (17–22): $\log 1 = 0$; `de` is a label. `q-por-que-log` `single` a
  (23–32): information theory. `q-coseno` `multi` [a,b,d] (33–42): vector algebra.
- **`<Explorable>` `bag-of-words`** (72–75): Spanish caption — **and the prose reads four numbers
  off the widget's own two documents** (77–83): both amber maxima at `4` and both articles (`el` in
  the match report, `la` in the recipe); the content words `portero`, `balón`, `harina`,
  `mantequilla` at `1`; the corpus row headed by `el` 5, `la` 4, `de` and `y` 2. **English has one
  article**, so the "four times the weight of a word that says nothing" reading has to be re-pitched
  around `the`. Corpus is P11-02's — **this lesson is blocked on it.**
- **`<PyCell>`** (250–342): 6-document Spanish corpus over football / cooking / programming
  (256–274); identifiers `por_palabras`, `docs`, `pesos`, `coseno`, `total`, `orden`, `linea`,
  `fila`, `doble`; **the hand-listed probe words `["la","de","y","el","gol","horno","lista",
  "árbitro"]` (312) must all exist in the English corpus or `V.index` raises.**
- **Printed output quoted in prose — regenerated** (344–360): the raw-count head `.`, `la`, `el`,
  `de`, `y`, `El` (344); the four entries at `idf` exactly `0`; `gol`/`horno`/`lista` at `1.10` and
  `árbitro` at `1.79` (348–349); the per-document top pairs (349–351); same-topic cosines `0.23`,
  `0.35`, `0.30` against `0.00`–`0.06` (353–354); the doubled document at distance `6.47` (355).
- The `El` / `el` split at 344 is the same capitalisation artefact as 1.3 and survives as
  `The` / `the`.
- **`<Leccion ancla="">`: 0** (4 refs). **`reading`: 1**, `lang: en`, Spanish note. **`<W>`: 50.**

#### 1.6 `embeddings-densos` — `es/06-embeddings-densos.mdx` — adapt

- **Quiz (4, no answer moves).** `q-lookup` `single` a (12–21): matrix algebra. `q-que-compra`
  `multi` [a,b] (22–31): arithmetic. `q-coseno-negativo` `boolean` true (32–36) — **its explanation
  quotes `coche`/`harina` = `-0.48` from the cell** (36), which survives untouched if `E` is left
  alone. `q-distribucional` `single` a (37–46): explanation uses `el gato bebe leche` (1.1's
  sentence) and the `frío`/`caliente` pair.
- **`<PyCell>`** (236–294): `V` = 8 Spanish words (239) and **a hand-written `E` whose rows are
  commented with those words** (243–252). Because the numbers are authored rather than computed, a
  1:1 swap (`coche`→`car`, `automóvil`→`automobile`, `camión`→`truck`, `harina`→`flour`,
  `azúcar`→`sugar`, `gato`→`cat`, `perro`→`dog`) leaves **every printed value unchanged.**
  Identifiers `vecinos`, `orden`; Spanish comments (242, 256, 265, 284, 290) and prints (253,
  260–262, 269, 281, 287, 291).
- **Printed output quoted in prose — re-run only** (296–311): `0.99`, `0.97`, `-0.48`, `0.02`, and
  the honest-noise second neighbour at `0.30`. The one risk is cosmetic: the column slices
  `w[:6]` (270) and `w[:9]` (272) against longer English words.
- **`<Explorable>` `embedding-projection`** (82–85): Spanish caption; the widget is a **hand-placed
  Spanish word map**, and the prose names three of its points — `coche`, `manzana`, `gato` (78–80).
  Map is P11-02's; the sentence that names its points moves with it.
- **Prose.** The synonym pair `estupenda`/`magnífica` (73–74, 200); **the Firth cloze test in
  Spanish** (211–215) — «sirvió una copa de ___», «una botella de ___ en la mesa», «el ___ estaba
  frío», where `vino` and `zumo` fit and `martillo` and `lunes` do not. English needs three frames
  sharing two related mass nouns. Firth's line itself is **already quoted in English** (211–212)
  and stops being a foreign quotation.
- **`<Leccion ancla="">`: 0** (8 refs). **`reading`: 1**, `lang: en`, Spanish note. **`<W>`: 34.**

#### 1.7 `word2vec` — `es/07-word2vec.mdx` — adapt

- **Quiz (5, no answer moves).** `q-que-se-guarda` `single` a (12–21). **`q-pares` `numeric` 60,
  `tolerance: 0` (22–27): "una frase de 12 tokens" — abstract, no sentence given, transposes
  untouched.** `q-denominador` `single` a (28–37): arithmetic. `q-negativos` `multi` [a,b] (38–47).
  `q-ruido` `boolean` true (48–52): explanation names `de`, `la`, `que` as the frequent negatives —
  English `the`, `of`, `and`.
- **`<PyCell>`** (313–407): a **template-generated Spanish corpus** — `animales`, `comidas`,
  `lugares`, `bebidas` (319–322) crossed into `el {a} come {c} en el {l}`, `el {a} bebe {b} en el
  {l}` and `la niña ve el {a} en el {l}` (325–331). Identifiers `frases`, `corpus`, `pos`, `ids`,
  `centros`, `contextos`, `negativos`, `etiquetas`, `vecinos`, `perdida`, `epoca`/`epocas`, `paso`,
  `filas`; Spanish comments (318, 327, 340, 350, 360, 384–389, 402) and prints (348, 371–372,
  393, 396–406).
- **Printed output quoted in prose — regenerated** (409–422): `perro`'s pre-training neighbour
  `establo` at `0.68`; the post-training `ratón`, `gato`, `caballo` above `0.97`; `carne`'s and
  `patio`'s groups; **`niña` sticking to `la` and `ve`** (416–417); and with `n_neg = 0` the loss
  falling to `0.02` with `perro` pairing to `en` and `el` (419–421). `default_rng(7)` (316) makes
  them reproducible, but **`el` and `la` both become `the`**, collapsing two entries — `\|V\|`
  drops and every number moves.
- **Corpus design constraint.** The `la niña ve el {a}` template is deliberately the *one* mould
  `niña` appears in, and the prose cashes that in at 416–417. The English template set has to keep
  one single-mould word for that paragraph to survive.
- **Prose.** The lead example `el perro ladra en el patio de la escuela` with `m = 2` centred on
  `patio`, yielding `en`, `el`, `de`, `la` (88–100) — four function words English will not supply
  in the same slots; recount from the English sentence.
- **`<Leccion ancla="">`: 0** (3 refs). **`reading`: 3**, all `lang: en`, Spanish notes; the third
  (77) names `rey - hombre + mujer ≈ reina` — **restores to the source form,
  `king - man + woman ≈ queen`.** **`<W>`: 35.**

#### 1.8 `glove-y-limites` — `es/08-glove-y-limites.mdx` — adapt (the block's most expensive)

- **Quiz (4, no answer moves).** `q-razon` `numeric` 10, `tolerance: 0.01` (12–17): the counts are
  in the prompt, and `hielo`/`vapor`/`sólido` **are the GloVe paper's `ice`/`steam`/`solid`**, so
  English restores the source terms and 10 holds. `q-objetivo` `single` a (18–27). `q-peso` `multi`
  [a,b,c] (28–37). `q-banco` `single` a (38–47): built entirely on `banco` — **English `bank`
  (finance / river) is the canonical equivalent and is what the literature uses**, so the answer
  stays (a).
- **`banco` is the lesson's spine, and its replacement is a design decision.** Spanish `banco`'s
  second sense is a park bench, so the second word-set is `árbol`, `seto`, `sendero`, `estanque`,
  `columpio` (305). English `bank`'s second sense is a river bank, so that set becomes river words
  — and **`bank` itself may not appear in it**, or the corpus contradicts the point.
- **Two artifacts get cheaper.** The `hielo`/`vapor` table (97–102) is the paper's own; the
  `rey − hombre + mujer ≈ reina` analogy (84) is `king − man + woman ≈ queen`. Both are
  back-translations to the source.
- **`<PyCell>`** (300–443): `finanzas` / `parque` word lists (304–305) and `escribe(banco_f,
  banco_p)` (308–324) generating six Spanish moulds; identifiers `escribe`, `frases`,
  `coocurrencias`, `ajusta`, `semilla`, `objetivo`, `perdida`, `epoca`/`epocas`, `paso`,
  `contenido`, `vecinos`, `coseno`, `fila`, `muestra`, `todas`; the probe lists
  `["cliente","niña","banco","en"]` (350) and `["dinero","hipoteca","árbol","seto"]` (417); the
  split-sense tokens `banco_dinero` / `banco_parque` (416).
- **Printed output quoted in prose — regenerated** (445–462): `432` non-zero cells against `3 840`
  pairs; `cliente` at `3.00`, `niña` at `0.33`, `banco` and `en` at `1.00` exactly; the fit falling
  `0.55` → `0.02`; the two neighbour triples; the shared row at `8` across four columns; cosines
  `0.00` on content words, `0.55` counting stopwords, `0.71` from the shared row to each sense.
- **`<Explorable>` `embedding-projection`** (79–82): second use in the block, Spanish caption, the
  analogy button. P11-02.
- **Prose.** `banco` in `saqué el dinero del banco` / `me senté en el banco del parque` (266–267);
  the closing `el banco cerró a las dos` / `el banco estaba mojado` (481–482); the `frío`/`caliente`
  pair inherited from 1.6 (276).
- **`<Leccion ancla="">`: 0** (**11 slug-only refs**). **`reading`: 2**, both `lang: en`, Spanish
  notes; the GloVe note (57) names "la tabla de «hielo» y «vapor»" — restores to `ice`/`steam`.
  **`<W>`: 61 — the most in the block.**

### Block totals

| | Count | Notes |
|---|---|---|
| **Lessons** | 8 | `es/01` … `es/08`, `block: 1`; the `draft: true` fixture excluded |
| **Transpose** | **0** | every lesson carries at least one Spanish example, corpus or asset |
| **Adapt** | **7** | 1.1, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8 |
| **Rewrite** | **1** | 1.2 only |
| Quiz items | 32 | 12 `single`, 8 `multi`, 6 `numeric`, 6 `boolean` — **1 answer moves** (1.2 `q-longitud`) |
| `<PyCell>` | 7 | 1.1 has none. **5 regenerated** (1.2, 1.3, 1.5, 1.7, 1.8); **2 re-run only** (1.4, 1.6) |
| `<CodeChallenge>` | **0** | none in the block — no assertion messages, no `# tu código aquí` |
| `<Explorable>` | 4 uses / 3 ids | `tokenizer-playground`, `bag-of-words`, `embedding-projection` ×2 — **all three carry a Spanish corpus**, unlike Block 3's three. P11-02 owns them, and 1.5 reads numbers off one |
| `<Figure>` | 2 | **both have Spanish set into the asset** — `suma-armonica.svg` (1.3), `one-hot-equidistancia.svg` (1.4). No P11 task currently owns SVG redraws |
| `<Leccion ancla="">` | **0** | 53 slug-only refs, so no anchor is re-derived anywhere in this block — and no lesson elsewhere in `es/` anchors *into* Block 1, so translating it breaks no inbound reference |
| `reading` | 13 | **all `lang: en`** — no Spanish-language source in the block; 13 Spanish `note`s, two of which (1.2's 67, 1.8's 57) need rewriting rather than translating |
| `<W>` | 340 | 1.8 (61), 1.2 (53), 1.5 (50), 1.1 (44), 1.3 (41), 1.7 (35), 1.6 (34), 1.4 (22) |

**Sizing read.** The block is **not** "mostly rewrite" — but it is not cheaper for that. The cost
did not disappear, it moved from one rewrite into five corpus rebuilds. Two lessons (1.4, 1.6) are
genuinely near-transposes: their word lists feed computations that ignore them, so no printed
number moves and the work is prose plus identifiers. One lesson (1.1) is prose-only but needs one
example re-derived with care. The other five each need a corpus **designed to hit stated targets**,
then run in Pyodide, then ~35 quoted numbers transcribed back into prose — and in 1.3 and 1.5 some
of those numbers sit *before* the cell, so a translator working top-to-bottom will write them
before knowing them. **1.8 is the block's biggest job, above 1.2**: a polysemy corpus rebuilt in a
different sense pair, plus twelve regenerated figures.

**Ordering constraint.** 1.5 reads four numbers off the `bag-of-words` widget, so **P11-02 has to
settle that widget's English documents before 1.5 is written.** 1.4's SVG must use 1.1's re-sorted
English triple, so 1.1 fixes the word order for both. 1.4's `q-que-cumple` quotes 1.1's `agua`
example, and 1.6 inherits 1.1's `el gato bebe leche` — translate strictly in order.

## Lesson progress

- [ ] 1.1 `texto-como-numeros`
- [ ] 1.2 `tokenizacion`
- [ ] 1.3 `vocabulario-oov`
- [ ] 1.4 `one-hot`
- [ ] 1.5 `bolsa-de-palabras`
- [ ] 1.6 `embeddings-densos`
- [ ] 1.7 `word2vec`
- [ ] 1.8 `glove-y-limites`

## The worked case — 1.2

The lesson survives; three quiz items do not. Replacement direction, so it is not re-derived
under time pressure:

- **NFC**: `naïve` or `café` — a diacritic with a legal decomposed form, same point, no `ñ`.
- **Subwords**: `unhappiness` → `un ##happi ##ness`, or contractions (`don't`) and possessives
  (`'s`) for the "unit smaller than a word" argument that `dámelo` was carrying.
- **The numeric item**: recount for whatever English sentence replaces `El niño juega.` The
  answer **will** change; the tolerance stays 0.

The surrounding prose changes with them — the paragraph on clíticos and `del`/`al` has no English
counterpart and is replaced by whatever the new examples earn, not padded to length.

*Added by P11-00:* the `<Details>` at 192–210 is a fourth artifact this section did not name, and
it is the largest. It argues that word vocabularies never saturate **because Spanish inflects so
heavily** — fifty forms per regular verb, clitics, gender and number, derivation. English inflects
in four or five forms, so the argument has to be re-pitched onto what does grow an English
vocabulary without bound (compounds, proper nouns, neologisms) rather than translated into a
weaker version of itself. Same conclusion, different evidence.

## Replacement directions for the heavy adapts

Not required by [P11-00](00-triage.md) — rewrites only — but recorded for the three lessons whose
corpus is a design problem rather than a translation:

- **1.1** — the added vocabulary word must sort *early* alphabetically or the renumbering point
  dies. `the cat drinks milk` + `bird` works; + `water` does not.
- **1.7** — keep one word that appears in exactly one sentence mould, so the "it learned the mould,
  not the word" paragraph still has a subject.
- **1.8** — `bank`: finance against river. The river word-set must avoid the token `bank` itself.

## Acceptance criteria

- [ ] Every lesson in the block exists under `content/courses/dl-nlp/en/`, `draft: false`
- [ ] `slug`, `block`, `order`, and every widget / quiz / challenge id match the Spanish lesson
- [ ] Every `<PyCell>` and `<CodeChallenge>` has been **run in the browser**, and every number the
      prose quotes matches what Pyodide printed
- [ ] Every `<Leccion>` resolves; every `ancla` points at an English heading where the target is
      translated, and at the Spanish one where it is not
- [ ] `reading` carries the same sources with translated `note`s; `lang` values unchanged
- [ ] The two-reader test passes against the **English** neighbours
- [ ] English versions of `suma-armonica.svg` (1.3) and `one-hot-equidistancia.svg` (1.4) exist,
      and 1.4's shows the three words in 1.1's English alphabetical order
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
  *Resolved by P11-00 for this block:* **no `ancla` exists anywhere in Block 1, and nothing in
  `es/` anchors into it.** The block's 53 `<Leccion>` refs are slug-only and lean on P11-01's
  canonical fallback while their targets are still Spanish. This hazard is Block 2–5's, not this
  block's.
- **The bridge is a contract.** The closing after `---` is what the next lesson's opening picks
  up. Translate in order; never skip a lesson and come back. *Sharpened by P11-00:* 1.1's bridge
  hands `dámelo` to 1.2, and 1.2 is the rewrite — so **the first bridge in the block is already a
  rewritten one.** Settle 1.2's replacement examples before finishing 1.1.
- **Numbers quoted before the cell that produces them.** 1.3 quotes its corpus statistics in the
  opening paragraph (79–80), 190 lines above the `<PyCell>`; 1.5 reads four values off a widget
  it has not yet described. Write the cell, run it, *then* fill the opening.
- **Under-budget word warnings are expected** on transposed lessons — see `AUTHORING.en.md`. Note
  that Block 1 has **no transposes**, so a short lesson here is more likely a dropped example than
  a language-length artefact.

## Out of scope

- Editing the Spanish lesson. If translation exposes a Spanish error, that is a separate PR.
- Changing block/order or any id.
- Widget strings and corpora — P11-02 owns those. **Figure SVGs are not widgets**, and the two
  in this block are not covered by P11-02; they are this task's to redraw.

# P11-06 — Block 3: Recurrent Neural Networks

**Tag:** `COURSE-P11-06` · **Size:** L · **Status:** ✅ done (3.1–3.8, reviewed)

## TL;DR

Eight lessons. The most transposable block in the course: sequences, memory and the vanishing
gradient are argued in mathematics, and the widgets are numeric rather than linguistic. The
project at 3.7 is the exception — a character-level language model trains on a corpus.

## Classification

Filled by [P11-00](00-triage.md) — read against the eight `es/` lessons selected by their
`block: 3` frontmatter, in `order`. Note the two files whose name and frontmatter disagree:
**`es/26-seq2seq.mdx` is 3.8**, and `es/33-adios-recurrencia.mdx` is Block 5, not this block.

**No lesson in Block 3 is a rewrite.** Not one of the 32 quiz items has an answer that moves in
English — the block argues in mathematics, and the four items that look linguistic (3.1's `no`
marker, 3.5's plural agreement, 3.7's character count, 3.8's reversal) all keep their answer.
What the block does carry is five corpora and examples that have to be *chosen* rather than
translated, and one of them is a file outside the lesson tree.

| # | Slug | Class | Spanish-dependent artifacts |
|---|---|---|---|
| 3.1 | `por-que-falla-el-mlp` | **adapt** | The 8-word `V` in the cell; the 4-token / 2-token phrase pair whose counts the prose quotes; the word-order pair; `no` ×10 as the marker word — **also baked into `concatenacion-bloques.svg`**. Recap quotes Block 2's `88.3 %` and `5 329` |
| 3.2 | `la-rnn-vanilla` | **adapt** | Its own 12-word `V` (not 3.1's), shared by both cells and read through `V.index(palabra)` — every printed state moves with the list; two final states are quoted **inside a quiz explanation**. The second cell reads **Block 2's closing pair** (`la película no es aburrida, es divertida` and its swap) and quotes Block 2's `0.0014`, so it inherits P11-05's English pair and figure. `guion` ×5 |
| 3.3 | `bptt` | **transpose** | None. Prose, code identifiers and 12 assertion messages only; every number is seed-driven. Densest crosslinking in the block (21 `<Leccion>`) |
| 3.4 | `gradiente-desvanecido` | **transpose** | One illustrative sentence (`Dudo que a alguien le sirva`) that translates directly, no count attached. `vanishing-gradient` confirmed numeric, no corpus |
| 3.5 | `lstm` | **adapt** | The twelve-position agreement sentence, and **"doce posiciones" quoted three times** — the English distance must be recounted. The gate quiz item survives: its answer is a gate configuration |
| 3.6 | `gru` | **transpose** | None. No `<W>`, no example, no corpus; the reused `lstm-gates` caption is the only new prose |
| 3.7 | `proyecto-char-lm` | **adapt** | The heaviest. A **new corpus file** (`public/courses/dl-nlp/corpus-mar.txt`), and with it 2 632, \|V\| = 32, ln 32 = 3.47, the final ≈ 2.5, and every generated sample the prose characterises |
| 3.8 | `seq2seq` | **adapt** | The reversal pair `roma` → `amor` and the letters named from it. **Not a translation pair** — see the correction below. The toy task is alphabet-only and holds unchanged |

### What changed from the planning pass

Four of the eight pre-filled hypotheses were wrong or incomplete:

- **3.1** — "Inherits Block 2's corpus in its recap" is right, and it is specifically two numbers:
  `88.3 %` (58–64) and `5 329` parámetros (205–207), both from `es/18-proyecto-sentimiento.mdx`,
  which P11-05 classes **adapt**. P11-05 lands first, so quote the English figures, not these.
  The row missed the lesson's own 8-word corpus and the `«no»` baked into the figure asset.
- **3.5** — the block told triage to read the gate item rather than assume. Read: the answer is
  $f\to1$, $i\to0$, $o\to0$, a gate configuration that owes nothing to Spanish. **Not a rewrite.**
  The cost is elsewhere and the row missed it — the prose sentence carries a *position count*
  quoted three times, and that is what has to be recomputed.
- **3.8** — "Translation-pair examples" is wrong. There is no translation pair in this lesson; the
  dependency is a single reversal (`roma` → `amor`) needing an English word whose reverse is also a
  word. The alignment pair the README names (`leí` ↔ `read`) is Block 4's, not this one.
- **3.2 / 3.4** — "widget labels" and "widget — numeric, no corpus" are both confirmed, and the
  same holds for `lstm-gates`: **none of Block 3's three explorables carries a corpus.** They need
  labels and captions only, which is why they are absent from P11-02's corpus table. `3.3`'s row
  said "Code challenge" with no class; it is a transpose.

### Artifact inventory

Line refs are into the `es/` file named in each heading.

#### 3.1 `por-que-falla-el-mlp` — `es/19-por-que-falla-el-mlp.mdx` — adapt

- **Quiz (4, no answer moves).** `q-pesos` `numeric` 327680 (14–18), arithmetic. `q-por-que-falla`
  `single` a (19–28), carries `<W>no</W>` in prompt, option (a) and explanation. `q-longitud-fija`
  `multi` [a,b] (29–38), architecture only. `q-bolsa-mejor` `boolean` false (39–43) — its
  explanation holds the word-order pair `la actriz salva la película` / `la película salva la
  actriz`, which needs an English pair whose reversal changes the meaning.
- **`<PyCell>`** (230–284). `V` = 8 Spanish review words (233) with `NO, T = 7, 6` (234). The word
  list **never prints** — it is used only through `len(V)` and `np.eye(len(V))` — so an English
  list of 8 words leaves every printed value byte-identical. Spanish identifiers `corpus`,
  `posiciones`, `entrena`, `salida`, `acierto`, `pasos`, `mov`, `C_ent`/`C_pru`/`B_ent`/`B_pru`,
  `ac_e`/`ac_p`; Spanish print labels (277–283).
- **Printed output quoted in prose:** `1.000` / `0.500` (286), `0.0014` (290), `2.4` and
  `0.000000` (299–304). Re-run to confirm; nothing here is regenerated.
- **`<Figure>`** (75–79) `concatenacion-bloques.svg`: Spanish `alt` and `caption`, and **the SVG
  has `«no»` set in it twice**. Changing the marker word means a new asset, not a new caption.
- **`<Leccion ancla="">`: 0** (5 slug-only refs). **`reading`:** 1 (46–53), `lang: en`, Spanish note.
- **`<W>`: 14** — `no` ×10; `la fotografía es magnífica` and `guion flojo` (69–70), **whose token
  counts the prose quotes** ("trae cuatro vectores" / "trae dos"), so the replacements must be
  4 tokens and 2 tokens; the two word-order phrases (43).

#### 3.2 `la-rnn-vanilla` — `es/20-la-rnn-vanilla.mdx` — adapt

- **Quiz (3, no answer moves).** `q-parametros` `numeric` 12352 (12–18). `q-compartir` `single` a
  (19–28), `<W>guion</W>` in prompt and option (a); the `29 312` / `384 000` in its explanation are
  arithmetic. `q-recurrencia` `multi` [a,b] (29–38) — **its explanation names the second cell's
  two sentences in `<W>` and quotes their final states `(-0.751, 0.011, -0.932)` and
  `(-0.678, 0.239, -0.859)`**, so the item is downstream of both the pair and the vocabulary.
  (`q-memoria` has been removed from the Spanish lesson; nothing to translate.)
- **`<PyCell>` ×2** (322–358, 376–420), **sharing one 12-word `V`** (325–326, 379–380): cell 1's
  eight words (`la el actriz película guion salva hunde y`) followed by the four only cell 2 uses
  (`no es aburrida divertida`). Both cells draw `E` first from `default_rng(0)`, with `len(V)` rows,
  so **the list's length and order move every printed state** in both cells, and the two cells
  must keep an identical `V` («la misma red de la celda anterior», 382). Identifiers `paso`, `lee`,
  `frase`, `palabra`, `estados`, `corta`, `larga`, `tokens`, `bolsa`, `concat`, `recurr`;
  Spanish comments in both cells, Spanish prints (342–357, 410–419).
- **Cell 2 reads Block 2's closing pair** (408–409): `la película no es aburrida, es divertida` /
  `la película no es divertida, es aburrida`, the pair `es/18-proyecto-sentimiento.mdx` ends on,
  linked from the lead-in (373). `tokens()` drops the comma. It prints both bags and a
  side-by-side table of the states, one row per position.
- **Printed output quoted in prose:** cell 1's `el guion` states `(-0.686, 0.010, -0.744)` /
  `(-0.715, 0.077, -0.745)` (366); cell 2's two final states (433, and `q-recurrencia` at 38);
  `29 312` / `3 810 688` (444, arithmetic, stable). **Quoted from Block 2, not printed here:
  `0.0014`** (424), the probability `es/18` gave both sentences.
- **Claims that depend on where tokens fall**, to re-check against the English run: `V` has 12
  entries and cell 1 uses 8 (316); cell 1's sentences are 5 and 10 tokens (360), with `el guion`
  at positions 1–2 and 7–8 (355, 364) and its states there «casi los mismos» (364–370); the pair
  shares a 4-token prefix, so rows 1–4 coincide and the table splits at row 5 (426–431).
- **`<CodeChallenge>` `ch-rnn-forward`** (40–133): 2 `# tu código aquí` (57, 62), 5 test `name`s,
  8 Spanish assertion messages (72–110), Spanish `prompt` (41–50), `solution` (`paso`, `estados`)
  and `explanation` (126–133). Tests are numeric; nothing moves.
- **`<Explorable>` `rnn-unrolled`** (163–168), `direction="forward"`: Spanish caption. Widget has
  **no corpus** — `RnnUnrolled.tsx` is symbolic, with Spanish only in its `aria-label` (185) and
  step readout (465). P11-02.
- **`<Leccion ancla="">`: 0** (3 refs: `funciones-activacion`, `proyecto-sentimiento`, `bptt`).
  **`reading`:** 1 (134–142), `lang: en`, Spanish note.
- **`<W>`: 13** — `guion` ×4, `el guion`, `no` ×2, `no es`, `la película no es`, `aburrida`,
  `divertida`, and the two full sentences (38).

**English notes for 3.2.**

- **The pair and the figure come from P11-05**, not from a fresh translation: `en/18` ends on
  `the film is not boring, it is fun` / `the film is not fun, it is boring` (en/18:340–341) and
  quotes `0.0002` for both (en/18:359). The English 424 quotes `0.0002`, not `0.0014`.
- **The English pair is 8 tokens, not 7** (`es` → `it is`), so the table has 8 rows and the final
  states are `h_8`. The shared prefix is still 4 tokens (`the film is not`), so the row-5 split and
  «la posición 5» hold as written.
- **A 12-word English `V` falls out naturally** if cell 1 becomes `the script sinks the film` /
  `the actress saves the film and the script sinks it`: `the actress film script saves sinks and it`
  (8, used by cell 1) + `not is boring fun` (4, only cell 2), because `it` covers both the pronoun
  `la` in cell 1 and the pair's `it is`. The 5 / 10 token counts and `the script` at 1–2 and 7–8
  hold. **But «casi los mismos» does not hold for free:** it is a property of the draw, and with
  that list in that order and `default_rng(0)`, `the script` at 7–8 is *not* close to 1–2
  (measured in CPython). Reorder `V` or change the seed until it is, verify in
  Pyodide, and keep the two cells' `V` identical. *Resolved by reordering `V`; see "From 3.2" below.*

#### 3.3 `bptt` — `es/21-bptt.mdx` — transpose

- **Quiz (5, all language-free).** `q-forma-gradiente` `numeric` 4096 (12–18);
  `q-de-donde-la-suma` `single` a (19–28); `q-recurrencia-atras` `multi` [a,b] (29–38);
  `q-sesgo-suma` `predict-output` `[ 0.5 -0.5]` (39–57), whose answer is a NumPy repr and whose
  explanation turns on NumPy's sign padding — both survive translation intact;
  `q-guardar-la-ida` `single` a (58–67). **No item touches Spanish.**
- **`<PyCell>`** (346–397): identifiers `perdida`, `aporte`, `peor`, `mas`, `menos`; Spanish
  comments and prints (369, 384–385, 396). Quoted output — five per-step contributions with the
  last exactly zero, and `10^{-10}` (399–404) — is seed-driven and holds.
- **`<CodeChallenge>` `ch-bptt`** (69–180): 1 starter comment (87), 4 test `name`s, **12 Spanish
  assertion messages** (97–152, the most in the block), Spanish `prompt`, `solution` comments
  (160–166) and `explanation` (168–180); identifiers `peor`, `guardas`, `copias`.
- **`<Explorable>` `rnn-unrolled`** (215–219), `direction="backward"`: Spanish caption only.
- **`<Leccion ancla="">`: 0**, but **21 slug-only refs — the densest in the block**; all of them
  lean on P11-01's canonical fallback while their targets are still Spanish.
- **`reading`:** 1 (182–189), `lang: en`, Spanish note. **`<W>`: 0.**

#### 3.4 `gradiente-desvanecido` — `es/22-gradiente-desvanecido.mdx` — transpose

*Re-read at translation time: commit `1301972` removed `q-decae-numerico` and added the
`svd`/`eig` cell after triage, and the COURSE-P11-06 fix commit rewrote the formalisation (see
"From 3.4" below). Line refs are to the fixed file.*

- **Quiz (4, all language-free).** `q-que-lo-desvanece` `single` a (12–22);
  `q-clipping-que-arregla` `single` a (23–32); `q-mascara-tanh` `single` a (33–41);
  `q-que-cuesta` `single` a (42–51).
- **`<PyCell>` ×3** (224–241, 260–267, 286–304): the `svd`/`eig` cell and the scalar cell are
  Spanish comments and print headers only; the clipping cell has `recorta`, `nombre`, `coseno` and
  the labels `"normal   "` / `"explotado"` / `"(coseno con g: %.4f)"`. Quoted output (σ_max 4.06,
  ρ 0.5, 0.5776 at d = 40, 9.09e-13, 1.11e+07, norm ≈ 30 clipped to `5.00`, cosine `1`) holds.
- **`<Explorable>` `vanishing-gradient`** (104–107): Spanish caption. **Confirmed numeric, no
  corpus** — `VanishingGradient.tsx` carries slider labels only, and `Radio espectral` is already
  in P11-02 §3's terminology list.
- **`<Leccion ancla="">`: 0** (5 refs). **`reading`:** 2 (53–69), both `lang: en`, Spanish notes.
- **`<W>`: 2** — `Dudo que a alguien le sirva` and `Dudo` (83–84). Translates directly; the
  "treinta palabras más tarde" is a round figure, not a computed count.

#### 3.5 `lstm` — `es/23-lstm.mdx` — adapt

*Re-read at translation time: commit `4e7420d` removed `q-producto`, moved the figure up beside the
six-line block and the explorable below the first cell, and commit `ef39bff` fixed the errors listed
under "From 3.5" below. Line refs are to the fixed file.*

- **Quiz (4, no answer moves).** `q-por-que-sobrevive` `single` a (12–22). **`q-que-compuerta`
  `single` a (23–32) — the item the block flagged.** Its prompt holds "el sujeto era plural"
  across a relative clause, but the answer is a gate configuration ($f\to1$, $i\to0$, $o\to0$) and
  owes nothing to how strongly a language marks plurality. English present-tense agreement
  carries the prompt; distractor (b) inverts the forget gate and (c) fails on the output gate, both
  language-free. `q-parametros` `numeric` 49408 (33–39); `q-que-no-arregla` `multi` [a,b] (40–50).
- **The example, and the one recount in the block.**
  `Las cámaras que el ayuntamiento instaló el año pasado en la plaza no funcionan` (180–181), with
  **"doce posiciones" quoted at 182, 185 and 245**. Count the English sentence's own distance and
  move all three together; the same sentence supplies the cheap-token contrast `que` / `del` (234).
- **`<PyCell>` ×2** (349–388, 415–449): numeric only. Identifiers `pesos`, `paso`, `entra`,
  `sigmoide`, `sesgo_olvido`, `olvidos`, `empujon`; Spanish prints. Quoted output: `20 %` / `78 %`,
  `1.1 × 10^{-3}`, the `b_f = 0` line (prints `0.00e+00`, see "From 3.5"), `14 %`, `76 %`.
- **`<CodeChallenge>` `ch-lstm-paso`** (52–142): 1 starter comment, 5 test `name`s, 6 Spanish
  assertion messages, Spanish `prompt`, `solution` (`paso_lstm`, `entra`, `sigmoide`, `c_nuevo`)
  and `explanation`.
- **`<Explorable>` `lstm-gates`** (405–408): Spanish caption. **No corpus** — `LstmGates.tsx:221–227`
  carries the three row hints `qué conserva` / `qué escribe` / `qué deja ver` plus the `b_f` slider
  label, and nothing else. P11-02. (The caption's "la misma frase" describes a sequence the widget
  renders as vectors, not words; the English caption should not promise more than it shows.)
- **`<Figure>` `lstm-celda.svg`** (273–277): Spanish `alt` and `caption`, but **the SVG's visible
  labels are symbols only** (`f`, `i`, `c̃`, `o`, `tanh`) — the asset is reused unchanged. Its
  `aria-label` is Spanish, but `<Figure>` renders through `<img>`, whose `alt` is what a screen
  reader gets (the same holds for `forward-shapes.svg` in `en/12`).
- **`<Leccion ancla="">`: 0** (9 refs). **`reading`:** 3 (143–167), all `lang: en`, Spanish notes.
- **`<W>`: 11** — `cámaras` ×5, `ayuntamiento`, `plaza`, `funcionan`, `que`, `del`; all inside the
  one example, so all 11 are decided by the sentence chosen to replace it.

#### 3.6 `gru` — `es/24-gru.mdx` — transpose

- **Quiz (4, all language-free).** `q-actualizacion` `single` a (12–22); `q-reset` `single` a
  (23–32); `q-parametros-gru` `numeric` 37056 (33–39); `q-tradeoff` `multi` [a,b] (40–50).
- **`<PyCell>`** (339–379): numeric only; identifiers `pesos`, `paso`, `entra`, `sigmoide`,
  `sesgo_z`, `guardados`, `cand`; Spanish prints (372–378). Quoted output `3 %` / `77 %` (383–384)
  holds.
- **`<CodeChallenge>` `ch-gru-paso`** (52–148): 1 starter comment (69), 5 test `name`s, 6 Spanish
  assertion messages (80–124), Spanish `prompt`, `solution` and `explanation`.
- **`<Explorable>` `lstm-gates`** reused (202–205) with a **second, different Spanish caption** —
  one widget id, two captions across 3.5 and 3.6, both translated here; the widget strings are
  P11-02's.
- **`<Leccion ancla="">`: 0** (12 refs). **`reading`:** 2 (150–165), both `lang: en`; the second
  note (157) explains a sign convention (`su z conserva y tu z escribe`) — translate it, do not
  drop it, because the lesson's own convention depends on it.
- **`<W>`: 0.**

#### 3.7 `proyecto-char-lm` — `es/25-proyecto-char-lm.mdx` — adapt (the heaviest in the block)

- **A new asset, outside the lesson tree.** `public/courses/dl-nlp/corpus-mar.txt` — 2 692 bytes of
  Spanish prose about a seaside village — is fetched at runtime by
  `open_url("/courses/dl-nlp/corpus-mar.txt")` (208). The English lesson needs its own file at its
  own path. Neither P11-02 (widgets) nor this block's "Out of scope" covers it; budget it with the
  lesson.
- **Every quoted number is a function of that corpus, and they move together:** `2 632` characters
  (quiz prompt 14; prose 224, 227), `|V| = 32` (224–225, 300, and distractor (c) at 18),
  `ln 32 = 3.47` as the starting loss (300; summary 7), and the final `≈ 2.5` (302; summary 7). An
  English corpus without `ñ` and accented vowels lands nearer `|V| = 29`, `ln 29 ≈ 3.37`.
- **The regex** `[^a-záéíóúñ .,]` (210) and its comment drop the Spanish character classes.
- **Sample text quoted in prose — regenerate, do not re-run.** `el pueblo es` / `l pueblo est` as
  the input/label pair (220–221, 226–227), and the generated samples the prose characterises at
  305–308 and 344–350. The closing characterisation ("palabras cortas reales — `la`, `el`, `de`,
  `y`", 307) has to be rewritten against what the English model actually prints.
- **Quiz (3, no answer moves).** `q-t-ejemplos` `single` a (12–22) — **the answer stays `a`**, but
  the prompt states the character count and distractor (c) states `32`; both are corpus numbers.
  `q-dos-errores` `multi` [a,b] (23–33), pure BPTT. `q-por-que-malo` `single` a (34–44); its
  explanation's `64 coordenadas` and `25 caracteres` are hyperparameters (240) and stay.
- **`<PyCell>` ×3** (203–222, 236–298, 322–342): identifiers `texto`, `datos`, `adelante`, `atras`,
  `genera`, `genera_voraz`, `salida`, `suave`, `perdida`; Spanish prints (218–221, 297, 326, 340).
- **`<Leccion ancla="">`: 0**, with **24 slug-only refs — the most in the block**.
- **`reading`:** 2 (47–62), both `lang: en`, Spanish notes. **`<W>`: 12** — `q` / `u` for the `qu`
  digraph (90, a claim that holds in English), `la` / `el` / `de` / `y` as the frequent short words
  (90, 307), `ñ` (224), and the two printed strings (226).

#### 3.8 `seq2seq` — `es/26-seq2seq.mdx` — adapt

- **The one dependency: a reversal, not a translation pair.** `roma` → `amor` (87–92, 102) needs an
  English word whose reverse is also a word; the prose then names the output's first and last
  letters (`a`, `r`, 88–89), which follow from whichever pair is chosen. The alignment pair the
  README flags (`leí` ↔ `read`) belongs to Block 4.
- **Quiz (4, no answer moves, and none touches `roma`/`amor`).** `q-dos-redes` `single` a (12–22);
  `q-contexto-tamano` `numeric` 64 (23–29); `q-encoder-aprende` `multi` [a,b] (30–40);
  `q-cuello-botella` `single` a (41–51). All four are architecture.
- **`<PyCell>` ×2** (223–285, 294–326): **the toy task is alphabet-only** — `V = list("abcdef")`
  (227) — so neither cell is Spanish-dependent and both the loss curve and the accuracy-by-length
  table hold unchanged. Identifiers `paso`, `pesos`, `escribe`, `suave`, `ej`, `ac`, `bien`, `tot`;
  Spanish prints (284, 310, 314–315, 319, 325).
- **`<Figure>` `encoder-decoder.svg`** (94–98): Spanish `alt` and `caption`. The labels are mostly
  English or symbolic (`encoder`, `decoder`, `c`, `GO`), **but the note under `c` reads `d_h
  números`**, so the asset needed an English sibling after all (see "From 3.8").
- **`<Leccion ancla="">`: 0** (12 refs). **`reading`:** 2 (54–69), both `lang: en`, Spanish notes.
- **`<W>`: 7** — `roma` ×3, `amor` ×2, `a`, `r`.

### Block totals

| | Count | Notes |
|---|---|---|
| **Lessons** | 8 | `es/19` … `es/26`, selected by `block: 3` |
| **Transpose** | **3** | 3.3, 3.4, 3.6 |
| **Adapt** | **5** | 3.1, 3.2, 3.5, 3.7, 3.8 |
| **Rewrite** | **0** | no quiz answer in the block moves |
| Quiz items | 31 | 16 `single`, 7 `multi`, 6 `numeric`, 1 `predict-output`, 1 `boolean` — **0 answers move** (3.4's `q-decae-numerico` and 3.5's `q-producto` were removed from the Spanish after triage) |
| `<PyCell>` | 15 | all re-run; only 3.7's 3 are **regenerated** (3.4 gained its `svd`/`eig` cell after triage) |
| `<CodeChallenge>` | 4 | 3.2, 3.3, 3.5, 3.6 — 32 Spanish assertion messages, 19 test `name`s, 5 `# tu código aquí` |
| `<Explorable>` | 5 uses / 3 ids | `rnn-unrolled` ×2, `lstm-gates` ×2, `vanishing-gradient` ×1 — **none carries a corpus**; captions here, widget strings in P11-02 |
| `<Figure>` | 3 | only `concatenacion-bloques.svg` (3.1) has Spanish set into the asset |
| `<Leccion ancla="">` | **0** | 91 slug-only refs, so no anchor is re-derived anywhere in this block |
| `reading` | 14 | **all `lang: en`** — no Spanish-language source in the block; 14 Spanish `note`s to translate |
| `<W>` | 59 | over 6 lessons; 3.3 and 3.6 have none. 3.1 (14), 3.2 (13), 3.7 (12), 3.5 (11) hold most |

**Sizing read.** Three lessons are prose-only work. Four adapts cost one example or one word list
each, with the numbers they feed. 3.7 is the block: a new corpus asset, a retrain, and every
quoted figure and sample regenerated — treat it as its own PR-sized job, not as one of eight.

**Cross-block dependency.** 3.1's recap quotes `88.3 %` and `5 329` from `es/18-proyecto-sentimiento.mdx`,
which P11-05 classes **adapt**. P11-05 lands before this task, so 3.1 quotes whatever the English
Block 2 prints — check it rather than transcribing these. **3.2 depends on the same lesson**: its
second cell reads Block 2's closing pair and quotes the `0.0014` both sentences got there, so the
English 3.2 takes `en/18`'s pair and its `0.0002` (see the English notes under 3.2).

## Lesson progress

- [x] 3.1 `por-que-falla-el-mlp`
- [x] 3.2 `la-rnn-vanilla`
- [x] 3.3 `bptt`
- [x] 3.4 `gradiente-desvanecido`
- [x] 3.5 `lstm`
- [x] 3.6 `gru`
- [x] 3.7 `proyecto-char-lm`
- [x] 3.8 `seq2seq`

## Decisions fixed by a translated lesson

Reuse these verbatim; they are settled, not open.

**From 3.1** (`en/19-por-que-falla-el-mlp.mdx`):

- **The word-order pair is <W>the actress saves the film</W> / <W>the film saves the actress</W>**
  (`q-bolsa-mejor`'s explanation). **3.2 reuses it**: its first cell reads
  `la actriz salva la película y el guion la hunde`, so its English sentence should open on this
  pair. (3.2's second cell used to read this pair too; it now reads Block 2's closing pair instead.)
  Note for 3.2's `V`: `la` and `el` both become `the`, so the English list is not index-for-index
  with the Spanish one and every printed state moves; see the English notes under 3.2.
- **The marker word is `not`**, in the cell, all ten `<W>` mentions and the figure. 3.2's `guion` is
  a different word and is not fixed by this.
- **3.1's cell vocabulary is `["the", "film", "is", "very", "good", "long", "fun", "not"]`**, `NOT = 7`.
  It is 3.1's alone: **3.2's `V` is a different list** (`la el actriz película guion salva hunde y
  no es aburrida divertida`), which this block md's classification row used to call "the same
  8-word `V`". Nothing in 3.1
  constrains it. The cell never prints the list, so the English output is byte-identical to the
  Spanish (verified in the browser: `1.000 / 0.500`, `1.000 / 1.000`, `0.0014`, `≈ 2.4` and
  `0.000000`).
- **The 4-token / 2-token phrases are <W>the cinematography is superb</W> / <W>weak script</W>.**
- **The recap quotes the English Block 2 figures, `86.7%` and `5,257`**, not the Spanish `88.3 %` and
  `5 329`, as the cross-block dependency below requires.
- **`concatenacion-bloques.en.svg`** carries `"not"` above positions 3 and 5 (measured: x 144–174 in
  a 134–184 segment), with its `aria-label` and comments translated.
- **Two Spanish errors found and fixed in `es/19`** (their own commit): the `reading` note placed the
  argument in the Deep Learning book's §10.1, but it and the Nepal example are in the chapter's
  introduction (p. 367, before §10.1); and «con la misma capa oculta» compared the Block 2 classifier
  (12 hidden neurons) with this lesson's 128-neuron example as if they shared a layer, now «con una
  sola capa oculta». The English says the same in both places.

**From 3.2** (`en/20-la-rnn-vanilla.mdx`):

- **3.2's `V` is `["the", "it", "actress", "film", "script", "saves", "sinks", "and", "is", "not",
  "boring", "fun"]`**, in both cells. It mirrors the Spanish list slot for slot (article/pronoun,
  the three nouns, the two verbs, the conjunction, then the four entries only cell 2 uses). The order
  the English notes above proposed (`the actress film script saves sinks and it` + `not is boring
  fun`) was measured and rejected: `the script` at 7–8 lands up to $0.23$ from 1–2, which is not
  "almost the same". This order gives $0.072$ against the Spanish $0.067$.
- **Cell 1's sentences are <W>the script sinks the film</W> / <W>the actress saves the film and the
  script sinks it</W>**, opening on 3.1's pair. Printed in Pyodide and quoted:
  $(-0.602,\ -0.098,\ -0.527)$ / $(-0.632,\ -0.026,\ -0.540)$.
- **Cell 2 reads en/18's pair** and quotes its `0.0002`. It is 8 tokens, so the table has 8 rows and
  the final states are `h_8`: $(-0.828,\ -0.077,\ -0.810)$ / $(-0.715,\ 0.167,\ -0.671)$, in the prose
  and in `q-recurrencia`'s explanation.
- **Code names:** `paso` → `step`, `lee` → `read`, `frase` → `sentence`, `palabra` → `word`,
  `estados` → `states`, `bolsa` → `bag`, `corta`/`larga` → `short`/`long`, `copias` → `copies`,
  `# tu código aquí` → `# your code here`. `step` names the recurrence step from here on, so 3.5/3.6's
  `paso_lstm` / `paso_gru` become `lstm_step` / `gru_step`. Block 2's step activation never shares a
  lesson with it.
- **A print that quotes a sentence uses `"%s"`**, not `«%s»` (now in `AUTHORING.en.md` §7). 3.7 has
  three of these.
- **`es/20` bolds two words for emphasis** (**cuántas veces**, **una**), against `AUTHORING.md` §5.
  The English uses italics; the Spanish is left for its own fix.

**From 3.3** (`en/21-bptt.mdx`):

- **Code names:** `perdida` → `loss`, `aporte` → `contributions`, `peor` → `worst`, `mas`/`menos` →
  `plus`/`minus`, `guardas` → `copies`. `worst`/`plus`/`minus` are `en/16`'s probe-loop names and
  `copies` is 3.2's, so any later cell or test that probes a derivative or guards its inputs reuses
  them.
- **`la ida` / `la vuelta` are `forward pass` / `backward pass`**, every time, per the glossary: never
  "the way back". The Spanish leans on the pair (`q-guardar-la-ida`, «qué obliga a guardar la vuelta»)
  and so does 3.4. The two moves are `en/16`'s **transports** / **masks**, and `sondeo numérico` is the
  *numerical probe*.
- **The pickup drops the Spanish opening's generator image** («los pesos que un generador escribió»),
  because `en/20`'s bridge already says "weights set by a generator": the English opens on "nobody has
  trained yet" instead.
- **MLP is expanded in `q-de-donde-la-suma`** ("the concatenated multilayer perceptron (MLP)"): the
  Spanish leaves it bare, and no prose in this lesson expands it.
- **Printed in Pyodide and quoted:** `ŷ = 0.4022`, `ℓ = 0.9107`, contributions
  `[0.2602 0.1352 0.0723 0.2272 0.]`, largest probe difference `9.3e-11` (the prose's $10^{-10}$),
  byte-identical to the Spanish cell.
- **Three Spanish errors found and fixed in `es/21`** (their own commit): the `reading` note cited
  equation 10.13 (the loss sum) where the transport-and-mask equation is 10.21; the challenge
  explanation said the copy of `dhT` is needed because `dh = Whh.T @ delta` rewrites it, but rebinding
  never touches the caller's array (without the copy, rebinding passes all four tests and an in-place
  `dh *= …` fails tests 2 and 4); and **acumulan** was bold for emphasis. The English says the same.
- **Open, not applied:** English lessons write "pre-activation" 53 times, but `rnn-unrolled`'s
  `forwardPreactivation` string says "preactivation". A glossary row in `AUTHORING.en.md` and the
  widget string would settle it; the widget string is P11-02's.

**From 3.4** (`en/22-gradiente-desvanecido.mdx`):

- **The vanishing condition is $\gamma\,\sigma_{\max} < 1$, never $\rho$.** It guarantees the vanishing
  whatever the masks do, and $\gamma\,\sigma_{\max} > 1$ is necessary for an explosion, not
  sufficient. $\rho$ is only the long-run pace of the matrix on its own (a recurrence with no mask),
  which is what the `vanishing-gradient` slider shows. The lesson's `<Details>` proves the gap: a
  $2 \times 2$ matrix with $\rho = 0$ whose masked product grows as $1.8^{d}$. 3.5–3.8 and Block 4
  cite $\gamma\,\sigma_{\max}$ when they call back to this lesson (`es/23` and `es/24` already did;
  `es/28` was fixed in the same commit). Recorded in the course `NOTATION.md`.
- **The clipping threshold is $\kappa$, and `kappa` in code**, never $\theta$, which the shared
  `NOTATION.md` §4 reserves for all parameters. `es/25`–`es/28` were renamed in the same commit, so
  3.7, 3.8 and Block 4 translate `kappa` as it stands. The English term is **gradient clipping**
  (new `AUTHORING.en.md` glossary row); never bare "clipping" where Block 2's clipping of the
  probabilities could be meant.
- **$\gamma$ is the largest slope over every step the product crosses**, not at a single step.
- **The example is <W>I doubt this helps anyone</W>.** "I doubt" is two words, so the prose says
  the gradient must get back to "the opening words".
- **Code names:** `recorta` → `clip`, `nombre` → `name`, `coseno` → `cosine`, `g_rec` → `g_clip`;
  labels `"normal  "` / `"exploded"`, equal width so the columns align.
- **Acronyms the Spanish leaves bare are expanded:** RNN in the opening, MLP in the first
  `<Leccion>` label, LSTM in the bridge. The bridge's forward label is "the LSTM and its gates",
  since 3.5 has no English title yet.
- **Printed in Pyodide and quoted:** σ_max `4.0616`, ρ `0.5000`, `1.0458` at d = 5, `0.5776` at
  d = 40, `9.09e-13`, `1.11e+07`, norms `2.56` (untouched) and `29.84` → `5.00`, cosine `1.0000`,
  byte-identical in both locales.
- **Spanish errors fixed in `es/22`** (their own commit): the bound was read as proving explosion
  («Si es mayor que 1, explota»); $\gamma$ was a single step's maximum raised to $T - k$; the
  Hochreiter note said the chapter proposes no remedy, but its §4 surveys them, LSTM included;
  **sumando** was bold for emphasis; «basta despejar» used the banned «basta» family; and $\rho$
  was presented as deciding the masked case. The widget's `math/vanishing-gradient.ts` comment
  claimed the bound $(\gamma\rho)^{d}$ and was corrected too (comments only).

**From 3.5** (`en/23-lstm.mdx`):

- **The example is <W>The cameras that the mayor installed in the square last year are broken</W>**,
  and the distance is **ten positions** (from <W>cameras</W> at 2 to <W>are</W> at 12), so all three
  «doce posiciones» moved to ten together. The third («las doce posiciones del inciso») reads
  "throughout those ten positions", because the relative clause itself is nine words. The agreement
  is spelled <W>are</W> against <W>is</W>, the singular nouns named are <W>mayor</W> and
  <W>square</W>, and the cheap tokens are <W>that</W> / <W>the</W>.
- **<W>mayor</W>, not <W>council</W>:** en-GB lets a collective noun take a plural verb, which would
  blur "both singular". Now a rule in `AUTHORING.en.md` §3.
- **«la misma frase» is "the same sequence"**, in the prose and the `lstm-gates` caption: the cell
  and the widget read random vectors. `es/24`'s reused caption already says «la misma secuencia».
- **The pickup drops «no es el valor de los pesos sino la forma del camino»**, because `en/22`'s
  bridge already says "The problem isn't the weights, it's the path"; it opens on "a diagnosis and a
  direction" instead. The title is "LSTM: gated memory"; `en/22`'s bridge label ("the LSTM and its
  gates") still names the topic and was left as it is.
- **Code names:** `paso_lstm` → `lstm_step`, `paso` → `step`, `entra` → `pre` (the pre-activation of
  piece `k`), `sigmoide` → `sigmoid`, `pesos` → `weights`, `sesgo_olvido` → `forget_bias`, `sesgo` →
  `bias`, `olvidos` → `forgets`, `empujon` → `nudge`, `c_nuevo`/`h_nuevo` → `c_new`/`h_new`, `salida`
  → `out`, `sesgos` → `biases`. 3.6's cell and challenge use `entra`, `sigmoide`, `pesos` and `paso`
  the same way, so they become `pre`, `sigmoid`, `weights` and `step` (`gru_step` for the challenge).
- **Printed in Pyodide and quoted**, byte-identical in both locales: about $20\%$ (19.0 / 20.4 /
  22.4 %) and $78\%$ (77.1 / 77.8 / 79.5 %) of $\mathbf{c}_1$ surviving at $\mathbf{b}_f = 1$ and $3$,
  with the same first row of $\mathbf{c}_t$; the probe's `1.13e-03`, `0.00e+00`, `1.43e-01` and
  `7.64e-01`, with $f_t$ at `0.500` / `0.953` / `0.993`. The challenge's "use `c` in the last line"
  variant fails test 4 only, as its explanation says. The widget reads 0 % at $\mathbf{b}_f = -2$ and
  91–92 % at $4$, which the caption's two claims need.
- **Spanish errors fixed in `es/23`** (their own commit, `ef39bff`): «el producto cae a $10^{-11}$»
  quoted a number the cell does not print. Pyodide prints `0.00e+00` for $\mathbf{b}_f = 0$; CPython's
  `1.39e-11` is one ulp of $c_{40}$ over `eps`, not the product, which is $1.4 \times 10^{-12}$. Both
  locales now give $0.5^{39} \approx 2 \times 10^{-12}$ as arithmetic and say the line prints zero.
  Also «un 20 % escaso» (two of the three values are above 20 %), seven words bold for emphasis
  (**no**, **alcanzable**, **antes**, **sin**, **cada**, **calcula**, **peor**), and a raya pair in
  the `lstm-gates` widget's `summary` string, in both `messages` files.
- **What a finite-difference probe cannot show:** a quantity below its resolution prints zero in
  Pyodide and ulp noise in CPython. No later lesson in this block probes a distance, but any tiny
  number a lesson quotes is checked against the quantity it claims to be, not only against a print.

**From 3.7** (`en/25-proyecto-char-lm.mdx`):

- **The corpus is `public/courses/dl-nlp/corpus-mar.en.txt`**, a faithful translation of the seaside-village
  paragraphs, written without apostrophes or hyphens so the regex `[^a-z .,]` splits no word. It
  prints **2,796 characters** and **|V| = 26** (23 letters, since no `j`, `x` or `z` appears, plus
  space, comma and full stop), not the ≈ 29 the inventory guessed. The prose notes that 26 is the
  alphabet's count but not its set.
- **Printed in Pyodide and quoted:** starting loss `3.258` ($\ln 26$, quoted $3.26$), final `2.474`
  ("around 2.5", prose and summary), the pair `'the village '` / `'he village s'`, the last training
  sample's real short words `of`, `the`, `age`, and the greedy loop on `she`. Training cell 2.9 s.
- **`q` / `u` became `t` / `h`:** the English corpus has a single `q`, so the network cannot learn the
  digraph from it; `t` is followed by `h` in 130 of 232 cases.
- **Code names:** `texto` → `text`, `datos` → `data`, `a_ix` → `to_ix`, `adelante` / `atras` →
  `forward` / `backward`, `genera` / `genera_voraz` → `generate` / `generate_greedy`, `suave` →
  `smooth`, `dh_sig` → `dh_next`, `h_ant` → `h_prev`, `salida` → `out` (3.5's).
- **The pickup drops the Spanish opening's "machinery built, nothing running" and "it will come out
  bad, the first time something writes"**, both already in `en/24`'s bridge.
- **A runtime-fetched data file gets an `.en` sibling** (now in `AUTHORING.en.md` §7).
- **Spanish nit, not fixed:** `es/25` says the loss settles «hasta rondar 2.5», but Pyodide prints
  `2.593` there.

**From 3.8** (`en/26-seq2seq.mdx`):

- **The reversal pair is <W>live</W> → <W>evil</W>**, and the letters named are <W>e</W> (the
  output's first) and <W>l</W> (its last). Chosen over <W>stressed</W>/<W>desserts</W> because no
  letter repeats, so "the output's first letter is the input's last" has one reading. Now a rule in
  `AUTHORING.en.md` §3.
- **`encoder-decoder.en.svg`** carries `d_h numbers` (measured: x 137.7–192.4 in the 360 `viewBox`),
  with its `aria-label` and comments translated. Both SVGs now draw the encoder states with the bar
  ($\bar{h}$) the notation requires; they were plain `h` while the Spanish `alt` claimed a bar.
- **`<GO>` is `<W>\<GO></W>` in prose**, glossed once as "the symbol the decoder starts from"; code
  keeps `GO = 6`. The Spanish now does the same («el símbolo de arranque»), and `dl-nlp/AUTHORING.md`'s
  `<GO>` paragraph says so.
- **The opening drops translation from its examples** (headline, typos, a date in words to digits),
  because `en/25`'s bridge already names a Spanish/English sentence pair.
- **The loss echo is $\ln 26$, not $\ln 32$**: the English previous lesson's corpus has 26 characters.
- **Code names:** `paso` → `train_step` (`step` is the recurrence step), `pesos` → `weights`, `suave`
  → `smooth`, `escribe` → `write`, `ent` → `dec_in`, `n_sim` → `n_sym`, `ej`/`ac` →
  `rng_ex`/`rng_acc`, `bien`/`tot` → `right`/`total`, `s_ant`/`h_ant` → `s_prev`/`h_prev`.
- **Printed in Pyodide and quoted**, identical to the Spanish cell: loss `1.805` → `0.753`; accuracy
  95 / 87 / 76 / 66 / 59 / 55 % for lengths 3–8; the 3- and 4-letter examples exact, the 8- and
  12-letter ones right at the start and wrong at the end.
- **Spanish errors fixed in `es/26`** (same commit): `q-dos-redes` (c) gave Block 2's MLP classifier a
  «último estado» (now «el clasificador recurrente de este bloque»); BPTT was no longer expanded on
  first use and the bridge said «el backpropagation»; the «allí» at line 186 had lost its referent;
  GO was bare in prose; **sólo** and **sin término de salida** were bold for emphasis; and the `alt`
  had dropped four accents.

## Two things to watch

**3.5's gate quiz leans on Spanish agreement.** One item asks what the gates do while a coordinate
holds "the subject was plural" across a relative clause. English marks plurality far more weakly
than Spanish does, so the example is thinner in English — but it is not broken, and a
long-range-dependency example that *is* strong in English (subject–verb agreement across an
intervening clause, or a pronoun antecedent) substitutes cleanly. Class it during triage by
reading the item, not by assuming.

*Resolved by P11-00:* the item was read, and its answer is a gate configuration — $f\to1$,
$i\to0$, $o\to0$ — which no language marks. **Not a rewrite.** The cost this section was looking
for is one line lower down: the prose sentence quotes its own **twelve-position distance three
times** (23-lstm.mdx:194, 197, 257), and the English sentence's distance has to be counted and
those three mentions moved together.

**3.7's samples are the lesson.** A character-level model trained on a Spanish corpus prints
Spanish-looking gibberish, and the prose comments on what the model has learned from it —
accents, `qu`, word endings. Retrain on an English corpus and every quoted sample changes. This
is the one lesson in the block where the outputs must be regenerated rather than re-run.

*Added by P11-00:* the corpus is a **file outside the lesson tree** —
`public/courses/dl-nlp/corpus-mar.txt`, fetched at runtime by `open_url` — so the English lesson
ships a new asset, and `|V|`, `ln |V|`, the character count and the final loss all move with it.

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

## Out of scope

- Editing the Spanish lesson. If translation exposes a Spanish error, that is a separate PR.
- Changing block/order or any id.
- Widget strings and corpora — P11-02 owns those.

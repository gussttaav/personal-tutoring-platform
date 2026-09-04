# P11-06 — Block 3: Recurrent Neural Networks

**Tag:** `COURSE-P11-06` · **Size:** L · **Status:** not started

## TL;DR

Eight lessons. The most transposable block in the course: sequences, memory and the vanishing
gradient are argued in mathematics, and the widgets are numeric rather than linguistic. The
project at 3.7 is the exception — a character-level language model trains on a corpus.

## Classification

Filled by [P11-00](00-triage.md) — read against the eight `es/` lessons selected by their
`block: 3` frontmatter, in `order`. Note the two files whose name and frontmatter disagree:
**`es/26-seq2seq.mdx` is 3.8**, and `es/33-adios-recurrencia.mdx` is Block 5, not this block.

**No lesson in Block 3 is a rewrite.** Not one of the 34 quiz items has an answer that moves in
English — the block argues in mathematics, and the four items that look linguistic (3.1's `no`
marker, 3.5's plural agreement, 3.7's character count, 3.8's reversal) all keep their answer.
What the block does carry is five corpora and examples that have to be *chosen* rather than
translated, and one of them is a file outside the lesson tree.

| # | Slug | Class | Spanish-dependent artifacts |
|---|---|---|---|
| 3.1 | `por-que-falla-el-mlp` | **adapt** | The 8-word `V` in the cell; the 4-token / 2-token phrase pair whose counts the prose quotes; the word-order pair; `no` ×10 as the marker word — **also baked into `concatenacion-bloques.svg`**. Recap quotes Block 2's `88.3 %` and `5 329` |
| 3.2 | `la-rnn-vanilla` | **adapt** | The same 8-word `V`, read through `V.index(palabra)` — the printed states move unless the English list is index-for-index; two of them are quoted **inside a quiz explanation**. `guion` ×5 |
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

- **Quiz (4, no answer moves).** `q-parametros` `numeric` 12352 (12–18). `q-compartir` `single` a
  (19–28), `<W>guion</W>` in prompt and option (a). `q-recurrencia` `multi` [a,b] (29–38) — **its
  explanation quotes `(0.117, 0.087, 0.171)` and `(-0.141, 0.701, -0.632)`**, printed by the second
  cell, so the item is downstream of the vocabulary choice. `q-memoria` `predict-output`
  `'True False'` (39–59) — the code is `np.eye(2)` vectors and the explanation's `ab`/`bb`/`ba` are
  letters; language-free.
- **`<PyCell>` ×2** (320–355, 372–408). `V` = 8 Spanish words (323, 375), read through
  `V.index(palabra)` — **the printed states are a function of each word's slot**, so the English
  list must keep one distinct entry per slot (`la` and `el` both becoming `the` would collapse two
  and move every number). Identifiers `paso`, `lee`, `frase`, `palabra`, `estados`, `corta`,
  `larga`, `estado_final`, `bolsa`, `concat`, `recurr`; Spanish prints (339, 350–354, 399–407).
- **Printed output quoted in prose:** `(0.509, 0.947, 0.072)` / `(0.481, 0.935, 0.024)` (363), the
  two final states (411–412), `29 312` / `3 810 688` (419–420, arithmetic, stable).
- **`<CodeChallenge>` `ch-rnn-forward`** (61–154): 2 `# tu código aquí` (78, 83), 5 test `name`s,
  8 Spanish assertion messages (93–131), Spanish `prompt` (62–71), `solution` (`paso`, `estados`)
  and `explanation` (147–154). Tests are numeric; nothing moves.
- **`<Explorable>` `rnn-unrolled`** (184–189), `direction="forward"`: Spanish caption. Widget has
  **no corpus** — `RnnUnrolled.tsx` is symbolic, with Spanish only in its `aria-label` (185) and
  step readout (465). P11-02.
- **`<Leccion ancla="">`: 0** (2 refs). **`reading`:** 1 (156–163), `lang: en`, Spanish note.
- **`<W>`: 9** — `guion` ×4, `el guion`, `ab` ×2, `bb`, `ba`.

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

- **Quiz (5, all language-free).** `q-que-lo-desvanece` `single` a (12–22);
  `q-clipping-que-arregla` `single` a (23–32); `q-decae-numerico` `predict-output`
  `1.0 / 0.0625 / 0.0039` (33–46), pure arithmetic; `q-mascara-tanh` `single` a (47–55);
  `q-que-cuesta` `single` a (56–65).
- **`<PyCell>` ×2** (203–210, 229–247): the first is Spanish comments and a print header; the
  second has `recorta`, `nombre`, `coseno` and the labels `"normal   "` / `"explotado"` /
  `"(coseno con g: %.4f)"` (238–246). Quoted output — norm ≈ 30 clipped to `5.00`, cosine `1`
  (249–250) — holds.
- **`<Explorable>` `vanishing-gradient`** (116–119): Spanish caption. **Confirmed numeric, no
  corpus** — `VanishingGradient.tsx` carries slider labels only, and `Radio espectral` is already
  in P11-02 §3's terminology list.
- **`<Leccion ancla="">`: 0** (5 refs). **`reading`:** 2 (68–83), both `lang: en`, Spanish notes.
- **`<W>`: 2** — `Dudo que a alguien le sirva` and `Dudo` (97–98). Translates directly; the
  "treinta palabras más tarde" is a round figure, not a computed count.

#### 3.5 `lstm` — `es/23-lstm.mdx` — adapt

- **Quiz (5, no answer moves).** `q-por-que-sobrevive` `single` a (12–22). **`q-que-compuerta`
  `single` a (23–32) — the item the block flagged.** Its prompt holds "el sujeto era plural"
  across a relative clause, but the answer is a gate configuration ($f\to1$, $i\to0$, $o\to0$) and
  owes nothing to how strongly a language marks plurality. English present-tense agreement
  (`the cameras … don't work`) carries the prompt; distractor (b) inverts the forget gate and (c)
  fails on the output gate, both language-free. `q-parametros` `numeric` 49408 (33–39);
  `q-producto` `predict-output` `0.0 / 0.669` (40–51); `q-que-no-arregla` `multi` [a,b] (52–62).
- **The example, and the one recount in the block.**
  `Las cámaras que el ayuntamiento instaló el año pasado en la plaza no funcionan` (192–194), with
  **"doce posiciones" quoted at 194, 197 and 257**. Count the English sentence's own distance and
  move all three together; the same sentence supplies the cheap-token contrast `que` / `del` (246).
- **`<PyCell>` ×2** (370–409, 425–459): numeric only. Identifiers `pesos`, `paso`, `entra`,
  `sigmoide`, `sesgo_olvido`, `olvidos`, `empujon`; Spanish prints (401–408, 454–458). Quoted
  output — `20 %` / `78 %` (413–414), `1.1 × 10^{-3}`, `10^{-11}`, `14 %`, `76 %` (461–468) — holds.
- **`<CodeChallenge>` `ch-lstm-paso`** (64–154): 1 starter comment (80), 5 test `name`s, 6 Spanish
  assertion messages (91–130), Spanish `prompt`, `solution` (`paso_lstm`, `entra`, `sigmoide`,
  `c_nuevo`) and `explanation`.
- **`<Explorable>` `lstm-gates`** (296–299): Spanish caption. **No corpus** — `LstmGates.tsx:221–227`
  carries the three row hints `qué conserva` / `qué escribe` / `qué deja ver` plus the `b_f` slider
  label, and nothing else. P11-02. (The caption's "la misma frase" describes a sequence the widget
  renders as vectors, not words; the English caption should not promise more than it shows.)
- **`<Figure>` `lstm-celda.svg`** (303–307): Spanish `alt` and `caption`, but **the SVG is symbols
  only** (`f`, `i`, `c̃`, `o`, `tanh`) — the asset is reused unchanged.
- **`<Leccion ancla="">`: 0** (9 refs). **`reading`:** 3 (156–179), all `lang: en`, Spanish notes.
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
- **`<Figure>` `encoder-decoder.svg`** (94–98): Spanish `alt` and `caption`, but **the SVG's own
  labels are already English or symbolic** (`encoder`, `decoder`, `c`, `GO`) — the asset is reused
  unchanged.
- **`<Leccion ancla="">`: 0** (12 refs). **`reading`:** 2 (54–69), both `lang: en`, Spanish notes.
- **`<W>`: 7** — `roma` ×3, `amor` ×2, `a`, `r`.

### Block totals

| | Count | Notes |
|---|---|---|
| **Lessons** | 8 | `es/19` … `es/26`, selected by `block: 3` |
| **Transpose** | **3** | 3.3, 3.4, 3.6 |
| **Adapt** | **5** | 3.1, 3.2, 3.5, 3.7, 3.8 |
| **Rewrite** | **0** | no quiz answer in the block moves |
| Quiz items | 34 | 16 `single`, 7 `multi`, 6 `numeric`, 4 `predict-output`, 1 `boolean` — **0 answers move** |
| `<PyCell>` | 14 | all re-run; only 3.7's 3 are **regenerated** |
| `<CodeChallenge>` | 4 | 3.2, 3.3, 3.5, 3.6 — 32 Spanish assertion messages, 19 test `name`s, 5 `# tu código aquí` |
| `<Explorable>` | 5 uses / 3 ids | `rnn-unrolled` ×2, `lstm-gates` ×2, `vanishing-gradient` ×1 — **none carries a corpus**; captions here, widget strings in P11-02 |
| `<Figure>` | 3 | only `concatenacion-bloques.svg` (3.1) has Spanish set into the asset |
| `<Leccion ancla="">` | **0** | 90 slug-only refs, so no anchor is re-derived anywhere in this block |
| `reading` | 14 | **all `lang: en`** — no Spanish-language source in the block; 14 Spanish `note`s to translate |
| `<W>` | 55 | over 6 lessons; 3.3 and 3.6 have none. 3.1 (14), 3.7 (12), 3.5 (11) hold most |

**Sizing read.** Three lessons are prose-only work. Four adapts cost one example or one word list
each, with the numbers they feed. 3.7 is the block: a new corpus asset, a retrain, and every
quoted figure and sample regenerated — treat it as its own PR-sized job, not as one of eight.

**Cross-block dependency.** 3.1's recap quotes `88.3 %` and `5 329` from `es/18-proyecto-sentimiento.mdx`,
which P11-05 classes **adapt**. P11-05 lands before this task, so 3.1 quotes whatever the English
Block 2 prints — check it rather than transcribing these.

## Lesson progress

- [ ] 3.1 `por-que-falla-el-mlp`
- [ ] 3.2 `la-rnn-vanilla`
- [ ] 3.3 `bptt`
- [ ] 3.4 `gradiente-desvanecido`
- [ ] 3.5 `lstm`
- [ ] 3.6 `gru`
- [ ] 3.7 `proyecto-char-lm`
- [ ] 3.8 `seq2seq`

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

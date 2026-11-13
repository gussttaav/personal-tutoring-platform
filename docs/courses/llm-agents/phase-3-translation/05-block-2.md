# P3-05 — Block 2: From Predicting Text to Following Instructions

**Tag:** `COURSE-C2-P3-05` · **Size:** L · **Status:** not started
**Depends on:** P3-04 (Block 1, and the `modelo.en.py` it freezes)
**Course:** `llm-agents` → `content/courses/llm-agents/en/` · **Runs on:** the English mini-GPT
through `modelo.en.py`, in the browser; Colab for 2·8

## TL;DR

Eight lessons, mathematically the densest of the course (Bradley–Terry, the KL-regularised
objective, DPO's full derivation). The derivations transpose. What does not is that six lessons
run the mini-GPT and quote what it does with an instruction, before and after SFT, under a reward,
under DPO. The project, 2·8, fine-tunes Qwen2.5-0.5B in Colab on **Spanish** OpenAssistant pairs,
and that notebook gets an English twin (**D2**, decided).

## Classification

Filled by [P3-00](00-triage.md) on 2026-11-13, read against the eight `es/` lessons. `es/10` …
`es/17` are 2·1 … 2·8. Line refs below are into those files.

**One rewrite the planning pass did not see: 2·3.** Its evidence that the fine-tuned model reads the
question is Spanish article agreement. The rest of the block is as planned. The derivations
transpose, and every lesson with a cell quotes what the mini-GPT did.

| # | Slug | Class | Re-run | What binds it to Spanish |
|---|---|---|---|---|
| 2·1 | `predecir-no-es-obedecer` | adapt | P | The base model asked «¿De qué color es la tierra?», and the novel's `?` sorted into five follow-ups, one of them «inciso del narrador» **by the raya** (`MANERAS`, 277–278). English dialogue punctuation needs its own five. All four quiz items hold |
| 2·2 | `plantilla-de-chat` | adapt | P | The specials are named in Spanish (`<\|sistema\|>` … `<\|fin\|>`, same ids in English); the first cell's 41 / 12 tokens; the second cell's probabilities and the novel-writing greedy answer. All four quiz items hold |
| 2·3 | `sft` | **rewrite** (was adapt) | P | The ten «¿De qué color es …?» pairs are P3-02's. The lesson shows the model **reads the question** by its article agreeing with the question's noun (443–448), and `q-el-vino` turns on that. English has no agreement. See below |
| 2·4 | `modelo-de-recompensa` | adapt | P | The colour annotator's 216 answers (`frase` builds them with Spanish gender agreement, 380); the accuracies (99 % / 85 % / 52 %) in a quiz prompt and the prose |
| 2·5 | `rlhf` | adapt | P | The «La Nela» prompt, a reward that counts the letter `a`, the hacked « a a a …», and `q-merece-la-pena`'s 16 / 73.3 / 3.47 (answer **0.171**) |
| 2·6 | `dpo` | adapt | P | Same task as 2·5; `q-preferidas-menos-probables` quotes the second cell (16 answers, 70 %, −0.4). The derivation transposes |
| 2·7 | `de-donde-salen-las-preferencias` | transpose | — | No cells; the Great Wall example is free prose (it sets up 2·8's fifth instruction). One sentence on 2·8's notebook being Spanish follows D2 |
| 2·8 | `proyecto-sft-colab` | adapt | C | The notebook (D2): pair counts, token counts, before/after numbers, forgetting measured on «el final de *Marianela*». **An anchored reference into 2·3**, whose anchor is a Spanish heading |

**Block totals:** 1 transpose · 6 adapt · 1 rewrite · re-runs P ×6, C ×1, — ×1.

### What changed from the planning pass

- **2·3 — adapt → rewrite.** P3-02 already noted that property 4 changes shape in English. That
  reaches the lesson as well as the assert. After the twelve steps the Spanish lesson argues:
  «En las cuatro preguntas de colores, el artículo de la respuesta es el de la pregunta: <W>la
  tierra</W> recibe <W>La leche es blanca.</W>, y <W>el vino</W>, <W>El cielo es azul.</W>. Ninguna
  fila cobrada apuesta por un token de la pregunta, y aun así la respuesta depende de ella» (443–448).
  That is the lesson's only evidence that the gradient reached what the answer rows read. In English
  ` The` is right for every pair, so the argument only works in Spanish. `q-el-vino` (30–40) is built
  on it: option (a) names «el artículo de la pregunta», and (c), «el modelo no lee la pregunta», is
  refuted by the cell.
- **2·1 — the row understated the cell.** It is two measurements, not one sample. The second sorts
  what follows the novel's 433 `?`, with a Spanish-punctuation rule: `—` counts as «inciso del
  narrador». English needs its own five ways. The frame «Pregunta: … Respuesta:» also has a
  property: «Respuesta:» never occurs in the novel (314), so the English answer word must never occur
  in the English corpus.
- **2·2 — confirmed, and its counts also have to agree with the English widget.** The widget's
  English conversation is "What colour is the sky?". The cell's English conversation must be the same
  one, so that the 41 / 12 the Spanish prose quotes become the English cell's and the widget's
  number, one number.
- **2·4 — confirmed; one code simplification.** `frase(cosa, color)` (380) agrees article and
  adjective with the noun («La nieve es blanca.», «El plátano es amarillo.»). The English one has no
  agreement to build, so the counts stay the same and the function gets shorter.
- **2·5 / 2·6 — one hazard.** The reward counts the letter `a`. In English, ` a` is a whole word
  (the article), so the hacked answer may still be ` a` × 16. But «aba repetido daría el doble»
  (2·5 374–375) assumes a merge the English list may not have. Re-measure before keeping the letter.
- **2·8 — confirmed, with an anchored cross-lesson reference** (108): `<Leccion slug="sft"
  ancla="lo-que-la-pérdida-no-dice">`. The anchor is the slug of 2·3's Spanish heading (315).
  The English 2·8 must use the anchor of 2·3's **English** heading. 2·3 lands first, so the anchor is
  known by then. This is the only `ancla` in the course.

### Cross-course references (`curso="dl-nlp"`)

| Lesson | Refs | Not yet in `dl-nlp/en/` |
|---|---|---|
| 2·1 | 1 | `bert-y-gpt` (140) |
| 2·2 | 1 | — (`encoder-decoder`) |
| 2·3 | 2 | — |
| 2·4 | 2 | — |

2·5–2·8: none.

### Frozen-module identifiers the prose names (for P3-03)

`modelo(prompt) -> texto` (2·1 93), `modelo` (2·2 264), `perdida` and `peso` (2·3), `Adam` (2·8
136). The chat specials `<|sistema|>`, `<|usuario|>`, `<|asistente|>`, `<|fin|>` are not module
identifiers, but every cell from 2·2 on redefines them under those names, so they belong in the map.
Cell-local helpers named in prose (`plantilla`, `responder`, `avanzar_lote`, `reinforce`,
`log_cociente`) are each lesson's own.

### Artifact inventory

#### 2·1 `predecir-no-es-obedecer` — `es/10-predecir-no-es-obedecer.mdx` — adapt, P

- **Quiz (4), all hold.** `q-mas-grande` b (12–22). `q-dos-factores` `numeric` **0.205** (23–29,
  arithmetic). `q-el-marco` a (30–40), with `<W>Pregunta: … Respuesta:</W>`. `q-que-la-mueve` [b,c]
  (41–51).
- **Prose examples**: GPT-3's moon-landing request (99–103, published); the invented instruction and
  its four continuations (109–117, `<W>`), which are free prose.
- **`<PyCell>` 267–303** (`modelo.py`, corpus): three seeds on «¿De qué color es la tierra?», the
  same question as P3-02's held-out SFT pair; `MANERAS` (277–278). Quoted 304–317: the samples, with
  «—dijo María» and the raya; 433 `?`; new paragraph 39.5 %; within 3.2 points; more ellipses after
  the new question; «Respuesta:» 0 times; greedy «—No ves acarde todas las minas».
- **`<W>`: 15.** **`reading`**: 4, `lang: en`.

#### 2·2 `plantilla-de-chat` — `es/11-plantilla-de-chat.mdx` — adapt, P

- **Quiz (4), all hold.** `q-marca-de-texto` a (12–22): translate «Asistente: Claro, aquí la
  tienes.». `q-sin-fin` a (23–33). `q-cuantos-cuentan` `numeric` **19** (34–40, arithmetic).
  `q-formato-o-entrenamiento` [a,c] (41–51, $1/516$).
- **`<CodeChallenge>` `ch-mascara`** (53–125): `bpe.py`, merges, 5 tests, `mascara(ids)`; its tests
  name the specials.
- **`<Explorable>` `chat-template`** (184): English corpus exists. The caption names the widget's
  button «Escribir la marca del asistente», which has to match the button's English label.
- **Specials in prose**: 178–182, 206, 321; text-mark fence 231–234 («Asistente: Verde.»).
- **`<PyCell>` 337–380** (`bpe.py`, merges): quoted 382–383 (41 tokens, 12 with loss, «El cielo es
  azul.» in 11 tokens; typed `<|asistente|>` = eight ordinary tokens).
- **`<PyCell>` 388–413** (`minigpt.py`, checkpoint, corpus): quoted 415–421 ($6.3 \times 10^{-7}$;
  27 positions; $2.4 \times 10^{-5}$; 69.7 nats in 11 tokens, 6.3 per token; 14.3 for `<|fin|>`;
  $3.1 \times 10^{-4}$; greedy «—No, señor, señor», no `<|fin|>` in 24 tokens).
- **`<W>`: 23.** **`reading`**: 4, `lang: en`.

#### 2·3 `sft` — `es/12-sft.mdx` — rewrite, P

- **Replacement:** *show the dependence on the question with a token the English answers actually
  take from it (P3-02's re-stated property 4, the held-out answer's leading-token match), and rebuild
  `q-el-vino`'s options on that. If no English answer token depends on the question, (c) stops being
  false: stop and decide, since it is a design question.*
- **Quiz (4).** `q-optimo-del-conjunto` `numeric` **0.2** (12–18, «¿Cuánto es 7 por 8?», arithmetic),
  holds. `q-donde-hay-gradiente` [a,c,d] (19–29), holds. `q-el-vino` a (30–40): **options rebuilt**
  (see above). `q-la-novela` a (41–51): 6.69 vs 2.96 nats, 0.4 % → re-measured.
- **`<CodeChallenge>` `ch-perdida-sft`** (53–147): `bpe.py`, merges, `minigpt.py`, checkpoint;
  4 tests; `perdida_sft(Z, ids, mascara)`.
- **The pairs**: 201 («¿De qué color es la nieve?» → «La nieve es blanca.»), = P3-02's `SFT_PARES`,
  character for character.
- **`<PyCell>` 342–388** (`modelo.py`): quoted 390–394 (277 positions of $10 \times 30$, 116 charged,
  5.25 nats vs 6.25; before, the model writes novel).
- **`<PyCell>` 403–413** (12 steps): 415 (5.25 → 0.33).
- **`<PyCell>` 421–441** (six questions, the novel's loss, weights moved, 2·1's frame): quoted 443–457
  (the six answers; the article agreement; «La Nela … es La nieve es blanca.»; 6.69 vs 2.96; 131 833
  of 136 704 weights; the frame now answers).
- **Anchor target**: the heading «Lo que la pérdida no dice» (315), linked from 2·8.
- **`<W>`: 13.** **`reading`**: 4, `lang: en`.

#### 2·4 `modelo-de-recompensa` — `es/13-modelo-de-recompensa.mdx` — adapt, P

- **Quiz (5).** `q-dos-escalas` a (12–22; «Lucía», «Andrés» are free names), `q-encadenar` `numeric`
  **0.9** (23–29), `q-que-no-cambia` [a,b] (30–40), `q-cuanto-empuja` a (41–51): hold.
  `q-preguntas-nuevas` a (52–62): «99 %» and «52 %» → re-measured. Its answer holds if the English
  run also generalises to new rivals and not to new questions.
- **`<CodeChallenge>` `ch-recompensas`** (64–143): no assets, 6 tests, language-free.
- **`<Explorable>` `bradley-terry`** (220): numeric.
- **`<PyCell>` 360–406** (`modelo.py`; `frase`; 36 questions × 6 answers): 408–410 (216 × 64; 72 /
  48 / 60 comparisons).
- **`<PyCell>` 415–444** (300 steps on $\phi$): quoted 446–463 (0.693 → 0.161; 71 of 72; 85 %; «La
  nieve es blanca.» vs «La nieve es amarilla.»; 52 %; «¿De qué color es el plátano?» lowest; 18.1 vs
  14.2).
- 232: the $y_w$ / $y_l$ subscripts glossed «en inglés, *win* y *lose*». Redundant in English.
- **`<W>`: 4.** **`reading`**: 5, `lang: en`.

#### 2·5 `rlhf` — `es/14-rlhf.mdx` — adapt, P

- **Quiz (5).** `q-por-que-no-derivar` a, `q-linea-base` [a,b,d], `q-sft-con-pesos` a: hold.
  `q-kl-de-una-respuesta` `numeric` **13.8155** (34–40): arithmetic; its explanation cites the second
  cell's ~$10^{-32}$. `q-merece-la-pena` `numeric` **0.171** (52–58): re-measured.
- **`<PyCell>` 302–348** (`modelo.py`): 350 (3.47 a's per 16 tokens, KL 0).
- **`<PyCell>` 355–370** (β = 0): quoted 372–381 (9.12 / 18.91 at step 10, 16 / 73.32 at 15, « a a a
  …», «aba», $e^{-73.3}$).
- **`<PyCell>` 385–388** (β = 0.5): quoted 390–397 (7.44, 5.48; «a la triste bajar a Florentina, a»;
  −20.7; 4.70).
- **`<W>`: 10.** **`reading`**: 5, `lang: en`.

#### 2·6 `dpo` — `es/15-dpo.mdx` — adapt, P

- **Quiz (5).** `q-por-que-no-la-formula` a, `q-por-que-se-cancela` [a,b,d], `q-factor` `numeric`
  **0.378** (arithmetic), `q-donde-esta-el-freno` a: hold. `q-preferidas-menos-probables` a (52–62):
  «16 respuestas con cuatro letras a … 70 % … −0.4» → re-measured. Its answer holds if the English run
  again has a winning group with a negative implicit reward.
- **`<CodeChallenge>` `ch-perdida-dpo`** (64–156): no assets, 6 tests, language-free.
- **`<Explorable>` `dpo-loss`** (421): numeric.
- **`<PyCell>` 446–492** (`modelo.py`; 64 reference answers, 2 016 comparisons): 494–495 (3.28; 69 % /
  13 % / 18 %).
- **`<PyCell>` 506–543** (`dpo` at β = 0.5 and 0.1): quoted 545–566 (0.693 → 0.433; 0.03 / 0.74; −3.4
  … 1.9 and −6.1 … −0.7; 5.75 a's at 3.01 nats; 12.12 at 32.94, «a la De a la a la día a la a mano
  la»; 2·5's 7.44 / 5.48).
- 212: the DPO paper's subtitle, quoted in Spanish → the original English.
- **`<W>`: 6.** **`reading`**: 5, `lang: en`.

#### 2·7 `de-donde-salen-las-preferencias` — `es/16-de-donde-salen-las-preferencias.mdx` — transpose, —

- **Quiz (4), all language-free.** `q-la-constitucion` a, `q-juez-en-dos-ordenes` `numeric` **0.845**
  (arithmetic), `q-alineado-con-quien` [a,b], `q-un-numero` a.
- **Example** 108–124: the Great Wall false premise, the principle, critique and revision (`<W>`).
  Translate it so it agrees with the English notebook's fifth instruction.
- Published figures hold (InstructGPT's ~40 labellers; GPT-4 judge 85 % / 81 %; 65 % / 30 %;
  DeepSeek-R1). 211–213 is arithmetic.
- 277: «con instrucciones en español» → English, per D2.
- **`<W>`: 9.** **`reading`**: 5, `lang: en`.

#### 2·8 `proyecto-sft-colab` — `es/17-proyecto-sft-colab.mdx` — adapt, C

- **Quiz (3).** `q-por-que-colab` [a,b] (12–22): holds (memory arithmetic). `q-que-se-cobra` [c,d]
  (23–34): «los siete de *La nieve es blanca.*» → the English pair's Qwen tokens, same question.
  `q-cota` a (35–45): Qwen's 291 tied rows, holds.
- **`<ColabLink>`** (232): `ai-notebooks@ce958eab…/ajuste-supervisado-qwen.ipynb` → the English
  notebook's own commit.
- **Holds**: the model's arithmetic (494 032 768, 136 134 656, 7.9 GB, 0.31 GB, 4.3 GB, 3.95, 3 621×,
  3.6 s per token), the 292 tied rows (0.3009–0.3010), OpenAssistant's 13 500 volunteers and 35
  languages, $\eta_{\max} = 2 \times 10^{-5}$.
- **Moves with the data**: table 100–101 (125 789 from P3-02; 3 249 pairs); 111 «el español entre
  ellos»; the 788 511 tokens and everything derived from them (157–173: $2.8 \times 10^{6}$ s,
  $C \approx 2.3 \times 10^{15}$, «cinco minutos») unless the English set is capped (D2); 186–193 the
  pair's Qwen tokens; 245–251 («De cada conversación en español», 3 249 / 788 511 / 86 % / 169);
  254 (203 steps); 263–268 (1.75 nats, $5.1 \times 10^{-8}$, forgetting on «el final de
  *Marianela*», 3.24).
- 239: Qwen's template adds a default system message «en inglés que nadie ha escrito». The remark
  loses its contrast in English; reword.
- 241: the base model's five answers, from the notebook's run.
- **Anchored ref** 108 → 2·3 (see above).
- **`<W>`: 14**, most of them the notebook's generations. **`reading`**: 3, `lang: en`.

## Lesson progress

- [ ] 2·1 `predecir-no-es-obedecer`
- [ ] 2·2 `plantilla-de-chat`
- [ ] 2·3 `sft`
- [ ] 2·4 `modelo-de-recompensa`
- [ ] 2·5 `rlhf`
- [ ] 2·6 `dpo`
- [ ] 2·7 `de-donde-salen-las-preferencias`
- [ ] 2·8 `proyecto-sft-colab`

## D2 — the notebook: an English twin (decided 2026-11-13)

`dl-nlp` kept its notebooks Spanish, and for its 5.11 that is right: BETO is a Spanish model and
every number in the lesson is computed from it. This notebook is different. Qwen2.5-0.5B is
multilingual; the language is chosen by the **data**, and the lesson's point is what the model
answers before and after. An English reader shown a Spanish *tortilla* recipe as the evidence that
SFT works is reading a lesson about Spanish.

**Gustavo's decision (2026-11-13): an English notebook.** Same model and revision, same versions,
same recipe and hyper-parameters, OpenAssistant's English pairs (`lang == "en"`) with the same
selection rule (first user message of each conversation, the volunteers' top-ranked reply), and the
same five test instructions in English, the false-premise one included because 2·7 sets it up.
Decide in 2·8 whether to cap the English pairs at the Spanish count (3 249), so the lesson's cost
arithmetic (7.9 GB before the first activation, the minutes on a T4) and the comparison hold, or to
take the larger English set and re-derive; record the choice below. Commit it beside the Spanish
one in `ai-notebooks` (its own file, the Spanish notebook untouched), pin the commit in the English
`<ColabLink>`, and run it from a fresh Colab account (Phase 1's rule) before the lesson quotes it.
Pushing to `ai-notebooks` is a publication: ask first.

## Decisions fixed by a translated lesson

*Empty until the first lesson lands. 2·3 must reuse P3-02's SFT pairs and template verbatim;
record anything else a later lesson depends on (the reward's definition in 2·4, the prompt
`β` sweeps in 2·5–2·6).*

## Acceptance criteria

- [ ] Every lesson under `content/courses/llm-agents/en/`, `draft: false`; ids identical
- [ ] Every cell loads `modelo.en.py` and the English checkpoint; every quoted number re-run in the
      browser
- [ ] 2·2's prose quotes the counts the English widget and cell show, and they agree
- [ ] 2·3's pairs, template and held-out pair are P3-02's, character for character
- [ ] The English notebook is committed in `ai-notebooks`, runs from a fresh Colab account, and its
      outputs are what 2·8 quotes; the English `<ColabLink>` pins its commit
- [ ] Two-reader test against the English neighbours; `pnpm lint:content` clean; `pnpm build` green

## Test plan

- Per lesson: `lint:content`, cells in the browser (desktop and phone), numbers from Pyodide.
- 2·8: a full Colab run on a T4 from a fresh account, outputs saved in the notebook.
- Read every derivation (2·4–2·6) against the Spanish for a dropped step: the class is adapt
  because of the cells, but the risk in this block is a translated derivation that lost a line.

## Gotchas

- **The derivations carry `\text{…}` words.** `AUTHORING.en.md` §8 says roman Spanish inside maths
  becomes English (`\text{step}` against `\text{paso}`); this block has the course's most display
  maths. Check every `\text{…}`.
- **The chat specials keep their ids in both locales** (`corpora.ts`): only the names drawn change,
  `<|sistema|>` → `<|system|>`. A cell that prints token ids must print the same ids.
- **Colab runs are slow to repeat.** Freeze the notebook's outputs before writing the lesson, not
  after.

## Out of scope

- The Spanish notebook.
- Any change to the SFT recipe beyond the data's language.

# P3-06 — Block 3: Talking to the Model Is Programming

**Tag:** `COURSE-C2-P3-06` · **Size:** L · **Status:** not started
**Depends on:** P3-05
**Course:** `llm-agents` → `content/courses/llm-agents/en/` · **Runs on:** the English mini-GPT
(`modelo.en.py`) and, from 3·1, the scripted model (`guionizado.en.py`), in the browser

## TL;DR

Seven lessons and one rewrite (3·4, found by P3-00), but the block where *Marianela* is most visible: constrained decoding
writes a character's name as JSON, retrieval finds passages of the novel, the evaluation set asks
questions about it, and the project ties all three into one assistant. Every one of those becomes a
question about the English corpus. Every lesson re-runs. 3·1 also freezes the scripted model, which
Block 4 is built on.

## Classification

Filled by [P3-00](00-triage.md) on 2026-11-13, read against the seven `es/` lessons. `es/18` …
`es/24` are 3·1 … 3·7. Line refs below are into those files.

**One rewrite the planning pass did not see: 3·4.** Retrieval's asymmetry argument is built on the
Spanish opening `¿`. Two kinds of re-run share this block, and they cost very differently.
**P** runs the mini-GPT (3·2, 3·3, 3·4) or real retrieval over the corpus (3·7), and its numbers are
measurements. **P (scripted)** runs only the scripted model (3·1, 3·6), and its output is a function
of strings the author writes. Re-authored with the same right/wrong pattern, those lessons print the
same numbers, so the run checks the prose and measures nothing new.

| # | Slug | Class | Re-run | What binds it to Spanish |
|---|---|---|---|---|
| 3·1 | `el-prompt-es-una-especificacion` | adapt | P (scripted) | Writes `ModeloGuionizado` (frozen as `guionizado.py`), its error strings and the course-long signature `modelo(mensajes, herramientas) -> respuesta`. The date task's scripted answers. All four quiz items hold |
| 3·2 | `cadena-de-pensamiento` | adapt | P | The shell-game question («¿Dónde está la bola?»), whose **token count** is the cell's $T = 12$ (6 739 968 multiplications), and the 48-token chain the mini-GPT writes |
| 3·3 | `salida-estructurada` | adapt | P | `logit-mask` (`SPANISH_BOUND_CORPORA`); the five *Marianela* names in the grammar; 50 `<W>`. The argument also rests on a **corpus property**: no `{` and no straight quotes in the novel (173) |
| 3·4 | `recuperacion` | **rewrite** (was adapt) | P | The causal mean «oye el `¿` doce veces y el `?` una» (242–244); `q-el-signo` asks about the Spanish opening mark; the cell measures it. Plus the `edad`/`años` vocabulary gap and the «diez y seis años» passage |
| 3·5 | `ventana-de-contexto` | adapt | P | The cell counts a Spanish conversation's tokens with the BPE (313 for 256; «: no lo sé.» is what survives of the system prompt). `context-window`'s `asistente` preset has round sizes «puestos por mí», so only its labels move |
| 3·6 | `evaluar` | adapt | P (scripted) | The judge's twelve cases about *Marianela* and its system prompt; the date bank. Every number is arithmetic on the scripted verdicts. All four quiz items are language-free |
| 3·7 | `proyecto-asistente` | adapt | P | Retrieval over the English corpus is measured (7 of 12, the 3 / 1 / 1 failure split); the piano trace's misread dialogue tag; the out-of-corpus probe is **an English question** |

**Block totals:** 0 transpose · 6 adapt · 1 rewrite · re-runs P ×5, P (scripted) ×2.

### What changed from the planning pass

- **3·4 — adapt → rewrite.** The section «La media de un modelo causal oye más el principio que el
  final» states its measurement as a fact about Spanish: «En español eso tiene una consecuencia …
  porque una pregunta empieza por un signo: en una de doce tokens, la media oye el `¿` doce veces y el
  `?` una» (242–244). `q-el-signo` (19–29) asks why removing the `¿` changes the neighbours and
  removing the `?` does not. The second cell's last lines measure it (411–415: 20 of 288 passages are
  questions, 100 of 120 neighbours, 97 without `?`, 10 without `¿`). English questions have no opening
  mark, so the question changes.
- **3·3 — confirmed, with a corpus property the row did not name.** «En *Marianela* no hay ni una
  llave ni unas comillas rectas» (173) is why the model gives `{` $1.2 \times 10^{-7}$ and why the
  mask is shown working on «un modelo que nunca había visto una llave» (372). Project Gutenberg's
  English texts often set dialogue in straight `"`. If the English corpus does, the JSON's quotes are
  ordinary text to the model and two sentences change. **P3-02 should count `{` and `"` in the
  candidate corpora.** The `í` split after «Celip» (222) disappears with ASCII names.
- **3·6 — the vocabulary note was misplaced.** The row says 3·6 «names the benchmark vocabulary
  Block 5 reuses (`pedido`, 18 mentions)». 3·6 has no `pedido`. The word is Block 4's and 5's (from
  4·1 on; 5·8 holds the 18). What 3·6 does hand Block 5 is the **Wilson interval** and the paired
  comparison, which 5·8 measures with.
- **3·1 and 3·6 — cheaper than the row suggests.** Their cells load only the scripted model, and
  every number they print (33 of 40, [0.680, 0.913], κ 0.571 …) is arithmetic on answers and verdicts
  the author writes. Re-authoring the English cases with the same pattern of right and wrong answers
  (in 3·6, two judge errors in the same direction, the long confident wrong answer accepted)
  reproduces the numbers exactly.
- **3·7 — the out-of-corpus probe is in English.** 415–417: «La pregunta en inglés no trae ninguno:
  no comparte ni una palabra con la novela». In the English lesson the probe has to be in another
  language. Flip it, with the same clause-1 consequence.
- **3·5 — no English preset to build.** The `asistente` preset in `math/context-window.ts` holds
  segment kinds and round sizes and no text. Its labels («Turno 3», «Pasaje 2») come from
  `courses.widgets.context-window.kinds.*` and already render in English. The asset row below is
  struck. The prose that walks the preset (98–109) is translated, and nothing else changes.
- **3·2 — the row understated the cell.** It is a cost table as well as a quoted sample, and its $T$
  is the question's token count, so 6 739 968 (293–294) moves with the English question.

### Cross-course references (`curso="dl-nlp"`)

| Lesson | Refs | Not yet in `dl-nlp/en/` |
|---|---|---|
| 3·4 | 3 | `bert-y-gpt` (228) — and `bolsa-de-palabras` (196–197), `one-hot` (222), translated |

3·1–3·3, 3·5–3·7: none.

### Frozen-module identifiers the prose names (for P3-03)

- **`guionizado.py`** (frozen by 3·1): `ModeloGuionizado`, its attributes `guion` and `turno`, the
  `modelo(mensajes, herramientas) -> respuesta` signature with messages `(rol, contenido)` (3·1
  234–235, held «hasta el final»), and its two error strings («el guion se acabó en el turno %d»,
  «turno %d: el mensaje %d no es el del guion»).
- **`modelo.py`**: `modelo`, `max_tokens` (3·5 136), `decodificar` (3·3 243 repeats 1·4's argument
  from the name).
- **Lesson-level names later lessons reuse**: `encajar(T_ctx, reserva) -> mensajes` (3·5; 3·7
  269), `asistente(modelo, pregunta, k=3, tope=2) -> (respuesta, citado)` (3·7 261), the JSON keys
  `personaje` (3·3), `fecha` (3·1, 3·3), `respuesta` and `pasaje` (3·7 271–272), the abstention
  `no lo sé` (3·5, 3·7), `wilson` (3·6, 3·7; 5·8 measures with it), and **compaction**, first named
  in 3·5 106.

### Artifact inventory

#### 3·1 `el-prompt-es-una-especificacion` — `es/18-el-prompt-es-una-especificacion.mdx` — adapt, P (scripted)

- **Quiz (4), all hold.** `q-describir-o-mostrar` [a,b] (12–22), `q-el-techo` a (23–33, arithmetic),
  `q-cumplir-todas` `numeric` **0.367** (34–40, $0.995^{200}$), `q-que-demuestra` [a,c] (41–51).
- **The date task**: «Responde sólo con…» (152), `2026-11-07` (156), the no-date word `ninguna`
  (217). ISO dates and weekdays hold.
- **`<PyCell>` 241–265** writes `ModeloGuionizado`, asserted character for character against
  `guionizado.py` → `guionizado.en.py` must equal the English cell.
- **`<PyCell>` 280–320** (`prompt`, `cumple`, `ESCRITAS`, `EJEMPLOS`; scripted answers): quoted
  322–329 («La fecha es 2026-12-02.»; the Thursday that is the 22nd, not the 23rd).
- 273–274: published (a 13 B model, up to 76 points).
- **`<W>`: 9.** **`reading`**: 3, `lang: en`.

#### 3·2 `cadena-de-pensamiento` — `es/19-cadena-de-pensamiento.mdx` — adapt, P

- **Quiz (4).** `q-capas-en-serie` `numeric` **62** (12–18, a hypothetical $T = 12$, holds),
  `q-leer-o-escribir` [a,b] (19–29), `q-donde-va-la-respuesta` c (41–51, «AAAA-MM-DD» →
  "YYYY-MM-DD"): hold. `q-que-demuestra` [a,c] (30–40): «La celda corre sobre el mini-GPT»; check
  it against the English run.
- **Example**: the shell game, 109–111, 176, 242 (`<W>`). 117 «Piensa paso a paso antes de
  responder.» 219 already quotes Kojima's English «Let's think step by step».
- **Published, hold**: Wei et al. (540 B, GSM8K 17.9 → 56.9 %), Kojima et al. (17.7 → 78.7 %), the
  ~100 B threshold. 175 (9 bits, 17) is arithmetic.
- **`<PyCell>` 247–291** (`modelo.py`; `escrita` / `leida`): quoted 293–304 (6 739 968 at $R = 48$
  with $T = 12$; timings are the machine's; the 48-token chain, «de *Marianela*, sin rastro de
  ninguna bola»). 309: the «Fecha:» line.
- **`<W>`: 7.** **`reading`**: 5, `lang: en`.

#### 3·3 `salida-estructurada` — `es/20-salida-estructurada.mdx` — adapt, P

- **Quiz (4).** `q-condicionada` `numeric` **0.231** (12–18): hypothetical numbers on «Pablo» /
  «Nela»; the arithmetic holds and the names become the English corpus's. `q-lo-que-queda` b
  (19–29), `q-cuando-coinciden` [a,d] (30–40): hold. `q-que-demuestran` [a,b] (41–51): «Nela primera
  en la condicionada y última con la máscara» → re-measured; needs the widget's property.
- **`<CodeChallenge>` `ch-permitidas`** (53–121): no assets, 7 tests.
- **`<Explorable>` `logit-mask`** (187), `SPANISH_BOUND_CORPORA`. The prose walks it (171–196:
  $1.2 \times 10^{-7}$ for `{`, the newline at 0.34, initials C / N / P / T, P at $2.5 \times
  10^{-5}$, 61 % / 1.6 %, `ela` at 58 %, the `or` of «Por», 4.6 %, «Pero», «Por», «Pues»).
- **The grammar**: five names (209–210: Nela, Pablo, Teodoro, Celipín, Choto); key `personaje`;
  prompt «¿Quién es la protagonista? Responde en JSON.» (173–174).
- **`<PyCell>` 334–369** (`modelo.py`; `permitidas`, `con_mascara`): quoted 372–375 (after `pers`,
  `o` and `n` instead of `on`; no Nela among five).
- **`<PyCell>` 381–406** (`recorrer`, 132 paths): quoted 408–418 ($8.1 \times 10^{-63}$, $1.2 \times
  10^{62}$ tries, $4 \times 10^{45}$ years; Nela 99.4 % conditioned, 1.6 % masked; Pablo 62 %; Choto
  ahead of her).
- **`<W>`: 50**, the block's most; the corpus's names on 14 lines. **`reading`**: 4, `lang: en`.

#### 3·4 `recuperacion` — `es/21-recuperacion.mdx` — rewrite, P

- **Replacement:** *show the causal mean's asymmetry with what English questions do open with (the
  question word) against the closing `?`, measured by the same cell, and ask `q-el-signo` about that
  pair; pick the worked question and its answer passage from the English corpus so a vocabulary gap
  like `edad`/`años` still defeats TF-IDF.*
- **Quiz (4).** `q-dos-sitios` `numeric` **0.78** (12–18): arithmetic, holds. `q-el-signo` a (19–29):
  **new question**. `q-fallos-tfidf` [a,b] (30–40): «tres de las doce preguntas» → re-measured, same
  question. `q-edicion-nueva` a (41–51): «diecisiete» → the English corpus's fact.
- **`<CodeChallenge>` `ch-recuperar`** (53–114): no assets, 6 tests, language-free.
- **Worked example** 174–176: «¿Qué edad tiene la Nela?», Golfín's question in chapter 3 and «Dicen
  que tengo diez y seis años»; the gap `edad` / `años` (221, 265, 356, 404).
- **`<PyCell>` 309–354** (`modelo.py`, corpus; 288 passages, TF-IDF vs the mini-GPT's mean): quoted
  356–363.
- **`<PyCell>` 365–401** (ranks, question-neighbours, passage length): quoted 404–421 (TF-IDF misses
  three; the age passage in the last four of 288; «Con el señor Centeno, capataz de ganado…»; 20 /
  100 / 97 / 10; 32.8 tokens, 98 of the 64-token window).
- 268: published (DPR, 9–19 points over BM25).
- **`<W>`: 22**; the corpus's names on 17 lines. **`reading`**: 4, `lang: en`.

#### 3·5 `ventana-de-contexto` — `es/22-ventana-de-contexto.mdx` — adapt, P

- **Quiz (4), all hold.** `q-donde-se-igualan` `numeric` **45856** (12–18), `q-lo-que-pierde`,
  `q-el-contrato`, `q-en-medio` (19–51).
- **`<Explorable>` `context-window` preset `asistente`** (111). The prose walks its structure (98–109:
  3 410 tokens, windows 2 560 / 1 024 / 768). The sizes are illustrative and stay; the labels move.
- **Hold**: 177–182 (512; 25 076; 6.2×; 64 GiB); 222–227, Liu et al.'s *lost in the middle* (75.8 /
  53.8 / 63.2 / 56.1 %).
- **`<PyCell>` 247–293** (`guionizado.py`, `bpe.py`, merges; a conversation about the novel, 256-token
  budget): quoted 295–302 (313 tokens; the last 231; seven tokens of the system prompt survive, «: no
  lo sé.» + `<|fin|>`; `RESERVA = 32` drops the third turn) → re-counted with the English tokenizer.
  The truncation must still cut inside the system prompt and leave its last instruction standing.
- **`<W>`: 4**; the corpus's names on 8 lines (the cell's conversation). **`reading`**: 3, `lang: en`.

#### 3·6 `evaluar` — `es/23-evaluar.mdx` — adapt, P (scripted)

- **Quiz (4), all language-free.** `q-cuantas-pruebas` `numeric` **683** (12–18), `q-doce-de-doce` a
  (19–29), `q-juez-que-coincide` `numeric` **0.61** (30–36), `q-el-numero-que-sube` [a,b] (37–47).
- **`<CodeChallenge>` `ch-comparar`** (49–117): no assets, 6 tests, language-free.
- **Arithmetic, holds**: the Wilson derivation and its numbers (212–273), the paired example
  (297–301).
- **Examples**: «La fecha es 2026-12-02.» (180–181, 314–315); the paraphrase pair «El hijo ciego de
  don Francisco Penáguilas» / «un joven ciego, hijo de don Francisco» (319–320) → a pair from the
  English corpus. 361: published (GSM1k).
- **`<PyCell>` 380–426** (`guionizado.py`; 40 scripted date answers): quoted 428–436 (33 of 40,
  [0.680, 0.913]; 36 of 40; coverage 71.3 / 97.4 % at 12, 91.4 / 94.3 % at 40).
- **`<PyCell>` 444–487** (the judge is the scripted model): `JUEZ`, a system prompt «sobre la novela
  *Marianela*»; twelve `CASOS` about the novel, each with the author's label and the judge's verdict.
  Quoted 489–493 (10 of 12, 83.3 %, κ 0.571, chance 61.1 %; judge 83.3 % vs labels 66.7 %).
  Re-authored with the same pattern, the numbers hold.
- **`<W>`: 6**; the corpus's names on 19 lines. **`reading`**: 4, `lang: en`.

#### 3·7 `proyecto-asistente` — `es/24-proyecto-asistente.mdx` — adapt, P

- **Quiz (3), all language-free.** `q-cuantas-llamadas` `numeric` **1.24** (12–18),
  `q-fallos-de-costumbre` a (19–29), `q-el-techo` `numeric` **0.6** (30–36).
- **`<CodeChallenge>` `ch-asistente`** (38–194): loads `guionizado.py`, 6 tests.
- **The trace** 238–250: «¿Quién toca el piano?»; three passages, the second «—Es la señorita Sofía,
  que toca—afirmó María.»; the scripted answer `{"respuesta": "María", "pasaje": 2}`, a misread
  dialogue tag. The English corpus needs a passage whose tag names someone other than the answer.
- **The contract** 259–273 (keys `respuesta`, `pasaje`; `no lo sé`).
- **`<PyCell>` 375–413** (`guionizado.py`, `bpe.py`, merges, corpus; TF-IDF): 415–417, the
  out-of-corpus probe written in English.
- **`<PyCell>` 424–469** (`montar`, `cumple`, `asistente`; scripted malformed answers): 472–473.
- **`<PyCell>` 482–528** (a 12-question bank by stage): quoted 530–537 (7 of 12, [0.32, 0.81]; 3
  retriever, 1 format, 1 reading; ceiling 9 of 12; «Teodoro» as Pablo's father; 7 of 9, [0.45,
  0.94]). Retrieval is measured on the English corpus; the answers are scripted.
- 21 `open_url` lines between the challenge and the three cells.
- **`<W>`: 16**; the corpus's names on 21 lines. **`reading`**: 3, `lang: en`.

## Assets this block builds

| Asset | Built by | Consumed by |
|---|---|---|
| `guionizado.en.py` + its assets-test block | 3·1 | 3·5, Block 4 |
| English `logit-mask` paths in `math/logit-mask-presets.ts`, picked per locale | 3·3 | 3·3 |
| ~~English `asistente` preset labels in `math/context-window.ts`~~ — none needed (P3-00): the preset holds no text, its labels come from `courses.widgets.context-window.kinds.*` | — | — |

## Lesson progress

- [ ] 3·1 `el-prompt-es-una-especificacion`
- [ ] 3·2 `cadena-de-pensamiento`
- [ ] 3·3 `salida-estructurada`
- [ ] 3·4 `recuperacion`
- [ ] 3·5 `ventana-de-contexto`
- [ ] 3·6 `evaluar`
- [ ] 3·7 `proyecto-asistente`

## The protagonist, decided once

3·3's grammar, 3·4's retrieval questions, 3·6's evaluation set and 3·7's project all ask about the
novel's people. The English corpus chosen in P3-02 supplies them; pick the question set **once**, in
3·3, from names the corpus repeats often enough for the mini-GPT to have learned them, and reuse it.
The JSON key moves with the language (`"personaje"` → `"character"`); the grammar's values are the
corpus's own names, untranslated.

## Decisions fixed by a translated lesson

*Empty until the first lesson lands.*

## Acceptance criteria

- [ ] Every lesson under `content/courses/llm-agents/en/`, `draft: false`; ids identical
- [ ] `guionizado.en.py` equals 3·1's English cell character for character; `parity-en.py` covers it
- [ ] `logit-mask` renders English paths on `/en`, leaves `SPANISH_BOUND_CORPORA`, and its data test
      asserts the property above
- [ ] Every number re-run in the browser against the English assets
- [ ] Two-reader test against the English neighbours; `pnpm lint:content` clean; `pnpm build` green

## Test plan

- Per lesson: `lint:content`, every cell in the browser, desktop and phone.
- 3·3: render the widget on `/en`, step through each path, confirm the property on screen.
- 3·6–3·7: the exact-match scores the prose quotes, re-counted from the English run.

## Gotchas

- **The judge in 3·6 is the scripted model** (`guionizado`, as assistant and as judge; the cells
  do not load the network). Its traps, order and length, are shown on scripted outputs, and a
  translation must keep each one visible: the longer answer must still be the one a length-biased
  judge wrongly prefers. 3·6 also derives the Wilson interval that 5·8 measures with; use P3-03's
  English names for it from here.
- **`compactación` is first named in 3·5** and given its contract in Block 5 (glossary note). Use
  P3-03's English term from the first mention.

## Out of scope

- Any Block 4 module (`entorno`, `harness`, `permisos`).

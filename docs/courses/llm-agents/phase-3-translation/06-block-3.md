# P3-06 — Block 3: Talking to the Model Is Programming

**Tag:** `COURSE-C2-P3-06` · **Size:** L · **Status:** not started
**Depends on:** P3-05
**Course:** `llm-agents` → `content/courses/llm-agents/en/` · **Runs on:** the English mini-GPT
(`modelo.en.py`) and, from 3·1, the scripted model (`guionizado.en.py`), in the browser

## TL;DR

Seven lessons and no rewrite, but the block where *Marianela* is most visible: constrained decoding
writes a character's name as JSON, retrieval finds passages of the novel, the evaluation set asks
questions about it, and the project ties all three into one assistant. Every one of those becomes a
question about the English corpus. Every lesson re-runs. 3·1 also freezes the scripted model, which
Block 4 is built on.

## Classification

**Planning pass, 2026-11-13. P3-00 replaces this table.** `es/18` … `es/24` are 3·1 … 3·7.

| # | Slug | Class | Re-run | What binds it to Spanish |
|---|---|---|---|---|
| 3·1 | `el-prompt-es-una-especificacion` | adapt | P | Writes the scripted model's class (frozen as `guionizado.py`, asserted "character for character" against this lesson's cell) → `guionizado.en.py`. Its scripted replies are Spanish. The spec-compliance quiz (**0.367**) holds |
| 3·2 | `cadena-de-pensamiento` | adapt | P | One cell on `modelo.py`; the chain-of-thought sample is quoted |
| 3·3 | `salida-estructurada` | adapt | P | `logit-mask` is in `SPANISH_BOUND_CORPORA`: five paths of the checkpoint writing `{"personaje": "…"}` after «¿Quién es la protagonista? Responde en JSON.», with *Marianela*'s names as the grammar's values. Re-run `logit-mask-presets.py` against the English checkpoint, a grammar over names the English corpus repeats, and check the property: **the mask's favourite value is not the one the model itself prefers among the valid answers.** 30 corpus-name mentions, 80 `<W>`, the block's heaviest |
| 3·4 | `recuperacion` | adapt | P | Embeddings and retrieval over passages of the novel; the questions and the retrieved passages are quoted. 21 corpus-name mentions; 3 `curso="dl-nlp"` refs |
| 3·5 | `ventana-de-contexto` | adapt | P | `context-window` preset `asistente`: "an assistant about Marianela in its seventh call". Its sizes are illustrative, not measured, so the preset's **labels** move and its numbers may stay; check which the prose quotes. One cell on `bpe` + `guionizado` |
| 3·6 | `evaluar` | adapt | P | The evaluation set: questions about the novel with exact answers, an LLM judge and its traps. 26 corpus-name mentions; the first lesson that names the benchmark vocabulary Block 5 reuses (`pedido`, 18 mentions) |
| 3·7 | `proyecto-asistente` | adapt | P | The assistant that retrieves, answers in format and is measured: 21 `open_url` loads, every number re-measured on the English corpus |

**Block totals (planning pass):** 0 transpose · 7 adapt · 0 rewrite · re-runs P ×7.

## Assets this block builds

| Asset | Built by | Consumed by |
|---|---|---|
| `guionizado.en.py` + its assets-test block | 3·1 | 3·5, Block 4 |
| English `logit-mask` paths in `math/logit-mask-presets.ts`, picked per locale | 3·3 | 3·3 |
| English `asistente` preset labels in `math/context-window.ts` (if the prose quotes them) | 3·5 | 3·5 |

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

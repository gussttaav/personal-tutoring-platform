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

**Planning pass, 2026-11-13. P3-00 replaces this table.** `es/10` … `es/17` are 2·1 … 2·8.

| # | Slug | Class | Re-run | What binds it to Spanish |
|---|---|---|---|---|
| 2·1 | `predecir-no-es-obedecer` | adapt | P | One cell on the corpus and `modelo.py`: the base model "continuing" an instruction instead of obeying it, quoted. The probability quiz (**0.205**) is arithmetic and holds |
| 2·2 | `plantilla-de-chat` | adapt | P | The `chat-template` widget already has its English conversation (`corpora.ts`: `<\|system\|>`…, "What colour is the sky?", the forged `Assistant: Green.`). The lesson's cells print **41** tokens and **12** carrying loss on the Spanish conversation; the English cell prints its own, and the widget opens on the same conversation. The loss-token quiz (**19**) is arithmetic |
| 2·3 | `sft` | adapt | P | The ten «¿De qué color es …?» pairs and the held-out «la tierra», which are P3-02's `SFT_PARES`. The English lesson uses **exactly P3-02's English pairs**, and quotes the before/after P3-02 asserted (re-run in Pyodide). Property 4 changed shape in English (no agreeing article), and the prose that reads the "before" sample changes with it. The `7 × 8` quiz (**0.2**) holds |
| 2·4 | `modelo-de-recompensa` | adapt | P | Cells on `modelo.py`. `bradley-terry` widget is numeric. Quoted rewards re-measured; the transitivity quiz (**0.9**) holds |
| 2·5 | `rlhf` | adapt | P | Three cells; a quiz quotes the **second cell's** numbers (reward 16, KL 73.3 nats, reference 3.47 → answer **0.171**), so its answer is re-measured. The KL quiz (**13.8155**) holds |
| 2·6 | `dpo` | adapt | P | The full derivation transposes. Cells on `modelo.py`; `dpo-loss` widget is numeric; quoted log-ratios re-measured. The factor quiz (**0.378**) holds. The block's longest lesson (3 691 words) |
| 2·7 | `de-donde-salen-las-preferencias` | transpose | — | No cells. Humans, constitutions, models as judges. The judge-position quiz (**0.845**) holds |
| 2·8 | `proyecto-sft-colab` | adapt | C | The notebook (D2): Qwen2.5-0.5B, 3 249 Spanish OpenAssistant pairs, five Spanish test instructions (a capital, a *tortilla de patatas* recipe, sleep advice, photosynthesis for an 8-year-old, the false-premise Great Wall question that 2·7 set up). 27 `<W>`, most of them quoted generations. `<ColabLink>` pins a commit of `gussttaav/ai-notebooks` |

**Block totals (planning pass):** 1 transpose · 7 adapt · 0 rewrite · re-runs P ×6, C ×1.

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

# Phase 3 — English translation

Write the English lesson tree: `content/courses/llm-agents/en/`, 40 lessons, one PR each.

**Planned:** 2026-11-13, the week the Spanish course closed at 40 of 40. The shape is
`dl-nlp`'s [Phase 11](../../dl-nlp/phase-11-translation/README.md), and almost everything that
phase built is reused rather than rebuilt. What differs is **where the Spanish lives**. In the
first course it lived mostly in the prose and in a few widget corpora. In this one it lives in a
**trained model**, in **seven frozen Python modules** the cells load, in a **companion
repository**, and in **measurements taken against a real local model**. Translating this course
is mostly re-making assets and re-measuring, and only then translating prose.

## What already works — do not rebuild it

Phase 11 paid for the platform. All of it is course-agnostic and covers this course unchanged:

- **Per-lesson resolution** (`catalog-view.ts`, COURSE-P6-03b). The Spanish tree is the spine; each
  lesson independently uses its English version when one exists. An untranslated lesson renders
  Spanish under `/en` with `noindex` and no hreflang alternate. No broken intermediate state.
- **Cross-locale references** (COURSE-P11-01). `validate-crosslinks.ts` and `Leccion.tsx` both
  resolve a reference in its own locale tree and then the canonical one, and the hover card marks a
  fallback target «In Spanish». **Cross-course references take the same two-step** in the other
  course's trees (COURSE-C2-P0-02, `Leccion.tsx` `resolveTarget`). `dl-nlp/en/` holds 37 of 43, so
  most `curso="dl-nlp"` references already land on English.
- **The English voice families** (`validate-voice.ts`), selected by the lesson's locale directory.
- **`validate-structure.ts`** already bans the English step names as headings.
- **The ten widgets were born bilingual** (PLAN's standing constraint, verified at Phase 1 exit):
  every string reads `courses.widgets.*`. Two of them — `bpe-merges` and `chat-template` — already
  carry an English corpus in `corpora.ts`, chosen against their teaching property and asserted in
  `corpora.test.ts`.
- **`course.en.yml`** is written and complete: title, tagline, FAQ, the five block titles.
- **`AUTHORING.en.md`** (COURSE-P11-03), the English language delta, and the `/course-translate`
  command, which resolves the course from the task md's path.

**No new routes, no redirects, no slug migration, no SEO work.**

## What does not work yet — four Spanish-bound layers

`SPANISH_BOUND_CORPORA` in `src/features/courses/widgets/corpora.ts` already lists most of it,
written by the Phase 1 lessons as they went. Read it as this phase's inventory of assets.

### 1. The model is Spanish — P3-02

The Block 1 mini-GPT is trained on *Marianela* (`corpus.txt`). Its merge table, its checkpoint and
**every number Blocks 1–3 quote** — 2.16 bytes per token, 125 789 training tokens, perplexity,
$0.118$ for <W> no</W> after <W>La Nela</W>, the SFT before/after, the constrained-decoding paths —
are functions of that corpus. An English lesson that runs the Spanish checkpoint teaches language
modelling on a language the reader is not reading. The PLAN already named this as "the one thing
that is not purely additive". It is the phase's single hard prerequisite: Block 1 lesson 2 trains
BPE on the corpus in a cell, so nothing in the course can be translated before it exists.

### 2. The code is Spanish, and it crosses blocks — P3-03

`AUTHORING.en.md` §7 settled that a `<PyCell>`'s code is the lesson talking and is written in
English. In `dl-nlp` that cost nothing beyond each cell, because cells were self-contained. Here,
seven modules are written by one lesson, **frozen**, and loaded by the lessons after it:

| Module (`public/courses/llm-agents/`) | Written by | Loaded by |
|---|---|---|
| `bpe.py` | 1·2 | Blocks 1–3, and `train-minigpt.py` |
| `minigpt.py` | P0-03 / Block 1 | Blocks 1–3, and `train-minigpt.py` |
| `modelo.py` | 1·9 | Blocks 2–3 |
| `guionizado.py` | 3·1 | Blocks 3–4 |
| `entorno.py` | 4·2 | Block 4, and the companion repo |
| `harness.py` | 4·4 | Block 4 |
| `permisos.py` | 4·5 | Block 4's project, and the companion repo |

And the course's terms *are* its identifiers: `turno`, `llamada`, `observación`, `entorno`,
`permiso`, `paso`, `codificar` / `decodificar`, `generar`. The Spanish glossary spent real effort
keeping `ventana` (training) and `ventana` (context) apart, and `llamada` (to the model, Blocks 2–3)
from `llamada` (the model's, Block 4 on). English has the same collisions (*window*, *call*) plus a
new one (`paso` → *step* is both the training step and the first course's `paso`). So the English
**identifier map** is fixed once, before Block 1, for the whole course — not lesson by lesson as
`dl-nlp`'s glossary grew. A name chosen in 1·2 is still being typed in Block 5.

### 3. The measurements are Spanish — Blocks 4–5

Block 5 runs a real model, `qwen3:4b-instruct` on Ollama, and quotes what it did: transcripts,
token counts, failure modes, and lesson 39's success rates with Wilson intervals. Those are
measurements of *this harness, with Spanish prompts, against this model*. An English system prompt,
an English `AGENTE.md` and English benchmark requests change what the model does. Two lessons go
further, because there the language *is* the content: 33 shows the model answering a Spanish
request in English, a failure an English run will not reproduce; and 35's worked system prompt is
«Escribe en español», which is vacuous in English. The `context-window` widget's `compactacion`
preset carries token counts measured on the Spanish run.

### 4. The repository and the notebook are Spanish — Blocks 2 and 5

The companion repository [`agente-minimo`](https://github.com/gussttaav/agente-minimo) is Spanish
end to end: file names (`bucle.py`, `compactar.py`), identifiers, its `AGENTE.md`, the five
benchmark tasks in `banco/`, and a README that tells English readers "the lessons are in Spanish".
Its nine tags are cut from the Spanish lessons' code, and the English lessons' code will not match
them. The Block 2 project's Colab notebook fine-tunes Qwen2.5-0.5B on the **Spanish** subset of
OpenAssistant and quotes Spanish generations.

## Classification — the model this phase runs on

Phase 11's three classes, with one refinement this course needs. In `dl-nlp` a moved quiz answer
meant the pedagogy was Spanish-bound, so it was the adapt/rewrite boundary. Here most moved answers
are **re-measured quantities** — the same question asked of a new checkpoint — and authoring cost
is unchanged. So:

| Class | What changes | Test |
|---|---|---|
| **Transpose** | Prose only. Mathematics, numbers, ids, quiz answers hold. | Every example and number stays correct with the prose in English. |
| **Adapt** | The argument holds; a corpus, an example, an identifier set or a **measured number** changes. A quiz answer may move **if it is the same question re-measured**. | Nothing has to be re-thought; things have to be re-run. |
| **Rewrite** | The pedagogy is Spanish-dependent: a new example, a new quiz question, a new failure to show. | A quiz *question* changes, or an argument only works in Spanish. |

Orthogonal to the class, every lesson carries a **re-run** flag — what has to execute again before
its prose can be written: **P** (Pyodide cells against the English checkpoint or modules),
**T** (terminal runs against the local model), **C** (Colab), **—** (nothing).

### The planning-pass estimate — P3-00 replaces it with a count

| Block | Lessons | Transpose | Adapt | Rewrite | Re-run |
|---|---|---|---|---|---|
| [1 — From the Transformer to the Language Model](04-block-1.md) | 9 | 1 | 6 | 2 | P ×7 |
| [2 — From Predicting Text to Following Instructions](05-block-2.md) | 8 | 1 | 7 | 0 | P ×6 · C ×1 |
| [3 — Talking to the Model Is Programming](06-block-3.md) | 7 | 0 | 7 | 0 | P ×7 |
| [4 — The Bridge: from Text to Actions](07-block-4.md) | 7 | 0 | 7 | 0 | P ×7 |
| [5 — A Coding Agent in the Terminal](08-block-5.md) | 9 | 0 | 7 | 2 | T ×9 |
| **Phase** | **40** | **2** | **34** | **4** | |

These rows are guesses from a scan of the Spanish tree (components, `open_url` targets, quiz
answers, where the corpus is quoted), not from reading each lesson. `dl-nlp`'s planning pass was
wrong on five of six pre-filled rows in its last block. P3-00 reads every lesson and corrects them.

What the estimate already says, and P3-00 will not change: **this phase is adapt-heavy and
re-run-heavy, and light on rewrites.** Only two lessons are clean transposes (1·7 and 2·7, the two
whose numbers are all published figures or arithmetic), because nearly every other lesson quotes its
own model. The four rewrites are the four places where the language is the subject: 1·2 (UTF-8 and
Spanish spelling), 1·8 (Spanish morphology as the in-context task), 5·2 and 5·4 (the model's
language as a finding, and as an instruction). The cost is in P3-02 (the checkpoint), in the identifier
map and the module siblings, and in Block 5's runs, not in the prose.

## Locked decisions

Inherited from Phase 11 unchanged: **en-GB**; **slugs, `block`, `order` and every widget, quiz and
challenge id identical to Spanish**; **`reading` keeps the same sources** with `note` translated and
`lang` unchanged; **block order, lesson order, strictly** (the bridges interlock in English); **one
lesson = one PR**; **a `.en` sibling for every locale-bound asset** (`<name>.en.svg`,
`<name>.en.txt`, `<name>.en.json`), with the Spanish file keeping its name (`AUTHORING.en.md` §7).

New for this course:

| Decision | Choice | Rationale |
|---|---|---|
| The model | **An English checkpoint**, trained by the same script on an English public-domain corpus, shipped beside the Spanish one as `minigpt.en.json`, `bpe-merges.en.json`, `corpus.en.txt`. Never the Spanish checkpoint behind English prose. | The PLAN's own out-of-scope note. The course's promise is "your own model"; the student cannot judge a sample in a language they are not reading, and every Block 1–3 argument that reads a sample (repetition under greedy decoding, what SFT changes) would be argued on text the reader takes on trust. |
| The corpus | Chosen in P3-02 against **the same teaching properties** `train-minigpt.py` asserts, not for its resemblance to *Marianela*. | A corpus is a teaching instrument (Phase 11's P11-02 lesson). The properties are written down and asserted in the script; that is what has to hold. |
| Frozen modules | **English siblings**, `<name>.en.py`, translated 1:1 against the identifier map, with a **parity test** proving the sibling computes exactly what the original does on the same inputs. `bpe.en.py` and `minigpt.en.py` come with P3-02 (the trainer imports them); each later one comes with the English lesson that freezes it, as the Spanish ones did. | §7's PyCell rule, one layer up. A cell in English that calls `modelo.generar(...)` is the half-translated tell. The parity test is what lets a translation of a frozen module be trusted without re-reviewing its maths. |
| Identifiers | **One English identifier map for the whole course**, in `llm-agents/AUTHORING.en.md` (P3-03), before Block 1. Lessons may add to it; they may not rename an entry once a module has frozen it. | The modules and the companion repo carry names across all five blocks. |
| Measurements | **Re-measured, never transposed.** A number the Spanish lesson measured is measured again on the English asset, prompt or run, and the English lesson quotes what *that* printed. | A translated lesson quoting the Spanish run's numbers describes a run the English reader cannot reproduce from the code beside it. |
| Block 5's chain | **The pinned chain of the Spanish lessons**: Ollama 0.40.13, `qwen3:4b-instruct`, the 8K `Modelfile`. If that version is no longer installable when Block 5 is translated, stop and decide before writing. | Two locales describing two different chains would make the callouts, the repo and lesson 39's table disagree across a language switch. |

## Decisions taken by Gustavo — 2026-11-13

Planned as open decisions, all three settled the day the phase was planned. Each block md
carries the detail.

| # | Decision | Choice |
|---|---|---|
| D1 | **The companion repository in English** | **The same repository, `agente-minimo`, on an `en` branch with tags `en-b5-l1` … `en-b5-l9`.** No new repo; `LLM_AGENTS_REPO_BASE` stays one URL. The English lessons' `<RepoLink tag>` differs from the Spanish one, and P3-01 adds a lint for it. ([08-block-5.md](08-block-5.md)) |
| D2 | **The Block 2 Colab notebook** | **An English notebook**: the same recipe on OpenAssistant's English pairs, re-run on Colab. Unlike `dl-nlp`'s BETO notebook, the lesson's evidence is what the model answers. ([05-block-2.md](05-block-2.md)) |
| D3 | **Lesson 39's two Kaggle rows** (`qwen3:8b` under the student's harness; Claude Code on the course's model at 32K) | **Both re-run on Kaggle against the English benchmark**, never quoted from the Spanish run. ([08-block-5.md](08-block-5.md)) |

## Tasks

1. [00-triage.md](00-triage.md) — `COURSE-C2-P3-00` (S) — classify 40 lessons; fill the tables in tasks 04–08
2. [01-platform-readiness.md](01-platform-readiness.md) — `COURSE-C2-P3-01` (S) — confirm Phase 11's machinery covers a second course; generalise the two things that name `dl-nlp`; teach `/course-translate` this phase's notebook, terminal and tag steps. **`/course-translate` must not run on this course before it lands**
3. [02-english-checkpoint.md](02-english-checkpoint.md) — `COURSE-C2-P3-02` (L) — the English corpus, checkpoint, merge table, and `bpe.en.py` / `minigpt.en.py`
4. [03-authoring-en.md](03-authoring-en.md) — `COURSE-C2-P3-03` (M) — `llm-agents/AUTHORING.en.md`: glossary, identifier map, the terminal form in English
5. [04-block-1.md](04-block-1.md) — `COURSE-C2-P3-04` (L) — Block 1, 9 lessons
6. [05-block-2.md](05-block-2.md) — `COURSE-C2-P3-05` (L) — Block 2, 8 lessons (+ the English notebook)
7. [06-block-3.md](06-block-3.md) — `COURSE-C2-P3-06` (L) — Block 3, 7 lessons
8. [07-block-4.md](07-block-4.md) — `COURSE-C2-P3-07` (L) — Block 4, 7 lessons
9. [08-block-5.md](08-block-5.md) — `COURSE-C2-P3-08` (XL) — Block 5, 9 lessons (the `en` branch, D3's Kaggle runs)

```
P3-00 (triage) ─────────────────────────────┐
                                            ▼
P3-01 ──► P3-02 (checkpoint) ──┐
          P3-03 (identifiers) ─┴──► P3-04 ──► 05 ──► 06 ──► 07 ──► 08
```

P3-00 and P3-01 are cheap and run first. **P3-02 and P3-03 are mutually dependent in one place**:
`bpe.en.py` and `minigpt.en.py` need the identifier map, and the map should be tested against two
real modules before it is frozen. Write P3-03's identifier table first, then P3-02, then finish
P3-03 against what P3-02 found.

## Sequencing constraints

- **`dl-nlp`'s Block 5 translation comes first.** 1·1 opens on `dl-nlp`'s last lesson and quotes
  its `genera(paso, go, eos, max_pasos)` from 5.9 `proyecto-transformer`; `dl-nlp`'s P11-08 still
  has 5.6–5.11 open. A reference can fall back to Spanish; a code name cannot. See P3-03.
- **Phase 2 is still open** (`P2-01` hand-off, `P2-02` announcement). Neither blocks this phase. If
  the announcement goes out before English lessons exist, the English email must say the lessons are
  in Spanish; an "English edition" announcement is out of scope here.
- **Block 5's run time.** Block 5 lessons take 30–50 minutes of model time each on the
  author's machine (memory: Ollama ignores `tool_choice`; 8K-filling runs are slow). Detach long
  runs (`setsid nohup`) and budget a session per lesson.
- **A Spanish lesson revised after its English counterpart is written** leaves the two out of sync,
  and nothing checks it (Phase 11's drift-lint note, still out of scope). Spanish edits during this
  phase go in the block md's notes so the English lesson is revisited.

## Exit criteria

- [ ] `content/courses/llm-agents/en/` holds 40 published lessons; `fullyTranslated` is true for `en`
- [ ] Every `/en/cursos/llm-agents/<slug>` is indexable, with reciprocal hreflang; no fallback `noindex`
- [ ] A partially translated tree passes `pnpm lint:content` at every intermediate commit
- [ ] `SPANISH_BOUND_CORPORA` holds no `llm-agents` entry; no English lesson renders a Spanish
      widget label, default corpus or preset
- [ ] Every English `<PyCell>` and `<CodeChallenge>` run in the browser, and every number the prose
      quotes matches what Pyodide printed against the **English** assets
- [ ] Every English Block 5 lesson verified from its English tag on the pinned chain
- [ ] `pnpm lint` + `pnpm lint:content` + `pnpm test` + `pnpm build` + `pnpm check:bundle` green

## Out of scope

- **A translation-drift lint** — Phase 11's out-of-scope note, unchanged.
- **Re-training the Spanish checkpoint** or touching any Spanish asset. Every English asset is a
  sibling; a Spanish file that changes is a separate PR against the Spanish lesson.
- **A model other than the pinned one in Block 5**, or a newer Ollama. Re-pinning is a change to
  both locales and its own task.
- **Translating `docs/`** (the plans, the task mds, `scripts/courses/llm-agents/README.md`). They
  are author-facing.
- **A third locale.**

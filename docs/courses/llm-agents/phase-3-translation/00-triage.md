# P3-00 — Triage: classify 40 lessons

**Tag:** `COURSE-C2-P3-00` · **Size:** S · **Status:** not started

## TL;DR

Read all 40 published Spanish lessons and give each one a **class** (transpose / adapt / rewrite),
a **re-run flag** (P / T / C / —) and a list of its Spanish-bound artifacts with line refs. Write
the result into the Classification tables of tasks 04–08, replacing the planning-pass rows. No code,
no content, no `en/` file.

## Context

[Phase 11's triage](../../dl-nlp/phase-11-translation/00-triage.md) is the model, and its gotchas
all still apply. What this course adds is a second axis. In `dl-nlp` the cost of a lesson was mostly
in its language; here it is mostly in **what has to run again** before the prose can be written —
the English checkpoint, a frozen module's English sibling, a terminal session against the local
model. A lesson can be a clean transpose *and* need six cells re-run, because every number it quotes
was printed by the Spanish checkpoint.

The planning-pass rows in the block mds came from a scan (component counts, `open_url` targets,
numeric quiz answers, the corpus's character names in the prose). They are a starting point and
are expected to be wrong in places.

## Files affected

| File | Change |
|---|---|
| `docs/courses/llm-agents/phase-3-translation/04-block-1.md` … `08-block-5.md` | fill the **Classification** table, add the **Artifact inventory**, record "What changed from the planning pass" |
| `docs/courses/llm-agents/phase-3-translation/README.md` | replace the planning-pass totals with the count |
| `docs/courses/llm-agents/STATUS.md` | the P3-00 note |

## The change

For each published lesson (`es/01` … `es/40`; `00-pipeline-fixture.mdx` is a draft fixture and is
**excluded**), record:

### 1. The class

The README's refined test. The boundary that matters is adapt/rewrite, and here it is about the
**question**, not the answer: a quiz item whose answer moves because the checkpoint changed is the
same question re-measured (adapt); a quiz item that asks about Spanish (`que` before `qu` in the
merge list, «Escribe en español» in a system prompt) is a new question (rewrite).

### 2. The re-run flag

- **P** — at least one `<PyCell>` or `<CodeChallenge>` whose printed output the prose or a quiz
  quotes, and which loads the checkpoint, the corpus or a frozen module.
- **T** — a terminal transcript, a token count or a rate measured against the local model.
- **C** — a Colab run.
- **—** — nothing runs, or nothing that runs is quoted.

### 3. The Spanish-bound artifacts

Phase 11's list (quiz items, `<PyCell>` identifiers and quoted output, `<CodeChallenge>` prompts,
starters, assertion messages and explanations, `<Explorable>` ids with a locale-bound preset,
`<Figure>` with text set into the SVG, `<Leccion ancla="">`, `reading`, `<W>`), plus three this
course adds:

- **Quoted samples from the checkpoint**: any generated text in the prose, a caption or a quiz.
  Count them; each one is regenerated, not translated.
- **Frozen-module calls**: which of the seven modules the lesson loads, and which **identifiers** of
  theirs its prose names (`generar`, `Adam.paso`, `ejecutar`, `turno`). These feed P3-03's
  identifier map.
- **Repository and run artifacts** (Block 5): `<RepoLink>` tags, file names quoted from the repo,
  quoted transcripts and token counts, and every claim of the form "the model did X" — each is a
  measurement.

### 4. Cross-course references

Count `<Leccion curso="dl-nlp">` per lesson and record which targets are **not** yet in
`content/courses/dl-nlp/en/`. Those render «In Spanish» in the English hover card until `dl-nlp`'s
Block 5 is translated; that is correct behaviour, but the block md should say so.

### 5. A one-line note for every rewrite

The replacement direction, e.g. for 5·2: *"the failure where the model answers in the wrong
language does not occur in English; show the next most frequent failure from the English run of
the same request."*

## Acceptance criteria

- [ ] All 40 published lessons classed, with a re-run flag, in the five block mds
- [ ] Every adapt and rewrite carries its artifact list with line refs
- [ ] Every rewrite carries its one-line replacement note
- [ ] Every identifier of a frozen module that some lesson's prose names is listed, for P3-03
- [ ] Every `curso="dl-nlp"` target not yet translated in `dl-nlp/en/` is named
- [ ] Per-block and phase totals recorded in the README, replacing the planning-pass estimate
- [ ] The fixture `00-pipeline-fixture.mdx` explicitly excluded

## Test plan

None — documentation. The check is that a reader of a block md can tell, without opening the
Spanish lesson, what the lesson will cost and what has to run before it is written.

## Gotchas

- **Classify against the rendered lesson.** A lesson with no `<PyCell>` can still quote the
  checkpoint (a caption, a quiz explanation); grep the prose for the corpus's names (`Nela`,
  `Pablo`, `Golfín`, `Florentina`, `Teodoro`, `Celipín`, `Socartes`), not only the code.
- **The bridge is not a free transpose.** A rewrite in lesson N changes what N+1's pickup can say;
  flag N+1 as adapt.
- **`lang: es` in `reading` is not a dependency.** A Spanish source stays.
- **A quoted number is not always the checkpoint's.** Block 1 lessons 1 and 7 quote published
  figures (Kaplan's exponents, GPT-3's sizes) that hold in any language; only the mini-GPT's own
  numbers move. Tell them apart per number.
- **"The model answered in English"** (Block 5) is a Spanish-run finding. Flag every sentence that
  reports what language the model used.

## Out of scope

- Writing any English content, any `en/` file, any asset.
- Choosing the English corpus (P3-02) or the identifier names (P3-03).
- Re-classifying later. A lesson that turns out harder than its class is a note in its block md.

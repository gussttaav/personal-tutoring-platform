# P11-00 — Triage: classify 43 lessons

**Tag:** `COURSE-P11-00` · **Size:** S · **Status:** not started

## TL;DR

Read all 43 published Spanish lessons and assign each one a class — **transpose**, **adapt** or
**rewrite** — plus a list of the Spanish-dependent artifacts it contains. Write the result into
the classification tables of tasks 04–08. No code, no content, no `en/` file.

## Context

Everything downstream keys off this. The class decides which model does the lesson, at what
effort, and how deep the review goes; the artifact list decides what the author has to replace
before writing a word of prose. Doing it lesson-by-lesson at translation time means making the
same judgement 43 times with no view of the whole, and discovering in Block 5 that a decision
made in Block 1 was wrong.

It is deliberately the cheapest task in the phase. One read-through, one table.

## Files affected

| File | Change |
|---|---|
| `docs/courses/phase-11-translation/04-block-1.md` … `08-block-5.md` | fill the **Classification** table |

Nothing else. This task writes no code and creates no lesson.

## The change

For each of the 43 published lessons, record:

### 1. The class

| Class | Test |
|---|---|
| **Transpose** | Every example, corpus and quiz answer stays correct with the prose in English. |
| **Adapt** | The argument survives, but at least one corpus, example or identifier set must be swapped, and no quiz *answer* moves. |
| **Rewrite** | A quiz answer changes, or an example only teaches something in Spanish. |

The boundary that matters is adapt/rewrite: if a **quiz answer** moves, it is a rewrite, because
that is the point where translating and authoring cost the same.

### 2. The Spanish-dependent artifacts

Enumerate, with line refs, everything that is not free prose:

- **Quiz items** whose prompt, options or answer depend on Spanish. Flag the `type` — a `numeric`
  answer that counts characters is the loudest case.
- **`<PyCell>` code**: Spanish identifiers (`frases`, `pasos`, `entrena`, `escala`, `iguales`) and
  Spanish comments. Note whether any **printed output** is quoted in the prose — that decides
  whether the cell has to be re-run or merely re-read.
- **`<CodeChallenge>`**: Spanish assertion messages (`'la salida debe sumar 1'`), Spanish starter
  comments (`# tu código aquí`), and the `explanation`.
- **`<Explorable>` ids** whose widget carries a Spanish default corpus — cross-reference P11-02.
- **`<Leccion ancla="…">`** references. English headings produce different `github-slugger` ids,
  so every anchored reference needs a new anchor. Count them.
- **`reading` entries** whose `note` is Spanish (all of them) and whose source is Spanish-language
  (`lang: es`) — the latter stay, per the README's locked decision.
- **`<W>` wrapped words**: the component marks a word-as-object. Some wrap Spanish words that
  disappear in translation; others wrap terms that stay.

### 3. A one-line note for the rewrites

For every lesson classed **rewrite**, one sentence naming the replacement direction — not the
finished example, just enough that the author is not re-deriving it under time pressure. E.g.
for B1.2: *"NFC via `naïve`/`café`; clitics → contractions (`don't`) and possessives (`'s`);
recount the numeric answer."*

## Acceptance criteria

- [ ] All 43 published lessons classed, in the five block task mds
- [ ] Every lesson classed **rewrite** or **adapt** carries its artifact list with line refs
- [ ] Every lesson classed **rewrite** carries its one-line replacement note
- [ ] Per-block and phase totals recorded, so the content tasks can be sized
- [ ] The fixture (`00-pipeline-fixture.mdx`, `draft: true`) is explicitly **excluded** — it is a
      pipeline fixture, not a lesson, and it is not translated

## Test plan

None — this task produces documentation. The check is that a reader of a block md can tell,
without opening the Spanish lesson, what that lesson will cost.

## Gotchas

- **Classify against the rendered lesson, not the diff.** A lesson can be pure mathematics and
  still be a rewrite because one quiz item leans on Spanish. B1.2 is 90% transposable prose with
  three unusable quiz questions.
- **The bridge is not a free transpose.** Bridges interlock; a rewrite in lesson N changes what
  lesson N+1's pickup can state. When a rewrite lands mid-block, flag the *next* lesson as adapt
  even if its own content is transposable.
- **Do not confuse `lang: es` in `reading` with a Spanish dependency.** A Spanish-language source
  is a legitimate citation in an English lesson and stays, badge and all.

## Out of scope

- Writing any English content, or creating `content/courses/dl-nlp/en/`.
- Deciding the model per lesson — the class implies it; the mapping lives in the
  `/course-translate` command, not here.
- Re-classifying later. The class is a starting estimate; a lesson that turns out harder than its
  class is a note in the block md, not a re-run of this task.

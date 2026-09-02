# P11-06 — Block 3: Recurrent Neural Networks

**Tag:** `COURSE-P11-06` · **Size:** L · **Status:** not started

## TL;DR

Eight lessons. The most transposable block in the course: sequences, memory and the vanishing
gradient are argued in mathematics, and the widgets are numeric rather than linguistic. The
project at 3.7 is the exception — a character-level language model trains on a corpus.

## Classification

Filled by [P11-00](00-triage.md). Known hazards:

| # | Slug | Class | Known Spanish dependency |
|---|---|---|---|
| 3.1 | `por-que-falla-el-mlp` | _tbd_ | Inherits Block 2's corpus in its recap |
| 3.2 | `la-rnn-vanilla` | _tbd_ | `rnn-unrolled` widget labels (P11-02) |
| 3.3 | `bptt` | _tbd_ | Code challenge |
| 3.4 | `gradiente-desvanecido` | _tbd_ | `vanishing-gradient` widget — numeric, no corpus |
| 3.5 | `lstm` | _tbd_ | `lstm-gates` widget hints (`qué conserva` / `qué escribe` / `qué deja ver`); the plural-agreement quiz item — see below |
| 3.6 | `gru` | _tbd_ | |
| 3.7 | `proyecto-char-lm` | **adapt** | The training corpus, and every sample the prose shows the model generating |
| 3.8 | `seq2seq` | _tbd_ | Translation-pair examples |

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

**3.7's samples are the lesson.** A character-level model trained on a Spanish corpus prints
Spanish-looking gibberish, and the prose comments on what the model has learned from it —
accents, `qu`, word endings. Retrain on an English corpus and every quoted sample changes. This
is the one lesson in the block where the outputs must be regenerated rather than re-run.

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

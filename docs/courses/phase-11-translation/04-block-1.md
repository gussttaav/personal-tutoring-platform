# P11-04 — Block 1: NLP Fundamentals

**Tag:** `COURSE-P11-04` · **Size:** L · **Status:** not started

## TL;DR

Eight lessons, and the block where translation is least like translation. Block 1 teaches how
text becomes numbers, so its examples *are* a language — and the language is Spanish. Expect
mostly **rewrite**, and budget it like authoring.

## Why this block is first

It is the most expensive block and it is scheduled before the four cheaper ones on purpose.
Block 1 is where an English reader decides whether this is a course or a translated course, and
every convention the other 35 lessons inherit — the English voice, the terminology, how a
rewritten quiz item is pitched — is set by getting it right here rather than by `AUTHORING.en.md`
predicting it in the abstract.

## Classification

Filled by [P11-00](00-triage.md). Known hazards, from the planning pass:

| # | Slug | Class | Known Spanish dependency |
|---|---|---|---|
| 1.1 | `texto-como-numeros` | _tbd_ | Prose-only lesson, no widget, no code cell — the likeliest pure transpose in the block |
| 1.2 | `tokenizacion` | **rewrite** | Three of four quiz items are about Spanish: `ñ` as `n`+combining tilde (NFC), `dámelo` from `dá`/`me`/`lo`, and a `numeric` answer of **14** for `El niño juega.` Also `del`/`al` contractions in the prose, and the `tokenizer-playground` corpus |
| 1.3 | `vocabulario-oov` | _tbd_ | Vocabulary/frequency counts over a Spanish corpus; the OOV example word |
| 1.4 | `one-hot` | _tbd_ | |
| 1.5 | `bolsa-de-palabras` | _tbd_ | `bag-of-words` widget corpus |
| 1.6 | `embeddings-densos` | _tbd_ | |
| 1.7 | `word2vec` | _tbd_ | Context-window examples over Spanish sentences |
| 1.8 | `glove-y-limites` | _tbd_ | |

## Lesson progress

- [ ] 1.1 `texto-como-numeros`
- [ ] 1.2 `tokenizacion`
- [ ] 1.3 `vocabulario-oov`
- [ ] 1.4 `one-hot`
- [ ] 1.5 `bolsa-de-palabras`
- [ ] 1.6 `embeddings-densos`
- [ ] 1.7 `word2vec`
- [ ] 1.8 `glove-y-limites`

## The worked case — 1.2

The lesson survives; three quiz items do not. Replacement direction, so it is not re-derived
under time pressure:

- **NFC**: `naïve` or `café` — a diacritic with a legal decomposed form, same point, no `ñ`.
- **Subwords**: `unhappiness` → `un ##happi ##ness`, or contractions (`don't`) and possessives
  (`'s`) for the "unit smaller than a word" argument that `dámelo` was carrying.
- **The numeric item**: recount for whatever English sentence replaces `El niño juega.` The
  answer **will** change; the tolerance stays 0.

The surrounding prose changes with them — the paragraph on clíticos and `del`/`al` has no English
counterpart and is replaced by whatever the new examples earn, not padded to length.

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

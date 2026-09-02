# P11-07 — Block 4: The Bridge to Attention

**Tag:** `COURSE-P11-07` · **Size:** L · **Status:** not started

## TL;DR

Six lessons — the shortest block. Mostly **transpose**, with one structural catch: this block is
*about* translation, so several of its worked examples are Spanish–English pairs, and their
direction has to be reconsidered rather than translated.

## Classification

Filled by [P11-00](00-triage.md). Known hazards:

| # | Slug | Class | Known Spanish dependency |
|---|---|---|---|
| 4.1 | `encoder-decoder` | _tbd_ | Translation-pair examples |
| 4.2 | `el-cuello-de-botella` | _tbd_ | `context-bottleneck` widget — numeric |
| 4.3 | `la-idea-de-atencion` | _tbd_ | |
| 4.4 | `bahdanau` | **adapt** | The alignment example is the pair `<W>leí</W>` ↔ `<W>read</W>`; `attention-alignment` widget corpus |
| 4.5 | `luong` | _tbd_ | Shares 4.4's alignment example |
| 4.6 | `atencion-como-consulta` | _tbd_ | |

## Lesson progress

- [ ] 4.1 `encoder-decoder`
- [ ] 4.2 `el-cuello-de-botella`
- [ ] 4.3 `la-idea-de-atencion`
- [ ] 4.4 `bahdanau`
- [ ] 4.5 `luong`
- [ ] 4.6 `atencion-como-consulta`

## The direction decision — make it once, in 4.1

A block about machine translation needs a language pair, and the Spanish course reasonably used
Spanish→English: `leí` aligning to `read` is a clean one-to-one across a word-order change, and a
Spanish reader knows both sides.

An English reader knows only one side of that pair. Two options, and the block must pick one in
4.1 and hold it through 4.6, because 4.4 and 4.5 share the alignment example and the widget:

- **Keep Spanish→English, reframed.** The reader is the *target*-language speaker. Alignment is
  still legible — you can see which English word came from which Spanish one without speaking
  Spanish — and it costs no new widget data.
- **Switch to English→French**, or another pair whose source the reader can read.

Neither is obviously right, which is exactly why it is decided once rather than per lesson. The
constraint that decides it: whichever pair is chosen must make the **alignment heat map
off-diagonal**, or the widget stops demonstrating alignment — the same property P11-02 records
for the self-attention corpus.

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

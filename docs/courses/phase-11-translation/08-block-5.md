# P11-08 — Block 5: The Transformer

**Tag:** `COURSE-P11-08` · **Size:** L · **Status:** not started

## TL;DR

Eleven lessons — the longest block, and largely **transpose**: self-attention, multi-head,
positional encoding and the block architecture are argued in mathematics and drawn by numeric
widgets. Two exceptions: the self-attention demonstration sentence, which depends on Spanish
agreement, and the Colab hand-off at 5.11, whose notebooks live outside the content tree.

## Classification

Filled by [P11-00](00-triage.md). Known hazards:

| # | Slug | Class | Known Spanish dependency |
|---|---|---|---|
| 5.1 | `adios-recurrencia` | _tbd_ | |
| 5.2 | `self-attention` | **adapt** | The demonstration sentence `<W>las llaves del coche están ahí</W>` — see below |
| 5.3 | `scaled-dot-product` | _tbd_ | Code challenge |
| 5.4 | `multi-head` | _tbd_ | `multi-head-view` widget labels + the shared sentence |
| 5.5 | `codificacion-posicional` | _tbd_ | `positional-encoding` widget — numeric, no corpus |
| 5.6 | `bloque-transformer` | _tbd_ | |
| 5.7 | `encoder-decoder-masking` | _tbd_ | Masking legend text in the widget |
| 5.8 | `arquitectura-completa` | _tbd_ | `transformer-architecture` widget labels |
| 5.9 | `proyecto-transformer` | _tbd_ | The block's project |
| 5.10 | `bert-y-gpt` | _tbd_ | |
| 5.11 | `fine-tuning-colab` | _tbd_ | Links `docs/courses/notebooks/` — Spanish notebooks, out of scope |

## Lesson progress

- [ ] 5.1 `adios-recurrencia`
- [ ] 5.2 `self-attention`
- [ ] 5.3 `scaled-dot-product`
- [ ] 5.4 `multi-head`
- [ ] 5.5 `codificacion-posicional`
- [ ] 5.6 `bloque-transformer`
- [ ] 5.7 `encoder-decoder-masking`
- [ ] 5.8 `arquitectura-completa`
- [ ] 5.9 `proyecto-transformer`
- [ ] 5.10 `bert-y-gpt`
- [ ] 5.11 `fine-tuning-colab`

## The demonstration sentence — decided in 5.2, shared with 5.4

`las llaves del coche están ahí` is doing real work. `están` is plural, and the only plural noun
it can agree with is `llaves`, not the adjacent `coche` — so the attention map has a bright
off-diagonal cell that the prose can point at and say *this is the model resolving agreement
across an intervening noun*. It is a good example precisely because Spanish marks the agreement
loudly.

English marks it more quietly (`are` vs `is`), but the same construction exists: *the keys to the
car **are** over there* has exactly the same structure and the same attractor noun. Verify the
replacement in the rendered widget before writing the paragraph that points at it — the criterion
is that the cell the prose names is visibly the brightest in its row, not that the sentence is a
good translation.

5.4 reuses the sentence to show different heads attending differently. Pick once, in 5.2.

## 5.11 and the notebooks

The fine-tuning lesson hands off to Colab because PyTorch does not run in Pyodide — by design,
per `PLAN.md`. The notebooks under `docs/courses/notebooks/` are Spanish and are **out of scope**
for this phase: translating them is its own task with its own verification story (they have to be
executed end-to-end on Colab, which nothing in `lint:content` or `pnpm build` can check).

Translate the lesson, and have it link the Spanish notebooks, exactly as the reader's other
fallbacks work today. Note the gap in `STATUS.md` rather than leaving it implicit.

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
- [ ] **Phase exit:** `fullyTranslated` is true for `en`; no lesson route emits the fallback
      `noindex`; hreflang is reciprocal for all 43 lessons

## Test plan

- `pnpm lint:content` after each lesson; `pnpm build` before each PR.
- Read every lesson in the browser at 360px — the reader is mobile-first and English line lengths
  differ from Spanish inside the same display-maths containers.
- Run every code cell and challenge in the browser. Re-running is not optional even when only
  identifiers changed: Pyodide's BLAS differs from CPython's, and the prose quotes printed values.
- After the last lesson: confirm `/en/cursos/dl-nlp` reports no untranslated-content notice, and
  spot-check three lesson pages for `noindex` having gone and hreflang being reciprocal.

## Gotchas

- **Translating a lesson invalidates inbound anchors.** Any already-translated lesson holding
  `<Leccion slug="X" ancla="…">` breaks when X is translated. By this block most targets are
  already translated, so the effect is largest here — check the lint output, not only the diff.
- **The bridge is a contract.** Translate in order; never skip a lesson and come back.
- **Under-budget word warnings are expected** on transposed lessons — see `AUTHORING.en.md`.

## Out of scope

- Editing the Spanish lesson. If translation exposes a Spanish error, that is a separate PR.
- Changing block/order or any id.
- Widget strings and corpora — P11-02 owns those.
- The Colab notebooks — see above.

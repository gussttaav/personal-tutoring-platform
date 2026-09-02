# P11-05 — Block 2: The Multilayer Perceptron

**Tag:** `COURSE-P11-05` · **Size:** L · **Status:** not started

## TL;DR

Ten lessons, mostly **transpose** — this is where the course becomes mathematics. The one
recurring dependency is the sentiment corpus that the XOR argument and the from-scratch MLP are
both built on, plus Spanish identifiers throughout the NumPy cells.

## Classification

Filled by [P11-00](00-triage.md). Known hazards:

| # | Slug | Class | Known Spanish dependency |
|---|---|---|---|
| 2.1 | `la-neurona` | _tbd_ | |
| 2.2 | `funciones-activacion` | _tbd_ | Activation names as terms (`escalón` → *step*); widget labels (P11-02) |
| 2.3 | `xor-y-capas-ocultas` | **adapt** | The four-phrase set `"está bien" / "está mal" / "no está bien" / "no está mal"`, and the `x₁`/`x₂` semantics defined from it |
| 2.4 | `forward-pass` | _tbd_ | |
| 2.5 | `funcion-de-perdida` | _tbd_ | Code challenge with Spanish assertion messages |
| 2.6 | `descenso-gradiente` | _tbd_ | |
| 2.7 | `regla-de-la-cadena` | _tbd_ | Code challenge |
| 2.8 | `backpropagation` | _tbd_ | |
| 2.9 | `implementar-mlp` | **adapt** | Three `<PyCell>`s carrying the same corpus and Spanish identifiers: `frases`, `pasos`, `entrena`, `escala`, `iguales` |
| 2.10 | `proyecto-sentimiento` | _tbd_ | The block's project, built on the same corpus |

## Lesson progress

- [ ] 2.1 `la-neurona`
- [ ] 2.2 `funciones-activacion`
- [ ] 2.3 `xor-y-capas-ocultas`
- [ ] 2.4 `forward-pass`
- [ ] 2.5 `funcion-de-perdida`
- [ ] 2.6 `descenso-gradiente`
- [ ] 2.7 `regla-de-la-cadena`
- [ ] 2.8 `backpropagation`
- [ ] 2.9 `implementar-mlp`
- [ ] 2.10 `proyecto-sentimiento`

## The corpus decision — make it once, in 2.3

The four phrases encode a negation flip: `x₁` is +1 when *no* is present, `x₂` is +1 when the
evaluative word is positive, and the label is XOR of the two. English carries this fine —
*it's good* / *it's bad* / *not good* / *not bad* — but the choice must be made **once, in 2.3**,
and then used verbatim in 2.9 and 2.10. The three lessons quote each other's numbers.

Identifiers translate with it (`frases` → `phrases`, `pasos` → `steps`, `entrena` → `train`,
`escala` → `scale`, `iguales` → `identical`). Renaming an identifier does not change what NumPy
computes, so the printed values should be unchanged — **confirm that in the browser rather than
assuming it**, because the prose quotes them and the seed (`default_rng(0)`) is what holds them
fixed, not the variable names.

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

# P5-02 — Block 2: El Perceptrón Multicapa

**Tag:** `COURSE-P5-02` · **Effort:** XL · **Owner:** _tbd_ · **Status:** ⬜
**Depends on:** P2 (all Block 2 widgets), P3 (quizzes + challenges)

## TL;DR

Neurons, activations, forward pass, loss, gradient descent, backpropagation — then a sentiment
classifier over bag-of-words that ties it back to NLP.

**This is the hardest block to teach and the most important to get right.** A student who
genuinely understands backpropagation here can follow everything that comes after. One who
doesn't will be pattern-matching for the rest of the course.

## Lessons

| # | Slug | Title | Widgets | Code | Quiz | Challenge |
|---|---|---|---|---|---|---|
| 1 | `la-neurona` | La neurona artificial | `perceptron-boundary` | 1 | 3 | — |
| 2 | `funciones-activacion` | Funciones de activación y no linealidad | `activation-explorer` | 1 | 4 | 1 |
| 3 | `xor-y-capas-ocultas` | XOR: por qué necesitamos capas ocultas | `perceptron-boundary` | 1 | 4 | — |
| 4 | `forward-pass` | El forward pass en forma matricial | — | 2 | 4 | 1 |
| 5 | `funcion-de-perdida` | Funciones de pérdida: MSE y entropía cruzada | — | 1 | 5 | 1 |
| 6 | `descenso-gradiente` | Descenso de gradiente | `gradient-descent-2d`, `loss-landscape` | 2 | 4 | — |
| 7 | `regla-de-la-cadena` | La regla de la cadena, en serio | — | 1 | 5 | 1 |
| 8 | `backpropagation` | Backpropagation: la derivación completa | `backprop-trace` | 2 | 5 | 1 |
| 9 | `implementar-mlp` | Implementar un MLP desde cero | — | 3 | 3 | 1 |
| 10 | `proyecto-sentimiento` | Proyecto: clasificador de sentimiento | — | 3 | 3 | — |

**Lesson 7 is deliberately its own lesson.** Most courses fold the chain rule into the
backpropagation lesson and lose half the audience. Separating them means lesson 8 can be about
the *algorithm* rather than about remembering calculus.

## Lesson progress

One lesson = one PR, authored via `/course-lesson`. This task's STATUS.md row flips to ✅ **only
when every box below is ticked.** Granular progress lives here; STATUS stays phase-level.

- [ ] 1. `la-neurona` — PR:
- [ ] 2. `funciones-activacion` — PR:
- [ ] 3. `xor-y-capas-ocultas` — PR:
- [ ] 4. `forward-pass` — PR:
- [ ] 5. `funcion-de-perdida` — PR:
- [ ] 6. `descenso-gradiente` — PR:
- [ ] 7. `regla-de-la-cadena` — PR:
- [ ] 8. `backpropagation` — PR:
- [ ] 9. `implementar-mlp` — PR:
- [ ] 10. `proyecto-sentimiento` — PR:

## Mathematical content

- $z = \mathbf{W}\mathbf{x} + \mathbf{b}$, $a = \sigma(z)$; the matrix form for a batch
- Derivatives of every activation, and where each saturates
- MSE and cross-entropy, **with the derivation of why cross-entropy is right for classification**
- Softmax + cross-entropy: derive the clean $\hat{y} - y$ gradient. It looks like magic until you
  do it once, and then it never does again
- Gradient descent, learning rate, convergence, divergence
- Chain rule: single variable → multivariable → the vector/Jacobian form
- **Full backpropagation derivation** for a 2-hidden-layer network, per-layer, indices explicit
- Weight initialisation: why zeros fail (symmetry), why scale matters (a forward pointer to Block 3)

## Acceptance criteria

- [ ] All 10 lessons published, within budget
- [ ] The backprop derivation in lesson 8 is **complete** — every step, no "se puede demostrar que"
- [ ] The numbers shown by `backprop-trace` match the lesson's worked example exactly
- [ ] The lesson-9 MLP trains in Pyodide in **under 10 seconds** (the P2-03 timeout)
- [ ] The lesson-10 sentiment classifier reaches a stated accuracy on a small committed dataset, reproducibly
- [ ] Softmax + cross-entropy gradient derived, not quoted
- [ ] Lesson 3's XOR failure is shown empirically *and* argued mathematically
- [ ] All challenges have verified reference solutions
- [ ] `lint:content` green

## Test plan

- Run every cell in a production build, on desktop and on a phone. Lesson 9 and 10's training
  loops are the highest-risk cells in the whole course for the timeout.
- Verify `backprop-trace` values against the hand derivation, digit by digit.
- Time the training loops on a **mid-range phone**, not a laptop. If lesson 9 exceeds the timeout
  on mobile, shrink the dataset — do not raise the timeout.

## Notes / gotchas

- **Keep training data tiny.** A few hundred examples, low dimensionality. The point is that the
  student watches the loss fall, not that the model is good. Ship the dataset as a committed
  JSON/CSV under `public/courses/dl-nlp/`.
- Stream per-epoch loss with `print()` (P2-03 streams stdout) — watching loss fall live is the
  single most motivating moment in the course. Don't batch the output.
- Set a fixed random seed in every cell. A student re-running and getting different numbers from
  the prose will assume the lesson is wrong.
- Lessons 7–8 will be the longest. Split rather than exceed the ceiling; use `<Details>` for the
  index-heavy algebra so the flow stays readable.
- Reuse the Block 1 bag-of-words representation for lesson 10 — the callback is the point of
  putting the project here.

## Out of scope

- Optimisers beyond vanilla gradient descent + a brief mention of momentum/Adam.
- Regularisation beyond a short note (dropout, weight decay).
- Batch norm.
- Convolutional networks — not on the path to the Transformer.

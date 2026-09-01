# P5-04 — Block 4: El Puente hacia la Atención

**Tag:** `COURSE-P5-04` · **Effort:** L · **Owner:** _tbd_ · **Status:** 🔄
**Depends on:** P5-03 · Block 4 widgets (built in this task)

## TL;DR

Encoder-decoder, the fixed context vector bottleneck, and attention (Bahdanau/Luong) as the
patch for it.

**This is the hinge of the whole course.** It is also the shortest block — and the one most
courses skip, which is precisely why attention ends up feeling like it appeared from nowhere.
The Transformer only makes sense as an answer to a question, and this block is the question.

## New widgets (built here)

| Id | Purpose |
|---|---|
| `context-bottleneck` | Increase source sentence length, watch reconstruction quality fall — the bottleneck, felt |
| `attention-alignment` | Bahdanau alignment heat map over a translation pair; hover a target word, see the source it attends to |

`attention-alignment` is the visual that makes attention click. Get it right; it is reused
conceptually in Block 5.

## Lessons

| # | Slug | Title | Widgets | Code | Quiz | Challenge |
|---|---|---|---|---|---|---|
| 1 | `encoder-decoder` | La arquitectura encoder-decoder | — | 1 | 4 | — |
| 2 | `el-cuello-de-botella` | El cuello de botella del vector de contexto | `context-bottleneck` | 1 | 4 | — |
| 3 | `la-idea-de-atencion` | La idea de atención: mirar hacia atrás | `attention-alignment` | 1 | 4 | — |
| 4 | `bahdanau` | Atención de Bahdanau (aditiva) | `attention-alignment` | 2 | 5 | 1 |
| 5 | `luong` | Atención de Luong (multiplicativa) | — | 2 | 4 | 1 |
| 6 | `atencion-como-consulta` | Atención como consulta, clave y valor | — | 1 | 5 | 1 |

**Lesson 6 is the most important lesson in the course.** It reframes what lessons 4–5 built as
query/key/value — the exact vocabulary of Block 5. A student who arrives at *Attention is All You
Need* already fluent in Q/K/V finds the paper readable instead of impenetrable. Do not rush it,
and do not merge it into lesson 5.

## Lesson progress

Authored one at a time via `/course-lesson`, on the shared branch, reviewed before commit. This
task's STATUS.md row flips to ✅ **only when every box below is ticked.** Granular progress lives
here; STATUS stays phase-level.

- [x] 1. `encoder-decoder`
- [x] 2. `el-cuello-de-botella`
- [x] 3. `la-idea-de-atencion`
- [x] 4. `bahdanau`
- [x] 5. `luong`
- [x] 6. `atencion-como-consulta`

## Mathematical content

- Encoder-decoder: $\mathbf{c} = \mathbf{h}_T$, and why compressing $T$ tokens into one fixed
  vector must lose information
- Alignment scores $e_{ij} = a(\mathbf{s}_{i-1}, \mathbf{h}_j)$
- Attention weights via softmax: $\alpha_{ij} = \frac{\exp(e_{ij})}{\sum_k \exp(e_{ik})}$
- Context vector as a weighted sum: $\mathbf{c}_i = \sum_j \alpha_{ij}\mathbf{h}_j$
- **Bahdanau (additive):** $a(\mathbf{s},\mathbf{h}) = \mathbf{v}^T\tanh(\mathbf{W}_1\mathbf{s} + \mathbf{W}_2\mathbf{h})$
- **Luong (multiplicative):** $a(\mathbf{s},\mathbf{h}) = \mathbf{s}^T\mathbf{W}\mathbf{h}$, and
  why the dot product is cheaper and parallelises — a forward pointer to why the Transformer picked it
- The Q/K/V reframing; gradients flow to the attention weights too

Lesson 5's parallelisation argument is the seed of Block 5's entire motivation. Plant it clearly.

## Acceptance criteria

- [ ] All 6 lessons published, within budget
- [ ] The bottleneck is demonstrated, not merely asserted (widget + code cell)
- [ ] Both Bahdanau and Luong derived, with an explicit comparison of cost and parallelism
- [ ] Lesson 6 lands the Q/K/V reframing using the same notation the Transformer block will use
- [ ] `attention-alignment` uses a real Spanish↔English pair with an alignment that is genuinely interpretable
- [ ] Attention weights per row sum to 1 in every visualisation — verify numerically, it's the kind of bug nobody notices
- [ ] Both new widgets registered, mobile-usable, math unit-tested
- [ ] `lint:content` green

## Test plan

- Verify alignment matrices are row-stochastic in the widget unit tests.
- Check the heat map is readable at 360px — a $T \times T$ grid on a phone is the hard case here;
  scroll inside the widget frame rather than shrinking cells to invisibility.
- Run every cell in a production build.

## Notes / gotchas

- **Use precomputed alignment matrices**, not a live model. A trained attention model won't run
  in Pyodide, and the pedagogical value is entirely in the visualisation.
- Choose the translation pair carefully — an example where attention visibly does something
  interesting (reordering, a many-to-one alignment) teaches far more than a monotonic one.
- Keep the block short. Six lessons is right; padding it dilutes the hinge.
- Notation must **exactly** match what Block 5 will use ($\mathbf{Q}, \mathbf{K}, \mathbf{V}$,
  $d_k$). This block's job is to make Block 5 feel inevitable.
- Don't mention self-attention yet. Lesson 6 sets up the vocabulary; Block 5 delivers the twist
  that the query can come from the same sequence.

## Out of scope

- Self-attention, multi-head attention, positional encoding (Block 5).
- Transformer architecture of any kind.
- Coverage/copy mechanisms, pointer networks.

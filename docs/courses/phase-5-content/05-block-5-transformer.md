# P5-05 — Block 5: El Transformer

**Tag:** `COURSE-P5-05` · **Effort:** XL · **Owner:** _tbd_ · **Status:** 🔄
**Depends on:** P5-04 · Block 5 widgets (built in this task)

## TL;DR

Self-attention, multi-head attention, positional encoding, the full *Attention is All You Need*
architecture, and how BERT and GPT descend from it. Final project: a small Transformer
implemented from scratch in NumPy, plus a **Colab notebook** for fine-tuning a pretrained model.

The payoff block. Every earlier block exists to make this one land.

## New widgets (built here)

| Id | Purpose |
|---|---|
| `self-attention-heatmap` | Type a Spanish sentence, see the token-to-token attention matrix |
| `multi-head-view` | The same sentence across heads — different heads capture different relations |
| `positional-encoding` | The sinusoidal encoding as a heat map; adjust dimension and position; see the frequency structure |
| `transformer-architecture` | Clickable block diagram; click a component, read what it does and which lesson builds it |

`transformer-architecture` doubles as the block's navigation and as a revision tool once the
block is finished. It **names** each component's lesson in prose («la lección 4 de este bloque,
sobre la atención multi-head») rather than linking to it — no lesson in this course links to
another, a link would 404 for every lesson still in draft, and a named topic survives a
renumbering where an href does not. It also carries a toggle that marks the boxes which mix
positions, which is what lesson 1 leans on.

## Lessons

| # | Slug | Title | Widgets | Code | Quiz | Challenge |
|---|---|---|---|---|---|---|
| 1 | `adios-recurrencia` | Adiós a la recurrencia | `transformer-architecture` | — | 4 | — |
| 2 | `self-attention` | Self-attention: la secuencia se mira a sí misma | `self-attention-heatmap` | 2 | 5 | 1 |
| 3 | `scaled-dot-product` | Scaled dot-product: por qué dividir por √dk | — | 2 | 5 | 1 |
| 4 | `multi-head` | Multi-head attention | `multi-head-view` | 2 | 5 | 1 |
| 5 | `codificacion-posicional` | Codificación posicional | `positional-encoding` | 2 | 5 | 1 |
| 6 | `bloque-transformer` | El bloque completo: residuales y layer norm | `transformer-architecture` | 2 | 5 | 1 |
| 7 | `encoder-decoder-masking` | Encoder, decoder y máscaras | `self-attention-heatmap` | 2 | 5 | 1 |
| 8 | `arquitectura-completa` | La arquitectura completa del paper | `transformer-architecture` | 1 | 5 | — |
| 9 | `proyecto-transformer` | Proyecto: un Transformer desde cero | — | 4 | 3 | 1 |
| 10 | `bert-y-gpt` | De aquí a BERT y GPT | — | 1 | 4 | — |
| 11 | `fine-tuning-colab` | Fine-tuning en la práctica (Colab) | — | — | 3 | — |

## Lesson progress

Authored one at a time via `/course-lesson`, on the shared branch, reviewed before commit. This
task's STATUS.md row flips to ✅ **only when every box below is ticked.** Granular progress lives
here; STATUS stays phase-level.

- [x] 1. `adios-recurrencia`
- [x] 2. `self-attention`
- [x] 3. `scaled-dot-product`
- [x] 4. `multi-head`
- [x] 5. `codificacion-posicional`
- [x] 6. `bloque-transformer`
- [x] 7. `encoder-decoder-masking`
- [x] 8. `arquitectura-completa`
- [ ] 9. `proyecto-transformer`
- [ ] 10. `bert-y-gpt`
- [ ] 11. `fine-tuning-colab`

## Mathematical content

- Self-attention: $\text{Attention}(\mathbf{Q},\mathbf{K},\mathbf{V}) = \text{softmax}\!\left(\frac{\mathbf{Q}\mathbf{K}^T}{\sqrt{d_k}}\right)\mathbf{V}$
- **Derive the $\sqrt{d_k}$ scaling** — the variance argument for why unscaled dot products push
  softmax into saturation. Lesson 3 exists solely for this, and it connects directly back to
  Block 2's saturation and Block 3's vanishing gradients. It is the course's thesis in miniature
- $\mathbf{Q},\mathbf{K},\mathbf{V}$ as learned projections of the same input — the *self* in self-attention
- Multi-head: parallel heads, concatenation, output projection; parameter count vs. single head
- Sinusoidal positional encoding: $PE_{(pos,2i)} = \sin(pos/10000^{2i/d})$, and **why** sinusoids
  (relative positions expressible as a linear function of the encoding)
- Residual connections and layer norm — why they're necessary at depth (callback to Block 3's
  gradient flow argument)
- Causal masking, and how it makes the decoder autoregressive
- Complexity: $O(T^2 d)$ vs. the RNN's $O(T d^2)$, and the parallelism trade this buys

## Acceptance criteria

- [ ] All 11 lessons published, within budget
- [ ] $\sqrt{d_k}$ derived via the variance argument, not asserted
- [ ] Positional encoding's relative-position property shown, not just stated
- [ ] Lesson 9's Transformer runs in Pyodide within the timeout (forward pass at minimum; training only if it genuinely fits)
- [ ] Lesson 8 maps every component to the paper's Figure 1, so a student can read the paper afterwards
- [ ] Colab notebook (lesson 11) tested end-to-end on a free-tier GPU runtime, from a clean account
- [ ] Lesson 11 states plainly that this part does not run in the browser, and why
- [ ] All four new widgets registered, mobile-usable, math unit-tested against known values
- [ ] `self-attention-heatmap` rows sum to 1
- [ ] `lint:content` green

## Test plan

- Verify attention outputs against a reference implementation on a small fixed input — the
  `math/attention.ts` unit tests from P2-01 extend here.
- Run the lesson-9 project on a mid-range phone. If training doesn't fit the timeout, ship a
  **forward pass only** in-browser and move training to the Colab notebook. Do not raise the timeout.
- Run the Colab notebook from a fresh Google account to catch missing installs and auth prompts.

## Notes / gotchas

- **Lesson 9 is the riskiest cell in the course.** A full Transformer in NumPy in a WASM runtime
  on a phone is a lot to ask. Plan for the fallback from the start: forward pass + attention
  visualisation in-browser, training in Colab. That is a perfectly good lesson, and a timed-out
  cell is not.
- The Colab notebook lives outside this repo. **Version it deliberately** — link a specific gist
  or repo revision, not a mutable "latest", or it will rot invisibly.
- Pretrained models change and break notebooks. Pin library versions in the notebook and add a
  note to the maintenance list.
- `multi-head-view` is only convincing with genuinely different heads. Use precomputed weights
  from a real pretrained model, chosen so the heads visibly differ.
- Lesson 10 (BERT/GPT) should stay conceptual and short — it's a map of where to go next, not a
  new architecture course. Resist expansion.
- Close the course by pointing back at Block 1's *banco* example: the thing a static embedding
  couldn't do, self-attention now does. Ending where you started is worth the paragraph.

## Out of scope

- Training a Transformer at any real scale.
- Modern variants (RoPE, FlashAttention, MoE, long-context) beyond a closing mention.
- Prompt engineering, RLHF, alignment.
- Deployment / serving.

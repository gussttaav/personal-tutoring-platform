# P1-01 — Block 1: Del Transformer al modelo de lenguaje

**Tag:** `COURSE-C2-P1-01` · **Effort:** XL · **Owner:** _tbd_ · **Status:** ⬜
**Depends on:** P0-01, P0-02, P0-03, P0-04 · Block 1 widgets (built in this task)
**Course:** `llm-agents` → `content/courses/llm-agents/es/` · **Shape:** derivation
**Runs on:** the mini-GPT checkpoint (P0-03) · **Publication:** `draft: true` until the block is
complete; all nine flipped in one PR together with P2-01

## TL;DR

From the one-column Transformer the first course ended on to a *language model* the student
can hold: the causal objective, real BPE (merging, not just splitting), training a mini-GPT in
NumPy from the checkpoint, how text is sampled from it and what each token costs, how a language
model is measured, why size matters (Kaplan, Chinchilla), and the observation that closes the
block and opens the rest of the course — a large enough model does tasks nobody trained it on,
from the prompt alone. Project: the model **as a function**, `modelo(prompt) -> texto`, the object
every later block wraps.

Mathematics: **high**. This is the block that has to earn the title's first half.

## New widgets (built here)

| Id | Lesson | Purpose |
|---|---|---|
| `bpe-merges` | 2 | A Spanish sentence + a corpus; step through merges and watch the token boundaries move and the count drop. Reuses `math/bpe-vocab.ts` where it fits; the merge *training* is new |
| `sampling-explorer` | 4 | One fixed logit vector (a real one from the checkpoint, frozen) → the distribution under $\tau$, top-k, top-p; the discarded mass shown, not implied. `math/sampling.ts`, shared with `logit-mask` (Block 3) |
| `kv-cache` | 5 | Generate token by token; the cache grows, the per-step cost is drawn with and without it; toggle to see recomputation |
| `scaling-laws` | 7 | Loss vs. $N$, $D$, $C$ on log–log axes from Kaplan's and Chinchilla's fitted forms; a compute budget slider that shows the optimal $(N, D)$ split; the checkpoint's own point plotted |

## Lessons

| # | Slug | Title | Widgets | Code | Quiz | Challenge |
|---|---|---|---|---|---|---|
| 1 | `una-sola-columna` | Una sola columna: el modelo de lenguaje causal | — | — (worked on paper) | 4 | — |
| 2 | `bpe-de-verdad` | BPE de verdad: fusionar, no solo partir | `bpe-merges` | 2 | 4 | 1 |
| 3 | `entrenar-un-mini-gpt` | Entrenar un mini-GPT en NumPy | — | 3 | 4 | 1 |
| 4 | `muestreo` | Muestreo: temperatura, top-k y top-p | `sampling-explorer` | 2 | 5 | 1 |
| 5 | `kv-cache` | La caché de claves y valores: cuánto cuesta cada token | `kv-cache` | 2 | 5 | 1 |
| 6 | `perplejidad` | Perplejidad: medir un modelo de lenguaje | — | 2 | 4 | — |
| 7 | `leyes-de-escala` | Leyes de escala: Kaplan y Chinchilla | `scaling-laws` | 1 | 5 | — |
| 8 | `aprendizaje-en-contexto` | Aprendizaje en contexto: el prompt como programa | — | 2 | 4 | — |
| 9 | `proyecto-mini-gpt` | Proyecto: el modelo hecho función | — | 3 | 3 | 1 |

**Bridge in:** lesson 1 opens on `dl-nlp`'s closing bridge — «no delante de un modelo que
funciona, sino delante de un artículo que puedes discutir» — and on `bert-y-gpt`'s choice of one
column and every mask, by `<Leccion curso="dl-nlp" …>` reference. It is the free sample lesson
and the first impression, so like the first course's lesson 1 it is **code-free**: the worked
example is the loss of a four-token sequence, by hand.

**Bridge out:** lesson 9 ends on the gap Block 2 exists for: the function completes text, it does
not answer. Give it a question and it continues the question.

## Lesson progress

Authored one at a time via `/course-lesson`, on the shared branch, reviewed before commit. This
task's STATUS.md row flips to ✅ **only when every box below is ticked.** Granular progress lives
here; STATUS stays phase-level.

- [x] 1. `una-sola-columna`
- [x] 2. `bpe-de-verdad`
- [x] 3. `entrenar-un-mini-gpt`
- [ ] 4. `muestreo`
- [ ] 5. `kv-cache`
- [ ] 6. `perplejidad`
- [ ] 7. `leyes-de-escala`
- [ ] 8. `aprendizaje-en-contexto`
- [ ] 9. `proyecto-mini-gpt`

## Mathematical content

- The causal factorisation $p_\theta(x_{1:T}) = \prod_{t} p_\theta(x_t \mid x_{<t})$, and the loss
  as the mean negative log-likelihood. **Show** that the causal mask is what lets all $T$
  conditionals be trained in one forward pass (teacher forcing, a `dl-nlp` callback by reference)
- BPE as greedy pair merging; the vocabulary as a compression of the corpus; the trade
  $|V|$ vs. sequence length, with the first course's $\bar{\ell}$ and Heaps' law returning
- Training: windows, batch, cross-entropy; AdamW **stated** (the blog post on AdamW is the
  `reading` entry — `kind: blog`, the first internal one); warm-up and decay stated, not derived
- Temperature: $\text{softmax}(\mathbf{z}/\tau)$, with the limits $\tau \to 0$ (argmax) and
  $\tau \to \infty$ (uniform) **derived**; top-k and top-p as truncation + renormalisation; **why
  greedy repeats** — a high-probability loop is a fixed point of argmax — is an argument, not a
  remark (Holtzman)
- KV cache: per-step cost $O(t\,d)$ with the cache vs. $O(t^2 d)$ without; totals over $T$
  steps $O(T^2 d)$ vs. $O(T^3 d)$ — **derived**, and the memory $2 L T d$ floats per sequence,
  which is the number Block 3's context lesson and Block 5's compaction lesson both quote
- Perplexity $= \exp(\bar{\mathcal{L}})$; bits per byte as the tokeniser-independent comparison;
  held-out vs. training; the unigram baseline the student computes
- Scaling: power-law fits $L(N) = (N_c/N)^{\alpha_N}$ and $L(D)$; the log–log linear regression
  the student runs on given points; $C \approx 6ND$; Chinchilla's $D \approx 20N$; and **the
  checkpoint's own ratio** — a "cuentas" lesson, as `fine-tuning-colab` was
- In-context learning: the prompt as conditioning — $p_\theta(y \mid \text{ejemplos}, x)$ — and the
  honest statement that the mini-GPT cannot do it and why (lesson 7's axes)

## Acceptance criteria

- [ ] All 9 lessons published as a unit, within budget, six-step structure per P0-04
- [ ] Lesson 1 code-free; it is the sample lesson the landing links
- [ ] Every cell runs from the P0-03 checkpoint **in the browser** under the cap; lessons quote
      Pyodide's numbers
- [ ] Greedy repetition (lesson 4) is *shown* on the checkpoint, and top-p *fixes* it — the P0-03
      properties 2 and 3, on the page
- [ ] KV-cache complexity derived, and the widget's per-step cost matches the derivation
- [ ] Lesson 7's fit reproduces Chinchilla's 20:1 within the tolerance the lesson states
- [ ] Lesson 8 says the mini-GPT cannot do in-context learning, with the reason
- [ ] Lesson 9 freezes the `modelo(prompt, ...) -> texto` interface that Block 2 imports
- [ ] The four widgets registered, bilingual, maths unit-tested against the prose's numbers
- [ ] `curso=` references resolve; `lint:content` green

## Test plan

- Read every lesson on a phone. Run every cell in a production build, on a phone.
- The `sampling-explorer`'s frozen logit vector is *from the checkpoint*, asserted in
  `math/__tests__/sampling.test.ts` against a value the lesson prints.
- Someone who finished `dl-nlp` reads lessons 1–3 and reports where the callbacks assume too much.

## Notes / gotchas

- **Lesson 3 is the riskiest cell of the block.** Continuing training for 200 steps must show a
  loss that moves; if the checkpoint is already at its floor for that corpus, ship the checkpoint
  a few hundred steps *short* of convergence (P0-03 decides this — say it there).
- **Spanish text in every example.** The corpus is Spanish; the prompts are Spanish; the BPE
  demo merges Spanish bigrams (`qu`, `ción`, `ñ` as two bytes — a genuinely good teaching case).
- Do not explain the Transformer again. A `<Leccion curso="dl-nlp">` reference and one sentence.
  A reader who needs more has the previous course one hover away.
- Lesson 7 has almost no code on purpose. It is the cheapest lesson in the block and one of the
  most important; resist making it a widget showcase.
- `kv-cache` and `sampling-explorer` are the two widgets most likely to grow. Cap them at the
  budget; the derivation carries the lesson.

## Out of scope

- Any architecture beyond the decoder-only Transformer already built (RoPE, GQA, MoE) — a
  closing mention in `reading`.
- Mixed precision, distributed training, real tokeniser libraries.
- Instruction following of any kind — Block 2.

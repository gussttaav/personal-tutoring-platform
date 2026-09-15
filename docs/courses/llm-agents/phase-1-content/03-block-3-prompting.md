# P1-03 — Block 3: Hablar con el modelo es programar

**Tag:** `COURSE-C2-P1-03` · **Effort:** L · **Owner:** _tbd_ · **Status:** ⬜
**Depends on:** P1-02 · Block 3 widgets (built in this task)
**Course:** `llm-agents` → `content/courses/llm-agents/es/` · **Shape:** derivation → systems
**Runs on:** the **scripted model** from lesson 18; the mini-GPT where the mechanism is
model-agnostic (20, 21) · **Publication:** lesson by lesson

## TL;DR

What you put in the prompt, and what the model does with it: the prompt as a specification,
chain-of-thought explained from autoregression (more tokens is more compute — it connects to
Block 1's cost per token), structured output as constrained decoding **implemented on the
mini-GPT** by masking logits, retrieval (closing the circle with the first course's Block 1 and
with BERT), the context window as a scarce resource ($T^2$ returns), and evaluation — exact
tests, a model as judge, and the traps. Project: an assistant that retrieves, answers in a
format, and is measured.

This block **introduces the scripted model** — the second implementation of `modelo` — and says
why in its first lesson: the mini-GPT is too small to follow an instruction, and what this block
teaches happens *around* the model, so a deterministic one is the honest instrument.

Mathematics: **medium**, and the block says so at the top.

## New widgets (built here)

| Id | Lesson | Purpose |
|---|---|---|
| `logit-mask` | 20 | A grammar (a tiny JSON schema) and the checkpoint's distribution at each position; the allowed set $A_t$ masks it; the renormalised distribution beside the raw one. Shares `math/sampling.ts` with `sampling-explorer` |
| `context-window` | 22 | The window as one bar: system prompt, examples, retrieved passages, history, output — each a segment; a budget slider; what falls off. Reused in 30 and 36 |

## Lessons

| # | Slug | Title | Widgets | Code | Quiz | Challenge |
|---|---|---|---|---|---|---|
| 18 | `el-prompt-es-una-especificacion` | El prompt es una especificación | — | 1 | 4 | — |
| 19 | `cadena-de-pensamiento` | Cadena de pensamiento: más tokens, más cómputo | — | 1 | 4 | — |
| 20 | `salida-estructurada` | Salida estructurada: decodificación restringida | `logit-mask` | 2 | 4 | 1 |
| 21 | `recuperacion` | Embeddings y recuperación: darle al modelo lo que no sabe | — | 2 | 4 | 1 |
| 22 | `ventana-de-contexto` | La ventana de contexto es un recurso escaso | `context-window` | 1 | 4 | — |
| 23 | `evaluar` | Evaluar: pruebas exactas, jueces y sus trampas | — | 2 | 4 | 1 |
| 24 | `proyecto-asistente` | Proyecto: un asistente que recupera, responde en formato y se mide | — | 3 | 3 | 1 |

**Bridge in:** lesson 18 picks up Block 2's close — an instruction-tuned model answers from its
weights, unchecked — and introduces the scripted model in its first cell, with the reason.

**Bridge out:** lesson 24 ends on the assistant's limit: it can *say* what to do and cannot *do*
it. Nothing it outputs touches the world. That is the bridge block.

## Lesson progress

- [ ] 18. `el-prompt-es-una-especificacion`
- [ ] 19. `cadena-de-pensamiento`
- [ ] 20. `salida-estructurada`
- [ ] 21. `recuperacion`
- [ ] 22. `ventana-de-contexto`
- [ ] 23. `evaluar`
- [ ] 24. `proyecto-asistente`

## Mathematical content

- The prompt as conditioning: $p_\theta(y \mid s, e_{1:k}, x)$ — system, examples, input — and
  the claim, stated with Block 1's ICL lesson behind it, that this is programming a fixed function
  by its argument
- Chain of thought from autoregression: a fixed amount of compute per token, so the compute
  available for an answer is proportional to the tokens generated before it; **cost per token
  from lesson 5 returns as a bill**; the bounded-depth-per-token argument as a `reading` signpost
- Constrained decoding: $A_t \subseteq V$ from a grammar; the masked softmax **is** the
  conditional distribution renormalised on $A_t$ — one line, but it is the line; versus rejection
  sampling, whose expected number of tries is $1/P(\text{válido})$ — computed on the checkpoint
- Retrieval: an embedding of a query and of each passage, cosine similarity (the first course's,
  by reference), top-$k$; the prompt budget it spends; the difference between *retrieved* and
  *known*
- The context window: attention's $T^2$ and the cache's $2LTd$ **from lesson 5, as a budget**;
  truncation vs. summarisation; «lost in the middle» stated as an empirical finding with its source
- Evaluation: accuracy on $n$ items with a **confidence interval** (the Wilson interval, derived
  briefly, or the normal approximation with its failure at small $n$ shown); contamination;
  judge agreement (Cohen's $\kappa$, stated)

## Acceptance criteria

- [ ] All 7 lessons published, within budget
- [ ] Lesson 18 introduces `ModeloGuionizado` with the reason, and every later lesson names
      which model it runs on
- [ ] Constrained decoding runs on the checkpoint: a JSON object the raw model would not
      produce, produced under the mask; the rejection-sampling try count printed
- [ ] Retrieval runs on the corpus with whichever embedding the checkpoint supports honestly
      (see gotchas), and the lesson says which
- [ ] Lesson 23's harness is the one Block 5's benchmark lesson imports in spirit: a list of
      items, a scorer, a number with an interval
- [ ] Project (24) is testable by `<CodeChallenge>` because the model is scripted
- [ ] Both widgets registered, bilingual, maths unit-tested
- [ ] `lint:content` green

## Test plan

- Every cell on a phone. `math/__tests__/sampling.test.ts` extends with the mask cases.
- The confidence-interval numbers in lesson 23 checked against a reference implementation.

## Notes / gotchas

- **Embeddings for lesson 21:** mean-pooled final hidden states of the checkpoint over corpus
  sentences are *an* embedding and the neighbours on the training corpus will be meaningful
  enough to show. If they are not, TF-IDF from the first course is the honest retriever and the
  lesson says the model's embeddings are the production version. Decide with the checkpoint in
  hand, not in this doc.
- The scripted model is a Python class of ~30 lines: a list of turns, a pointer, a `__call__`
  that returns the next authored response and raises if the conversation deviates. Its
  determinism is the feature; do not make it "smart".
- Lesson 19 is a temptation to over-promise. The mini-GPT shows *cost*, not *reasoning*; the
  claim that chain-of-thought helps is cited, not demonstrated. Say which.
- `context-window` is the widget three blocks share. Build it general (segments with labels and
  sizes) the first time.

## Out of scope

- Prompt-engineering folklore ("act as…", role prompts). A specification is a specification.
- Vector databases, chunking strategies, rerankers.
- Long-context architectures.

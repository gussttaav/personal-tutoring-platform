# P5-03 — Block 3: Redes Neuronales Recurrentes

**Tag:** `COURSE-P5-03` · **Effort:** XL · **Owner:** _tbd_ · **Status:** 🔄
**Depends on:** P5-02 · Block 3 widgets (built in this task, on the P2-01 registry)

## TL;DR

Why the MLP fails on sequences, the vanilla RNN, backpropagation through time, the vanishing
gradient problem **derived properly**, and LSTM/GRU as the response. Project: a character-level
language model.

## New widgets (built here)

| Id | Purpose |
|---|---|
| `rnn-unrolled` | Step through a sequence; watch the hidden state evolve; toggle the unrolled view |
| `vanishing-gradient` | Gradient magnitude vs. timestep distance, with adjustable spectral radius — makes the exponential decay *visible* |
| `lstm-gates` | Feed a sequence, watch forget/input/output gates open and close per timestep |

`vanishing-gradient` is the one that earns its keep: the exponential term in the BPTT product is
abstract on the page and obvious on a chart.

## Lessons

| # | Slug | Title | Widgets | Code | Quiz | Challenge |
|---|---|---|---|---|---|---|
| 1 | `por-que-falla-el-mlp` | Por qué el MLP falla con secuencias | — | 1 | 4 | — |
| 2 | `la-rnn-vanilla` | La RNN vanilla | `rnn-unrolled` | 2 | 4 | 1 |
| 3 | `bptt` | Backpropagation through time | `rnn-unrolled` | 1 | 5 | 1 |
| 4 | `gradiente-desvanecido` | El gradiente que se desvanece | `vanishing-gradient` | 2 | 5 | — |
| 5 | `lstm` | LSTM: memoria con compuertas | `lstm-gates` | 2 | 5 | 1 |
| 6 | `gru` | GRU: la versión simplificada | `lstm-gates` | 1 | 4 | 1 |
| 7 | `proyecto-char-lm` | Proyecto: modelo de lenguaje a nivel de carácter | — | 3 | 3 | — |
| 8 | `seq2seq` | Seq2seq: de secuencia a secuencia | — | 2 | 4 | — |

**Bridge out:** lesson 8 introduces the encoder-decoder and ends on the fixed context vector —
one vector must carry an entire sentence. That is the exact problem Block 4 opens with.

## Lesson progress

Authored one at a time via `/course-lesson`, on the shared branch, reviewed before commit. This
task's STATUS.md row flips to ✅ **only when every box below is ticked.** Granular progress lives
here; STATUS stays phase-level.

- [x] 1. `por-que-falla-el-mlp`
- [x] 2. `la-rnn-vanilla`
- [x] 3. `bptt`
- [ ] 4. `gradiente-desvanecido`
- [ ] 5. `lstm`
- [ ] 6. `gru`
- [ ] 7. `proyecto-char-lm`
- [ ] 8. `seq2seq`

## Mathematical content

- $\mathbf{h}_t = \tanh(\mathbf{W}_{hh}\mathbf{h}_{t-1} + \mathbf{W}_{xh}\mathbf{x}_t + \mathbf{b}_h)$
- Parameter sharing across timesteps, and why it is what makes an RNN an RNN
- **Full BPTT derivation** — the gradient as a sum over timesteps
- The vanishing/exploding gradient: the $\prod \mathbf{W}_{hh}^{\top} \text{diag}(\tanh')$ term, and
  the spectral-radius argument for why it decays or explodes exponentially
- Gradient clipping
- LSTM: all four gate equations plus the cell state, with **why the additive cell path preserves
  gradient** — this is the whole point of the LSTM and is usually glossed
- GRU equations, and the parameter-count comparison

Lesson 4 is where Block 2's `activation-explorer` saturation regions pay off. Reference it
explicitly — the student has already *seen* $\sigma' \approx 0$.

## Acceptance criteria

- [ ] All 8 lessons published, within budget
- [ ] BPTT derived completely, including the sum over timesteps
- [ ] The vanishing gradient is derived **and** shown numerically in a code cell
- [ ] The LSTM's additive cell-state path is explained as the gradient fix, not just described
- [ ] Character-level LM trains in Pyodide within the timeout and generates recognisably
      text-like output (it will be bad — say so explicitly; that honesty is the lesson)
- [ ] Lesson 8 ends squarely on the context-vector bottleneck
- [ ] All three new widgets registered, keyboard-operable, mobile-usable, math unit-tested
- [ ] `lint:content` green

## Test plan

- Time the lesson-7 training loop on a mid-range phone. This is the most computationally
  demanding cell in the course; if it can't fit the timeout, shrink the corpus and the hidden
  size rather than raising the limit.
- Verify the vanishing-gradient code cell reproduces the numbers in the prose.
- Widget math unit tests per P2-01 conventions.

## Notes / gotchas

- **Character-level, small corpus, small hidden state.** A few thousand characters. Generating
  mediocre text quickly beats generating good text never — and honestly naming the output as bad
  builds more trust than overselling it.
- Seed everything. Generated text differing from the prose reads as a broken lesson.
- The LSTM has four gates and a cell state; presented as a wall of equations it is hopeless.
  Introduce one gate at a time, each motivated by a concrete failure of the previous version.
- Don't cover bidirectional RNNs, stacked RNNs or attention here. Attention is Block 4 and
  arriving early would undercut the bridge Block 4 exists to build.
- `vanishing-gradient` should let the spectral radius go **above** 1 too — exploding gradients are
  half the phenomenon and are usually shown only as a footnote.

## Out of scope

- Bidirectional and deep/stacked RNNs (mention only).
- Attention (Block 4).
- Teacher forcing beyond a brief note in lesson 8.
- Beam search decoding.

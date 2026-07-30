# NOTATION.md — the notation contract for `dl-nlp`

**Tag:** `COURSE-P5-00` · Companion to [AUTHORING.md](AUTHORING.md)

This file fixes the mathematical notation for the **whole course**, all five blocks. It is not a
style preference. A student who learns $\mathbf{W}^{(l)}$ in Block 2 and meets $W^l$ in Block 5
cannot tell whether the difference *means* something — and spends attention on that instead of on
self-attention. Notation drifting between the early and late blocks is a real and common failure in
deep learning courses, and it is exactly what makes a rigorous course *feel* unrigorous.

Across ~40 lessons written over months, review alone will not hold this. Part of it is checked
mechanically — see [the machine-checked rules](#the-machine-checked-rules) at the bottom.

**If a lesson needs a symbol that is not here, add it here first.** That is the whole mechanism.

---

## 1. Typography

| Kind | Form | Example |
|---|---|---|
| Scalar | italic lowercase | $x$, $y$, $\eta$, $b$ |
| Vector | **bold** lowercase, `\mathbf` | $\mathbf{x}$, $\mathbf{h}$, $\mathbf{b}$ |
| Matrix | **bold** uppercase, `\mathbf` | $\mathbf{W}$, $\mathbf{X}$, $\mathbf{Q}$ |
| Set | italic uppercase | $V$, $D$, $\mathbb{R}$ |
| Function / operator | roman | $\text{softmax}$, $\text{tf-idf}$, $\log$ |
| Loss | calligraphic | $\mathcal{L}$ |

Always `\mathbf`. **Never** `\bf`, `\textbf`, `\boldsymbol` or `\vec` — four spellings of one idea is
three too many, and they do not all render the same.

Multi-letter names inside maths go in `\text{}`: $d_{\text{model}}$, not $d_{model}$ (which KaTeX
sets as the product $d \cdot m \cdot o \cdot d \cdot e \cdot l$).

## 2. Indices, layers and time

- **Layer** is a superscript in parentheses: $\mathbf{W}^{(l)}$, $\mathbf{h}^{(l)}$. Never $W^l$.
- **Element** is a subscript: $\mathbf{W}^{(l)}_{ij}$ — row $i$, column $j$.
- **Time step / sequence position** is a subscript: $\mathbf{h}_t$, $x_t$. Never $h^t$.
- **Example index** in a dataset is a superscript in parentheses too: $\mathbf{x}^{(i)}$. Where both
  appear, the context disambiguates and the lesson says which it means, in words, once.
- **Transpose** is `^{\top}`: $\mathbf{x}^{\top}$. Never $\mathbf{x}^T$, $x'$ or $x^t$.

## 3. Shapes — the batch dimension is first, always

Every array in this course is written batch-first, matching what the student will type in NumPy and
PyTorch:

$$
\mathbf{X} \in \mathbb{R}^{B \times T \times d_{\text{model}}}
$$

$B$ batch, $T$ sequence length, $d_{\text{model}}$ features. **Say the shape** whenever a new array
appears — most of the confusion in this material is shape confusion, and stating shapes is the
cheapest fix available.

A layer's weight matrix maps *input to output*: $\mathbf{W}^{(l)} \in \mathbb{R}^{d_{\text{out}}
\times d_{\text{in}}}$, so $\mathbf{h}^{(l)} = \sigma\left(\mathbf{W}^{(l)} \mathbf{h}^{(l-1)} +
\mathbf{b}^{(l)}\right)$ for a single example. When a lesson switches to the batched form
$\mathbf{H} \mathbf{W}^{\top}$, it says so explicitly.

## 4. Reserved symbols — never reuse these for anything else

| Symbol | Meaning |
|---|---|
| $\mathcal{L}$ | the loss (objective being minimised) |
| $\eta$ | learning rate |
| $\sigma$ | the logistic sigmoid, $\sigma(x) = 1/(1+e^{-x})$ |
| $\theta$ | all model parameters, collectively |
| $\nabla$ | gradient — $\nabla_{\theta}\mathcal{L}$ |
| $B$ | batch size |
| $T$ | sequence length |
| $d_{\text{model}}$ | model / embedding dimension |
| $h$ | number of attention heads |
| $L$ | number of layers |
| $V$ | the vocabulary (a set); $\lvert V \rvert$ its size |

$L$ is the layer **count**; the loss is $\mathcal{L}$. They look alike on purpose in most
textbooks and it is a genuine trap — when a lesson uses both in one equation, it names them in
prose immediately after.

## 5. Per-block symbols

### Block 1 — Fundamentos de NLP

| Symbol | Meaning |
|---|---|
| $V$, $\lvert V \rvert$ | vocabulary, vocabulary size |
| $w$, $t$ | a word / a term |
| $d$, $D$, $N$ | a document, the corpus, $\lvert D \rvert$ |
| $\text{tf}(t,d)$, $\text{df}(t)$ | term frequency, document frequency |
| $\mathbf{e}_w \in \mathbb{R}^{d_{\text{model}}}$ | the embedding of word $w$ |
| $\mathbf{o}_w \in \{0,1\}^{\lvert V \rvert}$ | one-hot encoding of $w$ |
| $\cos(\mathbf{u}, \mathbf{v})$ | cosine similarity |
| $c$ | a context word (Word2Vec) |
| $X_{ij}$ | co-occurrence count of words $i$ and $j$ (GloVe) |

### Block 2 — El Perceptrón Multicapa

| Symbol | Meaning |
|---|---|
| $\mathbf{W}^{(l)}$, $\mathbf{b}^{(l)}$ | weights and bias of layer $l$ |
| $\mathbf{z}^{(l)}$ | pre-activation, $\mathbf{W}^{(l)}\mathbf{h}^{(l-1)} + \mathbf{b}^{(l)}$ |
| $\mathbf{h}^{(l)}$ | activation, $\sigma(\mathbf{z}^{(l)})$; $\mathbf{h}^{(0)} = \mathbf{x}$ |
| $\hat{\mathbf{y}}$, $\mathbf{y}$ | prediction, target |
| $\boldsymbol{\delta}^{(l)}$ | $\partial\mathcal{L}/\partial\mathbf{z}^{(l)}$, the backprop error signal |
| $\sigma$, $\tanh$, $\text{ReLU}$ | activations |

$\boldsymbol{\delta}$ is the **one** allowed `\boldsymbol`, because `\mathbf` does not embolden
Greek letters in KaTeX. It is the exception that proves the rule; do not extend it to Latin letters.

### Block 3 — Redes Neuronales Recurrentes

| Symbol | Meaning |
|---|---|
| $\mathbf{h}_t$ | hidden state at step $t$ |
| $\mathbf{c}_t$ | LSTM cell state |
| $\mathbf{W}_{hh}$, $\mathbf{W}_{xh}$, $\mathbf{W}_{hy}$ | recurrent, input and output weights |
| $\mathbf{f}_t$, $\mathbf{i}_t$, $\mathbf{o}_t$ | LSTM forget, input and output gates |
| $\mathbf{r}_t$, $\mathbf{z}_t$ | GRU reset and update gates |
| $\odot$ | element-wise (Hadamard) product |

### Block 4 — El Puente hacia la Atención

| Symbol | Meaning |
|---|---|
| $\mathbf{s}_i$ | decoder state at output step $i$ |
| $\bar{\mathbf{h}}_j$ | encoder state at input step $j$ |
| $e_{ij}$ | alignment score between $\mathbf{s}_{i-1}$ and $\bar{\mathbf{h}}_j$ |
| $\alpha_{ij}$ | attention weight, $\text{softmax}_j(e_{ij})$ |
| $\mathbf{c}_i$ | context vector, $\sum_j \alpha_{ij} \bar{\mathbf{h}}_j$ |

$\mathbf{c}$ is the context vector here and the LSTM cell state in Block 3. That collision is
inherited from the literature; Block 4 names it in prose the first time it appears.

### Block 5 — El Transformer

Matching *Attention is All You Need*, deliberately — Block 5 exists partly so the student can then
go and read the paper, and a different notation would tax exactly that.

| Symbol | Meaning |
|---|---|
| $\mathbf{Q}$, $\mathbf{K}$, $\mathbf{V}$ | queries, keys, values |
| $d_k$, $d_v$ | key/query and value dimension |
| $d_{\text{model}}$ | model dimension |
| $h$ | number of heads; $d_k = d_{\text{model}}/h$ |
| $\mathbf{W}^Q_i, \mathbf{W}^K_i, \mathbf{W}^V_i$ | per-head projections |
| $\mathbf{W}^O$ | output projection |
| $PE_{(pos, 2i)}$ | positional encoding |
| $T$ | sequence length |

$$
\text{Attention}(\mathbf{Q}, \mathbf{K}, \mathbf{V}) =
\text{softmax}\!\left(\frac{\mathbf{Q}\mathbf{K}^{\top}}{\sqrt{d_k}}\right)\mathbf{V}
$$

Note the one deviation from the paper: superscripts on $\mathbf{W}^Q$ are **projection labels**, not
layer indices. Block 5 says so where it introduces them, because it is the single place in the
course where a superscript is not a layer.

---

## The machine-checked rules

`pnpm lint:content` warns (never fails) on the subset of this contract that is decidable from the
source. Implemented in [`src/lib/courses/validate-notation.ts`](../../src/lib/courses/validate-notation.ts):

| Rule | Fires on | Wanted |
|---|---|---|
| `bold` | `\bf`, `\textbf{`, `\boldsymbol{`, `\vec{` | `\mathbf{…}` |
| `matrix-bold` | a bare `W` in maths | `\mathbf{W}` |
| `layer-index` | `^l`, `^{l}`, `^{l+1}` | `^{(l)}` |
| `d-model` | `d_model`, `d_{model}` | `d_{\text{model}}` |
| `transpose` | `^T`, `^{T}`, `^t` | `^{\top}` (time is a subscript) |

The ruleset is small **on purpose**. Whether a bare $x$ is a scalar (correct) or a vector that
should be $\mathbf{x}$ (wrong) is not decidable without knowing what the lesson means, and a rule
that fires on correct lessons is a rule authors learn to skip past — which costs more than not
having it, because it also teaches them to skip the rules that are right. Five rules that are always
right beat twenty that are usually right. New rules go in only when they meet that bar.

Everything else in this file is enforced by reading the lesson. Summation limits (`\sum_{t=1}^{T}`)
are stripped before the rules run, so the correct form never trips the transpose rule.

The `\boldsymbol{\delta}` exception above **will** trip the `bold` rule. That is acceptable: it is
one warning, in the lessons that derive backpropagation, on a line that is deliberately correct.
Note it in the PR and move on.

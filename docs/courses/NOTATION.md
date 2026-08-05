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
| $\Sigma$ | the character alphabet |
| $\Sigma^{*}$, $\Sigma^{+}$ | all finite strings over $\Sigma$; the same without the empty string |
| $\lvert u \rvert$ | length of the string $u$, in characters |
| $\tau : \Sigma^{*} \to V^{*}$ | a tokeniser — a string to a sequence of tokens |
| $r : V \to \mathbb{R}^{d}$ | a representation function: one token to one vector |
| $d$, $D$, $N$ | a document, the corpus, $\lvert D \rvert$ |
| $T_d$ | number of token occurrences in the document $d$ |
| $C$ | corpus length, in characters |
| $\bar{\ell}$ | mean token length, in characters |
| $M$ | number of distinct types in the corpus |
| $f_i$ | frequency of the $i$-th most frequent type |
| $k$ | vocabulary cutoff — the $k$ most frequent types |
| $\text{cob}(k)$ | coverage: the fraction of occurrences those $k$ types account for |
| $\beta$ | Heaps' law exponent, $M \approx c \cdot T^{\beta}$ ($c$ a corpus constant) |
| $T'$, $M'$, $U$ | the same counts on a *held-out* text: its tokens, its types, and the set of them |
| $\texttt{<UNK>}$ | the token every out-of-vocabulary word collapses onto |
| $\text{tf}(t,d)$, $\text{df}(t)$ | term frequency, document frequency |
| $\text{idf}(t)$, $\text{tfidf}(t,d)$ | inverse document frequency, and the weight built from the two |
| $\mathbf{x}_d \in \mathbb{R}^{\lvert V \rvert}$ | the vector of the document $d$ — counts in a bag of words, weights in TF-IDF |
| $\mathbf{e}_w \in \mathbb{R}^{d_{\text{model}}}$ | the embedding of word $w$ |
| $\mathbf{o}_w \in \{0,1\}^{\lvert V \rvert}$ | one-hot encoding of $w$ |
| $\cos(\mathbf{u}, \mathbf{v})$ | cosine similarity |
| $c$ | a context word (Word2Vec) |
| $X_{ij}$ | co-occurrence count of words $i$ and $j$ (GloVe) |

**The corpus is not the alphabet**, and a lesson that uses both says so — they are both "characters",
which is exactly why the confusion is easy. $\Sigma$ is a *set* of distinct symbols. The corpus $D$
is a **collection of documents**, each document an element of $\Sigma^{*}$ — ordered, full of
repetitions, and plural: it is not one long string, even where an argument treats it as though the
documents were concatenated. Its size therefore has two measures: $C$ counts characters across the
whole corpus, $N = \lvert D \rvert$ counts documents. A lesson using both names which it means.

The bars are **"how many"** in both of their uses — elements of a set in $\lvert V \rvert$,
characters of a string in $\lvert u \rvert$ — and a lesson that writes both says that out loud the
first time, in one clause. They are not two notations; reading them as one is what keeps
$\sum_i \lvert u_i \rvert = C$ from looking like a new symbol.

The star is the **Kleene star**, and it applies to any set, not just to $\Sigma$: $V^{*}$ is the
finite sequences of tokens. It is not a course prerequisite — the prerequisites are Python, linear
algebra and calculus — so the lesson that first writes it **defines it in prose**, in one sentence,
before the equation that uses it. Block 1 lesson 2, on tokenisation, is that lesson.

**Rank is $i$, never $r$.** Ordering the types from most to least frequent gives each one a
position, and the obvious letter for it is taken: $r$ is the representation function
$r : V \to \mathbb{R}^{d}$ for the whole of Block 1, and the lesson that ranks types is also the
lesson that has to keep $r$ total. So the rank is $i$ and the frequency at that rank is $f_i$.

**$T$ counts occurrences, $M$ counts types**, and the distinction is the whole subject of Block 1
lesson 3. $T$ is what $\tau$ produces over the corpus — every repetition of *de* counted again —
while $M$ is how many *distinct* strings appear among them, so $M \leq T$ always and in
practice $M \ll T$. A lesson using both says which it means the first time, in words: the reader
who has just met $\lvert V \rvert$ will otherwise assume $M$ is a third name for the same thing.
It is not — $M$ belongs to the corpus, $\lvert V \rvert$ to the vocabulary someone chose from it.

**A prime means "measured on a held-out text", never a derivative.** $T'$ and $M'$ are the token and
type counts of a text the vocabulary did not see, against the unprimed $T$ and $M$ of the corpus that
built it — the only comparison in which an OOV rate means anything. Nothing in Block 1 differentiates,
so the notation is free; a later block that needs a derivative writes $\frac{d}{dx}$, which is the
course's form anyway.

**Counting sets: the bars, and what is inside them.** Write $\lvert \cdot \rvert$ for "how many", never
$\#$ — one notation for one idea, and $\lvert V \rvert$ already established it. The rule that actually
bites is what the set ranges over, because the same-looking expression counts two different things:
$\lvert\{\,t \le T' : w_t \notin V\,\}\rvert$ is a set of **positions** and counts occurrences, while
$\lvert\{\,w \in U : w \notin V\,\}\rvert$ is a set of **strings** and counts types. Dropping the index
turns the first into the second silently. Always state the domain — $t \le T'$ or $w \in U$ — even
where it feels obvious.

**Coverage is $\text{cob}(k)$ — never $\text{cov}(k)$, and never $C(k)$.** Both of the obvious
spellings are taken. $\text{cov}$ is the covariance everywhere else in maths and statistics, and a
reader meets it here in the one lesson whose whole argument is about a *distribution* — precisely the
context that makes the wrong reading plausible. $C$ is already the corpus length in characters, two
rows up in this table and load-bearing throughout lesson 2 ($T = C/\bar{\ell}$); reusing it for a
function one lesson later is the drift this file exists to prevent, and italic uppercase means a
**set** by §1 anyway, not a function. `cob` collides with nothing, stays roman as §1 requires for
functions, and the lesson introduces it in the same breath as the Spanish word it abbreviates.

**$t$ is a term inside $\text{tf}(t,d)$ and $\text{df}(t)$, and a position everywhere else.** §2
fixes the sequence position as a subscript $t$, and Block 1 lesson 4 already writes
$\sum_{t=1}^{T}\mathbf{o}_{w_t}$ over the positions of a document; the TF-IDF row above fixes the
other reading, and both spellings are the ones the literature uses. Block 1 lesson 5, on the bag of
words, is the one lesson that needs both: it writes the sum over positions first, **says at the
switch which $t$ it means from then on**, and uses $t$ for the term for the rest of the file. Any
later lesson needing both does the same — same rule as $d$ below, and as $\mathbf{c}$ in Block 4.

$d$ is a document in the TF-IDF lessons and the dimension of $\mathbb{R}^d$ in the representation
ones. The two never appear in the same equation; the lesson that needs both says which it means, in
words, the first time — same rule as $\mathbf{x}^{(i)}$ in §2. Where the dimension is the *model's*
and not an arbitrary one, prefer $d_{\text{model}}$.

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

## 6. Object language — words the lesson talks *about*

This is a course about text, so lessons mention strings constantly: *entre casa y gato no hay un
punto intermedio*. Those words are **mentioned, not used** — they are data the sentence points at,
not part of its own grammar — and the reader has to see that boundary to parse the sentence.

**A mentioned string goes in `<W>`.** Never italics, never backticks.

```mdx
Entre <W>casa</W> y <W>gato</W> no existe un punto intermedio.
Toma la frase <W>el gato bebe leche</W> y el vocabulario ordenado.
El día que alguien escriba <W>criptomoneda</W>…
```

Italics was the obvious choice and is wrong, for two reasons that both get worse with every
lesson. It is **overloaded**: `*…*` already means emphasis (*antes* de la red) and foreign terms
(*embeddings*), and Block 1 lesson 1 alone had 33 mentions against 8 of those — one signal with
three meanings is no signal, and the genuine emphasis is what loses. And it has **no boundaries**:
in *el gato bebe leche* the reader must parse the Spanish to find where the mention ends. Block 2
is nearly all multi-token examples, so this only gets worse.

Inline code was the other candidate. It is rejected because from Block 1 lesson 2 on, backticks
mean **Python** — `numpy`, `softmax()` — and a course that spells *gato* the same way it spells an
identifier has thrown away a distinction it needs.

Three consequences worth stating:

- **`<W>` shows whitespace faithfully.** `<W> gato</W>` and `<W>gato</W>` are different strings, and
  from the BPE lesson on that difference carries weight. Italics could not show it at all.
- **Inside maths, a mention stays `\textit{…}`** — $V = \{\textit{casa}, \textit{gato}\}$. `<W>` is a
  prose mark; it does not go in a `$…$` span.
- **It works in quiz frontmatter too** (`prompt`, `options`, `explanation`), because quiz strings
  compile through MDX with `W` in scope. It is the only custom component available there.

Not machine-checked, and deliberately so: whether an italicised word is a mention or an emphasis is
not decidable from the source, and by the rule below a check that fires on correct lessons costs
more than no check. This one is held by review.

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

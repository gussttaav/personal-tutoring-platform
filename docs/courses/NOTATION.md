# NOTATION.md — the notation contract

**Tag:** `COURSE-P5-00` · Companion to [AUTHORING.md](AUTHORING.md)

This file fixes the mathematical notation for **every course on the platform** — the shared rules
here, the per-course symbol tables in each course's folder (§5). It is not a style preference. A student who learns $\mathbf{W}^{(l)}$ in Block 2 and meets $W^l$ in Block 5
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

### $\times$ is the shape sign; $\cdot$ is the multiplication sign

Two jobs, two signs, and they never overlap — plus the cases where no sign is written at all:

| Job | Sign | Example |
|---|---|---|
| separating the axes of an array | $\times$ | $\mathbb{R}^{B \times T \times d_{\text{model}}}$ · $\mathbf{W}^{(l)}$ tiene forma $d_l \times d_{l-1}$ |
| multiplying two **scalars** | $\cdot$ | $50\,000 \cdot 300$ · $d_1 \cdot d_0$ · $T \cdot d_{\text{model}}$ · $\delta^{(1)}_i \cdot x_j$ |
| …unless both are bare single letters | juxtaposition | $2mT$ · $m(m+1)$ · $c\,T^{\beta}$ |
| multiplying **arrays** | juxtaposition, always | $\mathbf{W}^{(1)}\mathbf{x}$ · $\boldsymbol{\delta}^{(1)}\mathbf{x}_t^{\top}$ · $\mathbf{H}\mathbf{W}^{\top}$ |
| a power of ten | $\times$, as a fixed compound | $4 \times 10^{10}$ · $9 \times 10^{-4}$ |

**Inside a shape, $\times$ separates axes and does not multiply.**
$\mathbb{R}^{B \times T \times d_{\text{model}}}$ has **three** axes;
$\mathbb{R}^{T \cdot d_{\text{model}}}$ has **one**, of length $T$ times $d_{\text{model}}$. Same
count of numbers, different space — so a product of dimensions written in an exponent takes the
$\cdot$, never $\times$, because $\mathbb{R}^{T \times d_{\text{model}}}$ already means the matrix.
Block 3 lesson 1, on why the MLP fails on sequences, is where that bites: concatenating $T$ token
vectors gives $\mathbb{R}^{T \cdot d_{\text{model}}}$, a single column and the only thing
$\mathbf{W}^{(1)}$ can multiply, and the paragraph under the equation says «no una matriz de $T$
filas» in words. With a $\times$ the equation would contradict its own gloss.

**And outside a shape the multiplication sign is $\cdot$, not $\times$** — which is the same
one-glyph-one-job argument [§6](#6-object-language--words-the-lesson-talks-about) makes for `<W>`.
The confusable pair is not exotic: $d_1 \times d_0$ meaning *a matrix that shape* and
$d_1 \times d_0$ meaning *how many weights it holds* are the same six characters around the same two
symbols, and only the surrounding sentence tells them apart. With $\cdot$ for the product, the two
can sit in one clause and stay legible — «$\mathbf{W}^{(1)}$ tiene forma $d_1 \times d_0$, así que
guarda $d_1 \cdot d_0$ pesos» — and a count spelled out reads $64 \cdot 5\,120 = 327\,680$.

**Juxtaposition is not a third way of saying $\cdot$; it is what you write when there is nothing to
disambiguate.** Between bare single letters it is the universal convention and the course keeps it:
$2mT$, $m(m+1)$. It stops working the moment a factor carries a subscript, because then the operator
is a thin space between two symbols that already contain small type — and in a **superscript** that
thin space very nearly disappears. $\mathbb{R}^{T\,d_{\text{model}}}$ against
$\mathbb{R}^{T \times d_{\text{model}}}$ asks the reader to distinguish *a mark* from *no mark* at
half size; $\mathbb{R}^{T \cdot d_{\text{model}}}$ against $\mathbb{R}^{T \times d_{\text{model}}}$
gives them two marks to tell apart, and each one says what it does. So: **if either factor has a
subscript, write the $\cdot$.**

**The one place $\cdot$ is forbidden is between arrays**, and there the reason is not legibility but
meaning: $\mathbf{u} \cdot \mathbf{v}$ is the dot product in most of the literature, and this course
spends $\mathbf{u}^{\top}\mathbf{v}$ on that (§3). So a matrix product is juxtaposed however many
subscripts it carries — $\boldsymbol{\delta}^{(1)}\mathbf{x}_t^{\top}$, never
$\boldsymbol{\delta}^{(1)} \cdot \mathbf{x}_t^{\top}$ — and the bold is what tells the reader which
rule is in force. Note that the scalar and array versions of the same statement therefore look
different on purpose: the casilla $\delta^{(1)}_i \cdot x_j$ against the outer product
$\boldsymbol{\delta}^{(1)}\mathbf{x}^{\top}$, one line apart in Block 3 lesson 1.

The rule was written after Block 3 lesson 1 rather than before it, and what it caught is the usual
argument for writing these down early. Block 1 lesson 7, on Word2Vec, had
$\lvert V \rvert \cdot d_{\text{model}} = 50\,000 \times 300$ — **both** signs for one operation,
four characters apart, on a shipped page; and its cost equation was
$4 \times 10^{10} \times 1.5 \times 10^{7}$, four $\times$ of which two were powers of ten and one
was the product, distinguishable only by doing the arithmetic. Both are fixed, along with ~12 other
sites in Blocks 1 and 2, and ~17 more where a juxtaposed product had a subscripted factor.

**The power-of-ten carve-out is deliberate**, and it does not give $\times$ a second job in any place
that matters: $a \times 10^{n}$ is read as one number, never appears in an exponent of $\mathbb{R}$,
and always carries a power of ten on its right, so nothing about it can be mistaken for a shape. It
is also what every paper the student will go on to read writes. It buys the clearest form of the
Word2Vec line, where the two roles finally become visible:
$\left(4 \times 10^{10}\right) \cdot \left(1.5 \times 10^{7}\right)$.

Not machine-checked, and it fails this file's bar on purpose: a rule keyed on "$\times$ between two
numbers" would fire on «una $3 \times 4$ por una $4 \times 8$», which is Block 2 lesson 7 talking
about shapes in prose and is correct as written. Held by review, like §6.

### Vectors are columns, so a row of a matrix is a transpose

$\mathbf{x} \in \mathbb{R}^{d}$ is $d \times 1$. That is not a preference: it is what makes
$\mathbf{W}^{(l)} \mathbf{h}^{(l-1)}$ above a legal product at all, and it is why the dot product is
written $\mathbf{u}^{\top}\mathbf{v}$ and never $\mathbf{u}\mathbf{v}^{\top}$.

The consequence is the part that has to be said out loud, because it is where the transpose shows up
in a lesson: **when a matrix stores one vector per row, its row $i$ is $\mathbf{x}_i^{\top}$, not
$\mathbf{x}_i$** — row $i$ of the embedding matrix is $\mathbf{e}_{w_i}^{\top}$. A lesson that stacks
vectors into rows writes that transpose the first time, and says in one clause why it is there.

The rule was implicit for the whole of Block 1 and got written down only when Block 1 lesson 6, on
dense representations, needed to set a row equal to a vector. That delay is the usual failure this
file exists to catch: two earlier lessons had already relied on the convention —
$\mathbf{o}_u^{\top}\mathbf{o}_v$ in the one-hot lesson, $\cos(\mathbf{u}, \mathbf{v})$ in the
TF-IDF one — while nothing had stated it, so a student meeting their first transposed row has no way
to tell a convention from a typo.

The one place rows are the default is the batched form named just above, where the batch dimension
comes first and NumPy hands back `E[i]` as a row. That is the announced deviation, not a second
convention: the maths is in columns, and code that is row-major says so where it switches.

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
| $\pi_\theta$ | the policy — the model as a distribution over responses, $\pi_\theta(y \mid x)$ |
| $\pi_{\text{ref}}$ | the reference policy a KL term measures against |
| $r_\phi$ | the reward model |
| $\beta$ | the KL coefficient — how far $\pi_\theta$ may move from $\pi_{\text{ref}}$ |

$L$ is the layer **count**; the loss is $\mathcal{L}$. They look alike on purpose in most
textbooks and it is a genuine trap — when a lesson uses both in one equation, it names them in
prose immediately after.

The last four rows were reserved by `COURSE-C2-P0-04` for the second course's Block 2, and the
reservation runs platform-wide from that date: no course reuses them for anything else. One
shipped use predates it — `dl-nlp` Block 1 lesson 3 writes $\beta$ for Heaps' law exponent, named
in [that course's table](dl-nlp/NOTATION.md#block-1--fundamentos-de-nlp). It stays, because the two
courses never share a page, and it is the last time $\beta$ means anything but the KL coefficient.

## 5. Per-course symbols

The symbol tables are **per course**, one block section each, in the course's own
`docs/courses/<slug>/NOTATION.md`:

- [`dl-nlp/NOTATION.md`](dl-nlp/NOTATION.md) — Fundamentos de NLP · El Perceptrón Multicapa ·
  Redes Neuronales Recurrentes · El Puente hacia la Atención · El Transformer
- [`llm-agents/NOTATION.md`](llm-agents/NOTATION.md) — Del Transformer al modelo de lenguaje ·
  De predecir texto a seguir instrucciones · Hablar con el modelo es programar · El puente: de
  texto a acciones · Un agente de programación en la terminal — seeded by `COURSE-C2-P0-04`,
  filled block by block

They extend this file; they never contradict it. A symbol reserved in §4 keeps its meaning in
every course, and a course that needs a *different* $\beta$ or $\sigma$ picks another letter. A
course with no mathematics ships no `NOTATION.md` and only §6 below applies to it.

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

The `\boldsymbol{\delta}` and `\boldsymbol{\Delta}` exceptions above **will** trip the `bold` rule.
That is acceptable: it is one warning, in the lessons that derive and implement backpropagation, on
a line that is deliberately correct. Note it in the PR and move on.

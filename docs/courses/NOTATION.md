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
| $\mathbf{E} \in \mathbb{R}^{\lvert V \rvert \times d_{\text{model}}}$ | the embedding matrix — row $i$ is $\mathbf{e}_{w_i}^{\top}$ |
| $\mathbf{o}_w \in \{0,1\}^{\lvert V \rvert}$ | one-hot encoding of $w$ |
| $\cos(\mathbf{u}, \mathbf{v})$ | cosine similarity |
| $c$ | a context word (Word2Vec) |
| $\mathbf{u}_c \in \mathbb{R}^{d_{\text{model}}}$ | the vector of $c$ **as context** — row of $\mathbf{U}$; the centre role keeps $\mathbf{e}_w$ |
| $\mathbf{U} \in \mathbb{R}^{\lvert V \rvert \times d_{\text{model}}}$ | the context matrix, discarded when training ends |
| $m$ | window half-width — $m$ tokens each side, so $2m$ pairs per position |
| $n_{\text{neg}}$ | negative samples drawn per real pair |
| $P_{\text{neg}}$ | the noise distribution they come from, $P_{\text{neg}}(w) \propto f_w^{3/4}$ |
| $X_{ij}$ | co-occurrence count of words $i$ and $j$ (GloVe) |
| $X_i$ | $\sum_k X_{ik}$ — every co-occurrence in which $i$ is the centre |
| $P(j \mid i)$ | $X_{ij}/X_i$, the co-occurrence probability |
| $g$ | GloVe's weighting, $g(x) = \min\!\left((x/x_{\max})^{\alpha},\, 1\right)$ |
| $b_i$, $\tilde{b}_k$ | GloVe's two biases — centre role and context role |

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

**$\mathbf{E}$ is stored row-major, and it is not a layer weight matrix.** One row per vocabulary
entry, $d_{\text{model}}$ columns — the shape Block 1 lesson 4 already used for "la tabla que guarda
$r$", and the shape NumPy indexes with `E[i]`. It buys two things that a transposed $\mathbf{E}$
would cost: the lookup is a right-multiplication by a one-hot row,
$\mathbf{e}_{w}^{\top} = \mathbf{o}_{w}^{\top}\mathbf{E}$, and a whole text composes with it
directly, $\mathbf{X}\mathbf{E} \in \mathbb{R}^{T \times d_{\text{model}}}$ for the
$\mathbf{X} \in \mathbb{R}^{T \times \lvert V \rvert}$ of that same lesson. §3's
$d_{\text{out}} \times d_{\text{in}}$ rule is about the weight matrix of a **layer**, which
$\mathbf{E}$ is not, and Block 2 says so where the two first sit on the same page.

**Two vectors per entry, and the second matrix is $\mathbf{U}$ — never $\mathbf{V}$.** Word2Vec
gives each entry a vector for the times it is the centre of a window and another for the times it is
context, so Block 1 lesson 7 needs a name for each. The centre one is **$\mathbf{e}_w$, unchanged**
from lesson 6 on dense representations: it is the vector that survives training, the row of
$\mathbf{E}$, and what every later block means by an embedding. The context one is $\mathbf{u}_c$,
the row of $\mathbf{U}$, thrown away when training ends. The Word2Vec papers write $\mathbf{v}_w$
for the centre vector and a reader will meet that spelling; the course does not adopt it, because
renaming the object a lesson has just defined costs the student more than matching a source does.
$\mathbf{V}$ is not available for the context matrix either: $V$ is the vocabulary, and
$\mathbf{V}$ is the value matrix of Block 5.

**$n_{\text{neg}}$, not $k$, and $f_w$ is $f$ indexed by type.** The obvious letter for "how many
negatives" is taken by the vocabulary cutoff of lesson 3, where it is load-bearing across a whole
argument about coverage; a second meaning one lesson later is exactly the drift this file exists to
stop. $f_w$ is the corpus frequency of the type $w$ — the same $f$ as $f_i$, indexed by the type
itself rather than by its position in the ranking, because $P_{\text{neg}}$ needs a frequency per
entry and not a frequency per rank.

**GloVe's weighting is $g$, never $f$, and its two biases carry a tilde.** The paper writes
$f(X_{ij})$, and that letter is taken twice over by the row above and by lesson 3: $f_i$ is the
frequency at rank $i$, $f_w$ the frequency of the type $w$, and $f_w^{3/4}$ is on the page one
lesson before GloVe arrives. A reader who meets $f$ applied to a co-occurrence count, having just
read $f$ subscripted by a type, has to decide whether the two are related — same drift that
$\text{cob}$ and $n_{\text{neg}}$ exist to prevent, and $g$ collides with nothing. The biases are
$b_i$ for the centre role and $\tilde{b}_k$ for the context role, which is the $\mathbf{e}$/$\mathbf{u}$
split of Word2Vec written for scalars; $\mathbf{b}$ stays free for Block 2's layer bias, and the
tilde is unused elsewhere in the course. Everything else GloVe needs it inherits: the two vectors
per entry are $\mathbf{e}_{w}$ and $\mathbf{u}_{c}$, in the same $\mathbf{E}$ and $\mathbf{U}$ that
Word2Vec fills, so the second technique of the block costs no second notation.

$d$ is a document in the TF-IDF lessons and the dimension of $\mathbb{R}^d$ in the representation
ones. The two never appear in the same equation; the lesson that needs both says which it means, in
words, the first time — same rule as $\mathbf{x}^{(i)}$ in §2. Where the dimension is the *model's*
and not an arbitrary one, prefer $d_{\text{model}}$.

### Block 2 — El Perceptrón Multicapa

| Symbol | Meaning |
|---|---|
| $\mathbf{w} \in \mathbb{R}^{d}$, $b$ | weights and bias of a **single** neuron |
| $z$, $a$ | that neuron's pre-activation and activation, $z = \mathbf{w}^{\top}\mathbf{x} + b$ and $a = \varphi(z)$ |
| $\varphi$ | the activation slot — a generic activation function |
| $\text{escalón}$ | the threshold activation: $1$ when $z \geq 0$, $0$ otherwise |
| $\mathbf{W}^{(l)}$, $\mathbf{b}^{(l)}$ | weights and bias of layer $l$ |
| $\mathbf{z}^{(l)}$ | pre-activation, $\mathbf{W}^{(l)}\mathbf{h}^{(l-1)} + \mathbf{b}^{(l)}$ |
| $\mathbf{h}^{(l)}$ | activation, $\varphi(\mathbf{z}^{(l)})$; $\mathbf{h}^{(0)} = \mathbf{x}$ |
| $\hat{\mathbf{y}}$, $\mathbf{y}$ | prediction, target |
| $\ell(\hat{\mathbf{y}}, \mathbf{y})$ | the loss of **one** example; $\mathcal{L}$ is its mean over the batch |
| $\mathcal{L}_{\text{MSE}}$, $\mathcal{L}_{\text{EC}}$ | the two candidate losses, where both are on the same page |
| $d_l$ | width of layer $l$ — how many neurons it has; $d_0$ is the input dimension |
| $\mathbf{X} \in \mathbb{R}^{B \times d_0}$ | a batch of $B$ examples, one per row |
| $\mathbf{Z}^{(l)}$, $\mathbf{H}^{(l)} \in \mathbb{R}^{B \times d_l}$ | the batched pre-activation and activation; $\mathbf{H}^{(0)} = \mathbf{X}$ |
| $\hat{\mathbf{Y}}$, $\mathbf{Y} \in \mathbb{R}^{B \times d_L}$ | the batched predictions and targets |
| $\mathbf{1}_B \in \mathbb{R}^{B}$ | the all-ones column, so $\mathbf{1}_B\mathbf{b}^{\top}$ is a legal matrix sum |
| $D_{\text{ent}}$, $D_{\text{prueba}}$ | the labelled examples split in two — the ones the model is fitted on, and the ones kept back to measure it; $N_{\text{ent}}$, $N_{\text{prueba}}$ their sizes |
| $\text{acierto}(D)$ | the fraction of $D$ the network classifies correctly |
| $\theta_t$, $\mathbf{w}_t$ | the parameters after $t$ steps of gradient descent; $\theta_0$ is the initialisation |
| $\dfrac{\partial\mathbf{u}}{\partial\mathbf{x}} \in \mathbb{R}^{m \times n}$ | the Jacobian of $\mathbf{u} \in \mathbb{R}^{m}$ with respect to $\mathbf{x} \in \mathbb{R}^{n}$ — row $i$, column $j$ is $\partial u_i/\partial x_j$ |
| $\text{diag}(\mathbf{v})$ | the square matrix carrying $\mathbf{v}$ on its diagonal and zeros everywhere else |
| $\odot$ | element-wise (Hadamard) product |
| $\boldsymbol{\delta}^{(l)}$ | $\partial\ell/\partial\mathbf{z}^{(l)}$, the **error** of layer $l$ — one example, one coordinate per neuron |
| $\boldsymbol{\Delta}^{(l)} \in \mathbb{R}^{B \times d_l}$ | the batched error — row $i$ is $\left(\boldsymbol{\delta}^{(l)}_i\right)^{\top}$ |
| $\sigma$, $\tanh$, $\text{ReLU}$ | the activations that go in that slot |

$\boldsymbol{\delta}$ and $\boldsymbol{\Delta}$ are the **only** allowed `\boldsymbol`, because
`\mathbf` does not embolden Greek letters in KaTeX. They are the exception that proves the rule; do
not extend it to Latin letters.

**$\boldsymbol{\delta}^{(l)}$ is built on $\ell$, not on $\mathcal{L}$**, and the row said
$\partial\mathcal{L}/\partial\mathbf{z}^{(l)}$ until Block 2 lesson 8 derived it. That spelling
contradicted the two-sizes rule below: every derivation in this block starts from one example, so a
$\boldsymbol{\delta}$ defined against the batch mean carries a $1/B$ that none of the per-layer
algebra wants, and the recurrence
$\boldsymbol{\delta}^{(l)} = \left(\left(\mathbf{W}^{(l+1)}\right)^{\top}\boldsymbol{\delta}^{(l+1)}\right) \odot \varphi^{\prime}\left(\mathbf{z}^{(l)}\right)$
would then be false as written for a single example. The batched form is a later lesson's job and
gets its own symbol when it arrives; until then $\boldsymbol{\delta}^{(l)}$ is one example's error.

**And it arrives as $\boldsymbol{\Delta}^{(l)}$**, in Block 2 lesson 9, on implementing an MLP —
the capital-is-the-batch rule below applied to the one object that had not yet needed it. The
per-example recurrence transposes entire, and in doing so **loses** the transpose that the forward
pass **gained** when it went to rows:
$\boldsymbol{\Delta}^{(l)} = \left(\boldsymbol{\Delta}^{(l+1)}\mathbf{W}^{(l+1)}\right) \odot \varphi^{\prime}\left(\mathbf{Z}^{(l)}\right)$,
against $\mathbf{Z}^{(l)} = \mathbf{H}^{(l-1)}\left(\mathbf{W}^{(l)}\right)^{\top} + \dots$ — the
same matrix read with the examples in rows, both times, and a lesson writing both says so once.
The $1/B$ then belongs to the **gradients** and not to $\boldsymbol{\Delta}$, which is what keeps
$\boldsymbol{\delta}$ built on $\ell$ and $\nabla\mathcal{L}$ built on the mean:

$$
\nabla_{\mathbf{W}^{(l)}}\mathcal{L} = \frac{1}{B}\left(\boldsymbol{\Delta}^{(l)}\right)^{\top}\mathbf{H}^{(l-1)},
\qquad
\nabla_{\mathbf{b}^{(l)}}\mathcal{L} = \frac{1}{B}\left(\boldsymbol{\Delta}^{(l)}\right)^{\top}\mathbf{1}_B.
$$

**The single neuron and the layer are the same object at two sizes**, and the block says so where
the two first share a page. Block 2 lesson 1 has one neuron and no layers, so its weights are a
vector $\mathbf{w}$ and its bias, pre-activation and activation are scalars. Once the lessons on
hidden layers and the forward pass stack them, that neuron is row $j$ of $\mathbf{W}^{(l)}$, its
bias is $b^{(l)}_j$, and its $z$ and $a$ are $z^{(l)}_j$ and $h^{(l)}_j$. A reader who meets
$\mathbf{w}$ in one lesson and $\mathbf{W}^{(l)}$ in the next cannot otherwise tell a change of size
from a change of meaning.

**$\varphi$ is the slot; $\sigma$ is one thing that goes in it.** The row above used to write the
activation as $\sigma(\mathbf{z}^{(l)})$, which contradicts §4 — there $\sigma$ is the logistic
sigmoid and nothing else, so a network with $\tanh$ or ReLU could not be written down. Neither
obvious alternative letter is free: $f$ is the model as a whole,
$f : \mathbb{R}^d \to \mathbb{R}^k$, fixed by Block 1 lesson 1 and still on the page in Block 2, and
$g$ is GloVe's weighting one lesson earlier. $\varphi$ collides with nothing and is what the
literature reaches for.

**The step is $\text{escalón}$, roman and Spanish.** §1 sets functions roman, and the course already
prefers a Spanish abbreviation where one is unambiguous ($\text{cob}$ for coverage). $H$ for
Heaviside was the alternative and is rejected for the reason $\text{cov}$ was: $\mathbf{H}$ is the
batched activation matrix of §3, and a reader meeting $H$ beside $\mathbf{h}^{(l)}$ has to decide
whether the two are related.

**Capital is the batch, lowercase is the example**, and the whole of §3's transpose follows from
it. $\mathbf{h}^{(l)} \in \mathbb{R}^{d_l}$ is one example's activation and it is a column, by
§3's rule that vectors are columns; $\mathbf{H}^{(l)}$ stacks $B$ of them as **rows**, so row $i$
is $\left(\mathbf{h}^{(l)}_i\right)^{\top}$ and the layer that was
$\mathbf{W}^{(l)}\mathbf{h}^{(l-1)}$ becomes
$\mathbf{H}^{(l-1)}\left(\mathbf{W}^{(l)}\right)^{\top}$. The same split names the two forms of
everything else the batch touches: $\mathbf{z}^{(l)}$ against $\mathbf{Z}^{(l)}$,
$\hat{\mathbf{y}}$ against $\hat{\mathbf{Y}}$. Block 2 lesson 4, on the *forward pass*, is where
the course switches, and it says so in prose — which is the announcement §3 requires.

**$\mathbf{1}_B$ rather than a silent broadcast.** $\mathbf{Z}^{(l)}$ is $B \times d_l$ and
$\mathbf{b}^{(l)}$ is a $d_l$-vector, so `+ b` is not a matrix sum: what is meant is
$\mathbf{1}_B\left(\mathbf{b}^{(l)}\right)^{\top}$, the same bias row repeated once per example.
NumPy writes the short form and the course writes the long one, because the student who never
sees the outer product cannot tell a broadcast that is right from one that is off by a transpose
— which is the most common shape bug in this material.

**The loss comes in two sizes, and the small one is $\ell$.** §4 reserves $\mathcal{L}$ for the
objective being minimised, which is a number per *batch*; every derivation in this block starts from
one example, and the two need separate names or the $1/B$ goes missing in the algebra. The obvious
alternative, $\mathcal{L}_i$, collides with the subscript that Block 2 already spends on the example
index inside a batch ($\mathbf{h}^{(l)}_i$, row $i$ of $\mathbf{H}^{(l)}$), so a per-example loss and
the $i$-th coordinate of something would be written the same way. $\ell$ is free: Block 1's $\bar{\ell}$
is mean token length, always barred and always in the tokenisation lessons, and no lesson carries both.
The pair is fixed as $\mathcal{L} = \frac{1}{B}\sum_{i} \ell(\hat{\mathbf{y}}_i, \mathbf{y}_i)$, mean and
not sum, so that $\mathcal{L}$ does not scale with $B$.

**A subscripted $\mathcal{L}$ names a candidate, never an example.** Block 2 lesson 5 puts
$\mathcal{L}_{\text{MSE}}$ and $\mathcal{L}_{\text{EC}}$ side by side because it compares them; a lesson
using only one writes plain $\mathcal{L}$. The subscript is roman and abbreviates the Spanish term, the
same convention as $\text{cob}$ and $\text{escalón}$. (Block 1 lesson 7 already wrote
$\mathcal{L}_{\text{par}}$ for Word2Vec's per-pair loss, which is this rule applied before it was
written down.)

**The softmax Jacobian is derived in its two explicit cases, not with a Kronecker delta.** The
literature writes $\partial \hat{y}_k / \partial z_j = \hat{y}_k(\delta_{kj} - \hat{y}_j)$, and the
course does not, for one reason: $\boldsymbol{\delta}^{(l)}$ is the backprop error signal three
lessons later, and a reader who meets $\delta_{kj}$ in the loss lesson and $\boldsymbol{\delta}^{(l)}_j$
in the backpropagation one has to work out that bold-versus-italic and one-subscript-versus-two are
carrying the whole distinction. Writing $j = c$ and $j \neq c$ separately costs two display equations
and teaches the derivation better, which is the trade this course makes everywhere else too.

**$d_l$ once there is a chain, $d_{\text{in}}$ / $d_{\text{out}}$ for a single layer.** §3's pair
names the two sides of *one* weight matrix and it stays right there. It stops working the moment
$L$ layers are composed, because layer $l$'s input is layer $l-1$'s output and the two names would
have to mean different numbers in the same sum. So a chain is indexed:
$\mathbf{W}^{(l)} \in \mathbb{R}^{d_l \times d_{l-1}}$, with $d_0$ the input dimension and $d_L$
the output one. $d_{\text{model}}$ stays reserved for §4's meaning and is not one of these.

**The descent step is a subscript $t$, and it is §2's rule rather than a new one.** Block 2 lesson
6, on gradient descent, needs to write the iterates — $\theta_{t+1} = \theta_t - \eta
\nabla_{\theta}\mathcal{L}(\theta_t)$, and the closed form $w_t = (1-2\eta)^{t}w_0$ that makes
convergence and divergence exact instead of asserted — so it needs an index, and neither of the
course's two index positions is free: the superscript in parentheses is the layer, and the plain
subscript is already the coordinate. §2 has the answer, having fixed a step of any kind as a
subscript. The collision worth naming is with Block 3, where $t$ is the sequence position: Block 2
carries no sequences, so nothing in this block has to disambiguate, and a later lesson holding both
a training step and a sequence position says which it means in words — the clause §2 requires
anyway. $k$ was the alternative and is worse today: it is the class index of the loss lesson and
the vocabulary cutoff of Block 1 lesson 3.

That choice **trips the `transpose` rule**, and the warning is expected rather than a defect. A
closed form raises something to the power $t$ — $(1-2\eta)^{t}$ — and the rule fires on any `^{t}`
because it cannot tell a genuine exponent from a transpose written the wrong way. It is the same
trade the `\boldsymbol{\delta}` exception below already makes: one warning, in the lessons that
iterate, on a line that is deliberately correct. Note it in the PR and move on.

**The Jacobian is written as a fraction, never $\mathbf{J}$.** Block 2 lesson 7, on the chain rule,
puts four of them in a single product — $\mathcal{L}$ to $\mathbf{z}^{(L)}$, $\mathbf{z}^{(L)}$ to
$\mathbf{h}^{(L-1)}$, and so on down to a weight — and a bare $\mathbf{J}$ records nothing about
which two objects it relates, so that product would need a subscript on every factor before it could
be read at all. The fraction carries the pair already, and carries the **shape** with it: numerator
length by denominator length, which is §3's "say the shape" moved from the sentence into the symbol.
What it costs is width, and that is the cheaper of the two prices. The convention the row fixes is
**output first**, $m \times n$, and both of the things this block does with a Jacobian follow from
it: the chain rule is a matrix product read right to left, and a scalar loss has a $1 \times n$
Jacobian whose transpose is the column gradient §4 already reserves.

**$\odot$ enters the course here, and Block 3 lists the same symbol rather than a second one.** An
activation applied coordinate by coordinate has a diagonal Jacobian, so
$\text{diag}(\mathbf{v})\,\mathbf{g} = \mathbf{v} \odot \mathbf{g}$ — $m$ multiplications instead of
$m^{2}$, and no matrix built — which is why every lesson from the chain rule on writes the
right-hand side. $\text{diag}$ is roman by §1's rule for functions and needs no further defence; it
is $\odot$ that is worth the row, because it is the one piece of Block 3's table that is load-bearing
two blocks earlier.

**The two halves of the data are subscripted, not primed, and $D$ is Block 1's own letter.** Block 2
lesson 10, the sentiment project, is the first lesson that measures anything on examples the network
was not fitted on, so it needs a name for each half. $D$ arrives already meaning "a collection of
documents" from Block 1's table, and a review is a document, so $D_{\text{ent}}$ and
$D_{\text{prueba}}$ cost no new letter — only the roman-Spanish subscript that
$\mathcal{L}_{\text{MSE}}$ and $\mathcal{L}_{\text{EC}}$ already established. The prime is the
tempting alternative, and Block 1's own note licenses it: $T'$ and $M'$ are measured on a held-out
text, which is exactly what $D_{\text{prueba}}$ is. It is refused here because **Block 2 spends the
prime on the derivative**, $\varphi^{\prime}\left(\mathbf{z}^{(l)}\right)$, on nearly every page
from the chain rule on — and both spellings would land inside this one lesson, whose training loop
carries $\varphi^{\prime}$ and whose measurement carries the split.

$\text{acierto}$ is roman and Spanish for the reason $\text{escalón}$ and $\text{cob}$ are, and it
takes a **set** as its argument rather than a pair of vectors: the quantity is a property of the
data being scored, and writing $\text{acierto}(D_{\text{ent}})$ beside
$\text{acierto}(D_{\text{prueba}})$ is the whole content of that lesson's result. Note that it is
not a loss and never appears in a gradient — $\mathcal{L}$ is what descent minimises, $\text{acierto}$
is what the reader is told at the end, and a lesson using both says so once.

### Block 3 — Redes Neuronales Recurrentes

| Symbol | Meaning |
|---|---|
| $\mathbf{x}_t \in \mathbb{R}^{d_{\text{model}}}$ | the vector of the token at position $t$ |
| $T_{\max}$ | how many positions a **fixed-length** input has room for |
| $\left[\mathbf{x}_1 ; \dots ; \mathbf{x}_T\right]$ | vertical concatenation — the semicolons stack, a comma would lay them in a row |
| $\mathbf{W}^{(1)}_t \in \mathbb{R}^{d_1 \times d_{\text{model}}}$ | the column block of $\mathbf{W}^{(1)}$ that multiplies position $t$ |
| $\mathbf{h}_t$ | hidden state at step $t$ |
| $d_h$ | width of the hidden state — how many coordinates $\mathbf{h}_t$ has |
| $\mathbf{h}_0 = \mathbf{0}$ | the state the recurrence starts from, before any token has been read |
| $\mathbf{p}_t$ | the recurrence pre-activation, $\mathbf{h}_t = \tanh(\mathbf{p}_t)$ — the argument of the $\tanh$ |
| $\boldsymbol{\delta}_t$ | the error of step $t$: $\nabla_{\mathbf{p}_t}\ell$, the time-analogue of Block 2's $\boldsymbol{\delta}^{(l)}$ |
| $\mathbf{c}_t$ | LSTM cell state |
| $\tilde{\mathbf{c}}_t$ | LSTM candidate — what step $t$ proposes to write into the cell, a $\tanh$ |
| $\mathbf{W}_{hh}$, $\mathbf{W}_{xh}$, $\mathbf{W}_{hy}$ | recurrent, input and output weights |
| $\mathbf{b}_h$, $\mathbf{b}_y$ | the recurrence bias and the output bias — subscripted by role, like the matrices above |
| $\mathbf{f}_t$, $\mathbf{i}_t$, $\mathbf{o}_t$ | LSTM forget, input and output gates |
| $\mathbf{W}_{x\ast}$, $\mathbf{W}_{h\ast}$, $\mathbf{b}_{\ast}$ | the input weights, recurrent weights and bias of piece $\ast \in \{f, i, o, c\}$ — eight matrices and four biases, each shaped like the RNN's |
| $\mathbf{r}_t$, $\mathbf{z}_t$ | GRU reset and update gates |
| $\tilde{\mathbf{h}}_t$ | GRU candidate — what step $t$ proposes to write to the state, a $\tanh$ over $\mathbf{r}_t \odot \mathbf{h}_{t-1}$ |
| $\mathbf{W}_{x\ast}$, $\mathbf{W}_{h\ast}$, $\mathbf{b}_{\ast}$, $\ast \in \{z, r\}$ | the two GRU gates' weights, the same role-subscript shapes as the RNN's; the candidate reuses the RNN's own $\mathbf{W}_{xh}$, $\mathbf{W}_{hh}$, $\mathbf{b}_h$ — six matrices and three biases in all |
| $\odot$ | element-wise (Hadamard) product |
| $\rho(\mathbf{W}_{hh})$ | spectral radius — the largest of the moduli of the eigenvalues |
| $\sigma_{\max}$ | largest singular value (the operator 2-norm) — the most a matrix can stretch a vector |
| $\bar{\mathbf{h}}_j$ | seq2seq encoder state at input position $j$ — the bar marks it as the encoder's, against the decoder's $\mathbf{s}_i$ (Block 3 lesson 8; shared with Block 4) |
| $\mathbf{s}_i$ | seq2seq decoder state at output position $i$ (Block 3 lesson 8; shared with Block 4) |
| $\mathbf{c} = \bar{\mathbf{h}}_{T_x}$ | the context vector — the encoder's last state, the one fixed-size summary the decoder sees of the whole input |
| $T_x$, $T_y$ | source and target sequence lengths in seq2seq; they need not be equal |
| $\mathbf{W}^{\text{enc}}_{\ast}$, $\mathbf{W}^{\text{dec}}_{\ast}$ | the encoder's and decoder's own recurrence weights — the superscript is a role label (which network), not a layer index |

**$\mathbf{x}_t$ is one token's vector, and Block 2's $\mathbf{x}$ is one example's input.** The two
are not in conflict and the block keeps both: what changes in Block 3 is that an example is now a
*sequence*, so its input is $T$ vectors instead of one, and which one is fixed by §2's sequence
position. Block 3 lesson 1, on why the MLP fails on sequences, is where they share a page — its
concatenated input is a single example *and* $T_{\max}$ token vectors at once — so there the
unsubscripted $\mathbf{x}$ is the whole example and $\mathbf{x}_t$ is its $t$-th piece, said once in
prose. Where the token vector comes from is Block 1's business: $\mathbf{x}_t = \mathbf{e}_{w_t}$,
the row of $\mathbf{E}$ belonging to the entry at that position.

**$T$ varies, $T_{\max}$ does not**, and a lesson needs both only while the input has a fixed size.
§4 reserves $T$ for the length of *a* sequence — a property of the text, different for every
document, which is precisely the fact that breaks a fixed $d_0$. $T_{\max}$ is a property of the
**architecture**: how many positions it has room for. A text with $T > T_{\max}$ is truncated and one
with $T < T_{\max}$ is padded, and both of those are losses the lesson names. An RNN reads $T$ steps
whatever $T$ is and has no $T_{\max}$ at all, which is one way to say what it fixes.

**The subscript on $\mathbf{W}^{(1)}_t$ is a position, not an element index.** §2 spends the *double*
subscript on coordinates — $\mathbf{W}^{(l)}_{ij}$ is row $i$, column $j$ — which leaves a single
subscript free, and Block 3 lesson 1 spends it on the piece of $\mathbf{W}^{(1)}$ that multiplies
position $t$: $T_{\max}$ blocks of $d_1 \times d_{\text{model}}$, laid side by side, so that
$\mathbf{W}^{(1)}\mathbf{x} = \sum_t \mathbf{W}^{(1)}_t\mathbf{x}_t$. It is the one matrix in the
course carrying a layer superscript and a time subscript at once, and the lesson that writes it says
so in a clause.

That is **not** what the subscripts on $\mathbf{W}_{hh}$ and $\mathbf{W}_{xh}$ mean, three rows up,
and the difference is the whole subject of the block. Those name a **role** — which pair of spaces
the matrix maps between — and there is exactly one $\mathbf{W}_{hh}$ for the entire sequence, while
there are $T_{\max}$ different $\mathbf{W}^{(1)}_t$. A reader who takes the second spelling for the
first has read the recurrence as an MLP.

**The hidden state's width is $d_h$, not $d_1$.** Block 2's $d_l$ indexes a layer inside a chain,
where $d_0$ is the input and $d_L$ the output and every intermediate number names a different
matrix. The hidden state is not that: it is **one** object of **one** width, applied $T$ times, and
writing it $d_1$ would hand the reader the exact misreading the block spends lesson 1 dismantling —
that position $t$ is layer $t$. $d_h$ says instead which vector it measures, which is what
$\mathbf{W}_{hh}$ and $\mathbf{W}_{xh}$ already do one row up. So
$\mathbf{W}_{hh} \in \mathbb{R}^{d_h \times d_h}$ and
$\mathbf{W}_{xh} \in \mathbb{R}^{d_h \times d_{\text{model}}}$, and the recurrence's parameter count
$d_h \cdot d_h + d_h \cdot d_{\text{model}} + d_h$ can be written without $T$ appearing in it —
which is the whole claim of Block 3 lesson 2, on the vanilla RNN.

**The biases carry a role subscript, not a layer superscript.** $\mathbf{b}^{(l)}$ is Block 2's
spelling and its superscript is a layer index; an RNN has no layers to index, and the two biases it
does have are told apart by *which* product they are added to. That is the distinction
$\mathbf{W}_{hh}$/$\mathbf{W}_{hy}$ already makes, so $\mathbf{b}_h$ rides with the recurrence and
$\mathbf{b}_y$ with the output. Note that a bare $\mathbf{b}$ is then free for a lesson carrying
only one of them.

**$\mathbf{h}_0$ is fixed at $\mathbf{0}$ and the course says so.** The recurrence reads
$\mathbf{h}_{t-1}$, so at $t = 1$ it reads something that no step produced, and leaving that
implicit is what makes a first step look like a special case with its own rule. It is not one:
$\mathbf{h}_0 = \mathbf{0}$ makes $\mathbf{h}_1 = \tanh(\mathbf{W}_{xh}\mathbf{x}_1 + \mathbf{b}_h)$
fall out of the same line as every other step. The zero is a choice rather than a necessity — it
could be learned — and the lesson that writes it says which it is.

**$\mathbf{p}_t$ is the pre-activation and $\boldsymbol{\delta}_t = \nabla_{\mathbf{p}_t}\ell$ its
error — the recurrence's $\mathbf{z}^{(l)}$ and $\boldsymbol{\delta}^{(l)}$.** Block 3 lesson 3, on
BPTT, needs both: a name for the argument of the $\tanh$ that lesson 2 left unwritten, and a name for
the gradient the backward pass carries from one step to the previous. Neither of Block 2's spellings
survives the move. $\mathbf{z}^{(l)}$ is out because $\mathbf{z}_t$ is already the GRU update gate two
rows up — the same subscript, a different object, in the same block — so the pre-activation takes
$\mathbf{p}_t$, for *preactivación*, which collides with nothing. $\mathbf{a}_t$, the other obvious
letter, is worse than free: Block 2 lesson 1 spent $a$ on a neuron's **activation**, the post-$\varphi$
value, so a bold $\mathbf{a}_t$ meaning the pre-activation would invert a letter the course already
fixed. The error, by contrast, keeps its name on purpose. $\boldsymbol{\delta}_t$ is Block 2's
$\boldsymbol{\delta}^{(l)}$ with a step of the time in place of a layer — the same quantity at the same
place in the graph, built on the one-example $\ell$ and not $\mathcal{L}$ the way Block 2's is, so
that BPTT reads as the sum over $t$ of the per-layer gradient rather than a new object. Calling it anything else would tell the
reader the two are different when the whole of the lesson is that they are one. It is a `\boldsymbol`
for the reason Block 2's is — `\mathbf` does not embolden Greek in KaTeX — and it trips the `bold`
lint the same way: one warning, in the lessons that derive BPTT, on a line that is deliberately
correct.

**$\rho$ and $\sigma_{\max}$ size a repeated product, and Block 3 lesson 4, on the vanishing
gradient, needs both.** The backward pass multiplies by $\mathbf{W}_{hh}^{\top}$ once per step, so the
error at a distance $d$ carries that matrix applied $d$ times, and how it grows is a fact about the
matrix, not the sequence. $\sigma_{\max}$, the largest singular value, bounds a **single** step —
$\lVert \mathbf{W}\mathbf{v} \rVert \le \sigma_{\max}\lVert \mathbf{v} \rVert$ — so the product is at
most $\sigma_{\max}^{d}$; $\rho(\mathbf{W}_{hh})$, the spectral radius, is the **long-run** rate,
$\left\lVert \mathbf{W}^{d} \right\rVert^{1/d} \to \rho$, so $\rho < 1$ is what decides the vanishing
and $\rho > 1$ the explosion. Neither eigenvalues nor singular values are course prerequisites — those
are the matrix product, not its spectrum — so the lesson **defines each in a clause** where it first
uses it, and the `vanishing-gradient` explorable puts $\rho$ on a slider. $\sigma_{\max}$ does reuse the
$\sigma$ that §4 reserves for the logistic sigmoid, and is kept for the reason $\mathbf{c}$ is shared
with Block 4: it is the notation the literature uses, and the two never collide on the page — the
sigmoid is always $\sigma(\cdot)$ applied to an argument, while $\sigma_{\max}$ is a subscripted scalar
property of a matrix, applied to nothing.

**The LSTM's four pieces are the RNN recurrence subscripted by role, and $\tilde{\mathbf{c}}_t$ carries
a tilde so it is not the cell.** Block 3 lesson 5, on the LSTM, needs a name for each of the forget,
input, output and candidate computations, and each is the vanilla recurrence of lesson 2 with its own
weights: $\mathbf{W}_{x\ast} \in \mathbb{R}^{d_h \times d_{\text{model}}}$,
$\mathbf{W}_{h\ast} \in \mathbb{R}^{d_h \times d_h}$ and $\mathbf{b}_{\ast} \in \mathbb{R}^{d_h}$, with
$\ast$ the gate's own letter. That is the same subscript-by-role convention $\mathbf{W}_{hh}$ and
$\mathbf{b}_h$ already use two rows up — a subscript naming *which* map, never a position — so the eight
matrices cost no new idea, only the letters $f$, $i$, $o$, $c$. The candidate reuses $\mathbf{c}$
because it is a proposed cell value, and the **tilde is what keeps it distinct from $\mathbf{c}_t$
itself**: $\mathbf{c}_t = \mathbf{f}_t \odot \mathbf{c}_{t-1} + \mathbf{i}_t \odot \tilde{\mathbf{c}}_t$
would be unreadable if both wore the same symbol. The tilde is otherwise spent only on GloVe's
$\tilde{b}_k$, one block away and never on the same page, so there is no collision. The gradient of the
cell along the additive path is written $\nabla_{\mathbf{c}_t}\ell$ in full rather than given a symbol
of its own: a bare superscript would fight §2's layer index, and the lesson uses it too rarely to earn
a letter.

**The GRU is the vanilla RNN wrapped in two gates, and its candidate is $\tilde{\mathbf{h}}_t$ — a
state, not a cell.** Block 3 lesson 6, on the GRU, needs a name for what a step proposes to write, and
unlike the LSTM there is no separate cell to write it into: the proposal is a candidate *hidden state*,
so it carries an $\mathbf{h}$ under the tilde rather than a $\mathbf{c}$. The tilde does the same job it
does for $\tilde{\mathbf{c}}_t$ — keeping the proposal distinct from the state itself in
$\mathbf{h}_t = (1 - \mathbf{z}_t) \odot \mathbf{h}_{t-1} + \mathbf{z}_t \odot \tilde{\mathbf{h}}_t$ —
and the two never share a page, so there is no collision with the LSTM's candidate. The two gates take
the same subscript-by-role weights as everything else in the block,
$\mathbf{W}_{x\ast}, \mathbf{W}_{h\ast}, \mathbf{b}_{\ast}$ with $\ast \in \{z, r\}$; the candidate, by
contrast, **reuses the vanilla RNN's own $\mathbf{W}_{xh}, \mathbf{W}_{hh}, \mathbf{b}_h$**, because it
*is* that recurrence, only reading $\mathbf{r}_t \odot \mathbf{h}_{t-1}$ in place of $\mathbf{h}_{t-1}$.
So the GRU costs three pieces to the LSTM's four — three quarters of the weights — and the reuse is
what makes that count exact rather than approximate. The gradient of the state along the direct path is
written $\nabla_{\mathbf{h}_t}\ell$ in full, like the LSTM's $\nabla_{\mathbf{c}_t}\ell$ and for the
same reason: too rare to earn a symbol of its own.

**Seq2seq is two RNNs, and the context vector is where Block 4 attacks.** Block 3 lesson 8, on
seq2seq, chains an encoder and a decoder, each the vanilla recurrence of lesson 2 with its own
weights — hence the role-label superscripts $\mathbf{W}^{\text{enc}}_{\ast}$ and
$\mathbf{W}^{\text{dec}}_{\ast}$, which name *which network* a weight belongs to and are the one
superscript in the course that is not a layer index (Block 5's projection labels are the other). The
encoder's states are $\bar{\mathbf{h}}_j$ and the decoder's are $\mathbf{s}_i$ — the same two symbols
Block 4 uses, introduced here so its opening inherits them unchanged. The seam between the two is a
single vector, $\mathbf{c} = \bar{\mathbf{h}}_{T_x}$, and it carries **no subscript on purpose**: it
is the same summary at every decoder step. Block 4's $\mathbf{c}_i$ is exactly this vector made
per-step — a different context for each output position — which is what attention adds, so the
missing subscript here is the whole shape of the problem Block 4 opens with. $T_x$ and $T_y$ are the
two lengths, distinct because a seq2seq maps a source to a target of its own length; they generalise
§4's single $T$ and are needed only while two sequences share a page.

### Block 4 — El Puente hacia la Atención

| Symbol | Meaning |
|---|---|
| $\mathbf{s}_i$ | decoder state at output step $i$ (introduced in Block 3 lesson 8) |
| $\bar{\mathbf{h}}_j$ | encoder state at input step $j$ (introduced in Block 3 lesson 8) |
| $V_x$, $V_y$ | the source and target vocabularies; $\lvert V_x \rvert$, $\lvert V_y \rvert$ their sizes |
| $\texttt{<EOS>}$ | the token that ends an output sequence — an entry of $V_y$ like any other |
| $x_{1:T_x}$, $y_{1:T_y}$ | the source and target **token sequences**, against $\mathbf{x}_j$ and $\hat{\mathbf{y}}_i$, which are one vector each |
| $y_{<i}$ | the target prefix $y_1, \dots, y_{i-1}$ — what the decoder has written before step $i$ |
| $P(y_i \mid y_{<i}, \mathbf{c})$ | the distribution the decoder puts on step $i$; its coordinates are $\hat{\mathbf{y}}_i$ |
| $e_{ij}$ | alignment score between $\mathbf{s}_{i-1}$ and $\bar{\mathbf{h}}_j$ |
| $\alpha_{ij}$ | attention weight, $\text{softmax}_j(e_{ij})$ |
| $\mathbf{c}_i$ | context vector, $\sum_j \alpha_{ij} \bar{\mathbf{h}}_j$ — the per-step version of Block 3 lesson 8's single $\mathbf{c}$ |

$\mathbf{c}$ is the context vector here and the LSTM cell state in Block 3. That collision is
inherited from the literature; Block 4 names it in prose the first time it appears.

**A sequence of tokens takes a range subscript, not a bold letter.** Block 4 lesson 1, on the
encoder-decoder at full size, is the first lesson that has to name a whole output *sequence* as one
object — the thing a translation is — and neither bold letter is free. $\mathbf{y}$ is Block 2's
target vector for one example and $\hat{\mathbf{y}}_i$ is Block 3 lesson 8's distribution over one
step, both of them a single vector; a bold $\mathbf{y}$ meaning $T_y$ tokens would collide with
both, on the same page, in the same lesson. $y_{1:T_y}$ says «these tokens, in this order» and
leaves the bold letters their existing jobs, and $y_{<i}$ then costs nothing extra. Note the shape
of the pair: $y_i$ is the token at position $i$ — an index into $V_y$, as it already was in Block 3
lesson 8's loss — and $\hat{\mathbf{y}}_i$ is the vector of probabilities that step assigns to every
entry of $V_y$, so $P(y_i \mid y_{<i}, \mathbf{c})$ is one coordinate of it.

**Two vocabularies, because the two sides are two languages.** Block 1's $V$ is a single vocabulary
because a single text was being tokenised, and Block 3 lesson 8's toy kept that — its reverser reads
and writes the same six letters. A translator does not: the encoder's one-hot lives in
$\{0,1\}^{\lvert V_x \rvert}$ and the decoder's softmax is over $V_y$, of a different size. The
asymmetry is load-bearing rather than decorative, and $\texttt{<EOS>}$ is where it shows: the token
that ends an output is a **target-side** entry, predicted by the same softmax as every other, which
is what makes «when to stop» something the model learns instead of something the loop is told. It
takes Block 1's $\texttt{<UNK>}$ spelling, and in prose it is written `<W>\<EOS></W>` — the escape
[AUTHORING.md §8](AUTHORING.md#8-mdx-and-latex-gotchas) requires for any angle-bracketed token.

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

The `\boldsymbol{\delta}` and `\boldsymbol{\Delta}` exceptions above **will** trip the `bold` rule.
That is acceptable: it is one warning, in the lessons that derive and implement backpropagation, on
a line that is deliberately correct. Note it in the PR and move on.

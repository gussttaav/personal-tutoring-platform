# NOTATION.md — per-block symbols for `llm-agents`

**Tag:** `COURSE-C2-P0-04` · The course-specific half of the notation contract. The shared half —
typography, indices, shapes, the reserved symbols, the object language, and the machine-checked
rules — is [`docs/courses/NOTATION.md`](../NOTATION.md), and it governs this file: a symbol here
never redefines one reserved there. The first course's tables are
[`dl-nlp/NOTATION.md`](../dl-nlp/NOTATION.md), and this course's reader has taken that course —
see the note on inherited letters under Block 1.

**If a lesson needs a symbol that is not here, add it here first.** That is the whole mechanism.

This file is a **seed** (2026-09-16): the tables below are what the plan fixed so that lesson 1
does not decide notation on its own, and each lesson adds to its block's table before it is
written, the way the first course's file grew. The mathematical density falls along the course on
purpose — Blocks 4 and 5 have **no new mathematics**, and their sections say so — which is why
this file gets shorter as it goes down.

---

## Per-block symbols

### Block 1 — Del Transformer al modelo de lenguaje

| Symbol | Meaning |
|---|---|
| $\theta$ | the model's parameters, collectively (reserved in the shared §4) |
| $p_\theta(x_{t+1} \mid x_{\le t})$ | the causal language model: the distribution over the next token given the prefix |
| $\mathbf{z}_t \in \mathbb{R}^{\lvert V \rvert}$ | the logits at position $t$ — the vector the softmax turns into $p_\theta$ |
| $\tau$ | the temperature: the logits are divided by it before the softmax |
| $k$, $p$ | the top-$k$ and top-$p$ (nucleus) cut-offs on the sampling distribution |
| $\mathcal{K}^{(l)}$, $\mathcal{V}^{(l)}$ | the cached keys and values of layer $l$, for every position generated so far |
| $T_{\text{ctx}}$ | the context length: the most positions one call may hold |
| $\text{PPL}$ | perplexity — $\exp$ of the mean per-token cross-entropy on a given text, $= p_\theta(x_{2:T+1} \mid x_1)^{-1/T}$ (Block 1 lesson 6) |
| $N$, $D$, $C$ | parameters, training tokens, compute — Kaplan's letters. $N$ counts every parameter, embeddings included, as Chinchilla does (Kaplan's excludes them, and Block 1 lesson 7 says so where it matters); $D$ counts tokens **read**, a token read twice counting twice; $C$ is in FLOPs |
| $\alpha_N$, $\alpha_D$ | the scaling exponents: how the loss falls with $N$ and with $D$. Kaplan's are of the whole loss (0.076, 0.095), Chinchilla's of what lies above $\mathcal{L}_{\infty}$ (about 0.35): same letters, and Block 1 lesson 7 says which fit a number belongs to |
| $x_t \in V$ | the token at position $t$ — the first course's $w_t$; $x_{1:T}$, $x_{<t}$, $x_{\le t}$ are the runs, as there, and $x_{<1}$ is the empty sequence (Block 1 lesson 1) |
| $\mathbf{Z} \in \mathbb{R}^{T \times \lvert V \rvert}$ | the logits stacked — row $t$ is $\mathbf{z}_t^{\top}$, one row per position read, one column per entry |
| $\mathbf{z}_t(x_{\le t})$ | the logits of position $t$ **with the input named**: what the network was given. Used to state that the mask makes $\mathbf{z}_t(x_{1:T}) = \mathbf{z}_t(x_{\le t})$ (Block 1 lesson 1) |
| $n$ | a text's length in **bytes** (Block 1 lesson 2) — what the first course called $C$ in characters; lesson 6's bits per byte divides by it |
| $\lvert u \rvert$ | the length of token $u$ in bytes (Block 1 lesson 2), the first course's $\lvert u \rvert$ with bytes for characters |
| $\bar{\ell} = n / T$ | the mean bytes per token (Block 1 lesson 2) — the first course's $\bar{\ell} = C/T$, measured in bytes |
| $f(a, b)$ | the frequency of the pair $(a, b)$: how many times token $a$ is immediately followed by token $b$ inside one pre-token, under the corpus's current segmentation (Block 1 lesson 2). The first course's $f_i$ was a type's frequency: same letter, same idea, one level down |
| $(a_i, b_i)$, $u_i$ | fusión $i$: the pair it glues and the vocabulary entry it creates, whose bytes are those of $a_i$ followed by those of $b_i$ (Block 1 lesson 2) |
| $V_i$, $m$ | the vocabulary after $i$ fusiones, $V_0$ being the 256 bytes; $m$ the number of fusiones, so $\lvert V_m \rvert = 256 + m$ (Block 1 lesson 2) |
| $T_i$ | the corpus's length in tokens after $i$ fusiones, $T_0 = n$ (Block 1 lesson 2) |
| $\mathcal{L}_i(\theta)$ | lesson 1's loss on the training window that starts at position $i$ of the corpus (Block 1 lesson 3) |
| $\mathcal{L}_{\text{corpus}}(\theta)$ | $\mathbb{E}_i\left[\mathcal{L}_i(\theta)\right]$, $i$ uniform over the starts where a window fits: what training lowers (Block 1 lesson 3) |
| $i_1, \dots, i_B$ · $\hat{\mathcal{L}}(\theta)$ | the starts of one *batch*, drawn independently like $i$ · its loss, the mean of their $\mathcal{L}_{i_j}$ (Block 1 lesson 3) |
| $\mathbf{g}$ · $\hat{\mathbf{g}}$ · $\hat{\mathbf{g}}_s$ | $\nabla_\theta\mathcal{L}_{\text{corpus}}$ · $\nabla_\theta\hat{\mathcal{L}}$ · the latter at step $s$, after the recorte: vectors with one coordinate per parameter (Block 1 lesson 3) |
| $s$, $S$ · $\theta_s$ | the training step and how many there are · the parameters after $s$ steps (Block 1 lesson 3) |
| $\mathbf{m}_s$, $\mathbf{v}_s$ | Adam's two medias móviles: of $\hat{\mathbf{g}}_s$ and of $\hat{\mathbf{g}}_s \odot \hat{\mathbf{g}}_s$, both $\mathbf{0}$ at $s = 0$ (Block 1 lesson 3) |
| $\rho_1$, $\rho_2$ | their rates (Block 1 lesson 3) |
| $\varepsilon$ | the guard in Adam's denominator (Block 1 lesson 3) |
| $\lambda$ | the decaimiento de pesos coefficient, AdamW's (Block 1 lesson 3) |
| $\eta_s$ · $\eta_{\max}$ · $S_{\text{cal}}$ | the learning rate at step $s$ · its peak · the steps of calentamiento (Block 1 lesson 3) |
| $\mathbf{z}$, $z_v$ | the logits of the position being generated, and the one of entry $v$: lesson 1's $\mathbf{z}_t$ with $t$ dropped where only that position is in play (Block 1 lesson 4) |
| $\mathbf{q}$, $q_v$ | $\text{softmax}(\mathbf{z}/\tau)$, the distribution the sampler draws from before any corte, and its entry for $v \in V$ (Block 1 lesson 4) |
| $v^{\star}$ | the favorita, $\arg\max_v z_v$ (Block 1 lesson 4) |
| $q_{(i)}$ | the $i$-th largest entry of $\mathbf{q}$: a parenthesised subscript is a rank, a bare one an entry (Block 1 lesson 4) |
| $M_j$ | the masa of the $j$ most probable entries, $\sum_{i=1}^{j} q_{(i)}$ (Block 1 lesson 4) |
| $k_p$ | the size of the núcleo: the smallest $j$ with $M_j \ge p$ (Block 1 lesson 4) |
| $\tilde{\mathbf{q}}$, $\tilde{q}_v$ | $\mathbf{q}$ after a corte, renormalised: what the sorteo draws from (Block 1 lesson 4) |
| $\mathbf{q}_t$, $\mathbf{k}_t$, $\mathbf{v}_t \in \mathbb{R}^{d_k}$ | the query, key and value of position $t$ in one head of one layer: the first course's, row $t$ of its $\mathbf{Q}$, $\mathbf{K}$, $\mathbf{V}$. With the input named, as $\mathbf{z}_t(\cdot)$ is: $\mathbf{k}_i(x_{1:t}) = \mathbf{k}_i(x_{\le i})$ (Block 1 lesson 5) |
| $\mathbf{K}$, $\mathbf{V} \in \mathbb{R}^{t \times d_k}$ | one head's share of the caché after $t$ positions — row $i$ is $\mathbf{k}_i^{\top}$, $\mathbf{v}_i^{\top}$ — the first course's two matrices, kept from one token to the next (Block 1 lesson 5) |
| $c_{\text{fila}}$ | the multiplications that take one row through every matrix of the network, $L\left(4d_{\text{model}}^{2} + 2d_{\text{model}} \cdot d_{\text{ff}}\right) + d_{\text{model}} \cdot \lvert V \rvert$: one per weight of a matrix (Block 1 lesson 5) |
| $c(t)$ | the multiplications of the token at position $t$ with the caché, $c_{\text{fila}} + 2Lt \cdot d_{\text{model}}$; without it, exactly $t\,c(t)$ (Block 1 lesson 5) |
| $\text{bpb}$ | bits per byte: $-\log_2 p_\theta(x_{2:T+1} \mid x_1)$ divided by the $n$ bytes of the predicted tokens, $= \mathcal{L}/(\bar{\ell}\ln 2)$ (Block 1 lesson 6) |
| $f(v)$ | the frequency of entry $v$: how many times it appears in the training part (Block 1 lesson 6) — lesson 2's $f(a, b)$ one level down |
| $p_{\text{uni}}(v)$ | the modelo de unigramas: $\left(f(v) + 1\right) / \sum_{u}\left(f(u) + 1\right)$, the same at every position (Block 1 lesson 6) |
| $\mathcal{L}_{\text{res}}(\theta)$ | lesson 1's loss averaged over windows of the texto reservado — lesson 3's $\mathcal{L}_{\text{corpus}}$ on the other part (Block 1 lesson 6) |
| $\bar{\mathcal{L}}(\theta)$ | the mean loss over all text of the same origin: what both estimate for a $\theta$ fixed in advance (Block 1 lesson 6) |
| $\theta_{\text{corpus}}$ · $\theta^{\star}$ | the $\theta$ that minimises $\mathcal{L}_{\text{corpus}}$ · the one that minimises $\bar{\mathcal{L}}$ (Block 1 lesson 6) |
| $\mathcal{L}(N)$, $\mathcal{L}(D)$, $\mathcal{L}(N, D)$ | the loss on unseen text as a function of scale: of the parameters, of the training tokens, of both (Block 1 lesson 7). The papers write $L$, which is the layer count here |
| $N_c$, $D_c$ | Kaplan's scales in $\mathcal{L}(N) = (N_c/N)^{\alpha_N}$, $\mathcal{L}(D) = (D_c/D)^{\alpha_D}$: constants of the corpus and the tokeniser, not of the model (Block 1 lesson 7) |
| $\mathcal{L}_{\infty}$ | the irreducible loss, the floor of $\mathcal{L}(N, D)$ as $N, D \to \infty$: Chinchilla's $E$ (Block 1 lesson 7) |
| $A_N$, $A_D$ | Chinchilla's coefficients in $\mathcal{L}(N, D) = \mathcal{L}_{\infty} + A_N/N^{\alpha_N} + A_D/D^{\alpha_D}$: the paper's $A$ and $B$ (Block 1 lesson 7) |
| $N^{\star}(C)$, $D^{\star}(C)$ | the reparto óptimo for a budget $C$: the $N$ and $D = C/(6N)$ that minimise $\mathcal{L}(N, D)$. The papers' $N_{\text{opt}}$, $D_{\text{opt}}$ (Block 1 lesson 7) |
| $G$ | the constant in $N^{\star} = G\,(C/6)^{\alpha_D/(\alpha_N + \alpha_D)}$, Chinchilla's eq. 4 — inside a `<Details>` only (Block 1 lesson 7) |
| $e_i$, $e_{1:K}$ · $K$ | ejemplo $i$ of a prompt, a token sequence holding a caso and its respuesta · the $K$ ejemplos in order · how many there are, the GPT-3 paper's letter (Block 1 lesson 8) |
| $x$, $y$ · $y_j$ | the caso the prompt ends on and the respuesta a tarea asks for, both token sequences · token $j$ of $y$ (Block 1 lesson 8). Block 2's $x$, the whole prompt, is this $x$ with the ejemplos in front |
| $p_{\text{texto}}$ | the distribution the training text comes from: what the text *is*, against $p_\theta$, what the model believes (Block 1 lesson 8) |
| $\omega$ · $\omega_1$, $\omega_2$ | a tarea, the latent variable a document of $p_{\text{texto}}$ follows, drawn with probability $p_{\text{texto}}(\omega)$ · two of them, compared (Block 1 lesson 8) |
| $\tilde{q}(v \mid x, y_{<j})$ · $\tilde{q}(y \mid x)$ | lesson 4's $\tilde{q}_v$ with the text it was computed from named, as $\mathbf{z}_t(x_{\le t})$ names it · the product of those over a continuation $y$: the distribution `modelo` draws from. Here $x$ is the whole prompt and $y = y_1, y_2, \dots$ what `modelo` sorts after it, both token sequences: lesson 8's $x$ with the ejemplos inside it, which is Block 2's reading (Block 1 lesson 9) |
| $T_{\text{mín}}$ | the tokens a relleno keeps, $T_{\text{ctx}}/2 = 32$ in `modelo` (`T_min` in the code): the fewest a token is drawn from once the text has overflowed the window (Block 1 lesson 9) |

**$x$, not $w$, for a token** (`COURSE-C2-P1-01`). The first course wrote $w_t$ in its two
language-model lessons and spent $x_{1:T_x}$ on the *source* of a translator; this course has one
sequence and no translator, so it takes $x$, which is what every paper the student will read
writes. Block 1 lesson 1 says so in one clause, and no later lesson writes $w_t$. The runs keep the
first course's spelling — a range subscript, never a bold letter — for the reason its Block 4 table
gives.

**The first token is given, and the index is shifted.** The mini-GPT has no `<GO>`: a training
window is $T + 1$ tokens of the corpus, the network reads $x_{1:T}$, row $t$ of $\mathbf{Z}$ is
computed from $x_{\le t}$ and predicts $x_{t+1}$, and what the network models of a window is
$p_\theta(x_{2:T+1} \mid x_1)$ — $T$ factors, not $T + 1$, and a loss that is the mean over $T$ rows.
That is the table's $p_\theta(x_{t+1} \mid x_{\le t})$ read literally, and it is the shift Block 1
lesson 1 fixes with its four-token table; every Block 1 lesson that writes the loss writes it with
that shift, and the lesson that first writes the product $\prod_t p_\theta(x_t \mid x_{<t})$ — the
chain rule, indexed on the *predicted* position — says in a clause that the factor of position $t$
comes out of row $t - 1$.

**Four letters the first course spent elsewhere**, and the lesson that first writes each says so
in one clause, because this course's reader has just come from that one: $\tau$ was the tokeniser
there and is the temperature here; $k$ was the vocabulary cut-off and is top-$k$'s; $N$, $D$ and
$C$ were the document count, the corpus and its length in characters, and are Kaplan's parameters,
tokens and compute. None of the four shares a page with its old reading — this course's tokeniser
is a fixed BPE from Block 1 lesson 2 on and never needs a letter — so the collision is across
courses, not within a lesson, and one clause settles it.

**The tokeniser's letters avoid the block's later ones** (`COURSE-C2-P1-01`). Block 1 lesson 2
needs a byte count, a merge count and a pair frequency, and three obvious letters are spoken for:
$C$ is Kaplan's compute from lesson 7, so a text's bytes are $n$, not the first course's $C$; $k$ is
top-$k$'s from lesson 4, so the merge count is $m$ (and `bpe.py`'s parameter was renamed `k` →
`m` in the same task, so the code and the page agree); and a new token is **named**, $u_i$, rather
than written $a_i b_i$, because juxtaposition is multiplication (shared §3) and a concatenation of
byte strings is not a product. $T_i$ carries a *merge* index in its subscript, not a position; the
lesson says so where it first writes it, and $T_i$ never shares an equation with $x_t$.

**Training has its own letters, and three of them dodge a reservation** (`COURSE-C2-P1-01`,
Block 1 lesson 3). Adam's two rates are **$\rho_1$, $\rho_2$, never $\beta_1$, $\beta_2$**: the shared
§4 reserves $\beta$ platform-wide for the KL coefficient, and this course's Block 2 writes it. The
Adam paper and `minigpt.py` (`beta1`, `beta2`) say $\beta$, so the lesson says in one clause that
they name the same two numbers; $\rho_1$, $\rho_2$ is the spelling of Goodfellow, Bengio and
Courville's *Deep Learning* (algorithm 8.7), so the choice has a textbook behind it. The first
course's $\rho(\mathbf{W}_{hh})$, a spectral radius, is a function of a matrix in one Block 3 lesson
there, and never meets these. **The step is $s$, not the first course's $t$**, which wrote
$\theta_t$ in its descent lesson: here $t$ is the position inside the window and both sit in one
equation, so the lesson that first writes $\theta_s$ says why in a clause. **The hat means
"estimated from a batch"** — $\hat{\mathcal{L}}$, $\hat{\mathbf{g}}$ — and nothing else, so Adam's
bias-corrected averages are written out, $\mathbf{m}_s / (1 - \rho_1^{s})$, instead of the paper's
$\hat{\mathbf{m}}_s$. $\mathbf{m}_s$ and $\mathbf{v}_s$ keep the paper's letters because
`Adam` stores `self.m` and `self.v`: bold and step-indexed, they are not lesson 2's italic $m$ (a
fusión count), and $\mathbf{v}_s$ is not a value vector, whose home is the rows of $\mathbf{V}$.
$\varepsilon$ is the first course's LayerNorm guard: the same letter doing the same job, a constant
that keeps a denominator away from zero.

**Sampling has its own letters, and $p$ alone is a number** (`COURSE-C2-P1-01`, Block 1 lesson
4). The table's $p$ is top-p's threshold, a scalar in $(0, 1]$; the model's distribution always
carries its subscript, $p_\theta$, and the lesson that first writes both says so in a clause. The
distribution the sampler draws from is **$\mathbf{q}$, not $p_\theta$**, because away from
$\tau = 1$ it is not the model's: it is a distribution made from the model's logits, and that
difference is half the lesson. The tilde means «after a corte, renormalised», and nothing else —
the hat stays «estimated from a batch». A **parenthesised subscript is a rank**, $q_{(1)} \ge
q_{(2)} \ge \dots$, the order-statistics convention; the shared §2's parenthesised *superscript*
is the layer, a bare subscript is an entry ($q_v$) or a position, and nothing else in the course
writes a parenthesised subscript. $M_j$ is free to take: Block 4's `M` lives in pseudocode only
and never enters `$…$`. And top-p is written as top-k with a $k$ the position chooses, $k_p$,
because that is the claim the lesson makes about it.

**The query carries its position; the sampler's $\mathbf{q}$ never does** (`COURSE-C2-P1-01`,
Block 1 lesson 5). Lesson 4 spent a bare $\mathbf{q}$ on the distribution the sampler draws from,
with entries $q_v$ indexed by $v \in V$; the KV-cache lesson needs the first course's attention
query back, and writes it $\mathbf{q}_t$, always with the position, beside $\mathbf{k}_t$ and
$\mathbf{v}_t$. The two never share an equation, and the lesson says in a clause which one it
means. $\mathbf{K}$ and $\mathbf{V}$ are the first course's per-head matrices, and bold
$\mathbf{V}$ is the value matrix beside italic $V$, the vocabulary, as it was there;
$\mathcal{K}^{(l)}$ and $\mathcal{V}^{(l)}$ are the $h$ of them in layer $l$. Costs are counted in
**multiplications of matrix products**, the first course's unit («una multiplicación por
casilla»), which drops the layer norms, the softmax and the ReLU; lowercase italic $c$ is a cost
and meets nothing — the first course's bold $\mathbf{c}$ was a context vector.

**Measuring has its own letters, and none of them is a hat** (`COURSE-C2-P1-01`, Block 1 lesson
6). The course's $\log$ is natural and a loss is in **nats**; the lesson that first counts bits
writes $\log_2$ and says so, and $\text{bpb}$ is roman like $\text{PPL}$. The minimiser of the
training loss is **$\theta_{\text{corpus}}$, not $\hat{\theta}$**: the hat means «estimated from a
batch» and nothing else, and the subscript ties it to $\mathcal{L}_{\text{corpus}}$, the loss it
minimises. The star is the optimum, as in $v^{\star}$ (the argmax of the logits): $\theta^{\star}$
minimises $\bar{\mathcal{L}}$, and the overline is a mean, as in $\bar{\ell}$ — here over all text of
the same origin, not over one corpus. A frequency is $f$, as lesson 2's pair frequency was, and never
$c$, which lesson 5 spent on a cost. $p_{\text{uni}}$ is a distribution and carries its subscript,
like $p_\theta$; bare $p$ stays top-p's threshold. And a model with no context is written with the
course's own letter, $p_\theta(v)$, the same at every position, rather than with a fresh vector:
$\mathbf{q}$ is the sampler's and $\mathbf{r}$ would sit next to the reserved $r_\phi$.

**Scaling has its own letters, and two of the papers' are taken** (`COURSE-C2-P1-01`, Block 1
lesson 7). Both papers write the loss $L$; here it stays $\mathcal{L}$, because the shared §4
reserves $L$ for the layer count and lesson 5 wrote $2Lt \cdot d_{\text{model}}$ with it. Chinchilla
writes $\mathcal{L}(N, D) = E + A/N^{\alpha} + B/D^{\beta}$, and three of those letters are spoken
for: $B$ is the batch size (shared §4), $\beta$ the KL coefficient (shared §4), and an italic $E$
would sit beside lessons 3 and 6's $\mathbb{E}$. So the floor is $\mathcal{L}_{\infty}$, the loss
with $N$ and $D$ infinite, in the family of $\mathcal{L}_{\text{res}}$ and $\mathcal{L}_{\text{corpus}}$;
the coefficients take the subscript of the quantity they go with, $A_N$ and $A_D$; and the
exponents are the table's $\alpha_N$, $\alpha_D$, which were always «how the loss falls with $N$ and
with $D$». The lesson names the paper's letters once, in a clause. The optimum is starred, as
$v^{\star}$ and $\theta^{\star}$ are, never subscripted $\text{opt}$; and the exponents of $C$ in
$N^{\star}$ and $D^{\star}$ are written out as fractions of $\alpha_N$ and $\alpha_D$ rather than
given the papers' $a$ and $b$, which lesson 2 spent on the two tokens of a fusión. $N_c$ and $D_c$
are Kaplan's alone; Chinchilla's constants are only ever $A_N$, $A_D$, $\mathcal{L}_{\infty}$.

**In-context learning has its own letters, and three of the literature's are taken**
(`COURSE-C2-P1-01`, Block 1 lesson 8). The latent task is written $c$ (a «concept») or $\theta$ in
the papers — Xie et al., whose model the lesson reduces, write $\theta$ — and here $\theta$ is the
model's parameters (shared §4) and $c$ lesson 5's cost, so the task is **$\omega$**, which nothing
else in the course writes; the lesson says so in a clause. Two tasks compared are $\omega_1$,
$\omega_2$, never $\omega'$: a prime reads as the transpose the shared §2 bans. The number of
examples is **$K$, not $k$**: $k$ is top-k's from lesson 4, and $K$ is what the GPT-3 paper
writes. Italic $K$ sits beside bold $\mathbf{K}$, the keys, the way italic $V$ sits beside bold
$\mathbf{V}$, and lesson 8 has no keys on its page. The text's own distribution carries a
subscript, **$p_{\text{texto}}$**, because bare $p$ is top-p's threshold (the sampling note above);
lesson 1 wrote the chain rule with a bare $p$ as a general identity, before that note existed. And
**$x$ without a subscript is a whole sequence**, the caso: lesson 8 writes no $x_t$, so the two
never share a page there, and the lesson says in a clause that this $x$ is not a token. Block 3's
task md writes the examples $e_{1:k}$; it follows this row, $e_{1:K}$.

**The function has almost no letters of its own** (`COURSE-C2-P1-01`, Block 1 lesson 9). The
project writes the model as `modelo(prompt) -> texto`, and its mathematics is lesson 1's chain rule
read with lesson 4's sampler. The continuation has **no length letter**: $m$ is lesson 2's fusión
count and $M_j$ lesson 4's masa, so the product runs over $j$ without an upper limit, as lesson 8's
sum did. The context a token is drawn from has **no letter** either: $c$ is lesson 5's cost, and the
context is a function of $x$ and $y_{<j}$ (the window keeps a known number of their last tokens), so
the condition names those. The tokens a relleno keeps are **$T_{\text{mín}}$, not $r$**: bare $r$
sits beside the reserved $r_\phi$ and Block 2's reward $r(x, y)$, while $T_{\text{mín}}$ says what it
is, the fewest tokens a draw reads, in the family of $T$ and $T_{\text{ctx}}$. It carries no index
and never shares an equation with lesson 2's $T_i$.

**$T_{\text{ctx}}$ is not $T$.** The shared §4 reserves $T$ for the sequence length — the positions
a given input actually has — and the context length is the most it may have; the KV-cache lesson
and the compaction widget both need the two on one page and say which is which the first time.

**The cache carries the layer the way every per-layer object does**: a parenthesised superscript,
$\mathcal{K}^{(l)}$, never $\mathcal{K}_l$ — the subscript slot is time's (shared §2), and a cache
indexed by layer in it would read as *the keys at step $l$*. Calligraphic because it is neither a
vector nor a single matrix but the stack of one $\mathbf{K}$ per head: $\mathcal{K}^{(l)}$ holds
$t \times d_k$ per head after $t$ positions, $t \times d_{\text{model}}$ over the $h$ heads
together, and the lesson states that shape when the cache first appears.

### Block 2 — De predecir texto a seguir instrucciones

| Symbol | Meaning |
|---|---|
| $x$, $y$ | a prompt and a response, as token sequences. In a chat, $x$ is the plantilla of the conversation followed by $\texttt{<\|asistente\|>}$, and $y$ the response's tokens followed by $\texttt{<\|fin\|>}$ (Block 2 lesson 2) |
| $\pi_\theta$ | the policy: the model as a distribution over responses, $\pi_\theta(y \mid x)$ (reserved in the shared §4). It is $p_\theta$ read through the plantilla, $\prod_j p_\theta(y_j \mid x, y_{<j})$, the product ending on $y$'s $\texttt{<\|fin\|>}$ (Block 2 lesson 2) |
| $\pi_{\text{ref}}$ | the reference policy the KL term measures against — the SFT model, frozen (reserved) |
| $r_\phi$ | the reward model, with its own parameters $\phi$ (reserved) |
| $y_w \succ y_l$ | a preference pair: the chosen response over the rejected one |
| $\beta$ | the KL coefficient — how far $\pi_\theta$ may move from $\pi_{\text{ref}}$ (reserved) |
| $\mathbb{D}_{\text{KL}}$ | the Kullback–Leibler divergence — blackboard $\mathbb{D}$, so it is never the corpus $D$ of Block 1 |
| $\sigma$ | the logistic sigmoid, as everywhere on the platform — Bradley–Terry's $\sigma(r_A - r_B)$ |
| $p_\theta(\text{obedece} \mid x)$ | the masa the model puts on the respuestas that obey the instrucción $x$, $\sum_{y \,:\, y \text{ obedece a } x} p_\theta(y \mid x)$; with $p_{\text{texto}}$ for $p_\theta$, the text's (Block 2 lesson 1) |
| $p_\theta(\text{buena} \mid x, \text{obedece})$ | the share of good respuestas among those that obey. Every buena obeys, so $p_\theta(\text{buena} \mid x) = p_\theta(\text{obedece} \mid x)\,p_\theta(\text{buena} \mid x, \text{obedece})$ (Block 2 lesson 1) |
| $\omega$ | Block 1 lesson 8's tarea, read after an instrucción: the kind of document $x$ appears in, which decides what follows it — the exam, the forum, the book of solved exercises (Block 2 lesson 1) |
| $\text{plantilla}$ | the chat template as a function: a list of mensajes in, the one token sequence the model reads out. Roman, a function's name, like $\text{softmax}$ and $\text{codificar}$ (Block 2 lesson 2) |
| $\texttt{<\|sistema\|>}$, $\texttt{<\|usuario\|>}$, $\texttt{<\|asistente\|>}$, $\texttt{<\|fin\|>}$ | the mini-GPT plantilla's four tokens especiales, ids 512 to 515: three that open a mensaje of each rol and one that closes any mensaje. Written as the vocabulary writes them, the first course's $\texttt{<EOS>}$ rule; in prose `<W>\<\|fin\|></W>` (Block 2 lesson 2) |
| $\mathbf{E}$ · $\mathbf{e}_v$ | the first course's embedding table, $\lvert V \rvert \times d_{\text{model}}$, and its row for entry $v$, which is $\mathbf{e}_v^{\top}$. The mini-GPT ties it to the output (Block 1 lesson 1's «la tabla leída al revés»), so $z_v = \mathbf{e}_v^{\top}\mathbf{h}$ (Block 2 lesson 2) |
| $\mathbf{h}$ | the vector the last block leaves at the position being predicted, after the final layer norm: what $\mathbf{E}$ multiplies to give that position's logits $\mathbf{z}$. No $t$, as lesson 4's $\mathbf{z}$ has none, because one position is in play (Block 2 lesson 2) |
| $\bar{\mathbf{e}}$ · $\bar{z}$ | the mean of the $\lvert V \rvert$ rows of $\mathbf{E}$, which every token especial starts as · the mean of the logits $z_v$ over $V$, which is then the logit each of them gets (Block 2 lesson 2) |
| $p_{\text{SFT}}$ · $p_{\text{SFT}}(x)$, $p_{\text{SFT}}(y \mid x)$ | the distribution that draws one pair $(x, y)$ of the supervised fine-tuning set at random · the share of its pairs with instruction $x$ · the share of those whose response is $y$. In the family of $p_{\text{texto}}$: the text the fine-tuning trains on (Block 2 lesson 3) |
| $\mathcal{L}_{\text{SFT}}(\theta)$ | the fine-tuning loss, $\mathbb{E}_{(x, y) \sim p_{\text{SFT}}}\left[-\log \pi_\theta(y \mid x)\right]$: Block 2 lesson 1's pretraining objective with $p_{\text{SFT}}$ for $p_{\text{texto}}$, minimised at $\pi_\theta(\cdot \mid x) = p_{\text{SFT}}(\cdot \mid x)$ on the set's instructions (Block 2 lesson 3) |
| $\mathbf{z}(x, y_{<j})$ | the logits of the position that has read $x$ and the first $j - 1$ tokens of $y$, and bets on $y_j$: Block 1 lesson 1's $\mathbf{z}_t(x_{\le t})$ with the input named in the block's two pieces, so it carries no position. $\mathbf{z}(x, y_{<1})$ reads $x$ whole, up to $\texttt{<\|asistente\|>}$ (Block 2 lesson 3) |
| $\mathbf{o}_v \in \{0, 1\}^{\lvert V \rvert}$ | the one-hot of entry $v$, the first course's (`dl-nlp` Block 1): the gradient of $-\log \text{softmax}(\mathbf{z})_v$ with respect to $\mathbf{z}$ is $\text{softmax}(\mathbf{z}) - \mathbf{o}_v$ (Block 2 lesson 3) |
| $y_A$, $y_B$, $y_C$ | responses to one instruction before anyone has chosen between them: what Bradley–Terry states $P(y_A \succ y_B \mid x)$ of. Once an anotador has chosen, the pair is $y_w \succ y_l$. The widget's $r_A$, $r_B$ are $r(x, y_A)$, $r(x, y_B)$ (Block 2 lesson 4) |
| $r(x, y)$ | the reward: one number per (instrucción, respuesta), with $P(y_A \succ y_B \mid x) = \sigma\big(r(x, y_A) - r(x, y_B)\big)$, defined up to $\kappa(x)$. $r_\phi$ is a network that computes one (Block 2 lesson 4) |
| $\kappa(x)$ | a constant per instrucción: adding it to every reward of $x$ changes no comparison (Block 2 lesson 4) |
| $\text{margen}$ | $r(x, y_A) - r(x, y_B)$, or $r_\phi(x, y_w) - r_\phi(x, y_l)$ for a comparison: the log of the odds, $P/(1 - P) = e^{\text{margen}}$. Roman, a named quantity like $\text{acierto}$; an English lesson writes $\text{margin}$ (Block 2 lesson 4) |
| $p_{\text{pref}}$ | the distribution that draws one comparison $(x, y_w, y_l)$ of the preference set at random, in the family of $p_{\text{texto}}$ and $p_{\text{SFT}}$ (Block 2 lesson 4) |
| $\mathcal{L}_{\text{R}}(\phi)$ | the reward model's loss, $\mathbb{E}_{(x, y_w, y_l) \sim p_{\text{pref}}}\left[-\log \sigma\big(r_\phi(x, y_w) - r_\phi(x, y_l)\big)\right]$: the first course's binary cross-entropy with the margin for $z$ and the label always 1. The DPO paper's $\mathcal{L}_R$, and R reads as *recompensa* and *reward* alike (Block 2 lesson 4) |
| $\mathbf{h}(x, y_{\le j})$ · $\bar{\mathbf{h}}(x, y)$ | $\mathbf{h}$ at the position that has read $x$ and the first $j$ tokens of $y$, named by what it read as $\mathbf{z}(x, y_{<j})$ is · its mean over the tokens of $y$, $\mathbb{E}_j\left[\mathbf{h}(x, y_{\le j})\right]$ with $j$ uniform, $\texttt{<\|fin\|>}$ included (Block 2 lesson 4) |
| $\mathbf{u}$, $b$ | the weight vector and bias of the mini-GPT reward model's linear layer, $r_\phi(x, y) = \mathbf{u}^{\top}\bar{\mathbf{h}}(x, y) + b$, so $\phi = (\mathbf{u}, b)$: 65 numbers (Block 2 lesson 4) |

**An event in words is a set of respuestas** (`COURSE-C2-P1-02`, Block 2 lesson 1). Inside a
distribution, roman text names the set of respuestas it describes, and the probability is that
set's masa, lesson 4's word for the sum over a set of entries: $p_\theta(\text{obedece} \mid x)$
sums $p_\theta(y \mid x)$ over the $y$ that obey $x$. Roman because it is a word, as
$\text{acierto}$ and $\text{PPL}$ are, and never a mention: it is the set, not the string
<W>obedece</W>. Letters for the two sets were the alternative, and the obvious ones are spoken for:
$B$ is the batch size (shared §4), $A$ is Block 3's allowed set $A_t$ and Chinchilla's $A_N$,
$\mathcal{C}$ would sit beside $C$, the compute, and a calligraphic $\mathcal{R}$ beside $r_\phi$
and $r(x, y)$ two lessons later. A word in the condition says what the set is, which no letter
would. The device is held to these two events, and a lesson that wants a third adds its row here
first. $\omega$ keeps lesson 8's meaning rather than taking a new letter: a document's tarea is what
it does next, and after an instrucción that is exactly what is in question.

**The plantilla is stated in words, and its tokens are spelled, not lettered** (`COURSE-C2-P1-02`,
Block 2 lesson 2). A mensaje is a rol and a contenido, and the obvious letters for them are spoken
for: $r$ sits beside the reserved $r_\phi$ and the reward $r(x, y)$ two lessons later, and $c$ is
Block 1 lesson 5's cost. The set of tokens especiales has no letter either, since $S$ is the number
of training steps; the lesson says «los cuatro especiales» and writes the $4$ where it counts them.
So the lesson defines $\text{plantilla}$ in a sentence (each mensaje is its rol's token, the tokens
of $\text{codificar}(\text{contenido})$ and $\texttt{<|fin|>}$, one mensaje after another) and keeps
its displays for what a sentence cannot carry: $\pi_\theta$ as a product, and the bound on a token
especial nobody has trained. Concatenation therefore never needs a sign, which matters because
juxtaposition is multiplication (shared §3). The mask over a conversation's tokens has no symbol
for the same reason: $m$ is lesson 2's fusión count, and the claim the mask carries, that its sum
is $\log \pi_\theta(y \mid x)$, is written with $\pi_\theta$. $\mathbf{h}$ without a subscript is
the last block's output at one position. The first course wrote $\mathbf{h}_t$ for an RNN's hidden
state and $\mathbf{h}^{(l)}$ for a layer's activation, and this is the latter at the last layer,
normalised. No page has two of them. The overline is a mean, as in $\bar{\ell}$ and
$\bar{\mathcal{L}}$.

**Fine-tuning has a distribution, not a set letter** (`COURSE-C2-P1-02`, Block 2 lesson 3). The
obvious letter for the set of pairs, $D$, is Kaplan's token count (Block 1 lesson 7) and Block 3's
evaluation set, and the papers' calligraphic $\mathcal{D}$ is not needed: the lesson writes the loss
as an expectation under $p_{\text{SFT}}$, the way Block 2 lesson 1 wrote pretraining under
$p_{\text{texto}}$, and that parallel is the lesson's point. The number of pairs has no letter
either ($n$ is lesson 2's bytes, $N$ Kaplan's parameters, $K$ lesson 8's ejemplos). The logits are
named by what their position read, $\mathbf{z}(x, y_{<j})$, not by an index: a $t$ would count the
positions of the whole conversation, and $\mathbf{z}_j$ would read as position $j$. The one-hot is
the first course's $\mathbf{o}_v$, always subscripted by an entry; Block 1 lesson 5 wrote
$\mathbf{o}_t^{\top}$ for a row of an attention head's output, subscripted by a position, and the
two never share a page. $\mathcal{L}_{\text{SFT}}$ keeps the block task md's subscript, an acronym
set in roman like $\text{PPL}$.

**Preferences dodge four of the literature's letters** (`COURSE-C2-P1-02`, Block 2 lesson 4). The
DPO paper writes two responses $y_1$, $y_2$, and here $y_j$ is token $j$ of $y$ (Block 1 lesson 8),
so two responses before a choice are $y_A$, $y_B$: a capital subscript is a label, never a position.
The paper calls the per-prompt freedom $f(x)$, and $f$ is Block 1's frequency; $c$ is Block 1 lesson
5's cost, the reason Block 2 lesson 2 already refused it. So the constant is $\kappa(x)$, which
nothing else in either course writes. The margin has no letter: $m$ is lesson 2's fusión count and a
$\Delta$ would sit beside the first course's batched error $\boldsymbol{\Delta}^{(l)}$, so it is the
word, $\text{margen}$, in roman as $\text{acierto}$ is. The reward head's weight is $\mathbf{u}$, not
the first course's neuron $\mathbf{w}$, because $w$ already marks the preferred response and the two
meet in the gradient, $\mathbf{u}^{\top}\left(\bar{\mathbf{h}}(x, y_w) - \bar{\mathbf{h}}(x, y_l)\right)$;
the lesson says so in a clause. $b$ keeps the first course's meaning, a bias. The mean of $\mathbf{h}$
takes the overline, a mean as in $\bar{\ell}$ and $\bar{\mathbf{e}}$, and $\mathbf{h}$ is named by
what its position read, like $\mathbf{z}(x, y_{<j})$; there is no length letter for $y$, as Block 1
lesson 9 already decided, so the mean is an $\mathbb{E}_j$ with $j$ uniform, Block 1 lesson 3's
$\mathbb{E}_i$. $\mathcal{L}_{\text{R}}$ is the DPO paper's own subscript, so lesson 15 can say
that its loss is this one with another reward inside.

**Two networks on one page need two parameter letters.** $\theta$ is the policy's and $\phi$ the
reward model's, and the split is the point of the block: the reward model is trained first, then
frozen while $\theta$ moves. A lesson that wrote $\theta$ for both would make the RLHF objective
read as if the reward were being optimised along with the policy.

**$\beta$ is reserved platform-wide** from this task on (shared §4). The first course's Block 1
lesson 3 wrote it for Heaps' law exponent before the reservation existed; that use stays, named
in `dl-nlp`'s table, and the two never share a page.

### Block 3 — Hablar con el modelo es programar

| Symbol | Meaning |
|---|---|
| $\mathbf{q}$, $\mathbf{d}_i$ | the query embedding and the $i$-th document embedding in retrieval; the score is $\mathbf{q}^{\top}\mathbf{d}_i$ or $\cos(\mathbf{q}, \mathbf{d}_i)$ |
| $\mathcal{G}$ | a grammar — the set of strings constrained decoding may produce |
| $A_t \subseteq V$ | the allowed set at position $t$: the vocabulary entries $\mathcal{G}$ admits next, given the prefix |
| $\hat{s}$ | a score — what an evaluator assigns one response |
| $\text{acierto}$ | accuracy on an evaluation set, $\text{acierto}(D)$, as the first course wrote it |

**The $\mathbf{q}$ collision, resolved by context and said once.** $\mathbf{q}$ is the attention
query throughout the first course. In Block 1 here it always carries its position, $\mathbf{q}_t$
— the KV cache is the cache of what $\mathbf{q}_t$ is scored against — because Block 1 lesson 4
spent the bare $\mathbf{q}$ on the sampler's distribution (see the Block 1 note). Retrieval's query is the same word for the same role, a vector
scored against a set of others, which is why the letter is kept rather than dodged. The lesson
that introduces retrieval says once, in one clause, that this $\mathbf{q}$ is the retriever's
query and not an attention head's, and the two never share an equation — the move the shared §3
makes for $t$ and $d$ in the first course.

**$\text{acierto}$, not $\text{acc}$.** The first course settled `tasa de acierto` as the term
and $\text{acierto}(D)$ as its symbol (its Block 2 lesson 10), and the evals lesson here measures
the same quantity — the fraction a model gets right on a held-out set. One concept, one symbol,
across both courses; the English *accuracy* is given once per lesson, as the acronym rule asks.

### Block 4 — El puente: de texto a acciones

No new mathematics, and the block's first lesson says so in its opening. What the block fixes is
**words**, not symbols — the object language of the shared §6 applied to a system: *herramienta*,
*llamada*, *observación*, *turno*, *entorno*, *permiso*, defined in the course's terminology table
([AUTHORING.md §4](AUTHORING.md#4-terminology-5--seeded)). The one letter is $M$, the loop's state
— the messages list — and it lives in **pseudocode only**: `M`, in a fenced block or in backticks,
never inside `$…$`. (It was the type count in the first course; there is no page on which the two
could meet, and a symbol that never enters maths is not a symbol.)

### Block 5 — Un agente de programación en la terminal

None. Object language: *harness*, *compactación*, *sandbox*, *subagente*, *protocolo* — the
terminology table. Product names only in `reading` (the AUTHORING delta's product-name rule). The
one quantity the block counts, the window — `tokens(M)` against `umbral` — is code, and stays
code.

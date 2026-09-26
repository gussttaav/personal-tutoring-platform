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
| $\text{PPL}$ | perplexity — $\exp$ of the mean per-token cross-entropy |
| $N$, $D$, $C$ | parameters, training tokens, compute — Kaplan's letters |
| $\alpha_N$, $\alpha_D$ | the scaling exponents: how the loss falls with $N$ and with $D$ |
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
| $x$, $y$ | a prompt and a response, as token sequences |
| $\pi_\theta$ | the policy: the model as a distribution over responses, $\pi_\theta(y \mid x)$ (reserved in the shared §4) |
| $\pi_{\text{ref}}$ | the reference policy the KL term measures against — the SFT model, frozen (reserved) |
| $r_\phi$ | the reward model, with its own parameters $\phi$ (reserved) |
| $y_w \succ y_l$ | a preference pair: the chosen response over the rejected one |
| $\beta$ | the KL coefficient — how far $\pi_\theta$ may move from $\pi_{\text{ref}}$ (reserved) |
| $\mathbb{D}_{\text{KL}}$ | the Kullback–Leibler divergence — blackboard $\mathbb{D}$, so it is never the corpus $D$ of Block 1 |
| $\sigma$ | the logistic sigmoid, as everywhere on the platform — Bradley–Terry's $\sigma(r_A - r_B)$ |

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
query throughout the first course and in Block 1 here — the KV cache is the cache of what
$\mathbf{q}$ is scored against. Retrieval's query is the same word for the same role, a vector
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

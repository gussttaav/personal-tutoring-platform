# AUTHORING.md — how a lesson gets made

**Tag:** `COURSE-P5-00` · Companion to [NOTATION.md](NOTATION.md) · Template:
[`content/courses/dl-nlp/_template.mdx`](../../content/courses/dl-nlp/_template.mdx)

Phase 5 is ~40 lessons. Anything left undecided here gets re-decided 40 times, differently each
time, and the course ends up reading like a pile of tutorials written by several people. This file
is the contract. Read it once, then work from the template and the checklist at the bottom.

The rule that outranks everything below: **fix authoring friction immediately, don't work around
it.** Ten extra minutes per lesson is a lost week across the course.

---

## 1. The six-step structure

Every lesson, in this order:

1. **Motivación** — the question this lesson answers. Two paragraphs. Why should anyone care?
2. **Intuición** — the idea in words and pictures, before any symbol. Usually an `<Explorable>`.
3. **Formalización** — the mathematics. Complete, not hand-waved. `<Details>` for the longest
   derivations, so the page stays readable without hiding the rigour.
4. **Implementación** — NumPy from scratch, in a `<PyCell>` the student actually runs.
5. **Verificación** — a `<Quiz>`, and a `<CodeChallenge>` when there is something to build.
6. **Puente** — what this lesson leaves unsolved, and which lesson solves it.

Step 4 is the only one that may take a different form: in a deliberately code-free lesson (Block 1
lesson 1 is one, because it is the first impression) it becomes a worked example the student
computes on paper. What it may not become is *absent*. Every lesson makes the abstraction concrete
somewhere; without that step, formalisation goes straight to quiz and the student has never touched
the object.

**Step 6 is what makes this a course rather than a pile of tutorials.** Block 4 exists entirely
because most courses skip the bridge, and attention ends up looking like it appeared from nowhere.
Every lesson ends pointing forward — including the last one of a block, which points at the next
block.

### These six are not headings

**A template is a great authoring tool and a terrible reader interface.** The six steps are the
shape of the argument, and the argument should be invisible: a student reading `## Motivación`,
`## Intuición`, `## Formalización` in lesson after lesson is not reading an explanation, they are
watching a form get filled in. The machinery is for you. Never ship it.

Two rules follow.

**1. Never use a step name as heading text.** Not `## Motivación`, not `## Puente`, not
`## Implementación`. If a heading earns its place, it says what *this* lesson does there:
`## Construyendo la matriz one-hot en NumPy`, not `## Implementación`. `pnpm lint:content` warns
when a heading is one of the six names.

**2. Most steps get no heading at all.** Motivación, Intuición and Puente are narrative moments —
you hook the reader, build the picture, then leave a door open. That is prose and transitions, not
labels. Motivation is the first two paragraphs. The bridge is the last two. Putting a heading on
either turns a continuous line of thought into compartments.

What reliably earns a heading is a **change of mode** — the point where the student stops reading
and starts doing:

| Step | Heading? |
|---|---|
| Motivación | No. It is the opening paragraphs. |
| Intuición | No — it flows out of the motivation. |
| Formalización | Usually yes, when the maths runs long: it is also a mode change ("now we get precise"), and the reader wants an anchor back to it. Title it by content. |
| Implementación | **Yes.** "Stop reading, run this." |
| Verificación | **Yes.** "Stop reading, test yourself." |
| Puente | No. It is the closing paragraphs. |

So a typical lesson has **two to four `##` headings**, all of them describing content. A lesson with
six headings named after the six steps has failed this rule even though it followed the structure
perfectly.

Only `##` and `###` feed the on-this-page rail. Don't use `#` — the lesson title comes from the
frontmatter and is rendered by the reader chrome.

## 2. What a lesson may assume

A lesson may use exactly two things: the **course prerequisites**, and **everything taught in the
lessons before it**. Nothing else, and the boundary is not negotiable by convenience.

The prerequisites are stated in `course.es.yml` and the student was promised them before paying
attention to anything:

- Python intermedio — funciones, clases, NumPy básico
- Álgebra lineal — vectores, matrices, producto matricial
- Cálculo — derivadas parciales y regla de la cadena

Note what that does and does not license. **Matrices are a prerequisite; weight matrices are not.**
$\mathbf{W} \in \mathbb{R}^{m \times d}$ as a linear-algebra object is fair game in lesson one.
"The weight matrix of the first layer" is Block 2 content, and using it in Block 1 to explain
something means the explanation rests on a thing the student has not been given.

This is the easiest rule in this file to break, because the later material is what *you* find
obvious — you know why text has to become vectors, and the shortest way to say it is in terms of
layers and gradient descent. That shortest path is borrowed against a debt the student cannot pay
yet. Block 1 lesson 1 was written that way first, and had to be rewritten: it explained the gap
using `\mathbf{W}\mathbf{x} + \mathbf{b}`, the first layer, and gradient descent — three things
Block 2 exists to build. The fix was to state the argument at the level Block 1 actually owns: a
network is a function, functions take numbers, text is not numbers. That version is both correct
*and* stronger, which is the usual outcome.

**Forward references are fine when they are signposted, and only then.** "Cómo aprende un modelo es
el bloque 2; por ahora basta con que aprender consiste en corregir poco a poco" tells the student
this is a promissory note and that they are not missing anything. Using the same idea silently, as
if it were shared ground, is what leaves a reader quietly feeling stupid. Say the debt out loud.

When you catch yourself needing a later concept, one of three things is true, and all three are
worth knowing:

1. **The argument can be made at a lower level** — usually it can, and it is usually better.
2. **The lesson is in the wrong place** in the syllabus.
3. **A prerequisite is missing** from `course.es.yml`, and adding it there is the honest fix.

Nothing checks this mechanically. It is a review question, and the first one to ask.

### Referring to other blocks and lessons

**Blocks are 1..5** — the `id` in `course.es.yml`, the number the sidebar shows, and the number the
prose uses are all the same number. (They were 0..4 until P5-00; if you find a stray "bloque 0"
anywhere, it is a leftover.)

**Lessons are numbered within their block**, starting at 1, and the sidebar shows that number.

In Spanish prose both are common nouns and stay **lowercase** mid-sentence: *el bloque 2*, *la
lección 3* — never *el Bloque 2*. Capitalise only at the start of a sentence or in a heading.

**Always name the topic alongside the number:**

> ✅ la lección 3, sobre vocabulario y OOV · lo verás en el bloque 2, al construir el MLP
> ❌ la lección 3 · lo verás en el bloque 2

A bare ordinal is a reference that rots. Insert one lesson into a block and every "la lección 3"
elsewhere in the course silently points at the wrong place — across 40 lessons, written over
months, that *will* happen, and nothing checks it. Naming the topic makes the reference
self-correcting: the number may drift, but the reader can still find what you meant.

## 3. The budget

Targets, not laws. But a lesson over them should be **split**, and `pnpm lint:content` says so.

| Dimension | Target | Hard ceiling |
|---|---|---|
| Words | 1,200–2,000 | 3,000 |
| Reading time | 20–30 min | 40 min |
| Display equations | 5–12 | 20 |
| Widgets | 1–2 | 3 |
| Code cells | 1–3 | 5 |
| Quiz questions | 3–5 | 8 |
| Code challenges | 0–1 | 2 |

**A lesson at the ceiling on every axis is not a lesson, it is a chapter.**

Word counts exclude LaTeX, code and JSX — the number tracks how much *prose* a student has to get
through, not how maths-heavy the lesson is. Zero widgets and zero code cells never warn: a
prose-only lesson (Block 1 lesson 1) is a legitimate design choice. Being under budget on **words**
or **quiz questions** does warn — a 400-word lesson is usually half a lesson.

`minutes` in the frontmatter is what the reader UI promises the student. The lint estimates it from
the content — **120 wpm**, plus a flat cost per widget, cell, question and challenge — and warns
when the two diverge badly. Take the estimate as a sanity check, not as the answer.

**Reading time has no lower bound.** It only warns above 30 minutes, and tells you to split above
40. There is no floor because there cannot be a useful one: for a prose-only lesson the estimate is
`words/120 + questions`, so clearing 20 minutes would need more than 2,000 words — past the word
target. Two floors measuring the same thing, disagreeing. `words` is the one that keeps its floor.

120 wpm is a *study* rate, not a reading rate — this is prose the student re-reads and works
derivations out of. In practice a full six-step lesson lands around 1,400–1,900 words; if you are
at 900 and think you are done, a step is missing, and it is usually the bridge or the derivation.

Budget warnings **never fail the build.** They are a nudge to consider splitting. If a lesson is
deliberately outside the budget forever — the rendering fixture is the only current case — put
`{/* content-budget: ignore — <reason> */}` in the body and say why.

## 4. Notation

See [NOTATION.md](NOTATION.md), and add to it before using a symbol it does not cover. Five of its
rules are checked mechanically by the lint (warnings, not failures). The short version:

- Scalars italic $x$, vectors $\mathbf{x}$, matrices $\mathbf{W}$ — always `\mathbf`.
- Layer superscript in parens $\mathbf{W}^{(l)}$; indices subscript $\mathbf{W}^{(l)}_{ij}$; time a
  subscript $\mathbf{h}_t$; transpose `^{\top}`.
- Batch dimension first, always. **State the shape** whenever a new array appears.
- $\mathcal{L}$ loss, $\sigma$ sigmoid, $\eta$ learning rate, $T$ sequence length,
  $d_{\text{model}}$ model dimension, $h$ heads.

## 5. Tone

- **Spanish, `tú` form.** Technical but not stiff.
- **Anglicisms where they are the real term** — *embedding*, *attention*, *batch*, *token*.
  Italicise on first use in a lesson, then plain. Translating *embedding* to *incrustación* helps
  nobody. Which words those are is fixed below, not decided per lesson.
- **Never "obviamente", "simplemente", "trivialmente".** If it were obvious the lesson wouldn't
  exist, and these words are how you make a student feel stupid for needing the explanation.
  ("Basta con" and "no es más que" are the same move wearing a hat.)
- **Derivations shown, not asserted.** This is the course's differentiator: it does the algebra. If
  a step is long, it goes in `<Details>` — it does not go away.
- **Spanish examples throughout.** A Spanish course tokenising English sentences is a small,
  constant signal that it is a translation of someone else's material. Spanish has better examples
  anyway: clitics (*dámelo*), contractions (*del*, *al*), inflection, `ñ` and accents.

### Terminology — one term per concept

**One concept, one word, course-wide.** Not because synonyms are bad writing — in ordinary prose
they are good writing — but because in a technical explanation a reader cannot tell a synonym from
a distinction. A student who meets *modelo* in one paragraph and *red* in the next spends attention
deciding whether the switch meant something. Across 40 lessons that tax is paid on every page, and
it is paid by exactly the readers who are least sure of the material.

This is the prose counterpart of [NOTATION.md](NOTATION.md): that file fixes the symbols, this
fixes the words. Same rule — **if a lesson needs a term that is not here, add it here first.**

#### `modelo`, `red neuronal`, `sistema`

These are not synonyms and must not be swapped freely:

| Term | Means | Use it when |
|---|---|---|
| `red neuronal` (or `la red`) | the neural network specifically | the claim is about a network: its layers, its weights, what it computes |
| `modelo` | the trained artefact, neural or not | the claim is about learning, generalising, being trained, being deployed |
| `sistema` | anything that consumes the representation | the claim holds regardless of what is downstream |

**In Block 1, prefer `modelo` or `sistema`.** Most of what consumes these representations in that
block — bolsa de palabras, TF-IDF, similitud coseno — is not a neural network at all, so
`red neuronal` is both over-specific and a forward reference to Block 2 (see §2). Say `red neuronal`
in Block 1 only when you mean a network and nothing else.

#### Spanish or English

The syllabus already commits to these. Anglicisms are italicised on **first use per lesson**, then
plain. Never italicise the Spanish terms.

| Concept | Use | Not |
|---|---|---|
| *embedding*, *token*, *batch*, *attention*, *self-attention* | the English term | incrustación, ficha, lote, atención |
| *one-hot encoding*, *scaled dot-product*, *multi-head*, *layer norm*, *fine-tuning*, *softmax*, *encoder*, *decoder*, *forward pass* | the English term | any translation |
| *backpropagation* | the English term | retropropagación |
| capa, peso, sesgo | Spanish | layer, weight, bias |
| pérdida, gradiente, descenso de gradiente | Spanish | loss, gradient, gradient descent |
| entrenamiento, entrenar | Spanish | training, entrenar el *training* |
| vocabulario, tokenización, bolsa de palabras, codificación posicional | Spanish | vocabulary, tokenisation, bag of words, positional encoding |
| maldición de la dimensionalidad | Spanish | curse of dimensionality |

The line is not "English is cooler": it is whether a Spanish term is genuinely in use among people
who do this work. *Capa* and *pérdida* are; *incrustación* and *atención* are not. Where both
circulate — *backpropagation* / *retropropagación* — the course picks one and this table is where
it is picked, because the alternative is that each lesson picks separately.

> **Open:** `course.es.yml` still says *retropropagación* in the Block 2 summary, against
> *backpropagation* in the syllabus titles and the `backpropagation` slug. One of the two has to
> move; the table above assumes the slug wins.

#### Acronyms

**Expand every acronym on first use, in every lesson**, then use it bare: *palabras fuera de
vocabulario (out-of-vocabulary, OOV)*, then *OOV* thereafter. Give the English expansion even when
the surrounding term is Spanish — the acronym comes from the English, and a reader who only ever
sees `OOV` cannot look it up.

Per **lesson**, not per course, and this is the part that is easy to get wrong. Lessons are entered
from search results, from the sidebar and from a link in another lesson, so "I defined it in lesson
3" is not a defence for lesson 8. It costs four words.

This is §2 in miniature: an unexpanded acronym is a thing the student has not been given, dressed
up as a thing they should already know. That is precisely the move that makes a reader feel stupid
rather than informed.

#### Adding a term

Add the row **before** writing the lesson that needs it, not after. A term settled while you are
mid-paragraph is settled by whichever word came out first.

## 6. Frontmatter reference

All eleven keys are **required**, including empty arrays. The schema is `z.strictObject`
([`src/lib/schemas.ts`](../../src/lib/schemas.ts)) — an unknown key is a hard build failure, which
is exactly how the `mintues:` typo gets caught.

```yaml
slug: tokenizacion        # must equal the filename minus its `NN-` prefix
title: "Tokenización: palabras, caracteres, subpalabras"
block: 1                  # must be declared in course.es.yml — blocks are 1..5
order: 2                  # position within the block
minutes: 25               # integer > 0; what the reader UI shows
summary: "Una frase para el índice y el SEO."
draft: true               # flip to false in the PR that publishes it
hasCode: true             # must agree with the body — see §8
hasQuiz: true             # must agree with the body — see §8
quiz: []                  # required even when empty
challenges: []            # required even when empty
```

### Quiz questions

Questions live in the frontmatter, not inline, so they can be validated, counted and re-graded.
Every type requires `id`, `prompt`, `explanation`; `hint` is optional everywhere. **`explanation` is
required** — a question with no explanation teaches nothing.

| `type` | Also requires |
|---|---|
| `single` | `options` (≥2, `{id, text}`), `answer` (an option id) |
| `multi` | `options` (≥2), `answer` (array of option ids; graded all-or-nothing) |
| `boolean` | `answer` (`true`/`false`) |
| `numeric` | `answer` (number), `tolerance` (number ≥0, written explicitly), optional `unit` |
| `predict-output` | `code` (shown, **not** runnable), `answer` (the expected stdout), optional `language` |

### Code challenges

```yaml
challenges:
  - id: ch-tokeniza
    prompt: "Implementa `tokeniza(texto)` …"     # markdown + LaTeX allowed
    packages: [numpy]                            # optional
    starter: |                                   # required, non-empty
      def tokeniza(texto):
          # tu código aquí
          pass
    tests:                                       # ≥1, names unique, assertions hidden
      - name: "separa por espacios"
        code: "assert tokeniza('hola mundo') == ['hola', 'mundo']"
    solution: |                                  # required — unlocks after 3 failures
      def tokeniza(texto):
          return texto.split()
    explanation: "…"                             # required
```

Write assertion messages for the student, not for you: `assert …, 'desborda: resta el máximo antes
de exponenciar'` is worth ten minutes of their time.

## 7. Components

| Component | Props | Notes |
|---|---|---|
| `<W>` | none — wraps the string | A word/phrase the lesson talks *about*. Not italics, not backticks — [NOTATION.md §6](NOTATION.md#6-object-language--words-the-lesson-talks-about) |
| `<Callout>` | `type?`: `note` \| `warning` \| `intuition` \| `math`, `title?` | Server-rendered, no JS |
| `<Figure>` | `src`, `alt` (both required), `caption?` | |
| `<Details summary="…">` | `summary` required | Native `<details>`; use for long derivations |
| `<ColabLink notebook="…">` | URL, or `github/user/repo/blob/main/nb.ipynb` | Block 5's escape hatch to a GPU |
| `<Explorable id="…" caption?="…">` | `id` must be a registered widget | Lazy-loaded on the lesson route only |
| `<PyCell code={`…`} packages?={[…]}>` | `code` is a **prop, not children** | Requires `hasCode: true` |
| `<Quiz id="…">` | `id` must match a frontmatter question | Requires `hasQuiz: true` |
| `<CodeChallenge id="…">` | `id` must match a frontmatter challenge | Also satisfies `hasCode: true` |

**Widget ids** ([`widget-ids.ts`](../../src/features/courses/widgets/widget-ids.ts)) — an id not on
this list is a hard lint failure:

`sigmoid-explorer` · `tokenizer-playground` · `onehot-vs-embedding` · `embedding-projection` ·
`activation-explorer` · `perceptron-boundary` · `gradient-descent-2d` · `backprop-trace` ·
`loss-landscape`

Blocks 3–5 widgets do not exist yet. Adding one is `widget-ids.ts` + `registry.ts`, and it is a
separate PR from the lesson that uses it.

## 8. MDX and LaTeX gotchas

These cost real time the first time. Read them before writing, not after.

- **`$$…$$` on one line renders INLINE**, not as a display equation. remark-math needs the fences on
  their own lines:

  ```mdx
  $$
  \mathcal{L} = -\sum_k y_k \log \hat{y}_k
  $$
  ```

  The lint's equation count follows the same rule, so a lesson that looks equation-heavy but reports
  `0 eq` has its fences inline.

- **`rehype-katex` throws on malformed LaTeX, by design.** A missing brace fails `pnpm build` rather
  than shipping a red error box. That is good; it also means `pnpm build` is a LaTeX check.

- **`<PyCell>` takes `code` as a prop**, in a template literal, because MDX parses children as
  markdown and mangles indentation — which in Python is syntax. Leading blank line and common
  indentation are stripped for you, so indent the literal to match the surrounding MDX.

- **Backticks inside a `<PyCell>` template literal** end the literal. Python rarely needs them; if
  you do, escape as `` \` ``.

- **`{` and `<` in prose are JSX to MDX.** Write `\{` and `\<`, or wrap in backticks. A stray `<`
  before a word produces a confusing "unexpected character" compile error.

- **MDX comments are `{/* … */}`**, never `<!-- -->`. HTML comments render as literal text.

- **A component tag inside an MDX comment still counts for the lint.** The content passes read the
  file with regular expressions, not an MDX parser, so a commented-out `<Quiz id="…" />` is still a
  reference that has to resolve, and a commented-out `<PyCell>` still forces `hasCode: true`. To
  disable a component, **delete it** — do not comment it out.

- **Curly braces inside maths are safe** — `$\{1, \dots, n\}$` works, because remark-math claims the
  `$…$` span before MDX sees the braces.

- **YAML frontmatter with LaTeX: single-quote it.** `prompt: '¿Cuál es $\sigma(x)$?'` — double
  quotes make YAML interpret `\s` as an escape. Multi-line prose uses a `|` block scalar.

- **Frontmatter text is markdown, not MDX.** Quiz prompts, options and explanations render through
  `react-markdown`, so a literal `<UNK>` inside backticks is safe there — while the same thing in
  the prose body is JSX and needs escaping. Two different parsers, two different rules.

- **A `#` inside a fenced Python block is not a heading.** The outline extractor is fence-aware, so
  comments in code cells are safe.

## 9. Adding a lesson, end to end

```bash
# 1. Create the file. NN is the order prefix; the rest MUST equal the frontmatter slug.
cp content/courses/dl-nlp/_template.mdx content/courses/dl-nlp/es/02-tokenizacion.mdx

# 2. Fill the frontmatter (§6). Leave `draft: true` while you write.
# 3. Write the six steps (§1), in Spanish (§5), against NOTATION.md (§4).
# 4. Wire the widgets, quiz questions and challenges — ids must resolve (§7).

# 5. Read it in the browser. Not optional. NOTE: a draft has NO page — `draft: true`
#    is excluded from `generateStaticParams`, so the URL 404s even in dev. Flip to
#    `draft: false` to preview, and flip back if the lesson is not ready to ship.
pnpm dev            # → http://localhost:3000/cursos/dl-nlp/tokenizacion

# 6. RUN EVERY CODE CELL AND EVERY CHALLENGE IN THE BROWSER. Not optional either.
# 7. Lint, then build.
pnpm lint:content   # hard errors + the budget/notation report
pnpm build          # this is also the LaTeX check

# 8. Leave `draft: false` and open the PR — ONE LESSON PER PR.
```

**The draft-preview flip is real friction and it is on the list.** You cannot see a lesson without
publishing it, which means the flag is toggled back and forth during authoring and is easy to commit
in the wrong state. Check it deliberately in step 8. If this bites more than a couple of times,
stop and add a dev-only draft preview rather than living with it — see the phase rule about fixing
friction immediately.

**One lesson per PR.** Reviewing a ten-lesson PR is not reviewing. It also keeps `git log` useful as
a record of when each lesson landed.

Scratch files: anything named `_something.mdx`, or anything under a `_drafts/` directory, is skipped
by the registry and by every content pass. Use that instead of commenting a lesson out.

## 10. Pre-merge checklist

Copy this into the PR description.

- [ ] **Uses nothing beyond the prerequisites and the lessons before it**; every forward reference
      is signposted as one
- [ ] Six steps present, in order, and the lesson **ends on a bridge forward**
- [ ] **No heading is named after a step**; two to four `##`, each describing what this lesson does
      there; motivation, intuition and bridge are prose with no heading at all
- [ ] Within budget on every axis, or the overrun is deliberate and explained in the PR
- [ ] Notation matches `NOTATION.md`; `pnpm lint:content` reports no notation warnings
- [ ] Spanish `tú`; no "obviamente" / "simplemente" / "trivialmente"; Spanish examples
- [ ] **One term per concept**, matching the §5 terminology tables; `modelo` / `red neuronal` /
      `sistema` used for their own senses, not as synonyms; anglicisms italicised on first use only
- [ ] **Every acronym expanded on first use in *this* lesson** — OOV, BPE, BPTT, TF-IDF, MLP, RNN —
      even if an earlier lesson already expanded it
- [ ] Every derivation shown, not asserted
- [ ] `summary`, `minutes`, `block`, `order` filled and honest
- [ ] `hasCode` / `hasQuiz` agree with the body
- [ ] **Every code cell run in the browser, output correct**
- [ ] **Every challenge solved in the browser** — starter fails, solution passes, an empty
      submission fails with a useful message
- [ ] Every quiz question answered in the browser, right and wrong, explanations read
- [ ] Read on a phone (360px): no horizontal scroll on the page body; wide equations, tables and
      code scroll inside their own boxes
- [ ] `pnpm lint:content` and `pnpm build` green
- [ ] `draft: false`
- [ ] One lesson in this PR

A code cell that does not execute is worse than no code cell. That is why two of these are in bold.

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
6. **Puente** — what this lesson leaves unsolved, and which lesson solves it. Preceded by a `---`
   and by nothing else.

Step 4 is the only one that may take a different form: in a deliberately code-free lesson (Block 1
lesson 1 is one, because it is the first impression) it becomes a worked example the student
computes on paper. What it may not become is *absent*. Every lesson makes the abstraction concrete
somewhere; without that step, formalisation goes straight to quiz and the student has never touched
the object.

**Step 6 is what makes this a course rather than a pile of tutorials.** Block 4 exists entirely
because most courses skip the bridge, and attention ends up looking like it appeared from nowhere.
Every lesson ends pointing forward — including the last one of a block, which points at the next
block.

Two things bound it. **The bridge names the *next* lesson**, and only that one: anything further
ahead is a signpost («eso ocupa el resto del bloque»), not a named promise. Two lessons promising
the same lesson in nearly the same sentence is a defect — the second one to arrive finds the door
already open and has nothing to hand over. And **the bridge is two paragraphs**, like the motivation
it mirrors. Three is a lesson that did not finish closing: the third paragraph is almost always
material that belonged in the argument above the `---`.

### And a non-first lesson opens by picking up the previous bridge

Step 6 leaves a door open. **The next lesson walks through it in its first sentence**, naming the
previous lesson by its topic (§2's naming rule) before posing its own question. Lesson 2 of Block 1
is the shape:

> La lección anterior, dedicada al problema de representar el lenguaje, terminó con una cuestión
> pendiente.

The first lesson of a *block* picks up the last lesson of the previous block — that is what makes
five blocks one course rather than five courses. Only the very first lesson of the course has
nothing to pick up.

This closes the loop step 6 opens, and it is why the two rules belong together: **a bridge nothing
picks up is a promise the course did not keep.** Writing the bridge is easy to remember because it
ends the lesson you are working on; the pickup is easy to forget because it belongs to a lesson you
have not written yet. When you finish a lesson, the last thing you do is read its bridge — that is
the opening of the next one.

#### How much of it to restate: two readers, not one

The rule above says the pickup must happen. This says what shape it takes, and it exists because the
opening is read by two people whose needs point in opposite directions.

**The continuous reader** has just finished the previous lesson and still has all of it in their
head. **The returning reader** last opened the course a fortnight ago, or arrived from a search
result, and remembers the topic but not the argument. Write only for the first and the second is
dropped into a lesson that assumes a conversation they no longer recall. Write only for the second
and the first reads the same two paragraphs twice — which is what happened by lesson 4, whose
opening was both of lesson 3's closing paragraphs paraphrased in order.

**Both failures are real, and they are not equally bad.** Boring the continuous reader costs them
some patience. Stranding the returning reader costs them the lesson: they reach the formalisation
without knowing what question it answers, which is the exact failure this guide exists to prevent.
When the two pull against each other, favour the reader who needs help.

So there is **no word count here**, and any rule that gave one would be wrong. The pickup is as long
as it takes to put someone back where the course had got to — usually two to four sentences, but the
number is an observation, not a target. What decides whether it is right is its **form**, because
form is what the two readers experience differently:

1. **It states; it does not re-derive.** «La lección anterior descartó $d = 1$» re-situates a
   returning reader in nine words. Re-explaining *why* $d = 1$ fails is the previous lesson, one
   click away, and it is the part the continuous reader has just read. The conclusion serves both;
   the derivation serves neither.
2. **Different words.** A sentence that survives from the bridge nearly intact is what makes a
   reader *certain* they have read this before — far more than the fact of a recap does. Say the
   same thing another way and it stops registering as a repeat, while losing nothing for the reader
   who needs it.
3. **Different order.** The bridge ended on its last point. An opening that starts from that same
   point, in that same sequence, replays the paragraph even in fresh words. Enter from where the
   previous lesson leaves *this* one, which is rarely where the bridge finished.
4. **Not the same example.** <W>dámelo</W>, «una reseña, un correo, una noticia», la crónica frente
   a la receta — a concrete case is the most recognisable thing on the page, so reusing one is the
   loudest possible signal of repetition. When the example is this lesson's own subject, it belongs
   further down, where it does new work.
5. **The second paragraph is this lesson's own.** Motivation is two paragraphs; the pickup lives in
   the first. If it has spilled into the second, it stopped being an entrance and became a summary.

**The two-reader test**, and it takes a minute:

> Read the previous lesson's closing paragraphs and this opening back to back, in that order —
> nothing should read twice. Then read the opening **alone and cold**: someone who last opened the
> course a fortnight ago should finish it knowing where they are and what is about to be settled.
>
> Failing the first is a recap. Failing the second is a door with no handle. Fix either; if you can
> only fix one, fix the second.

This is not a licence to restate everything, and the difference is worth naming because it is the
whole rule in four words: **the pickup is the state, not the story.**

### These six are not headings

**A template is a great authoring tool and a terrible reader interface.** The six steps are the
shape of the argument, and the argument should be invisible: a student reading `## Motivación`,
`## Intuición`, `## Formalización` in lesson after lesson is not reading an explanation, they are
watching a form get filled in. The machinery is for you. Never ship it.

Three rules follow.

**1. Never use a step name as heading text.** Not `## Motivación`, not `## Puente`, not
`## Implementación`. If a heading earns its place, it says what *this* lesson does there:
`## Construyendo la matriz one-hot en NumPy`, not `## Implementación`. `pnpm lint:content` warns
when a heading is one of the six names.

**2. Most steps get no heading at all.** Motivación, Intuición and Puente are narrative moments —
you hook the reader, build the picture, then leave a door open. That is prose and transitions, not
labels. Motivation is the first two paragraphs. The bridge is the last two. Putting a heading on
either turns a continuous line of thought into compartments.

**3. The bridge is preceded by a thematic break** — `---` on its own line, with a blank line above
and below. Not a heading, no label, nothing named: a short centred rule, and then the closing
paragraphs.

It earns that mark for a reason the other unheaded steps don't have. Motivación and intuición open
the lesson, so nothing above them can swallow them. The bridge comes *after* a section — normally
the quiz — and without a mark it reads as the tail of that section, as though "what this lesson
leaves unsolved" were a remark about the last question. The break says the argument has closed
without saying what closes it.

**Reserve `---` for exactly this: one per lesson, nowhere else.** A thematic break used twice is a
divider again, and the bridge stops being the place the lesson ends. `pnpm lint:content` warns on
zero, on more than one, and on one that is not the last thing in the file.

What reliably earns a heading is a **change of mode** — the point where the student stops reading
and starts doing:

| Step | Heading? |
|---|---|
| Motivación | No. It is the opening paragraphs. |
| Intuición | No — it flows out of the motivation. |
| Formalización | Usually yes: it is also a mode change ("now we get precise"), and the reader wants an anchor back to it. Title it by content — and see the subdivision rule below. |
| Implementación | **Yes.** "Stop reading, run this." |
| Verificación | **Yes.** "Stop reading, test yourself." |
| Puente | No — but it opens with a `---`. It is the closing paragraphs. |

So a typical lesson has **two to four `##` headings**, all of them describing content. A lesson with
six headings named after the six steps has failed this rule even though it followed the structure
perfectly.

### Subdividing the formalisation: by the argument, not by the length

Formalización is the step that runs long, so it is the one that gets split. **A heading marks a new
claim being established, not a new screenful.**

If the derivation has two movements — first what the object *is*, then what it *costs* — those are
two headings even when both are short. If it has one long movement, it is one heading even when it
runs a page: splitting it in the middle tells the reader a new argument has started when it hasn't,
which is worse than a long section. Block 1 lesson 1 splits at exactly such a seam: `##` establishes
what a network needs and what $r$ must satisfy, and `###` then takes the one representation that
satisfies all of it and shows it failing anyway. Two claims, two headings.

Two rules come with that:

- **Dependency order.** Nothing under a heading may rest on something established under a later
  one. If it does, the two are in the wrong order, or they were never two claims.
- **Title with the claim, not the material.** `### La representación que parece funcionar y no
  funciona`, not `### Índices y orden alfabético`. The reader scanning the on-this-page rail should
  be able to reconstruct the argument from the headings alone.

Length is still worth watching, but as a **symptom**: past roughly 600 words under one heading there
is usually a second movement in there that has not been named. Go and look for it. If it genuinely
is one movement, leave it alone.

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
prose uses are all the same number. (They were 0..4 until P5-00. The schemas in
[`src/lib/schemas.ts`](../../src/lib/schemas.ts) now reject a block id or a lesson `block` of 0
outright, so the old numbering cannot come back through content; a stray "bloque 0" in *prose* is
still just a leftover, and still yours to fix.)

**A lesson is never referred to by its number** (`COURSE-P7-01`). Write a
[`<Leccion>`](#7-components) and let the build resolve it:

> ✅ `como en <Leccion slug="bolsa-de-palabras">la bolsa de palabras</Leccion>`
> ❌ como en la lección 5 del bloque anterior, sobre la bolsa de palabras

A bare ordinal is a reference that rots. Insert one lesson into a block and every "la lección 5"
elsewhere in the course points at the wrong place — across 43 lessons written over months that
*will* happen, and until P7-01 nothing checked it. The slug is checked: an unknown one fails
`pnpm lint:content`. The number the reader may want — *BLOQUE 2 · LECCIÓN 5* — comes out of the
registry into the hover card, so it cannot go stale, and the component decides on its own whether
the reference is a link at all.

**The label still names the topic**, exactly as the old rule demanded, and for the same reason:

> ✅ `<Leccion slug="vocabulario-oov">el vocabulario y las palabras fuera de él</Leccion>`
> ❌ `<Leccion slug="vocabulario-oov">la lección anterior</Leccion>`

The sentence has to work for a student who never hovers anything — and when the reference renders
as plain text (a draft target, or a forward reference inside the bridge) the label *is* the whole
reference.

**A forward reference says that it is one, in the sentence.** The component renders a card marked
«Más adelante»; it never puts a word in your prose, and a card is not something a reader on a phone
ever sees:

> ✅ eso lo construye <Leccion …>el forward pass</Leccion> · de aquí a <Leccion …>…</Leccion>
> ❌ como vimos en <Leccion …>el forward pass</Leccion>  ← the target is ahead

**Blocks keep their numbers.** There is no `<Bloque>`: a block is a section of the syllabus, not a
page to link to. In Spanish prose both are common nouns and stay **lowercase** mid-sentence: *el
bloque 2*, *la lección 3* — never *el Bloque 2*. Capitalise only at the start of a sentence or in a
heading. Name the block when you point outside the current one, and prefer «del bloque anterior» to
«del bloque 1» when it *is* the preceding block: it survives a renumbering of the syllabus.

## 3. The budget

Targets, not laws. But a lesson over them should be **split**, and `pnpm lint:content` says so.

| Dimension | Target | Hard ceiling |
|---|---|---|
| Words | 1,200–2,000 | 3,000 |
| Reading time | 20–30 min | 40 min |
| Display equations | 5–12 | 20 |
| Widgets | 1–2 | 3 |
| Code cells | 1–3 | 5 |
| Longest code cell (lines) | ≤ 45 | 90 |
| Quiz questions | 3–5 | 8 |
| Code challenges | 0–1 | 2 |

**A lesson at the ceiling on every axis is not a lesson, it is a chapter.**

Word counts exclude LaTeX, code and JSX — the number tracks how much *prose* a student has to get
through, not how maths-heavy the lesson is. Zero widgets and zero code cells never warn: a
prose-only lesson (Block 1 lesson 1) is a legitimate design choice. Being under budget on **words**
or **quiz questions** does warn — a 400-word lesson is usually half a lesson.

**Cell length is its own axis, because the cell count cannot see it.** Three cells and one 142-line
cell are both "1–3 code cells", and only one of them is readable. The editor shows **20 lines**
before it scrolls (`src/features/courses/code/editor-metrics.ts`), so the target is two screenfuls
of that box and the ceiling is four. Past the ceiling the fix is to **split the cell** — usually
into "set it up" and "now run it", with a paragraph in between — not to split the lesson. Blank
lines inside the cell count; they take up the same space.

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

## 5. Voice and tone

Two things this section is not. It is not a preference — the course has one voice across ~40
lessons written over months, and "technical but not stiff" is four words two authors will read two
ways, which is the exact failure this file exists to prevent. And it is not decoration: the voice is
what decides whether a student who does not yet understand the material feels informed or feels
stupid, and that decision gets made in every paragraph.

The rules are in English; **the examples are in Spanish and every one of them is lifted from a
lesson in this course.** A rule about Spanish rhythm stated only in English is a rule nobody can
apply — the same reason [NOTATION.md §6](NOTATION.md#6-object-language--words-the-lesson-talks-about)
argues its case with `<W>casa</W>` rather than in the abstract.

The two constants, before anything else:

- **Derivations shown, not asserted.** This is the course's differentiator: it does the algebra. If
  a step is long, it goes in `<Details>` — it does not go away.
- **Spanish examples throughout.** A Spanish course tokenising English sentences is a small,
  constant signal that it is a translation of someone else's material. Spanish has better examples
  anyway: clitics (*dámelo*), contractions (*del*, *al*), inflection, `ñ` and accents.

### Person and mood — `tú` does one job, `nosotros` does another

Spanish gives you two voices here and they are **not** interchangeable:

- **`tú` and the imperative for what the student does or experiences.** *Toma la frase <W>el gato
  bebe leche</W>.* · *Ejecútala tal cual y después cambia el corpus por un texto tuyo.* · *Fíjate en
  que es un defecto distinto de los dos anteriores.* · *Guarda esa observación.* · *Añade
  <W>agua</W> al vocabulario.*
- **`nosotros` only for mathematical work being done jointly on the page.** *Fijemos el vocabulario
  y llamémoslo $V$.* · *Llamemos $\bar{\ell}$ a la longitud media de un token.* · *Denotaremos por
  $\lvert u \rvert$ la longitud, en caracteres, del token $u$.*

The distinction is real and the reader feels it: **we** are deriving, **you** are doing. Swap them
and the derivation reads as homework assigned to the student, while the exercise reads as something
being performed at them.

There is a third, rare voice, and it has exactly one job:

- **First person singular for what the author did to the material** — numbers invented for a toy
  example, a parameter deliberately set low, a figure drawn by hand rather than trained. *Sus
  coordenadas las he puesto yo a mano para el curso.* · *está ahí porque me he inventado los
  números* · *he dejado $d_{\text{model}} = 3$ adrede*.

This is "say what you are giving up" with someone owning it, so the impersonal alternative defeats
the purpose: *las coordenadas están puestas a mano* discloses that they were placed while hiding
that a person chose them, which is the whole content of the sentence. Use it only for that — never
for the derivation, never for the student — and expect a handful of these moments per block, not one
per lesson.

**Never the impersonal or the passive for either.** Not *se debe normalizar a NFC*, not *el
estudiante debe ejecutar la celda*, not *el lector observará que*. Spanish makes impersonal
constructions very easy to reach for, which is precisely why this needs saying: they are the default
register of a badly translated manual, and they put a pane of glass between the student and the
thing they are supposed to be doing.

### Sentence rhythm — the claim is short

Build-up may run long. **The sentence that lands the point stands alone, and it is short:**

> Y, sin embargo, los modelos de lenguaje funcionan.
>
> Tokenizar es elegir dónde cortar.
>
> Son tres cosas.
>
> Todo lo que $\tau$ descarta, el modelo no volverá a verlo jamás.

That is where the rhythm comes from: long, qualified setup; short, unqualified conclusion. A
paragraph in which every sentence is the same length reads as a wall whatever it says, and the
reader cannot tell which sentence was the one that mattered.

**Paragraphs: one idea, three to six sentences.** A paragraph that needs a semicolon to hold two
ideas together is two paragraphs.

### Name the consequence

State the fact, then say what it costs. This is the move that separates an explanation from a
description, and both lessons lean on it:

> Lo importante no es que las afirmaciones sean falsas, sino que la red no tiene forma de saber que
> lo son.
>
> La tercera es la más incómoda: una palabra nueva reescribe la representación de palabras que no
> tienen nada que ver con ella.

If a paragraph states something true and stops, ask what the student is supposed to *do* with it.
Usually the answer is the next sentence, and it was missing.

### Say what you are giving up

When the lesson defers something, simplifies something, or concedes something, it says so, in the
same paragraph, out loud:

> La concesión es grande.
>
> Los detalles de BPE quedan fuera de esta lección; el explorable de arriba muestra su resultado,
> que es lo que hace falta aquí.

This is §2's signposting rule seen from the voice side. A silent simplification is the thing that
leaves a reader quietly convinced they missed something.

### What the voice never does

Two families, banned outright, for two different reasons.

**Condescension.** *obviamente* · *evidentemente* · *claramente* · *por supuesto* · *simplemente* ·
*sencillamente* · *trivialmente* · *basta con* · *no es más que* · *sin más*. If it were obvious the
lesson would not exist. These words cost the reader who already understood nothing, and cost the
reader who did not the belief that they can. Note that the ban is on the **family**, not on four
specific words: *sencillamente* is *simplemente* wearing a hat, exactly as *basta con* is.

**Padding.** *cabe destacar / señalar / mencionar* · *es importante señalar* · *como podemos ver /
observar* · *a continuación veremos* · *en esta sección vamos a* · *en el presente apartado*. The
lesson does not narrate itself; the argument just proceeds. Across 40 lessons this is a measurable
amount of the student's time spent on words that carry nothing.

The one legal exception is a lead-in that changes what the student **does**, not one that announces
what you are about to write: *Mira tres cosas:* before a code cell is instruction, not padding.

`pnpm lint:content` warns on both families.

### The five marks — one job each

The single rule most easily broken, because every mark looks fine in isolation and the damage is
cumulative. A mark with three jobs is not a mark — the argument
[NOTATION.md §6](NOTATION.md#6-object-language--words-the-lesson-talks-about) makes for `<W>`, applied
to all five:

| Mark | Its one job | From our lessons |
|---|---|---|
| `**negrita**` | the term **being defined**, at its definition, once | **corpus**, **Determinismo**, **reconstrucción**, **Totalidad.** |
| `*cursiva*` | (a) an anglicism on first use *per lesson*; (b) the one word that flips the sentence | *embedding*, *byte-pair encoding*, *out-of-vocabulary*; *antes* de la red, que no afirme *nada* |
| `<W>…</W>` | a string the lesson talks *about* — see NOTATION §6 | <W>dámelo</W>, <W>el gato bebe leche</W> |
| `«…»` | a word used in its loose, non-technical sense | «distancia», «dirección», «unidad», «nueva» |
| `` `código` `` | Python, and only Python: identifiers, calls, modules | `numpy`, `softmax()`, `isalnum()` |

Three consequences that are easy to get wrong:

- **Never italicise a Spanish term.** Italics mean "this word is not Spanish" or "read this word
  harder". A Spanish term at its definition is **bold**; every use after that is plain. The terms
  are fixed in the tables below — *tokenización*, *subpalabra*, *capa*, *pérdida* are Spanish and
  are never italicised.
- **Never bold for emphasis.** That is italics' job. Bold appearing twice in a paragraph means one
  of the two is emphasis and should be italics.
- **`«…»` is not `<W>`.** «unidad» is the ordinary word *unidad* being used loosely, before the
  lesson has pinned it down. <W>gato</W> is the string g-a-t-o as an object on the page. Both are
  "a word being pointed at", which is exactly why they need different marks.
- **In a plain-text prop there is no `<W>`, so `«…»` covers for it.** `caption`, `alt` and `summary`
  are strings (§7), so a string the lesson talks *about* is written `«programación»` there —
  `caption="…qué le pasa a una palabra larga como «programación»"`. This is the one place the two
  marks collide, and it is a limitation of the prop, not a second meaning for `«…»`: in prose the
  same word still takes `<W>`.

Spanish typography, since this is Spanish prose and half of it differs from English:

- **La raya `—` is glued to the text it encloses, with the space outside**: `el traductor —numerar
  las palabras por orden alfabético, por ejemplo— produce números válidos`. A single raya
  introducing a final clause glues the same way: `…y la tilde por separado —y <W>niño</W> pasa a
  tener seis tokens`. Never ` — ` spaced on both sides, which is the English convention; never `-`
  (guion) or `–` (semirraya) in its place.
- **Opening `¿` and `¡` always.** Their absence is the single clearest tell of prose drafted in
  English.
- **Numbers in prose take the decimal point and a space for thousands**: `1.5`, `30 000`. Inside
  `$…$` the decimal point is the same point — `C/3.5` is maths, and maths is set the way
  NOTATION.md says. A number the prose is *reporting* needs no escaping to make that true: `$0.500$`
  de acierto, una columna que se mueve `$2.4$` unidades, `$29\,312$` pesos, are typeset exactly like
  a bare expression. Thousands still take `\,` inside `$…$` the way prose takes a space. **Changed
  from the decimal comma on 2026-08-16** — see the P5-00 deviation in STATUS.md for why (a sentence
  reading four numbers in a row, `de 1,0 a 1,1, a 1,2, a 1,3`, is unreadable as a list before it is
  read as four decimals) and for the note that every lesson through Block 3 was rewritten the same
  day, so there is no mixed-convention period to account for. The old rule needed a carve-out
  (`$0{,}500$`, comma-escaped) so a reported number would still read as a decimal inside `$…$`
  instead of tripping KaTeX's comma-spacing; the point needs none, which is the second reason to
  prefer it, not just the first.
- **Quotes are `«…»`.** Never `"…"`.
- **A display equation is part of its sentence and carries that sentence's punctuation.** A `$$…$$`
  block is not a picture dropped between two paragraphs — it is a clause, and it is read aloud as
  one. The mark is the **last character inside the fence** (§8 says where exactly), and which mark
  it is depends on what follows:

  | The sentence… | Mark | From our lessons |
  |---|---|---|
  | ends at the equation | `.` | `… \quad T \in \mathbb{N}.` → «Una red, en cambio, …» |
  | continues with a clause that would take a pause in prose — a «donde …», an apposition, an explicative relative, an independent clause joined by *y*, an explanatory *porque* | `,` | `f : \mathbb{R}^d \to \mathbb{R}^k,` → «donde $d$ es la dimensión…» |
  | runs straight through the equation, which is its grammatical object | nothing | `… \approx 4 \times 10^{-13}` → «del espacio de entradas.» |

  `pnpm lint:content` warns on the first case — an unpunctuated block whose next paragraph starts
  with a capital letter. It cannot see the other two, or a block followed by a heading, a
  `<Details>` or a table; those are held by reading the equation and the next line aloud as one
  sentence, which is the whole test.

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
| *embedding*, *token*, *batch* | the English term | incrustación, ficha, lote |
| atención, auto-atención | Spanish | *attention*, *self-attention* |
| *one-hot encoding*, *multi-head*, *layer norm*, *fine-tuning*, *softmax*, *encoder*, *decoder*, *forward pass* | the English term | any translation |
| *backpropagation* | the English term | retropropagación |
| capa, peso, sesgo | Spanish | layer, weight, bias |
| pérdida, gradiente, descenso de gradiente | Spanish | loss, gradient, gradient descent |
| tasa de aprendizaje | Spanish | *learning rate* |
| entropía cruzada, verosimilitud | Spanish | cross-entropy, likelihood |
| error cuadrático medio, then MSE | Spanish, with the acronym expanded on first use | bare *MSE*; *error medio cuadrático* |
| entrenamiento, entrenar | Spanish | training, entrenar el *training* |
| conjunto de entrenamiento | Spanish | *training set*, datos de entrenamiento, muestra |
| conjunto de prueba | Spanish | *test set*, conjunto de validación, datos de prueba |
| tasa de acierto — and `acertar` for the verb | Spanish | *accuracy*, precisión, exactitud |
| inicialización, inicializar | Spanish | *initialisation*, arranque; `semilla` is the generator's, not the weights' |
| vocabulario, tokenización, subpalabra, bolsa de palabras, codificación posicional | Spanish | vocabulary, tokenisation, subword, bag of words, positional encoding |
| filling the leftover positions of a fixed-length input | *padding* | relleno, acolchado |
| cutting a text at $T_{\max}$ | truncar, truncamiento | recortar, cortar |
| maldición de la dimensionalidad | Spanish | curse of dimensionality |
| denso, disperso | Spanish | *dense*, *sparse* |
| tipo — one distinct entry; *token* / ocurrencia — each appearance of one | `tipo`, `token`, `ocurrencia` | *type*; `token` for both senses |
| an element of the vocabulary $V$ | `entrada del vocabulario`, then `entrada` | palabra, término |
| one case shown to the network, and the answer wanted for it | `ejemplo`, `etiqueta` | muestra, dato, caso; *sample*, *label*, *target* |
| the place an element holds in an ordered sequence | posición | puesto, rango, ranking |
| an LSTM/GRU gate — a coordinate-wise multiplier in $(0,1)$ | compuerta | *gate*, puerta, válvula |
| the three LSTM gates $\mathbf{f}_t$ / $\mathbf{i}_t$ / $\mathbf{o}_t$ | compuerta de olvido / de entrada / de salida | *forget / input / output gate* |
| the two GRU gates $\mathbf{z}_t$ / $\mathbf{r}_t$ | compuerta de actualización / de reset | *update / reset gate*; reset kept untranslated (standard in Spanish ML), never «de reinicio», and as part of the term name it is not italicised |
| the LSTM's second state, the memory the gates guard | estado de celda | *cell state*, celda, memoria de celda |
| the vector a step proposes to write — to the cell in the LSTM ($\tilde{\mathbf{c}}_t$), to the state in the GRU ($\tilde{\mathbf{h}}_t$) | candidato | *candidate*, propuesta |
| the summing route the memory takes from one step to the next — the LSTM cell, or the GRU's convex combination on the state | vía aditiva | camino aditivo, *additive path* |
| $\boldsymbol{\delta}^{(l)}$ — what the loss owes a layer's pre-activation | `error` (de la capa, de la neurona) | delta, señal de error, término de error |
| a network trained to predict what comes next in a text | `modelo de lenguaje` | *language model* |
| the random draw a model makes from its own output distribution, one step of generating | `muestrear`, `muestreo` (*sampling*) | *samplear* |
| asignar un valor a una variable, parámetro o símbolo, en prosa | `asignar a` | `poner en` — «poner en $\varphi$» se lee como insertar algo dentro de un contenedor, no como fijar su valor |
| un experimento breve corrido en una celda de código, cuyo resultado interpreta el texto que sigue | `experimento` | `sonda` — en español designa un instrumento físico (sonda espacial, sonda médica), no un experimento |
| desarrollar un argumento o una fórmula algebraica paso a paso hasta un resultado, sin diferenciar nada | `desarrollar`, `desarrollo` | `derivar`, `derivación` — reservados para la derivada de una función |
| always advancing to the single highest-probability output, deterministically — the alternative to sampling when generating | `voraz`, decodificación voraz (*greedy*) | avara, ávida — «avara» lee como tacaña en español, lo contrario del algoritmo, que siempre toma el máximo |
| a model that maps a source sequence to a target sequence | `modelo de secuencia a secuencia`, apodo *seq2seq* | *sequence-to-sequence* traducido literalmente |
| the fixed vector the encoder hands the decoder in a seq2seq | `vector de contexto` | *context vector*; the per-step attention version keeps the same Spanish name |
| feeding the decoder the true previous token during training, not its own output | *teacher forcing* | any translation — kept in English, and it earns only a brief note (Block 3 lesson 8) |
| pasar un texto de un idioma a otro con un modelo | `traducción automática` | *machine translation* |
| the token that ends a generated sequence | `<EOS>`, glossed once per lesson as «símbolo de fin de secuencia» | *end token*, «símbolo de parada», «marca de fin», FIN |
| the token the decoder is fed at its first position, where there is no previous target token | `<GO>`, glossed once per lesson as «símbolo de arranque» | *start token*, `<BOS>`, «símbolo de inicio», INICIO |
| the decoding search this course does **not** cover, named once so the concession is honest | *beam search* | «búsqueda en haz», «búsqueda por haces» |
| the small network that computes the score $a$ | `modelo de alineación` | red de atención, *alignment model* |
| Bahdanau's score — two projections added, squashed, then read out | `atención aditiva` | *additive attention* |
| Luong's score — the two states multiplied through one matrix | `atención multiplicativa` | *multiplicative attention*, atención por producto |
| the three roles of one attention call | `consulta`, `clave`, `valor` — Spanish, with the English given once per lesson **that writes the letters** (*query*, *key*, *value*), so $\mathbf{Q}$, $\mathbf{K}$ and $\mathbf{V}$ can be read | untranslated *query* / *key* / *value*; «petición», «llave», «contenido» |
| the two-layer network a Transformer block applies to each position on its own | `perceptrón por posiciones` | *feed-forward*, red hacia delante, capa densa, red posicional |
| the decoder sublayer whose queries are the decoder's and whose keys and values are the encoder's | `atención encoder-decoder` | atención cruzada, *cross-attention* |
| the paper's *scaled dot-product* — the whole attention formula, divisor included | `producto interno escalado`, with the English given once per lesson | «producto escalar escalado»; and `producto escalar` still names the operation $\mathbf{q}^{\top}\mathbf{k}$ itself |
| one of the $h$ attentions a multi-head layer runs in parallel | `cabeza` | *head*; «cabezal», «cabecera» |
| the average of a quantity over the randomness assumed of it | `media`, written $\mathbb{E}[\cdot]$ | `esperanza`, `valor esperado`, `promedio` |
| how far a centred quantity typically lands from zero | `desviación típica` | `desviación estándar`; and never the letter $\sigma$, which NOTATION.md §4 reserves |
| how many positions a coordinate of the positional encoding takes to come back round | `longitud de onda` | `periodo`, `frecuencia` — the last one is $\omega_i$, a different number |
| the line that carries a sublayer's input around it and adds it back to its output | `conexión residual`, and `los residuales` for several | *residual connection*, *skip connection*, «atajo», «salto», «puente» |
| training a model against raw text before it is shown any task | `preentrenamiento`, `preentrenar` | *pre-training*, «entrenamiento previo»; the other half of the recipe, *fine-tuning*, stays English |
| the vector the stack produces for one position, which depends on the whole sequence | `representación contextual` | *contextual embedding*, «embedding contextual», «vector contextual» |
| BERT's objective — hide some positions and predict them from both sides | `modelado de lenguaje enmascarado`, with the English given once per lesson (*masked language modelling*, MLM) | «enmascaramiento», «modelo de lenguaje enmascarado», bare MLM |
| the token that replaces a hidden position | `[MASK]`, glossed once per lesson as «la marca que tapa una posición» | any translation — same rule as `<EOS>` and `<GO>` |
| the two mask regimes, as adjectives on a model or an attention | `causal`, `bidireccional` | «unidireccional», «de izquierda a derecha», «no causal» |

The `tipo` / `token` / `ocurrencia` row is a **distinction**, not a translation, and it is the one
place in Block 1 where using one word for two concepts breaks a sentence outright: *el corpus tiene 4 000 tokens y 900 tipos* is
the whole content of "words repeat". Say `tipo` for a distinct string, counted by $M$, and `token`
for a single appearance of one, counted by $T$. Never `token` for both.

`ejemplo` and `etiqueta` are **defined in Block 2 lesson 1**, on the artificial neuron, where the ten
reviews and the verdict a person wrote for each first sit on the same page. That row went in late,
after four lessons had already leaned on both words, and the audit that found it is worth recording
because the damage was not where the word counts pointed. Neither term had ever been introduced:
`etiqueta` first appeared *inside a code cell*, then in prose as though already given, and Block 2
lesson 3's «la etiqueta $y$ vale $1$ si la frase habla bien» fixes an **encoding** without ever
saying what the thing is. Nothing in the course says `supervisado` at all, and neither word is a
course prerequisite — so by §2 every use of them was a debt.

The subtler half is a **sense shift**, and it is the reason the definition is worded the way it is.
Block 2 lesson 4, on the forward pass, makes `ejemplo` mean *a row of $\mathbf{X}$* — input only, no
label in sight; Block 2 lesson 5, on loss functions, needs it to mean *the thing that has a label*
($\ell$ compares one example's prediction against its etiqueta). One word, two concepts, which is
exactly what this section exists to stop. So an **ejemplo is the case shown to the network,
identified with its input vector**, and its **etiqueta rides alongside** rather than being part of
it. Both later uses are then correct as written, which is why the retrofit cost one paragraph in
lesson 1 and no edits anywhere else.

`posición`, never `puesto`. Ordering things and then pointing at the $i$-th one is a move this course
makes constantly — Zipf ranks in Block 1, sequence positions from Block 3 on, sorted vocabularies
everywhere. `puesto` is where a runner finishes: it drags in competition, and it reads as prize-giving
rather than indexing. `rango` is worse, being already taken twice over by *rango de una matriz* and by
the statistical range. `posición` is the only one of the three that means a place in a sequence and
nothing else.

`error` for $\boldsymbol{\delta}^{(l)}$, and the word is **not** being borrowed — it is being kept.
Block 2 lesson 6, on gradient descent, already calls $\hat{y} - y$ «el error» for a network with no
hidden layer, and backpropagation's own recurrence starts at
$\boldsymbol{\delta}^{(L)} = \hat{\mathbf{y}} - \mathbf{y}$: the same quantity, at the same place,
now with a name that survives having layers underneath it. Using a second word for the general case
would tell the reader that lesson 6's error and lesson 8's $\boldsymbol{\delta}$ are two things, and
the whole point is that the first is the last layer of the second. `delta` as a noun in prose («el
delta de la capa 2») is the tempting alternative and is rejected for the reason `puesto` is: it
names the letter rather than the thing, and the letter is already on the page.

The collision to watch is *error cuadrático medio*, two rows up, which is a **fixed compound** and a
different concept — it measures a prediction, it is not the derivative of anything. They never share
a sentence, and a lesson that needs both writes the compound in full and never shortens it to
`error`. Note also that «error» is the concept and $\boldsymbol{\delta}^{(l)}$ is its symbol: prose
says *el error de la capa 2*, maths says $\boldsymbol{\delta}^{(2)}$, and neither is a synonym for
`gradiente`, which stays the general word for a vector of derivatives with respect to anything.

`conjunto de prueba` and `tasa de acierto` arrive together in Block 2 lesson 10, the sentiment
project, because that lesson is the first one that measures anything on examples the network was not
fitted on. `conjunto de validación` is not a synonym and is not in the course: it names a **third**
split, used to choose between models before the test set is touched, and this course never has one —
calling the sixty held-back reviews a validation set would promise a distinction no lesson makes.
`precisión` is the row that matters, and it is banned for the opposite reason to the usual one: it is
not vaguer than *accuracy*, it is a **different metric** (the fraction of the predicted positives that
were right), so a reader who has met both elsewhere would read the wrong quantity. `exactitud` is
free of that collision and rejected only because two Spanish words for one number is the drift this
section exists to stop. Note the shape of the pair: `tasa de acierto` is the quantity,
$\text{acierto}(D)$ is its symbol ([NOTATION.md](NOTATION.md#block-2--el-perceptrón-multicapa)), and
`acertar` is what the network does to one review.

`ocurrencia` is the **same** concept as `token`, licensed for one job: the counting noun when the two
are being contrasted. *La fracción de ocurrencias que cubren esos $k$ tipos* reads; *la fracción de
tokens que cubren esos $k$ tipos* invites the reader to hunt for a difference between "tokens" and
"tipos" that is grammatical rather than conceptual. Outside that contrast, use `token`. And neither
is `palabra`, which stays the everyday word and is never a unit of counting.

`entrada del vocabulario` — the row that every representation lesson leans on, and the one that was
missing longest. From Block 1 lesson 2 the elements of $V$ are whatever $\tau$ produced, so under a
subword tokeniser an entry is a *piece* of a word: <W>dámelo</W> may be three of them. That makes
*una dimensión por palabra* false as written and *una dimensión por entrada* true, and the
difference is not cosmetic — a window of $n$ tokens is not a window of $n$ words, so the $\lvert V
\rvert^{n}$ count in the one-hot lesson is a count over entries or it is wrong. The test is one
question: **would the sentence still have to hold under a subword tokeniser?** If it would, it
cannot say `palabra`.

That leaves three words on three jobs, and they are genuinely three things: `token` is what $\tau$
emits, `tipo` is a distinct string counted by $M$, `entrada` is a member of the vocabulary someone
chose — the same separation [NOTATION.md](NOTATION.md) already makes when it says $M$ belongs to the
corpus and $\lvert V \rvert$ to the vocabulary built from it. `palabra` keeps exactly one job:
the everyday word inside examples that are literally words. *Entre <W>casa</W> y <W>gato</W> no
existe un punto intermedio* is right, because those are words. **It is the claims that have to be
precise, not the illustrations.**

This row went in after Block 1 lesson 4 rather than before it, against the rule at the end of this
section, and the cost was exactly what that rule predicts: three finished lessons to reread and
correct. What the retrofit found is worth keeping, because it is not what the word counts suggested.
Lesson 2 needed **no term swaps at all** — its thirty-odd *palabras* name a tokenisation *strategy*
(«cortar por palabras», «el vocabulario de palabras no se satura»), which is that lesson's subject,
and replacing them would have broken it. Lesson 3 needed eight, every one of them a *palabra* with a
number attached, in the lesson whose whole topic is that tokens and tipos are counted differently.

So the rule to carry forward is narrower than "avoid `palabra`": **the violation is `palabra` used as
a counted unit**, and a grep is not enough to find it. Lesson 3 also shows where the seam falls —
before $M$ **tipos** is defined, a count has no formal name yet, so it says `cadena distinta` (which
lesson 2 already established) and the definition then names what the reader has been counting. That
is better than either reaching forward to `tipo` or leaving `palabra` in place.

The line is not "English is cooler": it is whether a Spanish term is genuinely in use among people
who do this work. *Capa* and *pérdida* are; *incrustación* and *atención* are not. Where both
circulate — *backpropagation* / *retropropagación* — the course picks one and this table is where
it is picked, because the alternative is that each lesson picks separately. `course.es.yml`'s Block 2
summary said *retropropagación* until this table settled it; the manifest now says
*backpropagation*, matching the syllabus titles and the `backpropagation` slug.

*padding* is English by that criterion, and the two obvious translations are both **already spent
inside this course**, which is the sharper argument. `relleno` is what NumPy puts between the columns
it aligns, in Block 2 lessons 5 and 9 — «un espacio de relleno además del que las separa» — so a
reader meets it as a formatting artefact two blocks before meeting it as an architectural decision.
`acolchado` is upholstery. The other half of the operation goes the other way and is ordinary
Spanish: `truncar` a text at $T_{\max}$, `truncamiento` for the loss. Not `recortar`, and for the
same reason: Block 1 lesson 3 cuts the *vocabulary* at the $k$ most frequent types and Block 2 lesson
5 cuts the *probabilities* before the logarithm, both of them «recorte», and neither is what happens
to a text that ran past the last position. Three cuts on three objects need three verbs or they need
one, and one is not available.

`muestrear`/`muestreo`, for the random draw a model makes from its own output distribution when
generating, collides with two things already on this page and has to stay clear of both. The noun
`muestra` is banned earlier in this table as a synonym for `ejemplo` — a lesson using both must never
let `muestreo` (the action) read as *una muestra* (a training example, which it is not). And Block 1
lesson 7, on Word2Vec, already spends `muestreo` inside a **fixed compound**, «muestreo negativo»
(*negative sampling*): a specific technique for avoiding a full-vocabulary softmax, not the generic
verb. The two never share a page, but a lesson that needed both would write the compound in full and
never shorten it to bare `muestreo`, the same rule this section already gives *error cuadrático medio*.

`asignar a`, not `poner en`, for the moment a symbol or variable is given its value. «Poner en
$\varphi$» reads like placing an object inside a container, not fixing what $\varphi$ equals — an
audit of Blocks 1–3 found the confusion in six lessons, not only as that literal phrase but one
level down: a code cell that «pone un cero en $\boldsymbol{\delta}$» or «pone la etiqueta $1$ en
los ejemplos» is doing the same assignment and deserves the same verb. `asignar a` says exactly
what happens — the symbol receives a value — and nothing is being inserted anywhere.

`experimento`, not `sonda`. Two Block 2 lessons used «sonda» for a short check run in a `<PyCell>`
whose result the prose interprets in the next sentence, and it reads as the physical instrument —
a space probe, a medical probe — because that is the only thing «sonda» means in Spanish outside
this course. Not to be confused with `sondeo`/`sondeo numérico` (a finite-difference gradient
check, e.g. `16-backpropagation.mdx`, `21-bptt.mdx`), which is a different, correct word and stays.

`desarrollar`/`desarrollo`, not `derivar`/`derivación`, for working an algebraic argument step by
step to a result — absorbing a bias into a ratio, proving a transpose identity, building the
reasoning behind a formula — when nothing is being differentiated. The collision is real, not
cosmetic: from Block 2 on, `derivar` names the calculus operation more than 200 times (the chain
rule, backpropagation, gradient descent all lean on it), so reusing the same verb for "work out a
formula" tells the reader nothing about which is meant until the next sentence resolves it. Two
existing uses are a *different* sense again and are correct as written, not candidates for
`desarrollar`: `derivarse de` («se deriva de», "to stem from" — `02-tokenizacion.mdx`, the
trade-off that follows from counting characters) and `derivación` as the linguistic term for
word-formation (`02-tokenizacion.mdx`'s «niñez, aniñado»).

`<EOS>` is a **special token, not a word**, and that is why it is not translated: it is written the
way it appears in a vocabulary file and in every paper the student will read, exactly as Block 1
keeps `<UNK>` rather than inventing a Spanish spelling for it. What it does earn is a gloss — «el
símbolo de fin de secuencia» — once per lesson, on the same first-use rule as an acronym, because a
reader arriving from a search result meets a bare `<EOS>` with nothing to hang it on. The rejected
alternatives all describe the *effect* instead of naming the object: «símbolo de parada» reads as
something outside the vocabulary that halts the loop, which is precisely the misreading Block 4
lesson 1 exists to prevent — the model predicts this token like any other, and the loop stops
because it was predicted.

`<GO>` is the same rule applied to the other end of the sequence, and it is on this table because
the course has been spelling it **only in code** since Block 3 lesson 8 — `ent =
np.concatenate(([GO], y[:-1]))`, three cells across two blocks — while no prose has ever said what
it is. Block 5 lesson 7, on the encoder, the decoder and the masks, is where that stops working: the
decoder's input is the target shifted one position, so position $1$ receives something that is not a
target token at all, and a lesson that cannot name it cannot state the shift. It takes `<EOS>`'s
treatment exactly — a special token, not a word, written the way a vocabulary file writes it,
`<W>\<GO></W>` in prose by [NOTATION.md §6](NOTATION.md#6-object-language--words-the-lesson-talks-about),
glossed once per lesson. `<BOS>` is what much of the literature writes and is refused for being a
second spelling of a token the course's own cells already spell one way; the Spanish alternatives are
refused for the reason «símbolo de parada» is, one paragraph up.

*beam search* is on this table despite the course never teaching it, and the row is there to stop
the obvious mistranslation rather than to license the topic. Block 4 lesson 1 has to say out loud
that greedy decoding does not maximise the product it decodes — the concession rule above — and a
concession that refuses to name what it is conceding to is not much of one. Named once, in English,
never derived: «búsqueda en haz» circulates in Spanish translations of textbooks but not among
people doing the work, and a reader who only met the Spanish could not search for it.

`atención aditiva` and `atención multiplicativa` name the two scores by **what they do with the
two vectors**, which is the distinction Block 4 lessons 4 and 5 exist to draw: one adds two
projections and squashes the sum, the other multiplies the two states through a single matrix. Both
adjectives are what the literature uses and both are ordinary Spanish, so the row costs nothing;
what it buys is that neither lesson has to name its own subject mid-paragraph. «Atención por
producto» is refused for being a description rather than a term the reader will meet again, and it
would leave the first of the pair with no matching name.

`modelo de alineación` is Bahdanau's own «alignment model», and it names the **network**, not the
mechanism. The separation is the point: `atención` is what the architecture does — mix the states by
weights — while the alignment model is one small multilayer perceptron inside it, whose output is
scored, normalised and then thrown away. «Red de atención» would collapse the two and leave the
block unable to say «la atención se queda, el modelo de alineación cambia», which is precisely what
Block 4 lesson 5 has to say.

`atención` and `auto-atención` are **Spanish**, and this row was wrong until Block 4 lesson 3
went to write the word. It sat in the anglicism row beside *embedding* and *token*, with
«atención» named as the rejected form — against which stands everything the course had
already shipped: `course.es.yml` calls block 4 «El Puente hacia la Atención» and block 5
«Auto-atención, múltiples cabezas y codificación posicional», the syllabus titles two lessons
with it, and the bridges of Block 3 lesson 8 and Block 4 lesson 2 both promise «la atención»
in prose. A lesson body writing *attention* would have put the sidebar, the page title and the
first paragraph in two different languages. The line this section draws is whether a Spanish
term is genuinely in use among people who do this work, and «mecanismo de atención» plainly
is — which is what separates it from *incrustación*, the case the row was really built to
stop. *Attention is All You Need* keeps its English title, being a title; the mechanism it
names does not.

`consulta`, `clave` and `valor` are Spanish, and the row is here to stop drift rather than to
argue a hard case: all three are ordinary words, they are what a Spanish-speaking practitioner
says, and Block 4 lesson 5's bridge already shipped them in prose. What the row adds is the
**gloss**. The symbols the student is about to meet on every page of Block 5 and in the paper —
$\mathbf{Q}$, $\mathbf{K}$, $\mathbf{V}$, $d_k$ — are initials of the English words, so a lesson
that never writes *query* beside `consulta` leaves four letters unexplained. That is the acronym
rule below, applied where the acronym is a single letter: give the English once, in this lesson,
and stay in Spanish afterwards.

**What the gloss is for is the letters, so a lesson with no letters owes nothing.** Block 5 lesson
9, the project, names all three roles in prose — «consultas de $\mathbf{X}^{\text{dec}}$, claves y
valores de $\mathbf{X}^{\text{enc}}$» — and writes $\mathbf{Q}$, $\mathbf{K}$ and $\mathbf{V}$
nowhere, because by then the three projections live inside a function the student calls. Glossing
there would introduce three English words to explain symbols that are not on the page, which is
the acronym rule running backwards. The trigger is the **letters**, not the words.

«Petición» and «llave» are refused for being second names for
objects that already have one, and «contenido» for the value because it says what a value holds
instead of naming the role it plays — the same objection that loses «red de atención» to
`modelo de alineación` two rows up.

`perceptrón por posiciones` is the course's own vocabulary doing a job the paper's name cannot.
*Feed-forward* is what *Attention is All You Need* calls that box, and as a term it says the one
thing about it that is **not** the point — every layer in Blocks 2 and 3 was feed-forward too. What
the box actually is, is Block 2's multilayer perceptron applied to one row at a time with the same
weights in every position, and «por posiciones» is precisely what Block 5 lesson 1 needs said: of
the fifteen boxes in the paper's figure, only the three attention ones look at another position.
So the course names it by what distinguishes it. «Capa densa» is refused for naming an
implementation detail no lesson introduces, and «red posicional» for colliding with
`codificación posicional`, a different object two boxes away.

`atención encoder-decoder` is the paper's own name, kept for the reason $\mathbf{W}_a$ keeps
Luong's letter: this block exists so the student can go and read the sources. «Atención cruzada»
circulates in Spanish and is refused as a **second** name for a thing already named — the drift
this section exists to stop — and it leaves the reader to work out which two things are being
crossed, which is exactly what the encoder/decoder spelling says out loud. It needs no gloss beyond
the ones already given: `encoder` and `decoder` are English by the table above, and the three roles
are Spanish by the row above that.

`producto interno escalado` is the one row in this table that deliberately keeps **two** Spanish
names in play, and it is here to say which is which rather than to license drift. `producto escalar`
is and stays the **operation** — $\mathbf{q}^{\top}\mathbf{k}$, named 51 times across thirteen
lessons from Block 1 lesson 4 on — and nothing about it changes. What needed a name is the
**compound**: the whole formula the paper calls *scaled dot-product*, divisor included. Gluing the
obvious adjective onto the existing term gives «producto escalar escalado», which puts the same root
twice in three words for two unrelated reasons — *escalar* because the result is a scalar, *escalado*
because it is divided by $\sqrt{d_k}$ — so a reader is entitled to think the two are connected. They
are not. «Producto interno» is standard Spanish for the same product, collides with nothing in the
course, and takes the adjective cleanly.

The price is the one this section normally refuses to pay, so it gets paid out loud instead: **the
lesson that uses the compound states in a clause that the two name the same product.** That is the
whole defect two names cause — a reader who cannot tell a synonym from a distinction — and said
plainly there is nothing left to hunt for. It is the move [NOTATION.md](NOTATION.md) already makes
for $\mathbf{c}$ and $\sigma_{\max}$: a collision is tolerable exactly when the page carrying both
names it. The alternative was a full retrofit to `producto interno` everywhere, and it is refused on
size against benefit — 51 sites in three blocks, to swap one standard term for another.

`cabeza` is Spanish, and the row is here to stop one page being written in two languages rather than
to argue a hard case. `course.es.yml` already summarises block 5 as «Auto-atención, múltiples cabezas
y codificación posicional», so the sidebar says *cabezas* before any lesson body says anything — the
same situation that settled `atención` four rows up, where the manifest, two syllabus titles and two
bridges had all shipped the Spanish while this table still listed it as the rejected form. What the
row adds beyond the choice is the **boundary with the row above it**: *multi-head* stays English as
the name of the **compound** —`atención multi-head`, what the paper calls that layer— while `cabeza`
is the ordinary Spanish noun for one of the $h$ things inside it. That is the split
`producto interno escalado` already makes between an operation and the compound that names it, and
it is what lets one sentence carry both: «la atención multi-head reparte $d_{\text{model}}$ entre sus
$h$ cabezas». «Cabezal» is a part of a machine and «cabecera» is a header; neither is a second name
for anything the course has.

`media` and `desviación típica` arrive in Block 5 lesson 3, which derives the $\sqrt{d_k}$ of the
attention formula and therefore has to say how big a dot product gets. Both are the ordinary Spanish
words and neither is a translation of anything, so the row is here only to stop the drift: `esperanza`
and `valor esperado` are the terms a statistics course would use, and a lesson mixing them with
`media` would invite a reader to hunt for a distinction that this course never makes. `promedio` is
refused for a sharper reason — the lesson computes the bracket **as** an average over $2^{d_k}$ sign
patterns before generalising it, so the two words would name the same operation at two moments of the
same page and read as two operations. One word, both times. The symbol and the ban on $\sigma$ are
[NOTATION.md](NOTATION.md#block-5--el-transformer)'s business, argued there.

`longitud de onda` arrives in Block 5 lesson 5, on codificación posicional, and the row exists
because the lesson quotes that number a dozen times: this coordinate comes back round every $6.28$
positions, that one every $35\,000$. It is the paper's own word — «the wavelengths form a geometric
progression» — and ordinary Spanish besides. `frecuencia` is not a synonym but the **other**
quantity, $\omega_i$, which the lesson also writes, so letting the two swap would put a number and
its reciprocal under one name. `periodo` describes the same thing correctly and is refused for the
reason `promedio` is refused two rows up: two words for one quantity, on the page whose whole first
claim is that these numbers form a ladder.

`conexión residual` is Spanish and the row is here to fix the plural more than the singular. Block 5
lesson 6 names the thing once and then refers to it a dozen times as *los residuales*, which is what
`course.es.yml` and the block plan already say, so the noun has to be a Spanish one or the sidebar
and the paragraph disagree — the same argument that settled `atención` and `cabeza`. The English is
refused for that reason alone, not for being unclear. «Atajo» and «salto» describe the picture
instead of naming the object, and both say the wrong thing about it: nothing is skipped and nothing
jumps, the sublayer runs exactly as it did and its output is **added** to what it was given, which
is the one fact the whole lesson turns on. «Puente» is worse still, being the course's own name for
block 4.

`preentrenamiento` is Spanish and *fine-tuning*, fixed in the English-terms row near the top of
this table, is not — and the split is deliberate rather than an oversight. The line this section draws is whether a Spanish term is
genuinely in use among people who do this work, and the two halves of that recipe answer
differently: *preentrenar un modelo* is what a Spanish-speaking practitioner says, while nobody
says «ajuste fino» out loud — and `course.es.yml`'s own syllabus already titles Block 5 lesson 11
«Fine-tuning en la práctica», so the English half is settled by something already shipped, exactly
as `atención` and `cabeza` were. «Entrenamiento previo» is refused for describing the order of two
things instead of naming one of them: what makes preentrenamiento a concept is that the text it
runs on has nothing to do with the task, not that it happens first.

`representación contextual` is the term Block 1 has been owed since its lesson 8, on GloVe and the
limits of a static table, closed on <W>banco</W> receiving one row of $\mathbf{E}$ for two
sentences. `representación` is already the course's word — Block 1 lesson 1 fixes
$r : V \to \mathbb{R}^{d}$ and every representation lesson since has used it — so the concept
needs an adjective and not a second noun. That is also what rules out «vector contextual»: the
thing that changes is **what $r$ takes as an argument**, and a name built on the output says
nothing about it. *Contextual embedding* is what the literature writes and is refused on the row
above's own logic: *embedding* stays English as the name of the static object, and gluing a Spanish
adjective to it would put one term in two languages.

`modelado de lenguaje enmascarado`, not «modelo de lenguaje enmascarado», and the one-letter
difference is the whole point: the table already spends `modelo de lenguaje` on *a network trained
to predict what comes next in a text*, which is precisely what BERT is not. What the row names is
the **objective** — an activity, hence *modelado* — and keeping the two apart is what lets one
sentence say that BERT is trained by masked language modelling and is not a language model in this
course's sense. The English and the acronym come once per lesson under the rule below, because the
student will meet MLM bare in every paper afterwards.

`[MASK]` takes `<EOS>`'s and `<GO>`'s treatment for `<EOS>`'s and `<GO>`'s reason: it is a special
token written the way a vocabulary file writes it, not a word, so it is not translated and it goes
in `<W>` in prose. Note that the square brackets are BERT's own spelling and the angle brackets are
the sequence tokens' — the course keeps each as its source writes it rather than unifying them,
because a reader who meets one spelling here and the other in the paper would be entitled to think
the difference meant something.

`causal` and `bidireccional` are the two adjectives Block 5 lesson 10 leans on in nearly every
paragraph, and both are ordinary Spanish. «Unidireccional» is the tempting partner for the second
and is refused for being a **third** name for a thing that already has two: the mask of Block 5
lesson 7 and the adjective here. «De izquierda a derecha» describes the reading order and is true,
but it is a phrase rather than a term and cannot modify a noun without a subordinate clause. And
«no causal» is refused for the reason «no lineal» would be if the course had a choice: naming half
the distinction by the absence of the other half makes the maskless case read as the deviation,
when in this lesson it is one of two symmetric answers.

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
| `<Figure>` | `src`, `alt` (both required), `caption?` | Assets live in `public/courses/<course-slug>/`; `src` is the path from `public`. **`caption` and `alt` are plain text** — no markdown, no LaTeX, so write `1/i`, not `$1/i$` |
| `<Details summary="…">` | `summary` required | Native `<details>`; use for long derivations |
| `<ColabLink notebook="…">` | URL, or `github/user/repo/blob/main/nb.ipynb` | Block 5's escape hatch to a GPU |
| `<Explorable id="…" caption?="…">` | `id` must be a registered widget | Lazy-loaded on the lesson route only. **`caption` is plain text**, like `<Figure>`'s — see §5 for the `«…»` that stands in for `<W>` there |
| `<PyCell code={`…`} packages?={[…]}>` | `code` is a **prop, not children** | Requires `hasCode: true` |
| `<Quiz id="…">` | `id` must match a frontmatter question | Requires `hasQuiz: true` |
| `<CodeChallenge id="…">` | `id` must match a frontmatter challenge | Also satisfies `hasCode: true` |
| `<Leccion slug="…" ancla?="…">` | `slug` must resolve; `ancla` must be a heading id in the target | A cross-reference. Children are the label, falling back to the target's title — see below |

### When a figure earns its place

Everything below this line is *how* to make a diagram. Nothing said *when*, and the content showed
it: the first ten lessons of the course carry two figures between them, one of those buried inside a
`<Details>`. That was not ten deliberate decisions to go without — the template offered an
`<Explorable>` slot and a `<PyCell>` slot and never mentioned `<Figure>`, so the question never got
asked. Same failure as the bridge pickup in §1: the step nothing prompts is the step that gets
skipped.

Two triggers, and they are different enough to name separately.

**1. The prose is describing a shape or a position.** When a sentence leans on *entre*, *por debajo*,
*paralelas*, *opuestas*, *perpendicular*, *la franja*, the reader is being asked to draw the picture
in their head from a description — which is the one job prose is worst at. The rectangles under
$1/x$ in Block 1 lesson 3, the three points on three axes in lesson 4, the band between two lines in
Block 2 lesson 3: in all three the argument **is** the picture, and the paragraph was a caption for
a figure that was missing.

**2. The object has a conventional picture the student will meet everywhere else.** Circles and
arrows in layers is how every paper and every library's documentation draws a network. A student who
finishes Block 2 without seeing it has to pick the convention up somewhere else, and will suspect
the course of hiding something. Block 3's unrolled recurrence and Block 5's encoder/decoder stack
are the same case.

And the case against, which covers most lessons. **No figure that re-draws an equation, restates a
table, or duplicates an `<Explorable>` already on the page.** A widget and a figure of the same
object need separate jobs to both survive: in Block 2 lesson 3 the widget shows the neuron failing
and the figure shows the two lines that succeed, and neither would do the other's work.

Two consequences, both easy to get backwards:

- **A figure replaces prose; it does not accompany it.** If the paragraph beside it still spells out
  what the picture shows, one of the two is redundant, and it is the paragraph. Block 2 lesson 3
  lost its sentence about the two positive phrases landing on the same vector the moment the caption
  said it.
- **The caption carries the claim; `alt` carries the description.** «Las mismas tres palabras, dos
  representaciones» tells the reader what to conclude. «Un diagrama de tres puntos» tells them what
  they can already see — and that belongs in `alt`, which is written for someone who cannot see the
  figure at all.

There is deliberately **no figure count in the §3 budget**. Every axis there measures load a student
has to get through; a figure reduces it. A minimum would produce decorative diagrams in the lessons
that do not need one, which is the opposite of this rule.

**Static diagrams are SVG, hand-written, and dark-only.** A geometric argument the prose is already
making — the rectangles under $1/x$ in Block 1 lesson 3 — is worth a picture, and an SVG committed to
`public/courses/dl-nlp/` is the cheapest one: no build step, no raster to regenerate at 2×, and it
scales to a 360px phone by itself. Two constraints. The site has **one theme** (a single `:root` in
`globals.css`, no toggle), so hardcode the palette's hex values — `#4edea3`, `#86948a`, `#bbcabf` —
and leave the background transparent so the figure sits on whatever surface hosts it, including a
`<Details>`. And `<Figure>` renders through `<img>`, which cannot reach the page's CSS variables, so
`currentColor` and `var(--text)` silently render as black. Check the file at 360px before shipping:
label text below 12px in the source is unreadable once the image scales down.

### Referring to another lesson

`<Leccion>` replaces every hand-written lesson number (§2). It works in lesson prose **and** in quiz
and challenge copy in the frontmatter, which is where 72 of the course's references live.

Whether it renders as a link is **not** yours to decide. It follows from where the target sits:

| The target is… | Renders | Why |
|---|---|---|
| behind the reader | link + hover card | they have been there; going back is useful |
| ahead, above the `---` | link + card marked «Más adelante» | mid-argument, often several lessons out |
| ahead, below the `---` | plain text | the bridge's hand-off; `LessonNav` links that same lesson two paragraphs down |
| `draft: true` | plain text | the route is not generated, so a link would 404 |

So a reference moves between those cases on its own when a lesson is reordered, and the bridge needs
no special syntax — being *after the `---`* is the whole signal.

The label is the children: `<Leccion slug="la-neurona">la neurona artificial</Leccion>`. Omit them
(`<Leccion slug="la-neurona" />`) and the target's own title is used, which is right for a sentence
that means to name the lesson and wrong for one that means to name the topic. `<Leccion>` text does
not count toward the word budget (§3).

`ancla` points at a section: it is the heading's **id**, the slug of the heading text, the same one
in the `#…` of the on-this-page rail. It is checked against the target's real headings, so
retitling a section elsewhere in the course fails the build here rather than dropping readers at the
top of the page. The card still names the *lesson*, never the section — a heading above a lesson
summary is two different things pretending to be one.

### Widget ids

[`widget-ids.ts`](../../src/features/courses/widgets/widget-ids.ts) — an id not on this list is a
hard lint failure:

`sigmoid-explorer` · `tokenizer-playground` · `embedding-projection` · `bag-of-words` ·
`activation-explorer` · `perceptron-boundary` · `gradient-descent-2d` · `backprop-trace` ·
`loss-landscape` · `rnn-unrolled` · `vanishing-gradient` · `lstm-gates`

**A widget a lesson calls for is built in the same task as that lesson, not deferred.** When a block
plan assigns a widget id to a lesson and that id is not yet in `widget-ids.ts`, building it is part of
authoring the lesson — you do not fall back to a `<Figure>` and leave the widget for later, and you do
not open a separate PR for it. The lesson and its widget ship together, in one PR, because a lesson
whose intuition step was designed around an explorable is not the same lesson with a static picture
bolted on: the widget is load-bearing, and splitting it out means the lesson is reviewed without the
thing it was built around. (This reverses the earlier rule that deferred Block 3–5 widgets to their
own PRs. It cost `lstm-gates` a lesson that shipped with a figure standing in for the widget, then a
retrofit — the usual price of deferring the step nothing forces.)

Building a widget is three files plus its wiring, and the maths is the part that gets tested:

- **`widget-ids.ts`** — add the id (a tagged comment says which lesson[s] use it). An id not on this
  list is a hard lint failure, so this is also what lets the lesson's `<Explorable>` resolve.
- **`registry.ts`** — map the id to a `dynamic(() => import(…), { ssr: false })` entry. The
  `Record<WidgetId, …>` type makes a missing entry a compile error; `__tests__/registry.test.ts`
  checks it at runtime too.
- **`math/<name>.ts`** — the widget's numbers as a **pure, DOM-free function**, so they can be
  unit-tested without a browser. This is not optional: the teaching claim rests on those numbers, and
  a widget that quotes a figure the prose also quotes must agree with it. Put a `math/__tests__/
  <name>.test.ts` beside it that verifies the maths two independent ways — exact hand/limit cases and
  reference values matching what the lesson's prose or code cell quotes (see `math/lstm.ts` and its
  test for the pattern: saturation limits at `d_h = 1`, plus the preset's survival numbers the lesson
  reports).
- **`nn/<Name>.tsx`** (or `nlp/`, `activations/`) — the component. `"use client"`, local state only,
  keyboard-operable (a native `<Slider>`, arrow-key stepping), and it reads every colour from the CSS
  tokens (`var(--green)`, `var(--text)`, …) so it themes with the page. It imports the maths; it does
  not recompute it inline.

The one thing that legitimately stays separate is the div between a widget and a **figure of the same
object**: they survive together only with separate jobs (§7 above). `lstm-gates` shows the gates
opening and the memory surviving as `b_f` moves — dynamic behaviour; `lstm-celda.svg` shows the
data-flow topology — what connects to what. Neither does the other's work, so the lesson carries both.

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

- **The sentence's punctuation goes INSIDE the fence** (§5), as the last character of the last line
  — never after the closing `$$`, never on a line of its own, where markdown would start a
  paragraph with a stray full stop. Two placements follow from that and are worth writing down
  because both look wrong until you see them rendered:

  ```mdx
  \end{cases}.                          ← after the environment, not inside its last row
  \lvert V \rvert^{2} \quad \text{números}.   ← outside \text{…}, not \text{números.}
  ```

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

- **The bridge's `---` needs a blank line above it.** Directly under a paragraph, `---` is a *setext
  heading* — markdown reads the text above it as an `h2`. It renders as a heading nobody wrote, and
  it fails **silently**: `extractHeadings` matches `##`-style headings only, so the on-this-page rail
  never shows it and the step-name lint never sees it. One blank line is the whole fix.

- **A component tag inside an MDX comment still counts for the lint.** The content passes read the
  file with regular expressions, not an MDX parser, so a commented-out `<Quiz id="…" />` is still a
  reference that has to resolve, and a commented-out `<PyCell>` still forces `hasCode: true`. To
  disable a component, **delete it** — do not comment it out.

- **Curly braces inside maths are safe** — `$\{1, \dots, n\}$` works, because remark-math claims the
  `$…$` span before MDX sees the braces.

- **YAML frontmatter with LaTeX: single-quote it.** `prompt: '¿Cuál es $\sigma(x)$?'` — double
  quotes make YAML interpret `\s` as an escape. Multi-line prose uses a `|` block scalar.

- **Frontmatter text goes through the same MDX compiler the body does.** Quiz prompts, options and
  explanations are compiled by `compileMDX` with the body's own remark/rehype plugins
  ([`src/lib/courses/quiz/render.tsx`](../../src/lib/courses/quiz/render.tsx)) — that is why LaTeX
  and `<W>` work there. One parser, one set of rules: whatever needs escaping in the body needs
  escaping in a quiz prompt too.

- **An angle-bracketed special token needs escaping, everywhere.** A bare `<UNK>` is an undefined
  JSX component, which is a hard build failure and not an obvious one — the error names the
  component, not the lesson. Write it `<W>\<UNK></W>`, and if a construct ever refuses the escape,
  the `&lt;UNK&gt;` entity always works. Backticks are not the way out: they mean Python
  ([NOTATION.md §6](NOTATION.md#6-object-language--words-the-lesson-talks-about)), and `<UNK>` is a
  string the lesson talks about, so it belongs in `<W>` like any other mention.

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
- [ ] **The bridge is preceded by `---`** — exactly one in the lesson, blank line above it, nothing
      after it but the closing paragraphs
- [ ] **The bridge is two paragraphs and names the NEXT lesson** — anything further ahead is a
      signpost, not a named promise, and no other lesson already promised the same one
- [ ] **Every cross-reference to another lesson is a `<Leccion slug>`**, never a number; its label
      names the topic, and a forward reference says it is one in the sentence
- [ ] **A non-first lesson opens on the previous lesson's bridge**, naming that lesson by its topic
- [ ] **The pickup states, it does not re-derive** — different words, different order, not the same
      example; it stays inside the first motivation paragraph
- [ ] **The two-reader test passes.** Back to back with the previous lesson's closing, nothing reads
      twice; read cold and alone, the opening still says where the course had got to
- [ ] **No heading is named after a step**; two to four `##`, each describing what this lesson does
      there; motivation, intuition and bridge are prose with no heading at all
- [ ] The formalisation is **split by its argument, not by its length** — one heading per claim, in
      dependency order
- [ ] Within budget on every axis, or the overrun is deliberate and explained in the PR
- [ ] Notation matches `NOTATION.md`; `pnpm lint:content` reports no notation warnings
- [ ] Spanish `tú` for the student, `nosotros` only for the derivation; no impersonal *se debe* / *el
      estudiante debe*; Spanish examples
- [ ] **No banned word** — the condescension family (*obviamente*, *simplemente*, *sencillamente*,
      *basta con*…) or the padding family (*cabe destacar*, *como podemos ver*…)
- [ ] **The five marks do their own jobs**: bold defines, italics emphasises or marks an anglicism,
      `<W>` mentions, `«…»` loosens, backticks are Python
- [ ] Spanish typography: raya glued (`—así—`), opening `¿` and `¡`, decimal point in prose
- [ ] **Every display equation punctuated as part of its sentence** — the mark inside the fence:
      `.` when the sentence ends there, `,` when the next clause takes a pause, nothing when the
      sentence runs through it. Read each equation aloud with the line after it
- [ ] **One term per concept**, matching the §5 terminology tables; `modelo` / `red neuronal` /
      `sistema` used for their own senses, not as synonyms; anglicisms italicised on first use only
- [ ] **`entrada` for a member of $V$, never `palabra`** — every claim that would still have to hold
      under a subword tokeniser says `entrada`, `token` or `tipo`; `palabra` only inside examples
      that are literally words
- [ ] **Every acronym expanded on first use in *this* lesson** — OOV, BPE, BPTT, TF-IDF, MLP, RNN —
      even if an earlier lesson already expanded it
- [ ] Every derivation shown, not asserted
- [ ] **No paragraph asks the reader to picture a shape or a position that a figure could just
      show** (§7); where there is a figure it *replaced* that prose rather than joining it, its
      caption states the claim and its `alt` describes the picture
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

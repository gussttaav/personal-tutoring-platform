# P7-02 — The content pass: 403 references across 43 lessons

**Tag:** `COURSE-P7-02` · **Effort:** L · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

Convert every hand-written cross-reference to `<Leccion>`, delete the hardcoded lesson numbers, and
rewrite the forward references that no longer state their direction. **Blocked on P7-01** — without
the lint pass this is 403 unvalidated edits.

## Context

- **403 numbered references**: 331 in body prose, **72 in quiz/challenge frontmatter across 30
  lessons**. The frontmatter group is only reachable because P7-01 binds `Leccion` in
  `quiz/render.tsx`.
- **The number was never the direction cue.** "La lección 4" means *ahead* only if the reader is
  holding the fact that they are in lesson 1. What has always carried direction is the verb —
  *mostrará*, *compartirán* versus *derivó*, *terminó*. Removing the number loses less than it
  appears to, but it does expose the references that were relying on it.
- **About half the ~18 forward body references already state direction** (*"mostrará que esa
  decisión es más delicada"*, *"todas las palabras raras compartirán vector"*, *"el argumento que
  lleva a"*, *"de aquí a la lección 8"*). The other half do not (*"es el asunto de la lección 3"*,
  *"es la lección 4 de este bloque"*, *"la falla de la que vive la lección 3"*) and read as
  backward references once the number is gone.
- **Bridge references need no rewrite for direction** — the bridge names the next lesson by
  definition (`AUTHORING.md §1`), and *"es la siguiente lección, sobre X"* is both accurate and
  natural there.

## The edit, per reference

1. Wrap it: `<Leccion slug="descenso-gradiente">la lección sobre descenso de gradiente</Leccion>`.
   Children carry the grammar — *"el explorador de activaciones de **Funciones de activación y no
   linealidad**"* is not Spanish. Omit children only where the canonical title reads naturally in
   the sentence.
2. **Delete the number.** "la lección 5 de este bloque" → "la lección sobre funciones de pérdida".
   This is the whole point; a reference that keeps the number and gains a link can now disagree
   with itself.
3. **If it points forward and is above the `---`, make the sentence say so.** *"es el asunto de la
   lección sobre vocabulario"* → *"es el asunto de una lección más adelante, la de vocabulario"*.
4. **Add an `ancla` only where it earns one** — when the target has a section that answers the
   specific question being raised, and the reader would otherwise land on a lesson and hunt. Copy
   the id from `extractHeadings`, do not hand-slug it.

## Block checklist

Convert **one block per commit**, in course order — earlier blocks are referenced most, so their
slugs stabilise first. A block is done when `pnpm lint:content` is green and no `lección \d` survives
in it.

- [x] **Block 1 — Fundamentos de NLP** · 8 lessons · 61 refs
  - [x] `01-texto-como-numeros` (7) · [x] `02-tokenizacion` (4) · [x] `03-vocabulario-oov` (5) · [x] `04-one-hot` (14)
  - [x] `05-bolsa-de-palabras` (5) · [x] `06-embeddings-densos` (10) · [x] `07-word2vec` (4) · [x] `08-glove-y-limites` (12)
- [x] **Block 2 — El Perceptrón Multicapa** · 10 lessons · 83 refs
  - [x] `09-la-neurona` (3) · [x] `10-funciones-activacion` (4) · [x] `11-xor-y-capas-ocultas` (5) · [x] `12-forward-pass` (6) · [x] `13-funcion-de-perdida` (13)
  - [x] `14-descenso-gradiente` (7) · [x] `15-regla-de-la-cadena` (9) · [x] `16-backpropagation` (10) · [x] `17-implementar-mlp` (17) · [x] `18-proyecto-sentimiento` (9)
- [x] **Block 3 — Redes Recurrentes** · 8 lessons · 102 refs
  - [x] `19-por-que-falla-el-mlp` (6) · [x] `20-la-rnn-vanilla` (3) · [x] `21-bptt` (22) · [x] `22-gradiente-desvanecido` (6)
  - [x] `23-lstm` (10) · [x] `24-gru` (13) · [x] `25-proyecto-char-lm` (28) · [x] `26-seq2seq` (14)
- [x] **Block 4 — El Puente hacia la Atención** · 6 lessons · 48 refs
  - [x] `27-encoder-decoder` (4) · [x] `28-el-cuello-de-botella` (7) · [x] `29-la-idea-de-atencion` (8)
  - [x] `30-bahdanau` (8) · [x] `31-luong` (6) · [x] `32-atencion-como-consulta` (15)
- [x] **Block 5 — El Transformer** · 11 lessons · 109 refs
  - [x] `33-adios-recurrencia` (8) · [x] `34-self-attention` (10) · [x] `35-scaled-dot-product` (5) · [x] `36-multi-head` (9) · [x] `37-codificacion-posicional` (2) · [x] `38-bloque-transformer` (10)
  - [x] `39-encoder-decoder-masking` (12) · [x] `40-arquitectura-completa` (12) · [x] `41-proyecto-transformer` (15) · [x] `42-bert-y-gpt` (10) · [x] `43-fine-tuning-colab` (16)

**The heavy files are the ones to schedule first in a session, not last:** `25-proyecto-char-lm`
(28), `21-bptt` (22), `17-implementar-mlp` (17), `43-fine-tuning-colab` (16),
`32-atencion-como-consulta` (15), `41-proyecto-transformer` (15). The project lessons cite the
whole block they close, which is why they dominate.

## Acceptance criteria

- [ ] `grep -rniE "lecci[oó]n\s+[0-9]" content/courses/dl-nlp/es/` returns nothing outside comments
- [ ] `pnpm lint:content` green — every slug and anchor resolves
- [ ] Every forward reference above a `---` states its direction in the sentence
- [ ] Word counts do not jump: per-lesson `words` is within a few of its pre-migration value
- [ ] Estimated `minutes` moves at most 1 on any lesson
- [ ] A spot check of ~10 links lands on the right lesson, and anchored ones on the right section
- [ ] `pnpm build` + `pnpm check:bundle` green

## Test plan

- **Per block:** `pnpm lint:content`, then read the rendered block in `pnpm dev` — every reference
  is either a link that works or plain text that reads correctly.
- **Reorder drill, once, on a scratch commit:** swap two lessons' `order` in a block and confirm
  references reclassify with no content edit, then revert. This is the property the whole phase
  exists to buy, and it should be demonstrated at least once.
- **Before/after word counts:** capture `pnpm lint:content`'s per-lesson report before starting and
  diff it at the end. A large drop means the budget regex is eating prose it should not.

## Notes / gotchas

- **Quiz frontmatter is YAML, and the copy is already quoted.** Adding `<Leccion slug="…">` inside a
  single-quoted YAML scalar is fine; the inner attribute quotes must be double. Watch for
  explanations that already contain `<W>\<UNK></W>`-style escaping.
- **`21-bptt` phrases cross-block references backwards from the number** — *"El bloque anterior
  tiene las dos piezas… la regla de la cadena —lección 7—"*. A naive regex reads those as same-block
  forward references. They are backward. Read, do not sed.
- **Do not batch-replace.** Each reference needs a grammatical decision about children and, for
  forward ones, about direction wording. A scripted pass would produce 403 sentences that parse and
  do not read.
- **`08-glove-y-limites` and the project lessons have long code cells** already flagged by
  `countLongestCodeCell`. Do not fold that cleanup into this pass; it is a separate content task.
- **Anchors are optional and should stay rare.** Every one is a dependency on a heading's exact
  text. Add them where the payoff is a direct answer, not by default.

## Out of scope

- Rewriting a reference's *argument* — this pass changes how a lesson is named, not what is said
  about it.
- Splitting over-long code cells, or any other budget-warning cleanup.
- English content.

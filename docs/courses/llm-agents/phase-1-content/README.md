# Phase 1 — Content production

Writing the course: five blocks, **40 lessons**, ten new widgets, one Colab notebook, one
companion repository. The dominant cost of the project, as it was the first time — but with a
rehearsed loop: [`AUTHORING.md`](../../AUTHORING.md) (with P0-04's step-3 rewrite),
[`NOTATION.md`](../../NOTATION.md), `pnpm lint:content`, and `/course-lesson`, one lesson per
run, reviewed before commit.

Numbering runs across the course, `01-` to `40-`, as in `dl-nlp`.

## Tasks

1. [01-block-1-modelo-de-lenguaje.md](01-block-1-modelo-de-lenguaje.md) — `COURSE-C2-P1-01` — Del Transformer al modelo de lenguaje (9)
2. [02-block-2-instrucciones.md](02-block-2-instrucciones.md) — `COURSE-C2-P1-02` — De predecir texto a seguir instrucciones (8)
3. [03-block-3-prompting.md](03-block-3-prompting.md) — `COURSE-C2-P1-03` — Hablar con el modelo es programar (7)
4. [04-block-4-acciones.md](04-block-4-acciones.md) — `COURSE-C2-P1-04` — El puente: de texto a acciones (7)
5. [05-block-5-agente-terminal.md](05-block-5-agente-terminal.md) — `COURSE-C2-P1-05` — Un agente de programación en la terminal (9)

**Order:** strictly in syllabus order. Each block's project is the object the next block starts
from (the mini-GPT → the SFT'd mini-GPT and the scripted model → the scripted agent → the real
agent), and the bridges interlock. Within a block, lessons in order, for the same reason.

## The three models, by block

| Block | The `modelo` a cell (or a terminal) calls |
|---|---|
| 1 | the mini-GPT from the P0-03 checkpoint, continued in-browser |
| 2 | the mini-GPT (SFT, RM head, REINFORCE, DPO — all on it); Colab for the project |
| 3 | the **scripted model** from lesson 3·1 onward; the mini-GPT where the mechanism is model-agnostic (constrained decoding, embeddings) |
| 4 | the scripted model, only |
| 5 | a local model over the Messages API, in the terminal |

Every lesson says which one it runs on, in its first `<Callout>` or its first code comment.
The reader must never wonder whether what they are seeing is real.

## Exit criteria

- [ ] All five blocks published (`draft: false`); Block 1 flipped as a unit with P2-01
- [ ] Every lesson within the budget; `pnpm lint:content` green in CI
- [ ] Every `<PyCell>` and `<CodeChallenge>` verified to run in Pyodide **in the browser**, on a
      phone, under the cap
- [ ] Every Block 5 lesson verified on a clean machine on both the 8 GB and the 16 GB model,
      from its companion-repo tag
- [ ] The ten widgets registered, bilingual, maths unit-tested against the numbers the prose
      quotes
- [ ] The Colab notebook run end-to-end from a fresh account on the free tier

## The rule that matters most

Unchanged: **fix authoring friction immediately, don't work around it.** And its corollary for
this course: **if the checkpoint cannot show what a lesson claims, the lesson changes, not the
claim.** A widget over a fixed logit vector can show any effect; the mini-GPT shows only the
effects it actually has. Where they differ, the prose says which is which.

## On publication

Block 1 is authored `draft: true` and flipped in one PR with P2-01. From Block 2 on, a lesson is
published as it lands — `dl-nlp`'s post-launch practice — and the `/course-lesson` command reads
the block doc's **Publication** line to know which.

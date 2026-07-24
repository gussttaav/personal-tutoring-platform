# Phase 5 — Content production

Writing the course. **This is the dominant cost of the entire project** — roughly 40 lessons of
mathematically rigorous prose, derivations, widgets, code cells and questions. Every engineering
decision in Phases 1–4 exists to make this phase survivable.

Unlike the other phases, these tasks are measured in weeks, not days, and each block is one PR
per *lesson* rather than one PR per task.

## Tasks

0. [00-authoring-guide.md](00-authoring-guide.md) — `COURSE-P5-00` (M) — **do this first**
1. [01-block-0-fundamentos.md](01-block-0-fundamentos.md) — `COURSE-P5-01` — Fundamentos de NLP
2. [02-block-1-mlp.md](02-block-1-mlp.md) — `COURSE-P5-02` — El Perceptrón Multicapa
3. [03-block-2-rnn.md](03-block-2-rnn.md) — `COURSE-P5-03` — Redes Neuronales Recurrentes
4. [04-block-3-atencion.md](04-block-3-atencion.md) — `COURSE-P5-04` — El Puente hacia la Atención
5. [05-block-4-transformer.md](05-block-4-transformer.md) — `COURSE-P5-05` — El Transformer

**Order:** 00 first, then blocks in syllabus order. Block 0 can start as soon as P1 lands
(prose-heavy); blocks 1+ need P2/P3.

## Exit criteria

- [ ] All five blocks published (`draft: false`)
- [ ] Every lesson within the P5-00 budget
- [ ] Prerequisites stated on the landing page and honoured by the content
- [ ] `pnpm lint:content` green in CI
- [ ] Every code cell and challenge verified to actually run in Pyodide

## The rule that matters most

**Fix authoring friction immediately, don't work around it.** If something takes ten extra
minutes per lesson, that is a lost week across the course. Stop and fix the pipeline.

## On the English version

Nothing here is written in English. The pipeline supports it, slugs are locale-invariant, and
adding `content/courses/dl-nlp/en/` is purely additive. Translation is a separate cycle, planned
after the Spanish course is complete — drafting in Spanish and translating with an LLM plus a
careful editing pass is realistic here, since the maths and code are language-neutral and only
the prose needs real work.

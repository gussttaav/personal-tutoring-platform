# P5-00 — Authoring guide and per-lesson budget

**Tag:** `COURSE-P5-00` · **Effort:** M · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

Write down how a lesson gets made — structure, budget, notation, tone — **before** writing lesson
three. This is the cheapest possible insurance against a course whose early lessons don't match
its later ones, and against scope creep killing the project at lesson eight.

## Context

- ~40 lessons. Anything unfixed now gets repeated 40 times.
- The walking skeleton (P3 exit) has produced exactly one lesson. This task generalises what was
  learned from it.

## Files affected

| File | Change |
|------|--------|
| `docs/courses/AUTHORING.md` (new) | The guide |
| `content/courses/dl-nlp/_template.mdx` (new) | Copy-paste starting point |
| `scripts/lint-content.ts` | + budget warnings, notation checks |
| `docs/courses/NOTATION.md` (new) | The course's mathematical notation contract |

## Per-lesson budget

Targets, not laws — but a lesson exceeding them should be **split**, and the lint should say so.

| Dimension | Target | Hard ceiling |
|---|---|---|
| Words | 1,200–2,000 | 3,000 |
| Reading time | 20–30 min | 40 min |
| Display equations | 5–12 | 20 |
| Widgets | 1–2 | 3 |
| Code cells | 1–3 | 5 |
| Quiz questions | 3–5 | 8 |
| Code challenges | 0–1 | 2 |

A lesson at the ceiling on every axis is not a lesson, it is a chapter.

## Lesson structure

The pattern this course commits to, in order:

1. **Motivation** — the question this lesson answers. Two paragraphs. Why should anyone care?
2. **Intuition** — the idea in words and pictures, before any symbol. Usually a widget.
3. **Formalisation** — the mathematics. Complete, not hand-waved. `<Details>` for the longest derivations.
4. **Implementation** — NumPy from scratch. A code cell the student runs.
5. **Verification** — a quiz and/or a challenge.
6. **Bridge** — what this leaves unsolved, and which lesson solves it.

Step 6 is what makes the course a course rather than a pile of tutorials. Block 3 exists entirely
because most courses skip that bridge and attention ends up looking like it appeared from
nowhere. Every lesson should end pointing forward.

## Notation contract

`docs/courses/NOTATION.md` fixes, for the whole course:

- Scalars italic $x$, vectors bold lowercase $\mathbf{x}$, matrices bold uppercase $\mathbf{W}$
- Indexing convention: $\mathbf{W}^{(l)}_{ij}$ — layer superscript in parens, indices subscript
- Batch dimension first, always
- Loss $\mathcal{L}$, activation $\sigma$, learning rate $\eta$
- Sequence length $T$, model dimension $d_{\text{model}}$, heads $h$ — matching *Attention is All
  You Need* so Block 4 aligns with the paper the student will go read

Notation drifting between Block 1 and Block 4 is a real and common failure in DL courses, and it
is exactly the kind of thing that makes a rigorous course feel unrigorous.

## Tone

- **Spanish, tú form**, technical but not stiff.
- Anglicisms where they're the real term (*embedding*, *attention*, *batch*) — italicised on
  first use, then plain. Translating *embedding* to *incrustación* helps nobody.
- Never "obviamente", "simplemente", "trivialmente". If it were obvious the lesson wouldn't exist,
  and these words are how you make a student feel stupid for needing the explanation.
- Derivations shown, not asserted. This course's differentiator is that it does the algebra.

## Acceptance criteria

- [ ] `AUTHORING.md` covers structure, budget, notation, tone, and the mechanical steps to add a lesson
- [ ] `NOTATION.md` covers every symbol used in Blocks 0–4
- [ ] `_template.mdx` produces a valid lesson when copied and filled
- [ ] `lint:content` **warns** (not fails) on budget overruns and reports per-lesson counts
- [ ] `lint:content` **fails** on a `<Quiz>` / `<Explorable>` / `<CodeChallenge>` id that doesn't resolve
- [ ] The guide is written against a real authored lesson, not hypothetically
- [ ] Mechanical steps documented end to end: create file → frontmatter → write → widgets → `pnpm dev` → lint → PR

## Test plan

- **Dogfood:** author Block 0 lesson 2 using only the guide and the template. Every place you had
  to guess is a gap in the guide — fix it before writing lesson 3.
- **Lint:** verify warnings fire on a deliberately over-budget fixture and that hard errors fire on unresolved ids.

## Notes / gotchas

- **Budget overruns warn, they don't fail.** A hard failure mid-flow is exactly the friction this
  phase is trying to eliminate. The warning is a nudge to consider splitting.
- Word counting must exclude LaTeX and code, or every maths-heavy lesson reads as over budget.
- Document the LaTeX escaping quirks of MDX in the guide the moment you hit one — you will hit
  several, and rediscovering them at lesson 20 is pure waste.
- Include a "commit one lesson per PR" convention. Reviewing a 10-lesson PR is not reviewing.
- Add a checklist item: **every code cell and challenge must be run in the browser before merging.**
  A code cell that doesn't execute is worse than no code cell.

## Out of scope

- The lessons themselves (P5-01..05).
- English translation guidance — a later cycle, once the Spanish course exists.
- Video or audio production.

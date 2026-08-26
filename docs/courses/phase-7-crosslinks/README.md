# Phase 7 — Cross-links

Turn the course's ~403 hand-written cross-references into build-validated links.

Today a lesson says *"como en la lección 5 de este bloque, sobre descenso de gradiente"*. That
sentence hardcodes two facts the registry already owns — the lesson's **position** and its
**title** — as prose. Reorder a lesson and every sentence that cites it lies, silently, and
nothing in the six `lint:content` passes can see it.

Phase 7 replaces the position with a slug the build resolves, and decides *by rule* whether that
slug renders as a link or as plain text.

## Tasks

1. [01-component-and-lint.md](01-component-and-lint.md) — `COURSE-P7-01` (M) — `<Leccion>`, the bridge pre-pass, the crosslink lint, the budget exemption
2. [02-content-migration.md](02-content-migration.md) — `COURSE-P7-02` (L) — the 43-lesson pass, block by block

**Landing order:** strictly P7-01 → P7-02. The lint pass must exist before content starts using
the component, or the migration has no safety net — which is the entire point of the phase.

## The rule

A reference renders as **plain text** in exactly two cases, and as a **link** otherwise:

| Case | Renders | Why |
|---|---|---|
| Target is behind the current lesson | link + hover card | The reader has been there; going back is useful |
| Target is ahead, **above** the bridge `---` | link + card marked *Más adelante* | Mid-argument, often several lessons out; `LessonNav` is no help here |
| Target is ahead, **below** the bridge `---` | plain text | `LessonNav` already links that exact lesson, two paragraphs down |
| Target is `draft: true` | plain text | The route is not generated; a link would 404 |
| Slug or anchor does not resolve | **build fails** | — |

**Nothing here is authored.** "Ahead" is a `(block, order)` comparison against the current lesson.
"In the bridge" is a position test against the lone `---` that `validate-structure.ts` has policed
since P5-00. The author writes `<Leccion slug="…">…</Leccion>` everywhere and reordering a lesson
reclassifies its references by itself.

## What the numbers say

Measured across the 43 published Spanish lessons:

| | |
|---|---|
| Numbered references in body prose | 331 |
| Numbered references in quiz/challenge frontmatter | 72, across 30 lessons |
| Backward references | ~190 |
| Forward references | 49 — **28 in bridges**, ~18 in bodies, rest cross-block |
| Forward refs in the last third of a lesson | 32 of 49 (65%), of which 88% point at lesson N+1 |
| Lesson `summary` length | mean 462 chars, median 396, max 869 |

Two of these drove design decisions. The forward-reference concentration in bridges is why the
bridge is exempt: those are the "next lesson" hand-offs `LessonNav` already renders. The summary
lengths are why the hover card clamps to five lines — no summary of 869 characters fits in a
floating card.

## Design decisions already settled

- **The hover card carries three fields:** `BLOQUE n · LECCIÓN m` (prefixed *Más adelante* when the
  target is ahead), the lesson `title`, and the `summary` clamped to five lines. No minutes, no
  status, no URL — they crowd out the summary and answer nothing the reader asked.
- **The card names the lesson, never the section**, even when the link carries an anchor. A section
  heading above a lesson summary is two different things pretending to be one.
- **No glyph marks an anchored link.** `§` is already spoken for in this project (`AUTHORING.md §2`,
  `NOTATION.md §6`) and has never reached a reader; and anchored or not, the destination is the same
  lesson. The link is simply well-aimed and says nothing about it.
- **The card is pointer-only** (`@media (hover: hover) and (pointer: fine)`). On a touch screen the
  first tap must navigate, not open a card the reader then has to dismiss.
- **Section anchors are locale-safe.** A reference and its target always live in the same locale
  tree, so heading ids derived from heading text never have to cross languages. No new remark
  plugin, no change to the `mdx.ts` chain whose order `mdx.test.ts` guards.
- **Direction lives in the prose, not in the component.** Roughly half the forward references
  already say it (*mostrará*, *compartirán*, *lleva a*, *de aquí a*); the other half must be
  rewritten to say it. The component never injects words.

## Exit criteria

- [ ] No published lesson contains a hand-written lesson number in a cross-reference
- [ ] Every `<Leccion slug>` resolves; an unknown slug or a stale anchor fails `pnpm lint:content`
- [ ] Reordering a lesson in the manifest changes which references link, with no content edit
- [ ] `<Leccion>` text is excluded from the word budget
- [ ] Every forward reference states its direction in the sentence
- [ ] `pnpm lint` + `pnpm lint:content` + `pnpm test` + `pnpm build` + `pnpm check:bundle` green

## Out of scope

- **Personalising by progress.** A forward reference could become a link once the reader has
  completed the target — `lesson_progress` exists. It would mean shipping client JS into the prose
  body, which is exactly what the P1-04 bundle guard exists to prevent. Not worth a link the
  sidebar already provides.
- **An orphan-lesson lint** (a lesson nothing references). Genuinely useful in a 43-lesson course,
  but it is a reporting feature, not part of making links work. Its own task, later.
- **English content.** The pipeline handles it; `en/` has no lesson tree today.

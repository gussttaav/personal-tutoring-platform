# P2-01 — The hand-off from `dl-nlp`

**Tag:** `COURSE-C2-P2-01` · **Effort:** S · **Owner:** _tbd_ · **Status:** ⬜
**Depends on:** P0-02 (`curso=`), P1-01 complete (ships in the same release as Block 1's flip)

## TL;DR

The first course ends «delante de un artículo que puedes discutir». From the day the second
course is public, it also ends in front of a door: its last bridge gains one sentence with a
`<Leccion curso="llm-agents" slug="una-sola-columna">` reference, and its landing page names the
next course. The only edits to `dl-nlp` content in this whole plan.

## Context

- `content/courses/dl-nlp/es/43-fine-tuning-colab.mdx` — the bridge's second paragraph is the
  literature signpost. A third paragraph would break the two-paragraph rule; the sentence goes
  into the second.
- `content/courses/dl-nlp/en/` — lesson 43 is not translated yet (Phase 11 is at Block 1). The
  English edit lands when that lesson is translated; note it in `phase-11-translation/08-block-5.md`.
- `content/courses/dl-nlp/course.{es,en}.yml` — the FAQ has no «¿Y después?» entry; the CTA's
  returning state (`CourseCta`, `courses.landing.cta.*`) is course-agnostic copy.
- `src/lib/schemas.ts:CourseManifestSchema` is strict — a `nextCourse` key needs the schema.
- `/cursos` orders cards by manifest scan order (directory listing): `dl-nlp` before
  `llm-agents`. Correct by accident; make it correct on purpose.

## Files affected

| File | Change |
|------|--------|
| `content/courses/dl-nlp/es/43-fine-tuning-colab.mdx` | Bridge, paragraph 2: one sentence, «…y ése es el sitio donde este curso te deja — y donde <Leccion curso="llm-agents" slug="una-sola-columna">el siguiente empieza</Leccion>, con la columna que BERT y GPT dejaron sola.» (final wording at authoring) |
| `content/courses/dl-nlp/course.es.yml`, `course.en.yml` | + `nextCourse: llm-agents`; + FAQ «¿Y después de este curso?» |
| `src/lib/schemas.ts`, `src/domain/types.ts` | `nextCourse: z.string().min(1).optional()` on the manifest |
| `src/features/courses/landing/CourseCta.tsx` | When `nextCourse` is set **and** the reader's progress is 100 %, the returning state offers «Continúa con …» (title from `getCourse(nextCourse, locale)`) instead of «continue the course» |
| `src/lib/courses/catalog-view.ts` | `listCatalogEntries`: stable order — a course that is another's `nextCourse` sorts after it; otherwise manifest order. Unit-tested |
| `messages/es.json`, `messages/en.json` | `courses.landing.cta.nextCourse` («Continúa con {title}» / «Continue with {title}») — key-for-key |
| `docs/courses/dl-nlp/phase-11-translation/08-block-5.md` | Note: lesson 43's English version carries the same sentence |

## Acceptance criteria

- [ ] Lesson 43's bridge is still two paragraphs; the reference links and its card names the
      second course; `lint:content` green on both trees
- [ ] `/cursos/dl-nlp` for a reader who completed it shows «Continúa con Modelos de Lenguaje…»;
      for anyone else, unchanged
- [ ] Both FAQs carry the new entry; both manifests carry `nextCourse`
- [ ] `/cursos` shows `dl-nlp` then `llm-agents`, by rule
- [ ] The e2e `courses-*` specs pass with two published courses

## Test plan

- Unit: catalog ordering; `CourseCta`'s pure branch if one is extracted, else the manual pass.
- Manual: both landings, both locales, signed in with a 100 % `dl-nlp` progress row (seed one).

## Notes / gotchas

- This PR is **content-visible on `dl-nlp`**; it is the one exception to Phase 0's «no changes to
  `dl-nlp`». Review the sentence like a lesson, with the two-reader test.
- Do not add a «next course» block to every lesson's `LessonNav`. The hand-off is the last
  bridge and the landing; a persistent upsell is the thing the first plan's out-of-scope list
  was protecting against.

## Out of scope

- A generic «related courses» section. Two courses, one order.

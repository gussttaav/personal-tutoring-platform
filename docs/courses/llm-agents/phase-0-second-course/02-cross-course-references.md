# P0-02 — Cross-course references: `<Leccion curso="…">`

**Tag:** `COURSE-C2-P0-02` · **Effort:** M · **Owner:** _tbd_ · **Status:** ⬜
**Depends on:** P0-04 (the AUTHORING rule this task implements is written there first)

## TL;DR

Let a lesson in `llm-agents` reference a lesson in `dl-nlp` the way it references its own
siblings: `<Leccion curso="dl-nlp" slug="proyecto-transformer">la función que escribiste en el
proyecto del Transformer</Leccion>`. Resolved by the build, validated by the lint, with the first
course's name in the hover card. Prose references to the other course would be exactly the rot
`COURSE-P7-01` removed from within a course, and this course refers back in nearly every lesson.

## Context

- `src/lib/courses/Leccion.tsx` — `LeccionCtx.courseSlug` is the *current* course; `resolveTarget`
  tries `contentLocale` then the canonical tree (P11-01), **within that course**. The link/plain
  decision follows position (`current` vs. target `block`/`order`) and the `bridge` flag.
- `src/lib/courses/bridge.ts` — marks every `<Leccion` below the lone `---` with `bridge`; it
  rewrites the tag string, so a new attribute passes through untouched.
- `src/lib/courses/validate-crosslinks.ts` — groups files `byDirectory` and builds the slug index
  from that `<course>/<locale>` directory, then the canonical one. A `curso` attribute has no
  index to resolve against today → `unresolved slug` → fatal.
- `src/lib/courses/search/searchable-text.ts:95` — strips only the self-closing form; children
  are kept. The regex is attribute-agnostic; nothing to change, but assert it.
- `src/lib/courses/headings.ts` + `extractHeadings` — `ancla` validation reads the *target*
  file's headings; with `curso` the target file is in another course directory.
- `docs/courses/AUTHORING.md` §2 «Referring to other blocks and lessons» and §7 «Referring to
  another lesson» — the rules this attribute extends (P0-04 writes the text; this task links it).

## Files affected

| File | Change |
|------|--------|
| `src/lib/courses/Leccion.tsx` | + `curso?: string` prop. When present and ≠ `ctx.courseSlug`: resolve in that course (same locale two-step); **always link** (another course is never «más adelante»), even inside the bridge; draft target → plain text as today; hover card gets a first line with the **course title** from `getCourse(curso, locale)` above `BLOQUE n · LECCIÓN m`; href `/cursos/<curso>/<slug>` through the same `<Link locale=…>` fallback |
| `src/lib/courses/validate-crosslinks.ts` | Parse `curso`; resolve `(curso, slug)` against that course's `<locale>` then canonical directory; `ancla` follows the target into whichever tree resolved; unknown `curso` is fatal with the file named; a `curso` equal to the current course is a **warning** («drop the attribute») |
| `src/lib/courses/__tests__/leccion.test.ts`, `validate-crosslinks.test.ts`, `bridge.test.ts` | Cases below |
| `src/lib/courses/search/__tests__/searchable-text.test.ts` | Assert `<Leccion curso="x" slug="y">label</Leccion>` keeps its label |
| `messages/es.json`, `messages/en.json` | `courses.reader.leccion.otherCourse` kicker if the card needs a word («del curso anterior» / «from the previous course») — key-for-key |
| `content/courses/dl-nlp/es/00-pipeline-fixture.mdx` | + one `curso=` reference (to itself is the warning case; to a second fixture course is not possible) — see Test plan for the fixture strategy |

## The change

The **position rule** is the design decision. Within a course, whether a reference links
follows from the target's position relative to the reader (behind → link; ahead above the bridge
→ «más adelante»; ahead in the bridge → plain; draft → plain). Across courses there is no
position: the other course is a finished, published object the reader either did or did not
take. So:

- **Always a link** when the target is published, wherever the reference sits — including the
  bridge, because `LessonNav` will not be linking a lesson in another course.
- **Plain text** when the target is a draft (the route does not exist), exactly as within a course.
- **The card names the course.** A reader on `/cursos/llm-agents/...` hovering a reference must
  see that the link leaves the course: `DEEP LEARNING PARA NLP · BLOQUE 5 · LECCIÓN 9` on one
  line, the lesson title on the next. `refFallback` (the «in Spanish» mark) applies unchanged.
- **The label still names the topic** (AUTHORING §2). And the prose names the course once, at
  its first reference in a lesson: «…que escribiste en el proyecto del Transformer del curso
  anterior». After that, the topic alone.

Resolution in `validate-crosslinks.ts` needs the target course's file list. `collectMdxFiles`
already walks all of `content/courses/`; the index becomes `Map<course, Map<locale, files>>`
instead of one directory at a time — the per-directory scope of the *checking* pass is kept, only
the *lookup* widens.

## Acceptance criteria

- [ ] `<Leccion curso="dl-nlp" slug="proyecto-transformer">…</Leccion>` in an `llm-agents` lesson
      renders a link to `/cursos/dl-nlp/proyecto-transformer` with the course title in the card
- [ ] Same reference under `/en`: the target resolves per P11-01's two-step (English file if it
      exists, Spanish otherwise, marked `refFallback`), and the href carries the right locale
- [ ] A `curso=` reference inside the bridge still links
- [ ] `curso="dl-nlp" slug="no-existe"` fails `pnpm lint:content`, naming the referencing file
- [ ] `curso="no-course"` fails the same way
- [ ] `ancla` on a `curso=` reference is validated against the target file's headings
- [ ] `curso` naming the current course warns, does not fail
- [ ] The search index keeps the label text of a `curso=` reference
- [ ] `bridge.test.ts`: a `<Leccion curso=… slug=…>` below `---` gets `bridge` like any other and
      the component ignores it for cross-course targets
- [ ] AUTHORING §2 and §7 link to this task's tag and state the four rules above (text by P0-04)
- [ ] `pnpm test`, `pnpm lint:content`, `pnpm build` green

## Test plan

- Unit tests use the existing in-memory fixtures for `leccion.test.ts` and the temp-directory
  pattern of `validate-crosslinks.test.ts` — build two fake course directories in a temp root and
  check every case above without touching `content/`.
- Manual: once P1-01 lesson 1 exists (it opens on `dl-nlp`'s last bridge by reference), read it
  under `/cursos` and `/en/cursos`, hover the reference, follow it.

## Notes / gotchas

- **Do not add a `<Curso>` component.** A course is a landing page, not a lesson; the landing is
  linked by URL in the manifest's prose or by `LessonCta`, never from lesson prose.
- The hover card is server-rendered `<span>`s (P7-01's bundle rule). Adding a line to it adds no
  JS. Keep it that way.
- Reordering a `dl-nlp` lesson does not reclassify an `llm-agents` reference (no position rule),
  but **retitling a `dl-nlp` heading breaks any `ancla` into it** from this course — the lint
  makes that fatal in the *next* run, possibly on a PR that touched neither file. That is the
  P11-01 behaviour, and it is the reason this course should prefer `curso=` references without
  `ancla`.
- `content-key.ts` (`CONTENT-FEEDBACK-01`) keys feedback on `<courseSlug>/<lessonSlug>`; nothing
  here touches it, but it is the other place a course slug is a string, if you go looking.

## Out of scope

- Cross-course *search* (searching `dl-nlp` from inside `llm-agents`). The index is per course by
  design (P9-01).
- Cross-course *progress* (a `dl-nlp` completion unlocking anything here). Access is free; there
  is nothing to unlock.

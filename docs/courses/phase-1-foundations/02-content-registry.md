# P1-02 — Content registry + Zod schemas

**Tag:** `COURSE-P1-02` · **Effort:** M · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

Build the typed **registry**: a build-time scan of `content/courses/` that validates every
course manifest and lesson frontmatter with Zod and exposes a strongly-typed structure to the
rest of the app. The registry is what the sidebar, syllabus, sitemap, progress percentages and
(one day) a mobile API all read. **Prose is never queried; metadata always is.** That separation
is the hedge that keeps a future mobile app from being a rewrite.

## Context

- Convention (CLAUDE.md): Zod schemas live in `src/lib/schemas.ts`, never inline.
- Domain types live in `src/domain/types.ts` with zero external dependencies — `Course`,
  `Lesson`, `CourseBlock` belong there, and must **not** import Zod.
- Slugs are shared across locales, so English is purely additive later (see PLAN.md).
- The registry is read at **build time only**. It must never require a DB call.

## Files affected

| File | Change |
|------|--------|
| `src/domain/types.ts` | + `Course`, `CourseBlock`, `Lesson`, `LessonRef` (pure types, no Zod) |
| `src/lib/schemas.ts` | + `courseManifestSchema`, `lessonFrontmatterSchema` |
| `src/lib/courses/registry.ts` (new) | Filesystem scan → validate → build + memoize the typed registry |
| `content/courses/dl-nlp/course.es.yml` (new) | Course manifest: title, tagline, blocks, prerequisites, level, hours |
| `scripts/lint-content.ts` (new) | Standalone content lint, runnable in CI |
| `package.json` | + `lint:content` script |

## The change

**Course manifest** (`course.es.yml`) — course-level facts and block ordering:

```yaml
slug: dl-nlp
title: "Deep Learning para NLP: del Perceptrón al Transformer"
tagline: "..."
level: intermedio
estimatedHours: 40
prerequisites:
  - "Python intermedio (funciones, clases, NumPy básico)"
  - "Álgebra lineal: vectores, matrices, producto matricial"
  - "Cálculo: derivadas parciales y regla de la cadena"
blocks:
  - id: 1
    title: "Fundamentos de NLP"
    summary: "..."
```

**Lesson frontmatter** — per-file:

```yaml
slug: tokenizacion          # globally unique within the course
title: "Tokenización y vocabulario"
block: 1
order: 1
minutes: 25
summary: "..."              # used by the sidebar, meta description and JSON-LD
draft: true
hasCode: false              # drives the Pyodide lazy-load decision (P2-03)
hasQuiz: false
quiz: []                    # validated in P3-01; must parse as an empty array here
```

**Registry API** — keep it small and total:

```ts
getCourse(slug, locale): Course | null
getLesson(courseSlug, lessonSlug, locale): Lesson | null
listCourses(locale): Course[]              // published only
listLessons(courseSlug, locale): Lesson[]  // published only, block+order sorted
lessonNeighbours(courseSlug, lessonSlug, locale): { prev, next }
```

**Publication rule — one place, not scattered.** A lesson is published when
`draft === false` **and** the global gate allows it (P6-03). Every list function filters
through that single predicate; nothing downstream re-implements it.

Fail the build, with the offending file path in the message, on: invalid frontmatter, duplicate
slug within a course, a `block` id not declared in the manifest, or an orphan file whose slug
doesn't match its filename stem.

## Acceptance criteria

- [ ] Malformed frontmatter fails `pnpm build` with a message naming the file and the bad field
- [ ] Duplicate lesson slugs within a course fail the build
- [ ] `block: 7` with no such block in the manifest fails the build
- [ ] `draft: true` lessons never appear in any `list*` result
- [ ] Registry is memoized — repeated calls during one build do not re-read the filesystem
- [ ] `src/domain/types.ts` still imports nothing external (Zod stays in `schemas.ts`)
- [ ] A locale with no content directory returns `[]` rather than throwing (this is the normal `en` state for months)
- [ ] `pnpm lint:content` passes standalone and is wired into CI
- [ ] File-top comment blocks carry `COURSE-P1-02`

## Test plan

- **Unit** (`src/lib/courses/__tests__/registry.test.ts`) against a temp fixture tree:
  valid course parses; bad frontmatter throws with the file path; duplicate slugs throw;
  unknown block throws; drafts filtered; ordering is `(block, order)`; missing locale dir → `[]`;
  `lessonNeighbours` returns `null` at both ends and skips drafts.
- **Schema unit tests** in the existing `src/lib/__tests__/` for the two Zod schemas — including
  that unknown frontmatter keys are rejected (`.strict()`), which catches typos like `mintues:`.

## Notes / gotchas

- **Use `.strict()` on both schemas.** A silently-ignored typo'd key is exactly the failure mode
  this task exists to prevent.
- Course manifest is **per-locale** (`course.es.yml`), because title, tagline and prerequisites
  are prose. Block *ids* and lesson *slugs* are locale-invariant — that invariant is what makes
  English additive. Assert it in the lint once `en/` exists.
- The English directory will be empty for months. Every code path must treat that as normal,
  not exceptional.
- `minutes` is authored, not computed — a reader estimate for a lesson with heavy math is not a
  word count. Keep it manual.
- Do not add a `courses` DB table. Content lives in git; `course_slug` is text everywhere.
- Keep `hasCode` / `hasQuiz` even though they're derivable from the body: the reader needs them
  **before** parsing the MDX to decide what to lazy-load.

## Out of scope

- Quiz question validation beyond "is an array" (P3-01 tightens it).
- Any page or route (P1-03/04).
- The publication gate mechanism itself (P6-03) — this task only routes all filtering through a single predicate so the gate has one place to plug in.

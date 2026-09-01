# P8-01 — `reading`: the schema, the block, the lint

**Tag:** `COURSE-P8-01` · **Size:** M · **Status:** done

## TL;DR

Add a required `reading:` array to lesson frontmatter, render it as a collapsed «Para profundizar»
`<details>` between the bridge and the prev/next footer, and add a sixth `lint:content` pass for
the link rules a Zod schema cannot express. No lesson content is written here — all 43 lessons get
`reading: []` and P8-02 fills them.

## Context

The course derives rather than cites, on purpose. The gap that leaves: a student who finishes
lesson 7 and wants Mikolov's actual paper has nowhere to go, and nothing in the course shows it
knows the literature. See [README.md](README.md) for the design review and what was rejected.

The one structural constraint: [`LessonLayout.tsx`](../../src/features/courses/reader/LessonLayout.tsx)
already renders `LessonComplete` and `LessonNav` after the MDX body, so the bridge is the last
*prose* but not the last thing on the page. The block joins that footer cluster rather than
breaking a clean ending.

## Files affected

| File | Change |
|---|---|
| `src/lib/schemas.ts` | `ReadingItemSchema`, `READING_KINDS`/`READING_MAX`/`READING_NOTE_MAX`, `reading` on `LessonFrontmatterSchema` |
| `src/domain/types.ts` | `ReadingItem`, `reading` on `Lesson` |
| `src/features/courses/reader/LessonReading.tsx` | **new** — the block |
| `src/features/courses/reader/LessonLayout.tsx` | `reading` prop; render between body and `LessonComplete` |
| `src/app/[locale]/cursos/[courseSlug]/[lessonSlug]/page.tsx` | pass `lesson.reading` |
| `src/app/[locale]/cursos/[courseSlug]/[lessonSlug]/lesson.css` | `.lesson-reading*` |
| `src/lib/courses/reading-summary.ts` | **new** — `tallyKinds`, the closed-state summary |
| `src/lib/courses/validate-reading.ts` | **new** — the sixth lint pass |
| `scripts/lint-content.ts` | wire `validateReading()` |
| `src/lib/courses/budget.ts` | report-only `reading` count |
| `messages/{es,en}.json` | `courses.reading.*`, key-for-key |
| `content/courses/dl-nlp/es/*.mdx` | `reading: []` × 44 |
| `content/courses/dl-nlp/es/00-pipeline-fixture.mdx` | one entry of each `kind` |
| `content/courses/dl-nlp/_template.mdx`, `docs/courses/AUTHORING.md` | the authoring contract |

## The change

### 1. Naming — `reading`, not `refs`

This codebase already has a `LessonRef` (the prev/next pointer) and a `lesson-ref-*` CSS family
(the P7 cross-lesson hover card). A third meaning for "ref" would collide with both, so the field,
the type, the component and the CSS all say `reading`.

### 2. The schema

`kind` (`paper|libro|blog|video|interactivo`), `title`, `authors`, `year?`, `venue`, `lang`
(`es|en`), `url`, `note`. Capped at `READING_MAX` = 5, `note` at 240 chars, `url` must be https,
no duplicate url within a lesson. `year` is an optional **string**: "2013", but also
"3.ª ed., borrador libre", and a living web tool has none.

`reading` is **required** on every lesson, like `challenges` — the strict-object discipline is what
makes an author answer the question instead of defaulting to no by omission.

### 3. `LessonReading` — the block

Server Component on a native `<details>`, the same idiom as `Details` and the sidebar accordion:
zero client JS, entries in the prerendered HTML while closed. Returns `null` on `reading: []`.

The summary is the whole advertisement for what is behind the fold, so it carries a count and a
per-kind breakdown (`5 fuentes · 3 papers, 1 libro, 1 interactivo`). Under 480px the breakdown is
dropped and the count kept — with five kinds the line wraps to three at 375px, measured.

### 4. `validate-reading.ts` — the sixth pass

Unlike its five siblings this one validates **no body reference**: the block is rendered from
frontmatter, so there is no `<Tag id>` to resolve. What is left is the link rules Zod cannot
express: arXiv `/abs/` not `/pdf/`, a `venue` naming an arXiv id must agree with the url's id, and
no duplicate title. Liveness is deliberately not checked — see [README.md](README.md).

## Acceptance criteria

- [x] `reading` required; a lesson missing it fails the build naming the file and field
- [x] A sixth entry, a non-https url, an unknown kind, an empty note, a note past 240, a duplicate
      url and an unknown key are each rejected
- [x] arXiv PDF link, venue/url id mismatch and duplicate title each exit 1 naming the file
- [x] The block renders collapsed, with all five kinds and both `lang` chips
- [x] `reading: []` renders nothing at all
- [x] No horizontal page scroll at 375px; summary stays one line there
- [x] Zero client JS added (`check:bundle` green)
- [x] `courses.reading.*` key-for-key in both message files
- [x] `pnpm lint` · `tsc` · `test:unit` · `lint:content` · `build` · `check:bundle` all green

## Notes / gotchas

- **A CSS specificity collision was found in the browser, not in review.** `.lesson-content p` is
  (0,1,1) and beat the bare `.lesson-reading-lede` / `.lesson-reading-note` (0,1,0), so both
  paragraphs silently kept the 1.25rem prose margin instead of the 18px/5px they declare. Both
  selectors are now prefixed with `.lesson-content`. Anything added inside the reading column has
  the same hazard.
- **The `<ul>` carries an inline `list-style`** so the `:not([style])` guard in `lesson.css`
  excludes it from the markdown-list rules — the mechanism that block already documents.
- **`reading` is not in `estimatedMinutes`.** The block ships collapsed and nothing in it is
  required to finish the lesson; counting it would inflate every estimate with minutes the student
  is never asked to spend.
- **The budget axis cannot warn** (`max` and `ceiling` are both 5, and the schema rejects a sixth).
  It exists to put the count in the report line, which is what makes "which lessons still have
  none" visible while P8-02 runs.
- **Screenshots were unavailable** in this environment (the Browser pane does not composite);
  verification was by computed styles and measured geometry against a real dev server.

## Out of scope

A course-level bibliography page, any `en/` content, link-liveness checking, and the reading
entries themselves — all of P8-02.

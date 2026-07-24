# Phase 1 — Foundations

Everything needed to turn an MDX file on disk into a statically-generated, responsive,
mathematically-typeset lesson page. No persistence, no widgets, no quizzes — but by the end
of this phase a real prose lesson from Block 0 is readable on a phone at a real URL.

This phase is the **authoring loop**. It is worth over-investing here: the cost of friction
gets multiplied by ~40 lessons.

## Tasks

1. [01-content-pipeline.md](01-content-pipeline.md) — `COURSE-P1-01` (L) — MDX + KaTeX + Shiki
2. [02-content-registry.md](02-content-registry.md) — `COURSE-P1-02` (M) — registry + Zod schemas
3. [03-catalog-and-landing.md](03-catalog-and-landing.md) — `COURSE-P1-03` (M) — `/cursos` + course landing
4. [04-lesson-reader.md](04-lesson-reader.md) — `COURSE-P1-04` (L) — responsive reader shell

**Landing order:** P1-01 → P1-02 → (P1-03 ∥ P1-04). The first two are strictly sequential;
the two page-building tasks are independent of each other once the registry exists.

## Exit criteria

- [ ] A prose lesson with display math and a highlighted code block renders at `/cursos/dl-nlp/<slug>`, statically generated
- [ ] Malformed frontmatter fails `pnpm build` with a readable error naming the file
- [ ] `draft: true` lessons are absent from `generateStaticParams` and the sitemap
- [ ] Reader usable at 360px; no horizontal **page** scroll with a wide equation on screen
- [ ] Landing-page JS bundle unchanged (bundle guard green)
- [ ] `pnpm lint` + `pnpm build` green

## Conventions this phase establishes

- Content lives in `content/courses/<courseSlug>/<locale>/`, never in `src/`.
- Course/lesson metadata is **typed and validated**, never read ad-hoc from frontmatter at render time.
- Course prose never passes through next-intl messages; UI chrome always does (`messages/es.json` **and** `messages/en.json`, key-for-key).
- Nothing course-related enters the shared layout chunk.

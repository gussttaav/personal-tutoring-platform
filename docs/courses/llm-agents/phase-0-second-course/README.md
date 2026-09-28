# Phase 0 — Second course

Everything the infrastructure needs before the first `llm-agents` lesson is written. Small on
purpose: the pipeline, registry, catalog, reader, widgets, Pyodide, quizzes, progress, search,
SEO and notifications are already course-agnostic (`[courseSlug]` routes, a per-course manifest,
`course_slug` as plain text in Postgres). What is left is what *only a second course* could have
revealed.

## Tasks

1. [01-manifest-and-landing.md](01-manifest-and-landing.md) — `COURSE-C2-P0-01` (S) — the two
   manifests, the «soon» landing, `noindex` while lesson-less
2. [02-cross-course-references.md](02-cross-course-references.md) — `COURSE-C2-P0-02` (M) —
   `<Leccion curso="…">` + lint
3. [03-course-model-assets.md](03-course-model-assets.md) — `COURSE-C2-P0-03` (L) — the mini-GPT
   checkpoint, the BPE merges, the corpus and the train script
4. [04-authoring-contract.md](04-authoring-contract.md) — `COURSE-C2-P0-04` (M) — AUTHORING step 3
   (shared), the course's AUTHORING/NOTATION deltas, the template
5. [05-terminal-lessons.md](05-terminal-lessons.md) — `COURSE-C2-P0-05` (S) — `<RepoLink>` and the
   companion repository

**Landing order:** 01 → 04 → 02 ∥ 03 → 05. The manifest first because the authoring contract's
"what a lesson may assume" section quotes it; the contract before the lint work because P0-02
changes a rule in AUTHORING too. P0-03 is the long one and is independent of everything but the
manifest's block titles — start it first and let the others land around it.

## Exit criteria

- [ ] `/cursos/llm-agents` and `/en/cursos/llm-agents` render the «soon» landing from the two
      manifests; neither is in `/cursos`, the sitemap, or indexable
- [ ] `<Leccion curso="dl-nlp" slug="proyecto-transformer">` in a fixture lesson links, carries
      the first course's name in its card, and a typo'd slug fails `pnpm lint:content`
- [ ] The mini-GPT checkpoint loads and generates inside one Pyodide cell on a mid-range phone,
      under `RUN_TIMEOUT_MS`, and `train-minigpt.py` re-produces it bit-for-bit from the seed
- [ ] Shared AUTHORING §1 step 3 reads «the precise statement»; `llm-agents/AUTHORING.md`
      carries the two-shapes table; `llm-agents/NOTATION.md` has the five block sections
- [ ] `<RepoLink>` renders from MDX; the companion repository exists, empty, with a pinned README
- [ ] `pnpm lint` + `pnpm test` + `pnpm lint:content` + `pnpm build` green; the three
      `courses-*.spec.ts` e2e files pass with two courses in the catalog

## What this phase deliberately does not do

- **No changes to `dl-nlp` content.** The hand-off from its last bridge is Phase 2, timed with
  this course's publication.
- **No second content pipeline, no new route.** If a task here finds it needs one, the plan is
  wrong and this README gets rewritten before the task does.
- **No English lessons**, but bilingual *chrome* from day one — the English manifest, and every
  new widget's strings in both message files.

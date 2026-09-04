# Courses — Status

**Planned:** 2026-07-24
**Started:** 2026-07-25
**Legend:** ⬜ not started · 🔄 in progress · ⛔ blocked · ✅ done · 🚫 won't do

Update this file when starting, completing, or blocking a task.

---

## Phase 1 — Foundations

| Task | Tag | Status | Owner | PR |
|------|-----|--------|-------|----|
| [01 MDX + KaTeX + Shiki pipeline](phase-1-foundations/01-content-pipeline.md) | `COURSE-P1-01` | ✅ | _tbd_ | local |
| [02 Content registry + Zod schemas](phase-1-foundations/02-content-registry.md) | `COURSE-P1-02` | ✅ | _tbd_ | local |
| [03 Catalog + course landing](phase-1-foundations/03-catalog-and-landing.md) | `COURSE-P1-03` | ✅ | _tbd_ | local |
| [04 Responsive lesson reader](phase-1-foundations/04-lesson-reader.md) | `COURSE-P1-04` | ✅ | _tbd_ | local |

**Exit criteria**
- [ ] A prose lesson with display math and a highlighted code block renders at `/cursos/dl-nlp/<slug>`, statically generated
- [ ] Malformed frontmatter fails `pnpm build`
- [ ] `draft: true` lessons are absent from routes and the sitemap
- [ ] Reader is usable on a 360px viewport; no horizontal page scroll with a wide equation on screen
- [ ] Landing-page JS bundle unchanged (bundle guard green)
- [ ] `pnpm lint` + `pnpm build` green

## Phase 2 — Interactivity

| Task | Tag | Status | Owner | PR |
|------|-----|--------|-------|----|
| [01 Widget registry + math core](phase-2-interactivity/01-widget-registry.md) | `COURSE-P2-01` | ✅ | _tbd_ | local |
| [02 First explorables](phase-2-interactivity/02-first-explorables.md) | `COURSE-P2-02` | ✅ | _tbd_ | local |
| [03 Pyodide worker + PyCell](phase-2-interactivity/03-pyodide-cells.md) | `COURSE-P2-03` | ✅ | _tbd_ | local |

**Exit criteria**
- [x] A widget renders from `<Explorable id="…" />` in MDX; an unknown id fails the build
- [x] Widget math functions unit-tested with no DOM
- [x] A NumPy snippet runs in-browser and prints output; `while True:` is killed by the timeout without freezing the tab
- [x] Pyodide loads only after the first Run click, only on `hasCode` lessons
- [x] `pnpm test` + `pnpm build` green

## Phase 3 — Assessment

| Task | Tag | Status | Owner | PR |
|------|-----|--------|-------|----|
| [01 Quiz schema + grading](phase-3-assessment/01-quiz-engine.md) | `COURSE-P3-01` | ✅ | _tbd_ | local |
| [02 Code challenges](phase-3-assessment/02-code-challenges.md) | `COURSE-P3-02` | ✅ | _tbd_ | local |

**Exit criteria**
- [x] All five question types render and grade correctly (unit-tested pure grader)
- [x] A code challenge passes/fails against hidden assertions in Pyodide
- [x] **Walking skeleton:** lesson 1 of Block 1 is complete — closed by P5-00, which authored
  `es/01-texto-como-numeros.mdx` as the dogfood lesson. **Partially:** the lesson is prose + display
  math + quiz, with no explorable and no NumPy cell, because P5-01 specifies lesson 1 as
  deliberately widget-free and code-free (it is the free sample lesson and the first impression).
  Explorable + `<PyCell>` in a *published* lesson first land with lesson 2, `tokenizacion`. The
  fixture has covered both mechanically since P2-02/P2-03. Phone reading not yet done — see below.
- [x] `pnpm test` + `pnpm build` green

## Phase 4 — Persistence

| Task | Tag | Status | Owner | PR |
|------|-----|--------|-------|----|
| [01 Schema + repository + service](phase-4-persistence/01-schema-and-service.md) | `COURSE-P4-01` | ✅ | _tbd_ | local |
| [02 Progress API + reader wiring](phase-4-persistence/02-progress-api.md) | `COURSE-P4-02` | ✅ | _tbd_ | local |
| [03 "Mis cursos" panel](phase-4-persistence/03-mis-cursos-panel.md) | `COURSE-P4-03` | ✅ | _tbd_ | local |
| [04 Attempt history: read it back](phase-4-persistence/04-attempt-history.md) | `COURSE-P4-04` | ✅ | _tbd_ | local |

**Exit criteria**
- [x] Migration `0016` applied; deny-anon RLS present on all three tables per the `0007` pattern
- [x] `CourseService` tested against in-memory fakes; zero infrastructure imports
- [x] Completing a lesson survives a refresh and a different device — refresh proven by E2E against the real DB; cross-device follows from the same server-side read (not separately exercised)
- [x] Signed-out reading still works (progress silently not tracked)
- [x] `/area-personal` shows enrolled courses with % complete and a resume link
- [ ] A quiz answered in a previous visit comes back answered; a solved challenge keeps its
  reference solution unlocked (P4-04)
- [x] `pnpm test` + `pnpm build` green

**P4-03 notes**
- `GET /api/courses/progress` without `courseSlug` now returns `{ enrollments: EnrolledCourseView[] }`
  instead of 400. Titles are merged in from the registry server-side (`src/lib/courses/enrollment-view.ts`);
  nothing is denormalised into Postgres.
- Title/lesson lookup falls back to the default locale when the request locale has no content tree
  (`dl-nlp` has no `en/` today), and the view carries the locale that resolved so the card links an
  English reader to the Spanish lesson that exists rather than a 404.
- Panel placement: full-width section **below** the two-column row in `PersonalArea.tsx`.
  **Superseded by the /area-personal redesign:** `MyCoursesPanel.tsx` is gone; enrolled courses are
  now the third tab (`CoursesTab.tsx`), its fetch lifted into `usePersonalAreaData` so the tab strip
  can show a count badge. The `areaPersonal.courses.title` key was dropped — the tab button carries
  that label via `areaPersonal.main.tabs.courses`. `CourseProgressCard` and `resumeHref` survive
  unchanged in behaviour; only their styling moved to `area-personal.css`.
- The card's `resumeHref` is exported and unit-tested; there is still no jsdom/RTL in the repo, so the
  task's "card renders 0 / partial / 100%" case is covered on the pure mapping
  (`src/lib/courses/__tests__/enrollment-view.test.ts`) rather than by rendering.
- Manual pass (three viewports, both locales) not yet run — automated checks only.

## Phase 5 — Content

Each block is authored **one lesson at a time** via `/course-lesson`, on the shared branch and
reviewed before commit. Per-lesson progress lives in each block task's "Lesson progress"
checklist; a block's row here flips to ✅ **only when every lesson box in that block doc is
ticked.** This table stays a phase-level dashboard — do not add per-lesson rows to it.

| Task | Tag | Status | Owner | PR |
|------|-----|--------|-------|----|
| [00 Authoring guide + budget](phase-5-content/00-authoring-guide.md) | `COURSE-P5-00` | ✅ | _tbd_ | local |
| [01 Block 1 — Fundamentos de NLP](phase-5-content/01-block-1-fundamentos.md) | `COURSE-P5-01` | ✅ | _tbd_ | local |
| [02 Block 2 — Perceptrón Multicapa](phase-5-content/02-block-2-mlp.md) | `COURSE-P5-02` | ✅ | _tbd_ | local |
| [03 Block 3 — Redes Recurrentes](phase-5-content/03-block-3-rnn.md) | `COURSE-P5-03` | ✅ | _tbd_ | local |
| [04 Block 4 — El Puente hacia la Atención](phase-5-content/04-block-4-atencion.md) | `COURSE-P5-04` | ✅ | _tbd_ | local |
| [05 Block 5 — El Transformer](phase-5-content/05-block-5-transformer.md) | `COURSE-P5-05` | ✅ | _tbd_ | local |

**Exit criteria**
- [ ] All five blocks published (`draft: false`), prerequisites stated on the landing page
- [ ] Every lesson within the P5-00 budget — measured by `pnpm lint:content` since P5-00; green for
  the one published lesson so far
- [x] Content lint green in CI

## Phase 6 — Launch

| Task | Tag | Status | Owner | PR |
|------|-----|--------|-------|----|
| [01 SEO: JSON-LD, sitemap, hreflang](phase-6-launch/01-seo.md) | `COURSE-P6-01` | ✅ | _tbd_ | local |
| [02 Course notifications](phase-6-launch/02-course-notifications.md) | `COURSE-P6-02` | ✅ | _tbd_ | |
| [03 Launch: bilingual catalog + link swap](phase-6-launch/03-publication-gate.md) | `COURSE-P6-03` | ✅ | _tbd_ | |

**Exit criteria**
- [x] Sitemap lists every published lesson; **no `en` hreflang alternate is emitted for a lesson while English lesson content does not exist** _(P6-01, P6-03)_
- [ ] `Course` + `LearningResource` JSON-LD validates
- [x] A course-notification opt-in exists with an unsubscribe path and a working (dry) send behind it _(P6-02)_
- [x] Navbar/Footer "Cursos" links to `/cursos`; the courses ComingSoonModal is gone (blog untouched) _(P6-03)_
- [x] `/en/cursos` shows a real English card; `/en/cursos/dl-nlp` is a real English landing page _(P6-03)_

## Phase 7 — Cross-links

Turn the ~403 hand-written cross-references into build-validated links. P7-02 is **blocked on
P7-01**: without the lint pass the migration is 403 unvalidated edits. Per-lesson progress lives in
the block checklist inside the P7-02 doc; this table stays a phase-level dashboard.

| Task | Tag | Status | Owner | PR |
|------|-----|--------|-------|----|
| [01 `<Leccion>` + bridge pre-pass + crosslink lint](phase-7-crosslinks/01-component-and-lint.md) | `COURSE-P7-01` | ✅ | _tbd_ | local |
| [02 Content pass: 43 lessons, block by block](phase-7-crosslinks/02-content-migration.md) | `COURSE-P7-02` | ✅ | _tbd_ | local |

**Exit criteria**
- [x] No published lesson contains a hand-written lesson number in a cross-reference
- [x] Every `<Leccion slug>` resolves; an unknown slug or a stale anchor fails `pnpm lint:content`
- [x] Reordering a lesson in the manifest changes which references link, with no content edit
- [x] `<Leccion>` text is excluded from the word budget
- [x] Every forward reference above a `---` states its direction in the sentence
- [x] `pnpm lint` + `pnpm lint:content` + `pnpm test` + `pnpm build` + `pnpm check:bundle` green

## Phase 8 — Further reading

Give every lesson that has one an annotated «Para profundizar» block. P8-02 is **blocked on
P8-01** for the same reason P7-02 was: without the lint the migration is ~120 unvalidated links.
Per-lesson progress lives in the block checklist inside the P8-02 doc; this table stays a
phase-level dashboard.

| Task | Tag | Status | Owner | PR |
|------|-----|--------|-------|----|
| [01 Schema + collapsed block + reading lint](phase-8-further-reading/01-component-and-lint.md) | `COURSE-P8-01` | ✅ | _tbd_ | local |
| [02 Content pass: 43 lessons, block by block](phase-8-further-reading/02-content-migration.md) | `COURSE-P8-02` | ⬜ | _tbd_ | |

**Exit criteria**
- [x] `reading` is required frontmatter; the shape rules and the three link rules all fail the build
- [x] The block renders collapsed after the bridge, and renders nothing on `reading: []`
- [x] Zero client JS added; entries are in the prerendered HTML while closed
- [ ] Every published lesson has a considered `reading` — entries or a deliberate `[]` (P8-02)
- [ ] Every URL resolves and points at what its `title` claims (P8-02)
- [x] `pnpm lint` + `pnpm lint:content` + `pnpm test` + `pnpm build` + `pnpm check:bundle` green

---

## Deviations

**COURSE-P1-01** — Closed per doc, no scope changes. Notes:
- **Spike landed on the PRIMARY path**: `next-mdx-remote/rsc` `compileMDX` works under
  Next 16 + React 19 RSC with remark-math / rehype-katex / rehype-pretty-code. Neither
  Fallback A (`@next/mdx`) nor B (precompile) was needed; `next.config.mjs` untouched.
  Recorded in the file-top comment of `src/lib/courses/mdx.ts` (every later task assumes it).
- **Type sourcing:** pnpm keeps `unified` / `mdx/types` as non-hoisted transitives that TS
  can't resolve directly, so `PluginList` and `MDXComponents` are derived from the direct
  dep `next-mdx-remote/rsc`'s exported `MDXRemoteProps` (type-only imports, erased at runtime).
- **Shiki theme:** `github-dark-default` (in `src/constants/shiki-theme.ts`).
- **KaTeX version pin:** `katex` is pinned to `^0.16` to MATCH the version `rehype-katex@7`
  renders HTML with. `pnpm add katex` first pulled 0.18.1, whose CSS renamed the
  `sizing` class → `katex-sizing`; imported against 0.16-rendered markup the
  script-shrink rules silently no-op'd and sub/superscripts rendered full-size.
  Keep katex aligned with rehype-katex's range on any future bump.
- **Verification** used a temporary, uncommitted route (`cursos/verify-fixture`, since deleted).
  Built as SSG static HTML: KaTeX (HTML+MathML), Shiki highlighting, and all four components
  render at build time; client chunks carry no katex/shiki/MDX-compiler JS; KaTeX fonts resolve
  to relative `/_next/static/media` URLs (no CSP `font-src` violation). The real lesson reader
  that imports `_styles/katex.css` on the segment is P1-04.
- Not yet committed to a branch/PR (**local**).

**COURSE-P1-02** — Closed. Registry, both Zod schemas, manifest, lint script + CI step all landed.
Deviations from the task doc:
- **`pnpm build` enforcement is deferred, not skipped.** The acceptance line "malformed
  frontmatter fails `pnpm build`" only fully holds once a route consumes the registry (P1-03) —
  in this task nothing imports it at build time yet. The standalone enforcement is
  **`pnpm lint:content`** (via `validateAllContent`), wired into CI right after `pnpm lint`.
  Verified: a `mintues:` typo in the fixture fails the lint naming the file + field, exit 1.
- **P1-01 fixture touched (not in the task's Files-affected list, but required).** The strict
  lesson schema rejects the old two-field frontmatter, so `content/courses/dl-nlp/es/00-pipeline-fixture.mdx`
  now carries the full field set (`slug: pipeline-fixture`, `block: 0`, `order: 0`, `minutes: 1`,
  `summary`, `hasCode/hasQuiz: false`, `quiz: []`), still `draft: true`. This keeps a single
  validation path (no fixture special-casing in the scanner); the fixture stays out of every
  `list*` because it is a draft. Block 1 is declared in the manifest so it validates.
- **Runner:** no `tsx`/`ts-node` existed, so `tsx` was added as a devDep to run
  `scripts/lint-content.ts` as the task specifies (script uses `console`, not the Sentry/Next-coupled `log()`).
- **YAML:** added `js-yaml` (dep, resolved to nodeca `js-yaml@5.x`; `load()` verified) +
  `@types/js-yaml` (devDep) to parse the standalone `course.es.yml`; lesson frontmatter still via `gray-matter`.
- **New test precedent:** `registry.test.ts` introduces the repo's first `os.tmpdir()`/`mkdtempSync`
  fs-fixture tests. `schemas.test.ts` introduces the first `expect(() => Schema.parse(bad)).toThrow()` pattern.
- Not yet committed to a branch/PR (**local**).

**COURSE-P1-03** — Closed. `/cursos` (catalog) + `/cursos/[courseSlug]` (landing) both statically
generated; `CourseCard` + five landing components (`CourseHero`, `Prerequisites`, `SyllabusAccordion`,
`CourseFaq`, `CourseCta`); `courses.*` + `meta.cursos` added key-for-key to both message files.
Build/lint/unit all green. Verified in the prerendered HTML: prerequisites, the "what you'll build"
outcome, and FAQ answers (collapsed `<details>`) are all in the static markup (JS-disabled criterion);
catalog renders the honest empty state in **both** locales; landing generated for `/es/cursos/dl-nlp`
only (en has no manifest → not generated). Deviations from the task doc:
- **`registry.ts` touched (not in the task's Files-affected list).** Added one additive selector,
  `listCourseManifests(locale)`, used ONLY by the landing route's `generateStaticParams`. dl-nlp has
  zero *published* lessons today (only the P1-01 draft fixture), so `listCourses` — and therefore a
  published-only static-params source — would generate **no** landing page, making the conversion
  surface un-reviewable on preview until P5. `listCourseManifests` enumerates manifest courses
  regardless of publication so `/cursos/dl-nlp` renders now; **counts and the syllabus still use the
  published-only `listCourses`/`listLessons`**, so drafts appear in neither. The **catalog stays
  published-only** (empty "próximamente" state today). User-confirmed decision during planning.
- **Course-specific landing copy lives in the message files, not the manifest.** The hero "what
  you'll build" outcome and the FAQ Q&A are under `courses.landing.*`; the manifest (`course.es.yml`)
  has no field for them and adding one would mean editing the P1-02 Zod schema (out of scope). The
  task explicitly permits FAQ "in the manifest or a message file". With one course this is keyed
  generically; a second course will key it per course — a known, acceptable future refactor.
- **`SyllabusAccordion` is a Server Component on native `<details>`** (same pattern as `Details` in
  `mdx-components.tsx`), not a `"use client"` disclosure. This ships zero client JS and keeps the full
  syllabus in the HTML while collapsed — the only way to satisfy the JS-disabled acceptance criterion.
  Its pure grouper `groupLessonsByBlock` is exported and unit-tested (incl. the all-drafts-block →
  omitted case) via the `os.tmpdir()` registry-fixture pattern.
- **`generateStaticParams` on the catalog page** is declared over locales as the task asks, though the
  root `layout.tsx` already cascades locale params (harmless redundancy, matches the task text).
- **The "free sample lesson" section (task item 4) was removed** at the user's request. Rationale: the
  course is free and needs no sign-up to read, so a "try one lesson free" card falsely implies the rest
  is paid — it made no sense here. Its `courses.landing.sample.*` keys were dropped from both message
  files. This is a deliberate departure from the task spec, which listed the sample lesson as its own
  section. The hero and closing CTA still provide the "start the course" entry points.
- Not yet committed to a branch/PR (**local**).

**COURSE-P1-04** — Closed. The lesson reader route `/cursos/[courseSlug]/[lessonSlug]` +
five reader components (`LessonLayout`, `LessonSidebar`, `OnThisPage`, `LessonNav`,
`MobileLessonBar`), `lesson.css` (grid + reading typography + `scroll-margin-top`), and the
`scripts/check-bundle.ts` guard. `courses.reader.*` added key-for-key to both message files.
`pnpm lint` (0 errors), `pnpm build`, `pnpm test:unit` (470 pass) all green; bundle guard
green on a clean build and proven to fail (exit 1) when a marker is present off the lesson
route, correctly exempting the lesson route. Deviations from the task doc:
- **`src/lib/courses/mdx.ts` touched (not in Files-affected).** Added `rehype-slug` as the
  first rehype plugin so headings get `id`s — required for anchor links, `scroll-margin-top`,
  and the on-this-page rail. New deps `rehype-slug` + `github-slugger`. The order-guard test
  `mdx.test.ts` was updated to assert `[slug, katex, pretty-code]`.
- **Two new lib helpers instead of extending the registry** (which is deliberately
  metadata-only / prose-free): `src/lib/courses/lesson-source.ts` (`getLessonSource` — the one
  place that reads a lesson's MDX body off disk) and `src/lib/courses/headings.ts`
  (`extractHeadings`, unit-tested; shares `github-slugger` with the pipeline so the on-this-page
  ids match the rendered heading ids).
- **`jest.config.js` touched.** `github-slugger` is ESM-only → added to the `ESM_PACKAGES`
  allowlist so `headings.test.ts` transpiles it (same mechanism next-intl already uses).
- **`lessonNeighbours` unit tests already existed** in `registry.test.ts` (null ends, middle,
  draft-skip, unknown→null) — the task's "add tests" item was already satisfied, so no new
  neighbour tests were written. Added `headings.test.ts` (h2/h3-only, code-fence skip, slug
  de-dup, inline-markdown stripping).
- **Containment not re-declared in `lesson.css`.** `pre`/`table`/`img` are already contained by
  `mdx-components.tsx` and `.katex-display` by `_styles/katex.css` (both from P1-01); `lesson.css`
  owns only the grid, reading typography, and `scroll-margin-top`, per the task's "don't
  duplicate" intent.
- **`generateStaticParams` is published-only** (via `listCourseManifests` × `listLessons`), so
  **no lesson page is generated while dl-nlp has only the draft fixture** and `en` generates
  nothing (404s cleanly) — drafts stay absent from routes/sitemap (Phase-1 exit criterion). The
  reader was verified by temporarily flipping the fixture to `draft: false` for a build (reverted
  after), mirroring the P1-01 temporary-verification approach.
- **`package.json`** gained a `check:bundle` script (`tsx scripts/check-bundle.ts`); the guard
  reads `.next/diagnostics/route-bundle-stats.json` (Next 16's per-route first-load chunk list —
  `app-build-manifest.json` was removed in Next 16). Not wired into CI (out of scope).
- **`sitemap.ts` / JSON-LD / hreflang correction untouched** (P6-01), progress slot in
  `MobileLessonBar` left empty (P4-02). Reading-position restore not built (deferred to P4-02).
- **Two fixes from live manual review** (`pnpm dev`, fixture temporarily published):
  (1) the global Navbar is `position: fixed`, so `lesson.css` now anchors all top offsets
  (content padding, sticky-rail `top`, mobile-bar `top`, heading `scroll-margin-top`) and the
  open drawer's z-index to a `--nav-h: 72px` var — otherwise the h1/rails slid under the navbar;
  (2) code (`pre`) and table wrappers got the same thin 6px `::-webkit-scrollbar` styling as
  `.katex-display` (they were showing the chunky browser default);
  (3) the sidebar + on-this-page rails are `position: sticky`, but the global
  `body { overflow-x: hidden }` (globals.css) made body a scroll container and silently broke
  sticky — fixed by scoping `body:has(.lesson-shell) { overflow-x: clip }` in lesson.css (clips
  the same horizontal overflow without creating a scroll container; global rule untouched for
  the rest of the site). Redundant inner `sticky` on the OnThisPage `<nav>` removed (the aside
  owns stickiness).
- **Sidebar redesign (user request during review).** The back link now NAMES its destination
  (`course.title`) and the redundant "Contenido del curso" header was dropped; block headers are
  numbered overlines (`01 · <title>`). A **progress layer** (per-lesson completion check +
  a "done / total" counter) was added but is **dormant** — driven by an optional
  `completedSlugs` prop that nothing passes in P1-04, so a signed-out reader sees a clean list
  with the current lesson highlighted. This is the **basis for P4-02** (which already lists
  `LessonSidebar → "Completed markers"`): P4-02 fetches progress client-side after hydration and
  feeds it via the prop or the `data-lesson-slug` hooks now on each lesson link. Message keys
  `courses.reader.backToCourseAria` + `progressLabel` added key-for-key; the mark-complete
  control and `courses.progress.*` copy remain P4-02's scope.
- Not yet committed to a branch/PR (**local**).

**COURSE-P2-01** — Closed. Widget registry + pure math core + one reference widget landed under
`src/features/courses/widgets/`. `Explorable` wired into the MDX map; `pnpm lint:content` now also
validates `<Explorable id>`. `pnpm test:unit` (510 pass), `pnpm lint` (0 errors), `pnpm build`,
`pnpm check:bundle` all green. Verified end-to-end by temporarily publishing the P1-01 fixture with
`<Explorable id="sigmoid-explorer" />`: the lesson route generated, the widget's `WidgetFrame` (with
its `aspect-ratio` reserved box + caption) SSR'd into the static HTML — so no layout shift on hydrate
— and `check:bundle` stayed green *with* widgets present (lesson route correctly exempt); fixture
reverted after. Deviations from the task doc:
- **WidgetId sourcing split from the registry** (doc showed `WidgetId = keyof typeof WIDGETS`). The
  content linter runs under Node/`tsx` and must know the valid ids **without** importing
  `next/dynamic` or any client `.tsx`. So a pure, zero-import `widget-ids.ts` owns
  `WIDGET_IDS`/`WidgetId`/`isWidgetId`, and `registry.ts` maps them typed `Record<WidgetId, …>` —
  which keeps the "unknown id ⇒ compile error" guarantee (missing or extra key fails typecheck)
  while staying Node-importable.
- **Only the primitives the reference widget needs were built** (`WidgetFrame`, `Slider`, `Plot2D`);
  **`Heatmap` + `VectorField` deferred** to the task whose widget first needs them (P2-02 / P5), to
  avoid shipping untested, unused scaffolding. User-confirmed during planning. The full four-module
  **math core** (`activations`, `optimisation`, `linalg`, `attention`) **was** built with tests — it
  is the task's named deliverable, is fully unit-tested (softmax stable at `[1000,1001]`; every
  derivative checked vs central finite differences), and is tree-shaken off the client unless a
  widget imports it (only `activations.sigmoid` ships today, via `SigmoidExplorer`).
- **New `src/lib/courses/validate-explorables.ts` (+ test), not in the task's Files-affected list.**
  The doc put the id-validation in `scripts/lint-content.ts`; extracting it into a Node-clean lib
  module (imports only the pure `widget-ids`) keeps the pure helpers (`findExplorables`,
  `explorableProblems`) unit-testable and follows the P1-04 precedent of a separate body-reader
  rather than extending the metadata-only content registry. `lint-content.ts` just calls it.
  Verified failing: an unregistered id exits 1 naming the file + id.
- **No jsdom/RTL added.** The repo has no component-render test infra; per the doc (math tests are
  "the bulk") and user confirmation, automated coverage is the pure math, the lint id-validator, and
  a registry-integrity test. Explorable's dev fallback and the `WidgetErrorBoundary` containment are
  code-level + manual (a class error boundary — no hook equivalent in React 19).
- **Deps:** `d3-scale` + `d3-shape` (+ `@types/*`) added, imported only by `Plot2D` (client,
  lesson-route-only). Hand-rolled SVG scales/paths, no chart library, per the task.
- Not yet committed to a branch/PR (**local**).

**COURSE-P2-02** — Closed. All eight Block 1/2 explorables landed: NLP
(`tokenizer-playground`, `onehot-vs-embedding`, `embedding-projection`) under
`src/features/courses/widgets/nlp/`, MLP (`activation-explorer`, `perceptron-boundary`,
`gradient-descent-2d`, `backprop-trace`, `loss-landscape`) under `.../nn/`. Registered in
`widget-ids.ts` + `registry.ts`, embedded in the P1-01 fixture, and validated by
`pnpm lint:content`. `pnpm test:unit` (558 pass), `pnpm lint` (0 errors), `npx tsc --noEmit`
(0 errors), `pnpm build`, `pnpm check:bundle` all green (widgets stay off every non-lesson
bundle). Deviations from the task doc:
- **Embeddings data is a hand-curated 2D layout, not projected real vectors** (user-confirmed
  during planning). `public/courses/dl-nlp/embeddings-sample.json` holds 218 Spanish words placed
  as clean semantic clusters with a pinned royalty/gender parallelogram so
  `rey − hombre + mujer = reina` lands EXACTLY (reina at distance 0, princesa second). It is an
  honest teaching illustration (the doc says "precomputed… verify the analogies work"), ~12.8 KB
  (budget ≤ 50 KB), generated by a throwaway deterministic script and guarded by
  `embeddings-data.test.ts` (parses, in-budget, analogy lands).
- **Two new primitives** in `primitives/`: `Heatmap` (the one P2-01 explicitly deferred — SSR-safe
  hand-rolled SVG field + marching-squares contours + a data-space overlay hook, first used by the
  two optimisation widgets) and `WidgetButton`. **`VectorField` was NOT built** — no P2-02 widget
  needs it, so it stays deferred to the task that does (avoids untested scaffolding, same rationale
  as P2-01).
- **`WidgetButton` instead of reusing `WidgetFrame`'s reset.** `Explorable` already wraps every
  widget in one `WidgetFrame` and forwards only `caption` (not `onReset`/`title`), so a widget can't
  reach the frame's reset without rendering a SECOND frame and doubling the chrome. The doc's "reuse
  WidgetFrame's reset" is impossible without that nesting, so widgets place reset/step/toggle controls
  inline with `WidgetButton`, styled to match the frame's button. One shared control style, no double
  frame.
- **New `useReducedMotion` hook** (`src/hooks/`, +test) — the repo's first, modelled on
  `useClientValue`'s `useSyncExternalStore` pattern (no set-state-in-effect, SSR-safe). The two
  animated widgets (`gradient-descent-2d`, `loss-landscape`) hide auto-play and expose step-only
  controls under reduce-motion. The pure `reducedMotionSnapshot` is unit-tested by stubbing
  `matchMedia`; no jsdom/RTL added (consistent with P2-01).
- **No `d3-contour` dependency.** Contour extraction is a ~40-line hand-rolled marching squares in
  `math/contour.ts` (a teaching demo doesn't justify the dep), unit-tested via the "every vertex sits
  on the iso-level" invariant plus exactness on a linear field.
- **All new maths is pure + unit-tested** (`tokenisation`, `bpe-vocab`, `perceptron`, `backprop`,
  `contour`, `embeddings`). Per the doc's emphasis, `backprop-trace`'s numbers are verified TWO ways:
  every gradient of the 2-2-1 net against central finite differences AND a fully hand-computed
  round-number example (o = 0.5, L = 0.125, ∂L/∂w2 = 0.0625, …), plus a trace-integrity test that
  each displayed factor product equals its step value.
- **Animation uses a `setTimeout`-per-step chain, not `setInterval`.** React Compiler forbids writing
  refs during render and the lint rule forbids synchronous set-state in an effect body; the timeout
  chain (with `step` in deps) advances via an async setState and halts at the end via a guard — clean
  under both rules.
- **Manual/device pass (360px, keyboard, reduce-motion, live analogy) NOT run in this shell** (no
  browser here). Automated coverage is the pure maths, the committed-data guard, the hook snapshot,
  content-lint id validation, and the full build; the manual pass is left for review (mirrors P2-01,
  which verified live separately).
- Not yet committed to a branch/PR (**local**).

**COURSE-P2-03** — Closed. Pyodide runs in a Web Worker behind `<PyCell>`: `src/lib/courses/pyodide/`
(`protocol` · `worker` · `client` · `spawn`) plus `src/features/courses/code/`
(`PyCell` · `PyCellClient` · `CodeOutput` · pure `editing` + `output`). CSP gained
`https://cdn.jsdelivr.net` on `script-src`/`connect-src`/`worker-src` in **both** arrays.
`pnpm test:unit` (619 pass), `pnpm lint` (0 errors), `npx tsc --noEmit` (0 errors),
`pnpm lint:content`, `pnpm build`, `pnpm check:bundle` all green.

**Verified live** in a production build (`pnpm build && pnpm start`) with the fixture temporarily
published and driven by a throwaway, uncommitted Playwright script — **14/15 checks passed**, the one
"failure" being a local-only `/_vercel/insights/script.js` MIME error, not a CSP violation (a strict
re-check for "Content Security Policy" during a real run found **zero**). Confirmed: no jsDelivr
request before the first Run click; numpy imports and prints (5–6 s cold start); cell 2 sees cell 1's
state; `plot()` renders through `Plot2D`; a `ValueError` shows the full traceback; `print()` in a loop
streams incrementally (2.09 s between first and last line); `while True: pass` is killed at 10.1 s
**with the tab responsive throughout**; the next run restarts the worker and succeeds; Enter-indent and
bracket auto-close work in a real browser; Reiniciar restores the original code. Deviations:

- **`src/lib/courses/mdx.ts` touched (not in Files-affected) — and this was a latent trap for the whole
  course, not just this task.** next-mdx-remote v6 defaults `blockJS: true`, which injects a remark
  plugin that **silently strips every JSX expression attribute**: `<PyCell packages={["numpy"]}
  code={`…`} />` compiled to `jsx(PyCell, {})` with no build-time warning, so the component received
  no props at all. `blockJS: false` is now set with a comment explaining the threat model (lessons are
  first-party files compiled at build time, reviewed in the same PR as the code they call);
  `blockDangerousJS` stays at its default `true`. Without this, **any** author-supplied component prop
  fails the same way.
- **Pyodide pinned to `v0.29.3`** (Python 3.13.2, numpy 2.2.5), user-confirmed during planning. Pyodide
  has since moved to a CPython-aligned scheme whose current release (`v314.0.3`, Python 3.14 /
  numpy 2.4.3) was four days old at the time; the mature line was chosen deliberately. The pin is one
  constant in `protocol.ts`, which also documents the self-hosting escape hatch.
- **`setStdout({ write })`, not `{ batched }`.** Pyodide's `batched` handler delivers fragments with
  the newlines stripped, so `print("suma:", x)` — one line, several writes — was indistinguishable
  from two lines and rendered broken. `write` gives the raw bytes; `appendChunk` reassembles lines
  across chunk boundaries (a chunk with no trailing newline leaves the line OPEN). Both the fragment
  case and the interleaved-stderr case are unit-tested.
- **Python's stdout is reopened UNBUFFERED in the preamble** (found in review, after the first pass).
  Python line-buffers `sys.stdout`, so a snippet that never writes a newline —
  `for num in range(10): print(num, end=" ")`, an entirely ordinary teaching example — produced
  **absolutely nothing**: the text sat in Python's buffer until an interpreter exit that never comes.
  Neither Pyodide's `isatty` option nor `reconfigure(write_through=True)` fixes it (both verified
  against a local Pyodide); the buffering is in the binary layer underneath. Reopening both streams
  over their own fds with an unbuffered `FileIO` does, and upgrades streaming from per-line to
  per-write. The worker additionally calls `_pycell_flush()` before posting each result, in case
  student code swapped `sys.stdout` for something buffered. Re-verified live: `end=" "` loops,
  no-trailing-newline prints, accented Spanish output, numpy, and partial output preserved
  alongside a traceback all render correctly, with no regression to the other 14 checks.
- **Two files beyond the task's list, both deliberate:** `protocol.ts` (pure shared contract, so worker
  and client never import each other's graph — the `widget-ids.ts` precedent) and `spawn.ts` (the only
  module containing `new Worker(new URL(…, import.meta.url))`, isolated so `client.ts` — the part with
  the timeout/terminate logic worth testing — stays loadable in Jest's `node` project, which has no
  jsdom and no `Worker`).
- **`PyCell` is an async Server Component + a client child**, per the task's "Shiki render when not
  focused". It highlights with `codeToHtml` at BUILD time (lazily imported, mirroring how `mdx.ts`
  lazily imports `compileMDX`, because shiki is ESM-only and a top-level import made the whole MDX
  component map unloadable in Jest). The highlighted `<pre>` shows when blurred **and** unedited;
  the textarea otherwise — a display swap, not an overlay. Known limitation: edited code is not
  re-highlighted, since that would mean shipping Shiki to the client.
- **`scripts/check-bundle.ts` split into two marker lists.** `pyodide` is now forbidden in **every**
  route's first-load JS including the lesson route (its only legal home is the lazy chunk behind the
  Run click); katex/shiki/widgets keep the old lesson-route exemption. Proven to fail: a temporary
  static `import` of `spawn.ts` in `PyCellClient` exits 1 naming the lesson route; reverted.
- **New `src/lib/courses/validate-pycells.ts` + `lint-content.ts` wiring (not in Files-affected).**
  Makes the task's first load gate real: `<PyCell>` present ⇔ `hasCode: true`, both directions.
  `hasCode` existed since P1-02 with nothing enforcing it. Verified failing: flipping the fixture's
  flag exits 1 naming the file.
- **`CodeOutput` loads `Plot2D` via `next/dynamic` (`ssr:false`)**, matching `widgets/registry.ts`:
  d3-scale/d3-shape stay out of the cell's chunk until a cell actually calls `plot()`.
- **No Playwright spec committed** (user-confirmed during planning). No published `hasCode` lesson
  exists — `generateStaticParams` is published-only and the only content is the draft fixture — so the
  spec would be permanently skipped. **Deferred to P5**, when the first real code lesson lands.
- **Fixture restored to `draft: true`.** It was sitting at `draft: false` on arrival, contradicting its
  own file-top comment ("Keep `draft: true` PERMANENTLY") — apparently left published by P2-02's
  verification pass. Since this task adds two runnable Python cells to it, leaving it public was not
  acceptable; it is now draft again, per its documented intent. **Flag for review** in case that was
  intentional.
- **Pre-existing bug surfaced while the fixture was temporarily published:** the catalog throws
  `MISSING_MESSAGE: courses.catalog.{hours,lessons,blocks,cta} (es)`. Those keys live under
  `courses.catalog.card.*` in both message files, and `CourseCard` (P1-03) reads them one level too
  high. It is invisible today only because no course has a published lesson — **it will fire the moment
  P5 publishes real content.** Untouched here (out of scope); worth a P5-00 or P1-03 follow-up.
- **Not verified: real iOS Safari / Chrome Android.** Pyodide's memory footprint is the likeliest place
  this breaks and needs a physical device; the headless Chromium pass above is not a substitute.
  Left for the user's manual pass (mirrors P2-01/P2-02).
- Not yet committed to a branch/PR (**local**).

**COURSE-P2-03 follow-up (2026-08-10) — the editor got a height cap.** Amends this task's
component rather than opening a new one, so it is recorded here. Prompted by reading Block 2:
the editor had `overflowX` but no vertical bound, so a cell rendered its author's listing at
full height while the output panel below it had been capped at 320px since day one — the part
the student must READ was bounded and the part they mostly SKIM was not. Measured on shipped
content, **10 of 13 cells exceed 40 lines**; `08-glove-y-limites` is 142 lines, **3,116px** as
rendered, four screens of code between the prose and Ejecutar.

- **New `src/features/courses/code/editor-metrics.ts`.** `EDITOR_MAX_LINES = 20` and a
  `min(calc(32em + 1.7rem), 60vh)` height, applied by BOTH `PyCellClient` and
  `CodeChallengeCard` so two editors with the same box metrics cannot drift. `em`, not `rem`:
  the cap re-derives itself from the box's own font-size instead of being a guess about it.
  Measured live: editor 462px, and **506px from the top of the code to the bottom of Ejecutar**
  (was ~1,500px on the 65-line cell, ~3,170px on the 142-line one).
- **Two fixes were mandatory, not polish — without them the cap is WORSE than no cap.**
  (1) The `<div>` ⇄ `<textarea>` display swap loses `scrollTop`, because they are different
  elements; a student who scrolled to line 100 and clicked Ejecutar (which blurs, and so swaps
  back) snapped to line 1. One `scrollOffset` ref + `onScroll` on both branches + a
  `useLayoutEffect` on `showHighlighted`. (2) The focus effect put the caret at
  `value.length`, and `setSelectionRange` scrolls the caret into view — so clicking near the
  top of the GloVe cell would have jumped to line 142. Caret now lands at `(0, 0)`, the offset
  is reapplied AFTER the selection call (order matters), and `focus({ preventScroll: true })`
  keeps the page still.
- **An expand toggle, not just a scrollbar.** `Ver las 142 líneas` / `Contraer`, rendered only
  when something is actually hidden. It is the affordance the scrollbar cannot be — on macOS
  the overlay bar fades out and a capped cell just looks like a short cell — and it keeps the
  full listing one click away for a student reading the cell as part of the narrative.
  `maxHeight: none` while expanded, which also un-breaks the textarea's `resize: vertical`
  (a max-height silently clamps the height a drag sets).
- **`CodeChallengeCard` got the same cap** (user-confirmed). **Correction to the planning
  note:** its starter in `10-funciones-activacion` is **12 lines, not 52** — that figure came
  from an awk script that ran past `starter:` into the `tests:` block. So the cap is dormant on
  every shipped challenge and exists for the STUDENT's solution as it grows. Verified live: the
  12-line starter is uncapped with no toggle, and both appear once the box passes 20 lines.
  Its copy is translated, so `courses.challenge.{expand,collapse}` were added key-for-key
  (28 keys, both files) — unlike `PyCellClient`, whose copy stays hardcoded Spanish per P2-03.
- **`lesson.css` scrollbar rule widened** to `.pycell-editor`, and `width: 6px` added next to
  the existing `height: 6px` — which also fixes the chunky VERTICAL bar the already-capped
  output/traceback `<pre>`s have had all along. Per the NB already in that block,
  `scrollbar-width` is still not used (it disables the `::-webkit-` pseudo-elements in Chromium).
- **New budget axis, because the cap hides the cause.** `budget.ts` gained
  `countLongestCodeCell` + a `longest code cell (lines)` axis (target ≤ 45 ≈ two windows,
  ceiling 90 ≈ four) and an optional `Axis.ceilingAdvice`, since "split this lesson" is the
  wrong advice for one over-long cell. The cell COUNT could never see this: three cells and one
  142-line cell are both "1–3 code cells". Fence-aware, so a cell quoted in an ```mdx fence is
  documentation, not a cell. **It fires on 10 shipped lessons today** (3 past the ceiling:
  142/93/91) — that is the honest signal, and `budgetWarnings` still never touches the exit
  code. Acting on it is a separate content pass. Row mirrored into `AUTHORING.md`.
- **Verified live** in a production build (`pnpm build && pnpm start`) with a throwaway,
  uncommitted Playwright probe: **19/19 checks, zero CSP violations.** Covers the cap and its
  scroll, the toggle's label/`aria-expanded`/`aria-controls`, expand→collapse round trip, the
  caret NOT jumping, the offset surviving the swap, the cell still running to the right answer,
  no horizontal scroll at 360px, the `60vh` clause biting on a short viewport (442px), and the
  challenge editor's uncapped→capped transition. The cap and the toggle are in the PRERENDERED
  HTML, so there is no layout shift on hydrate.
- **The English toggle copy was NOT exercised in a browser**: `dl-nlp` has no `en/` tree, so
  `/en/cursos/dl-nlp/*` 404s by design and every `courses.challenge.*` string is in the same
  position. Verified structurally instead (both files, identical key lists).
- `pnpm lint` (0 errors), `npx tsc --noEmit` (0 errors), `pnpm test:unit` (1,087), `pnpm
  lint:content`, `pnpm build`, `pnpm check:bundle` all green.

**COURSE-P3-01** — Closed. Quiz schema, components and grading.

- **Schemas are PascalCase.** The task doc writes `quizQuestionSchema` / `lessonFrontmatterSchema`;
  every schema in `src/lib/schemas.ts` is `PascalCase` + `Schema`, so they landed as
  `QuizQuestionSchema` / `QuizOptionSchema`. Cross-field rules (`answer` ∈ `options`, unique option
  ids) live in a `.superRefine` on the **union**, not on its members — `z.discriminatedUnion` wants
  plain objects. Duplicate question ids are caught by a second `.superRefine` on the array.
- **Quiz strings are rendered through `compileMDX`, one call per string, at build time**
  (`src/lib/courses/quiz/render.tsx`). Prompts/options/explanations live in YAML, so `rehype-katex`
  never sees them, and there was no string→KaTeX path in the repo. Reusing `mdx.ts`'s exported
  `remarkPlugins`/`rehypePlugins` was the only way to get *literally* the same KaTeX output with **no
  new dependencies** — `unified`/`remark-parse`/`rehype-stringify` are non-hoisted pnpm transitives.
  Bonuses: GFM markdown in quiz text, and Shiki on the `predict-output` snippet, both free. Verified
  in the built HTML: 87 KaTeX nodes and a fully colour-tokenised Python block, zero client KaTeX/Shiki
  (bundle guard green). The inline variant overrides `p` to a Fragment — `<p>` inside `<label>` is
  invalid and breaks click-to-select.
- **`renderLesson(source, quiz = [])` gained a second argument, and `mdx-components.tsx` gained
  `lessonMdxComponents(quiz)` rather than a static `Quiz` entry.** `<Quiz id="…" />` carries only an
  id while the question lives in frontmatter; a Server Component has no context to bridge that, so the
  questions are closed over per compiled lesson. The lesson page already had them from the registry.
- **`onAnswered` arrives via `QuizAttemptContext`, not a prop** (addition to the task doc). `Quiz` is
  rendered from the *server* MDX map, so a function prop cannot cross the boundary — a context with a
  no-op default is the only shape that lets P4-02 wire persistence **without reopening `QuizCard`**,
  which is what the doc asks for. P4-02 wraps the reader in one provider.
- **Component tested as a pure reducer, not by rendering** (user-confirmed during planning). The repo
  has no jsdom and no RTL, consistent with the P2-02 note above, so the state machine lives in
  `src/features/courses/quiz/state.ts` and `__tests__/state.test.ts` asserts what a render test would:
  result shape, retry clearing the input but not the attempt count, hint use sticky across retries, a
  fresh result object per attempt. **The card's markup itself has no automated test.**
- **`predict-output` takes free-text stdout**, not multiple choice (user-confirmed). Reading a loop and
  predicting its output is the skill; a list is guessable. Graded after normalising CRLF and trailing
  whitespace, but case-sensitively.
- **New `src/lib/courses/validate-quizzes.ts` + a fourth `lint-content.ts` call.** Beyond the doc's
  "every `<Quiz id>` resolves", it also rejects the same question placed twice (P4-02 keys attempts by
  quiz id) and `hasQuiz` disagreeing with the body in **both** directions — same reasoning as
  `validate-pycells.ts`, since `hasQuiz` had nothing enforcing it either. Proven failing: a typo'd id
  and a duplicated `<Quiz>` each exit 1 naming the file; reverted.
- **`WidgetButton` reused from `widgets/primitives/`** rather than duplicated, following
  `PyCellClient`'s precedent. Legal because quiz components only ever render on the lesson route, which
  is the one route exempt from the `courses/widgets` bundle marker.
- **One existing test replaced, not repaired:** `schemas.test.ts`'s "accepts a non-empty quiz array
  without inspecting its contents (P3-01 tightens it)" was written to be retired by this task.
- **One example of each of the five types added PERMANENTLY to `00-pipeline-fixture.mdx`**, matching
  what P2-02 did for the eight explorables and P2-03 for the two `<PyCell>`s: the fixture is where the
  render check and `pnpm lint:content` cover every feature. Includes heavy LaTeX in prompts, options
  and explanations, a deliberately over-wide option to exercise horizontal scroll, and two hints.
  Verified on both `pnpm build` output and a running dev server: 114 KaTeX nodes, 5 radios, 4
  checkboxes, the number input, the textarea and the Shiki-highlighted snippet.
- **Not verified: a real 360px device pass and a keyboard-only pass.** The rendered markup is native
  radios/checkboxes/inputs in labels with `role="group"` + `aria-labelledby`, so both should hold, but
  neither was exercised in a browser. Left for the user's manual pass (mirrors P2-01/P2-02/P2-03).
- **The fixture stays at `draft: false` by explicit decision** (user-confirmed, 2026-07-28), superseding
  the P2-03 note above. Phases 3–4 are still adding features that need to be looked at in a browser, and
  no real content is published yet, so the fixture stays reachable at `/cursos/dl-nlp/pipeline-fixture`
  until P5 begins. Revisit at P5-00.
- `pnpm test:unit` (701 tests, 66 suites), `pnpm lint`, `pnpm lint:content`, `pnpm build` and
  `pnpm check:bundle` all green.
- Not yet committed to a branch/PR (**local**).

**COURSE-P3-02** — Closed. Code challenges with hidden assertions: `<CodeChallenge id="…" />`
runs the student's Python against author-written `assert`s in the P2-03 worker and reports
pass/fail per test. New `src/lib/courses/pyodide/run-tests.ts` (program generation + result
parsing), `src/features/courses/code/{CodeChallenge,CodeChallengeCard}.tsx` +
`challenge-state.ts`, `src/lib/courses/validate-challenges.ts`, `CodeChallengeSchema` +
`challenges` in the lesson frontmatter, `courses.challenge.*` key-for-key in both message files.

- **One Pyodide run grades the whole suite, not one run per test.** The P2-03 client gives a run
  a single wall-clock budget and a single terminate path; N runs would multiply both and would
  lose the student's definitions the moment one of them timed out. So the suite becomes one
  generated program: the student's code is exec'd once, then each test independently inside its
  own `try/except` that PRINTS a structured result line rather than propagating. A failing test
  therefore cannot mask the ones after it — the acceptance criterion — and the whole protocol is
  pure string work, unit-testable with no Pyodide at all.
- **Student code and tests cross into Python as ONE JSON payload**, embedded as a single string
  literal and parsed by `json.loads` on the other side. JSON string syntax is a subset of
  Python's, so arbitrary student code (triple quotes, backslashes, newlines) needs no bespoke
  escaper — there is exactly one place where untrusted text enters the source.
- **The harness cannot be shadowed** (the task's gotcha): student code is exec'd into its own
  namespace dict while every harness name is `_`-prefixed in the wrapper's own globals, and each
  test runs against a fresh `dict(_ns)` copy so one test cannot decide the next. Verified: a
  student defining `_json`, `_emit` and `_payload` still grades correctly.
- **`fail` and `error` are different statuses, decided in Python.** An `AssertionError` is a
  wrong answer; anything else (`NameError`, `TypeError`, `OverflowError`) is a different problem
  and the UI says so — different icon, different colour, the exception line rather than the
  assertion message. Tracebacks are trimmed of the harness frame (`tb.tb_next`) so the student
  reads only their own, and are folded behind a `<details>` rather than shoved in their face.
- **Result-reporting: a SIBLING type, not a widened `QuizResult`** (user-confirmed during
  planning). `ChallengeResult` + `ChallengeAttemptContext` mirror `QuizResult` +
  `QuizAttemptContext` field for field where the meaning matches, and a new
  `AssessmentResult = QuizResult | ChallengeResult` union discriminates on `type`. P4-02 writes
  ONE `(r: AssessmentResult) => void` handler and hands the same function to both providers
  (contravariance makes it assignable to each), so the doc's "one persistence path" holds without
  reopening `QuizCard.tsx` or making `QuizQuestionType` mean something it doesn't.
- **`challenge-state.ts` may import only TYPES from `lib/courses/pyodide/`** — caught in review
  after the first draft had it importing `allPassed`/`passedCount` as values. The card imports
  the state module statically, so that one import would have pulled the whole test harness into
  the lesson's first-load JS and quietly defeated the load gate. The two derivations now live in
  `challenge-state.ts`, where deciding what counts as "correct" belongs anyway, and `run-tests.ts`
  is reached ONLY through the `await import()` in `handleRun`, next to `spawn.ts`.
- **Which failures burn an attempt.** A graded run is one that EXECUTED: success, assertion
  failures, student errors, and a RUN-phase timeout (whose partial output is still parsed — "tests
  1 and 2 passed, then it hung" is real information). A LOAD-phase timeout (slow network), a
  crash (device gave up) and Stop (the student's own choice) say nothing about their code, so they
  show a notice and cost nothing. The reveal gate counts only real failures.
- **Solution reveal is guarded in the reducer, not only in the UI** — all-pass OR ≥3 failures,
  sticky once revealed, and recorded on every later result. A rule that lives in a `disabled`
  attribute is one `disabled={false}` from gone.
- **Plain `<textarea>`, no Shiki display swap** (user-confirmed). PyCell's highlighted-when-blurred
  view earns its keep on an author's finished snippet; a challenge's starter is deliberately
  incomplete and gets edited within seconds, so it would have meant duplicating ~40 lines of
  editing/focus/caret state for a view almost nobody sees. The pure `editing.ts` helpers
  (tab-to-indent, indent-aware Enter, bracket matching) ARE reused as-is.
- **All chrome is translated (`courses.challenge.*`, 31 keys × 2 files)**, unlike the hardcoded
  Spanish of `PyCellClient`/`CodeOutput`. That follows the task doc and P3-01's precedent that
  assessment copy is translated; it does mean a lesson can show a translated challenge next to a
  Spanish-only `<PyCell>` until someone revisits the widget layer. `CodeOutput` was deliberately
  NOT reused for the challenge's output panel for exactly this reason (it hardcodes two Spanish
  strings) — the card renders its own small `<pre>` instead.
- **`validate-pycells.ts` widened (not in the task's Files-affected list).** `hasCode` means "this
  lesson runs Python", so `<CodeChallenge>` now satisfies it exactly as `<PyCell>` does —
  otherwise a challenge-only lesson could not satisfy the lint in EITHER direction. Plus a new
  `validate-challenges.ts` (id resolves; no id placed twice, since P4-02 keys attempts by it) as
  the fifth `lint:content` pass, mirroring the quiz lint.
- **`challenges` is REQUIRED in lesson frontmatter**, like `quiz` (user-confirmed): every lesson
  writes `challenges: []`. Consistent with the strict-object discipline; the three existing
  frontmatter test fixtures (`schemas`, `registry`, `SyllabusAccordion`) were updated.
- **One real `softmax` challenge added PERMANENTLY to `00-pipeline-fixture.mdx`** (numpy, three
  tests: sums to 1, stable at `[1000., 1001.]`, shift-invariant), matching what P2-02/P2-03/P3-01
  each did. Its reference solution is verified against its own tests, and the naive version
  genuinely fails the stability test rather than merely looking wrong.
- **Verified against a REAL Python interpreter** (CPython 3, via a throwaway script) for all five
  paths the parser claims to handle: correct solution, wrong solution, missing function
  (`NameError`), syntax error (student-error box with the caret line), and harness shadowing.
  Tracebacks came back trimmed to the student's frames and partial `print(..., end="")` output was
  preserved alongside the results.
- **Verified LIVE in a real browser with real Pyodide** — production build (`pnpm build && pnpm start`),
  fixture lesson, driven by a throwaway uncommitted Playwright script: **21/21 checks**, one page
  load, no reloads, zero CSP violations. Confirmed: the naive softmax scores **2 de 3** (it really
  does satisfy "sums to 1" and "shift-invariant" and really does fail only the stability test —
  the sharpest available proof that each test is graded on its own); the author's assertion
  message surfaces on the one failure; a renamed function reads as `NameError` rather than as a
  wrong answer; a syntax error produces the student-error box with the caret line and no test
  runs; the solution stays locked at 1 and 2 failures and unlocks on the 3rd; `while True: pass`
  is killed at **10.5 s** with the tab responsive; the very next run passes every test on the
  restarted worker; Reset restores the starter.
- **A false green was caught and corrected during that pass, and it is worth recording.** The
  first run reported 21/21 too — but the naive-softmax attempt scored 0/3, which is arithmetically
  impossible for that function. Cause: Playwright's `fill()` on a controlled `<textarea>` that has
  never been focused INSERTS instead of replacing, so the editor held "naive code + starter" and
  the second `def softmax` (the starter's `pass`) won — the harness ran exactly what was in the
  box and was right to. Not a product defect: clicking first, Ctrl+A + typing, and Ctrl+A +
  pasting all replace correctly, and `fill()` behaves identically on P2-03's shipped `PyCell`
  editor once focused. The probe now clicks before filling and asserts the editor took the code.
  The lesson generalises to any future browser test of these editors.
- **The four new lint failures were proven, then reverted:** a typo'd `<CodeChallenge id>`, the
  same challenge placed twice, an empty `tests: []`, and a duplicate challenge id in frontmatter
  each exit 1 naming the file and the problem.
- **Not verified: a real 360px device.** The card is a single column of native controls and the
  editor contains its own horizontal scroll, so it should hold, but no phone was exercised — and
  the task itself says mobile editing is genuinely awkward, which is why `courses.challenge.keyboardNote`
  says so out loud rather than pretending otherwise. Left for the user's manual pass (mirrors
  P2-01…P3-01).
- `pnpm test:unit` (760 tests, 69 suites), `pnpm lint` (0 errors), `pnpm lint:content`,
  `pnpm build` and `pnpm check:bundle` all green.
- **Two pre-existing type errors fixed in passing** (user-requested, after the task's own work was
  complete). `npx tsc --noEmit` was reporting TS7022 + TS7006 in
  `src/lib/courses/__tests__/validate-quizzes.test.ts`, which arrived with P3-01: its `lesson()`
  helper defaults `hasQuiz` off `ids` inside the same destructuring pattern, and that
  self-reference makes TypeScript abandon inference for `ids` (and for its `.map` callback), so
  the `as string[]` cast never applied. The parameter is now explicitly typed; defaults, call
  sites and behaviour are unchanged. **`npx tsc --noEmit` now exits 0 across the whole repo.**
- Not yet committed to a branch/PR (**local**).

**COURSE-P4-01** — Closed. Migration `0016_courses.sql` (`enrollments`, `lesson_progress`,
`quiz_attempts` + deny-anon RLS), `ICourseRepository` / `SupabaseCourseRepository`, a new
`ICourseCatalog` port with its registry adapter (`src/lib/courses/catalog.ts`), `CourseService`,
and the `InMemoryCourseRepository` / `FakeCourseCatalog` fixtures. Backend only — no routes, no UI.

- **The registry is INJECTED, not imported** (user-confirmed during planning; new precedent in
  this repo). `CourseService` takes an `ICourseCatalog` — `courseExists` + `listLessonSlugs` — and
  `src/services/index.ts` wires the registry-backed adapter. Importing `listLessons` directly
  would have satisfied the "zero infrastructure imports" criterion by the letter (the registry
  lives in `src/lib/`), but it does filesystem I/O, so every percentage test would have had to
  build a temp MDX tree and re-point `__setContentRoot`. With the port, a test sets the
  denominator with `new FakeCourseCatalog({ 'dl-nlp': ['l1','l2'] })`. It sits in
  `src/domain/repositories/` next to `IConfigCache.ts`, which set the "port that isn't a
  repository" precedent.
- **The catalog is pinned to the canonical locale (`es`), not the request locale.** The task doc's
  service signatures carry no `locale`, but every registry selector needs one. Since `Lesson.slug`
  is locale-invariant by design and `content/courses/dl-nlp/` has no `en` tree, resolving against
  the request locale would report `totalLessons: 0` — and 0% — to every English reader until the
  translation lands. One canonical denominator; the reasoning is in the file header of
  `src/lib/courses/catalog.ts`.
- **`touchLesson` never writes `status`** — this is the guard for the bug the task doc calls the
  most likely one in the phase. PostgREST builds `ON CONFLICT DO UPDATE SET` from the payload
  columns only, so omitting `status` from the upsert means an existing `completed` row keeps its
  status while `last_seen_at` moves, and a fresh row still gets the DB's `DEFAULT 'started'`.
  `completeLesson` is then a `touchLesson` + a guarded `UPDATE … .is("completed_at", null)`, which
  is also what makes a second completion a no-op rather than a new timestamp. The in-memory fake
  mirrors both rules, and a test asserts the seen-after-completed case directly.
- **Course completion is re-derived, not counted.** `markLessonCompleted` re-reads progress and
  compares it against the published list rather than incrementing a counter, so it self-corrects
  when a lesson is published or withdrawn between two completions. Progress rows for lessons that
  are no longer published are dropped from BOTH sides of the fraction, so a rename can never push
  a percentage past 100.
- **One `(user_id, course_slug)` index skipped.** The task doc asks for it on both progress
  tables; on `lesson_progress` it is a strict prefix of the `UNIQUE (user_id, course_slug,
  lesson_slug)` index Postgres already builds, so it would cost writes and buy nothing. Created on
  `quiz_attempts` (which has no unique constraint) and skipped on `lesson_progress`, with the
  reasoning in a SQL comment.
- **Migration NOT applied; `types.ts` hand-written** (user-confirmed). The three tables were added
  to `src/infrastructure/supabase/types.ts` by hand in the generated format so the repo typechecks
  and builds. **Pending on the user:** `supabase db push`, then
  `supabase gen types typescript --project-id <ref> > src/infrastructure/supabase/types.ts`, and
  diff against the hand-written block.
- **Repository test is a pure mapper test, not `describeDb`.** `next/jest` loads `.env.local`, so
  a DB-gated integration test would have run against the real project and failed until the
  migration is pushed. `src/infrastructure/supabase/__tests__/course-mappers.test.ts` covers what
  actually carries risk — the TIMESTAMPTZ normalisation (`"…:43.13+00:00"` → `"…:43.130Z"`) —
  with no database, following `booking-history.test.ts`.
- `pnpm test` (812 tests, 76 suites), `pnpm lint` (0 errors; 7 pre-existing warnings in untouched
  components) and `pnpm build` all green. The build still logs the pre-existing
  `MISSING_MESSAGE: courses.catalog.{hours,lessons,blocks,cta}` from the `CourseCard` key bug
  recorded under P1-03 — untouched here.
- Not yet committed to a branch/PR (**local**).

**COURSE-P4-02** — Closed. Three thin routes (`POST`/`GET /api/courses/progress`,
`POST /api/courses/attempt`), the `useCourseProgress` hook + its pure state module, and
the reader/landing wiring that fills every progress slot Phases 1–3 left behind
(`CourseProgressProvider`, `SidebarProgressBar`, `SidebarLessonList`, `LessonComplete`,
`MobileProgressIndicator`, `CourseProgressResume`). `courses.progress.*` added key-for-key
to both message files. Backend additions: `CourseProgressDetail` + `getCourseProgressDetail`.

- **`completedSlugs` could never have been a prop — the whole sidebar design assumed
  something impossible.** P1-04 built the completion layer behind an optional
  `ReadonlySet<string>` prop on `LessonSidebar`, an async Server Component on a
  statically generated page: there is no request, no session and no reader identity at
  render time, so nothing could ever pass it. The prop is gone. `LessonSidebar` stays a
  Server Component for what genuinely needs build-time data (translations, block
  grouping) and delegates the two progress-dependent regions to client leaves reading
  `CourseProgressProvider`'s context. **User-confirmed during planning** over the
  alternative (leave the file alone; have a client component paint `[data-lesson-slug]`
  rows by DOM mutation), which was rejected as imperative and because the row's inline
  styles would have had to move to CSS to be overridable at all.
- **Four files touched beyond the task's "Files affected" table**, each unavoidable:
  `src/domain/types.ts` + `src/services/CourseService.ts` (see below),
  `LessonLayout.tsx` (the only shared parent of both sidebar instances, the mobile bar
  and the MDX body — the provider has nowhere else to go, and putting it in `page.tsx`
  was the one thing the task forbids), and `CourseHero.tsx` (the task's prose and
  acceptance criteria call for landing-page progress + "continuar donde lo dejaste"
  even though the file table omits it — **user-confirmed** to include).
- **`Quiz.tsx` and `CodeChallenge.tsx` were NOT touched**, though the table lists them.
  P3-01/P3-02 deliberately put `QuizAttemptContext`/`ChallengeAttemptContext` in the
  `*Card` files with no-op defaults so P4-02 could wire persistence *without* reopening
  them, and both file headers say so. The provider hands ONE
  `(r: AssessmentResult) => void` to both, exactly as P3-02 designed.
- **`onAnswered` must keep a stable identity, and this was nearly a duplicate-write
  bug.** Both cards fire it from an effect keyed `[state.result, onAnswered]`, so a
  handler that changed identity when progress finished loading would re-run the effect
  and record the same attempt twice. The signed-in check therefore reads a ref rather
  than closing over `tracking`; the callback's deps are `[courseSlug, lessonSlug]` only.
- **`CourseProgressSummary` is scalar, so the sidebar's read had to be widened.** New
  `CourseProgressDetail` (summary + `completedLessonSlugs`) and
  `CourseService.getCourseProgressDetail`. **The first attempt was wrong and a test
  caught it:** making `getCourseProgress` delegate to the detail method leaked
  `completedLessonSlugs` into its runtime payload, and P4-01's
  `getCourseProgress` shape assertion (`toEqual`) failed. Fixed at the source, not in
  the test — both methods now share a private `readProgress` fetch and each returns
  exactly its declared shape. One read, two contracts, no extra query.
- **Signed-out is `204`, not `401`** — the task's central call, and there is no
  precedent for it anywhere else in `src/app/api/`. It is what keeps an anonymous
  reader's console clean, and it doubles as the client's signal that progress is
  untracked (no `useSession()` anywhere in this task). Pinned by tests on all three
  paths, including "the service was never called".
- **The limiter is keyed by the authenticated email, after the session check**, not by
  IP before it — the `paymentChannelRatelimit` precedent, for the same reason (students
  share school and office NATs). A side benefit: anonymous readers, the majority, never
  touch Redis at all, which a test also pins. Named `courseProgressRatelimit` per the
  file's `<domain>Ratelimit` convention (the doc says `courseProgressLimiter`), 120/min,
  prefix `rl:courses`. Schemas likewise landed PascalCase (`CourseProgressUpdateSchema`,
  `CourseProgressQuerySchema`, `CourseAttemptSchema`), the same rename P3-01 recorded.
- **A latent 400 was found and fixed while probing the schema.** `z.unknown().refine(…)`
  wraps the schema in `ZodEffects`, which makes the key REQUIRED even though `unknown`
  admits `undefined` — so a client that simply omitted `answer` would have been
  rejected. The trailing `.optional()` is load-bearing and now has its own test.
- **`e2e/fixtures/cleanup.ts` touched (not in the table), and this one would have broken
  every OTHER spec.** The three course tables reference `users(id)` with no
  `ON DELETE CASCADE`, so one progress row would make `truncateTestDb`'s `users` delete
  fail — for the whole suite, not just the courses spec. They are cleared before `users`,
  and marked optional (a missing-relation error is skipped) so the suite still runs in
  environments where migration `0016` has not been applied.
- **No jsdom/RTL added** — consistent with P2-01…P3-02. The hook's risk-carrying logic
  (how an HTTP response becomes UI state; optimistic tick and rollback) lives in the
  pure `src/hooks/course-progress-state.ts` and is tested there, following the
  `quiz/state.ts` precedent. **Not covered automatically:** that `seen` fires exactly
  once per mount — that guard is a `useRef` inside an effect and needs a renderer.
- **`console.warn`, not `log()`, in client code.** `@/lib/logger` reads AsyncLocalStorage
  and is server-only; no `"use client"` file in the repo imports it. Same choice as
  `SessionSettings.tsx`. Failures are otherwise silent by design — no toast, no retry,
  never blocking the lesson.
- **Verified staticness**, which is an acceptance criterion rather than a nicety: the
  build still marks `/[locale]/cursos/[courseSlug]/[lessonSlug]` as `●` (SSG) and emits
  `/es/cursos/dl-nlp/pipeline-fixture`. Confirmed in the prerendered HTML that no
  progress markup is present for a signed-out reader — the only occurrence of
  "Marcar como completada" is inside next-intl's client message payload (pre-existing
  behaviour: every `courses.*` namespace already ships), not as rendered markup.
- **Migration `0016` IS applied** — P4-01's note above ("Migration NOT applied") is stale.
  Verified directly against the project: `enrollments`, `lesson_progress` and
  `quiz_attempts` all answer PostgREST `200` (empty). What remains owed from P4-01 is
  only the type regeneration:
  `supabase gen types typescript --project-id <ref> > src/infrastructure/supabase/types.ts`,
  diffed against the hand-written block. Persistence itself works today.
- **E2E run and GREEN — 2/2** (`e2e/courses-progress.spec.ts`, Spanish only, since
  `generateStaticParams` is published-only and `/en/cursos/...` legitimately 404s until
  P5). Proven against the real database and a real browser: a signed-out reader gets the
  full lesson with no progress UI and no 401s; a signed-in reader marks the lesson
  complete, and after a **reload** the confirmation and the sidebar's
  `[data-lesson-done="true"]` are both still there — which they can only be if the state
  came back from Postgres.
- **The first E2E run failed, and the cause is worth recording because it was NOT a
  product defect.** The mark-complete assertion timed out at 10s. Diagnosed rather than
  patched: the API answered `200` with the correct body, the browser received `200` for
  both the GET and the `seen` POST, the button was in the DOM, and its computed
  accessible name was exactly `"Marcar como completada"` (the `aria-hidden` icon is
  correctly excluded) — the exact-string role locator matched with `count: 1`. It was
  purely **hydration time**: progress is client-fetched after hydration, and this lesson
  is the heaviest page in the app (MDX + KaTeX + eight widgets + two Pyodide cells), so
  under the local `pnpm dev` server first paint of the button lands past 10s. The
  timeouts are now 30s with a comment saying why, so nobody trims them back to what a
  production build gets away with.
- **`resetTestState()` truncates the target database, and there is no isolation:**
  `.env.local` and `.env.e2e.local` point at the **same Supabase project**, despite
  `playwright.config.ts` saying the override exists "so the dev server uses the test DB,
  not the live one". Pre-existing (every spec calls it), but worth knowing before running
  the suite — this run deleted the existing `lastgtorres@gmail.com` user row and 3
  bookings. **User-authorised** before running.
- `pnpm test` (858 tests, 79 suites), `pnpm lint` (0 errors; the same 7 pre-existing
  warnings in untouched components), `npx tsc --noEmit` (0 errors), `pnpm lint:content`,
  `pnpm build` and `pnpm check:bundle` all green. The build still logs the pre-existing
  `MISSING_MESSAGE: courses.catalog.{hours,lessons,blocks,cta}` from the `CourseCard`
  key bug recorded under P1-03 — untouched here.
- **The P1-03 `CourseCard` key bug was fixed in passing** (user-requested, after this
  task's own work was complete) — the follow-up predicted under P2-03 above. Its four
  strings live under `courses.catalog.card.*` but it resolved them against
  `courses.catalog`, so `hours`/`lessons`/`blocks`/`cta` each threw `MISSING_MESSAGE`.
  The card uses **no** key outside `card.*`, so the fix is one line — the namespace, not
  four call sites. It had been invisible only while no course had a published lesson
  (the catalog rendered its empty state and the component never ran); publishing the
  fixture made `/cursos` the first page a visitor hits and the first one to break.
  Verified in the prerendered HTML: `40 h · 1 lección · 1 módulo · Ver curso` in Spanish,
  `View course` in English, no `courses.catalog.*` literals, and **zero `MISSING_MESSAGE`
  in the build**. The English catalog still correctly renders its "Coming soon" empty
  state with no card, since there is no English content.
- **Not verified: a real 360px device pass and a keyboard-only pass.** The E2E run does
  now cover signed-out reading in a real browser (no 401s, no progress UI) and the
  mark-complete round trip, but no phone and no keyboard-only pass. Left for the user's
  manual pass, mirroring P2-01…P3-02.
- Not yet committed to a branch/PR (**local**).

**COURSE-P4-04** — Closed. The read path for `quiz_attempts` (`listQuizAttempts` →
`summariseAttempts` → `getLessonProgressDetail` → the existing progress GET) plus hydration of
both assessment cards, the sign-in nudge, and the solved counter next to mark-complete.
`courses.{quiz,challenge}.history.*` and three `courses.progress.*` keys added key-for-key.

- **The table was written on every attempt and read by nobody.** That is the whole bug: P4-02
  wired `POST /api/courses/attempt` and stopped there, so `ICourseRepository` had
  `recordQuizAttempt` and no `list…`, and both cards seeded from their `initial*State` on every
  mount. A quiz answered last week showed as untouched, and — worse — a code challenge whose
  reference solution the student had EARNED locked itself again on the next visit.
- **⚠️ The duplicate-write trap, and it is the reason `restored` exists.** `QuizCard` fires
  `onAnswered(state.result)` from an effect keyed on the result object. Hydrating a result
  through the same field would have POSTed a fresh `quiz_attempts` row on EVERY page load —
  each one then read back as another attempt, so the count would climb on its own. The reducer
  marks a replayed result `restored`, the effect skips those, and a unit test pins it. The
  challenge reducer sidesteps it structurally: `hydrate` never sets `outcome`/`result`, because
  there is no editor state to restore anyway.
- **Restored answers are RE-GRADED locally, not trusted.** `gradeQuestion` runs again against the
  current answer key, so a question whose key was corrected after someone answered it shows the
  honest verdict rather than a stale stored `correct`. The stored `correct` survives only as
  `solved`/`lastCorrect` in the history, which is about the row, not about the card.
- **New pure `src/lib/courses/quiz/restore.ts` is where content drift is absorbed.** The JSONB is
  `unknown`, written by an older client against a possibly older question, so it is validated
  against the CURRENT question: wrong `questionType`, a deleted option id, a partially valid
  multi-selection (all-or-nothing grading makes a partial restore a different answer), a
  non-finite number, empty typed output — each degrades to a badge with live inputs. A
  confidently wrong restore is worse than an honest blank one; same argument P5-00 made for the
  on-this-page rail.
- **`AttemptHistoryContext` is its own module** (`reader/attempt-history.ts`), not part of
  `CourseProgressProvider`, because the provider already imports both card files for the
  write-side contexts — putting the read-side context there would have made that import cycle
  back on itself. Its `status` field is load-bearing: history lands after hydration, so a card
  that only checked `byId.get(id)` would paint "never attempted" and then jump.
- **`readProgress` gained an optional `lessonSlug`** rather than a second fetch, so the attempts
  query joins the SAME `Promise.all`. One lesson view is still one request and one round of
  queries. `LessonProgressDetail` extends `CourseProgressDetail` (the P4-02 precedent over
  `CourseProgressSummary`) so the P4-03 list callers keep the shape they asked for — pinned by a
  test asserting `getCourseProgressDetail` still has no `exercises` key.
- **The counter's denominator comes from the BODY, not the frontmatter.** New
  `src/lib/courses/exercise-ids.ts` reuses the lint's own `findQuizRefs`/`findChallengeRefs`, so
  the reader counts exactly what `pnpm lint:content` validates. Frontmatter may declare a question
  that is never placed (the lint forbids only the reverse), which would have made "3 de 3"
  unreachable. Read at build time; the page stays static.
- **`SaveAttemptsNotice` imports `signIn` lazily, inside the click handler** — and this was a
  test failure first, not a preference. Both cards import the notice statically and both are
  reachable from `mdx-components.tsx`, so a top-level `next-auth/react` import dragged an ESM-only
  package into the MDX component graph that the node-environment tests load directly
  (`mdx.test.ts` broke immediately). Lazy import rather than a new `ESM_PACKAGES` entry: it fixes
  the cause instead of transforming next-auth in every test run. Same shape as `mdx.ts`'s lazy
  `compileMDX`.
- **The nudge appears only AFTER a submission.** Before that an anonymous reader's page is exactly
  as clean as it is today — `LessonComplete` renders nothing at all when untracked for the same
  reason. Telling someone their work was not saved is honest; telling them before they have done
  any is a nag.
- **`e2e/courses-progress.spec.ts` pointed at a lesson that 404s** — pre-existing, not from this
  task: P5-00 restored `00-pipeline-fixture.mdx` to `draft: true`, and
  `generateStaticParams` is published-only, so `/cursos/dl-nlp/pipeline-fixture` stopped existing.
  Repointed at `texto-como-numeros` (the real published lesson) and a third test added: answer a
  quiz, reload, and the selection, verdict, Retry state AND "1 intento" all come back — that last
  assertion is what proves a page load records nothing.
- **E2E NOT RUN in this shell.** `resetTestState()` truncates the target database and
  `.env.local`/`.env.e2e.local` point at the SAME Supabase project (pre-existing, recorded under
  P4-02) — running it would delete the live user and bookings again. Needs the user's explicit
  authorisation, so the specs are written and left unrun. **This is the only acceptance criterion
  not exercised.**
- **A P3-01 rendering bug was found by the user and fixed here: a graded option no longer shows
  which one you chose.** Reported from a screenshot ("the circle is not filled") and reproduced
  in a real browser SIGNED OUT — so it predates this task and has nothing to do with restored
  history. The DOM was never wrong (`input.checked === true` both before and after grading); the
  cause is that grading sets `disabled`, and **no browser honours `accent-color` on a disabled
  control** — it greys it, which on these dark rows makes the checked dot grey-on-grey and
  invisible. `boolean` was worse still: it receives no `answer` prop, so its rows are never
  coloured and the greyed control was the ONLY trace of the reader's choice.
  - Fixed by stating the choice in text — a small "Tu respuesta" tag on the chosen row, in all
    three option types — **not** by dropping `disabled`. A graded group must not be editable
    until Retry, and `disabled` is the honest way to say that to the pointer, the keyboard and
    the accessibility tree at once; the fix must not weaken it to win back a pixel.
  - It also closes an ambiguity that predates the styling problem: on a CORRECT answer the green
    row said "this is the right answer" and nothing said "…and it is the one you picked".
  - `optionRowStyle` gained `flexWrap` and `optionTextStyle` a `10rem` flex-basis so the tag
    drops to its own line instead of squeezing the option into a two-word column — at 360px the
    first version wrapped "Porque las redes / procesan un / caracter a la vez y". Verified at 900px
    and 360px, correct and incorrect, single and multi: no horizontal page scroll at either width.
  - New key `courses.quiz.yourAnswer`, both message files.
- **Verified in a real browser** (production build, throwaway Playwright script, signed out — so
  no database writes): the live answer path, the graded state at 900px and 360px, and the
  sign-in notice appearing only after a submission. The static HTML was also checked — all new
  strings appear ONLY inside next-intl's client message payload, never as rendered markup for a
  signed-out reader, and the lesson route is still `●` SSG.
- **Not verified: the RESTORE path in a browser.** That needs a signed-in session against the real
  database, which is the same reason the E2E run is pending. The reducer, the restorer and the
  route are covered by unit tests; what has not been watched with human eyes is a real row coming
  back into a real card.
- `pnpm test` (1036 tests, 89 suites), `pnpm lint` (0 errors; the same 7 pre-existing warnings),
  `npx tsc --noEmit` (0 errors), `pnpm lint:content` (green, no warnings), `pnpm build` (no
  `MISSING_MESSAGE`) and `pnpm check:bundle` all green.
- Not yet committed to a branch/PR (**local**).

**COURSE-P5-00** — Closed per doc. Deviations and notes:
- **The dogfood lesson was authored inside this task** (user-confirmed, 2026-07-30). The task doc
  assumes the P3 walking skeleton produced a lesson to generalise from; it did not — the only file
  under `es/` was the P1-01 rendering fixture, and the Phase-3 exit criterion was still unchecked.
  Its own acceptance criterion ("the guide is written against a real authored lesson, not
  hypothetically") is unsatisfiable without one, so Block 1 lesson 1
  (`es/01-texto-como-numeros.mdx`, `draft: false`) was written here. Lessons 2–8 stay in P5-01.
  Guide, template and lint were then corrected against what writing it actually exposed — that is
  the whole point of the exercise, and four separate things came out of it:
  1. **`minutes` was calibrated at a skim rate and contradicted the budget.** At 180 wpm a
     mid-budget 1,600-word lesson estimates ~11 minutes against a 20–30 minute band, so every
     lesson would have warned on one axis or the other forever. Now 120 wpm — a *study* rate — and
     the two axes agree.
  2. **A code-free lesson had no step 4.** P5-01 specifies lesson 1 as deliberately code-free, and
     the six-step structure demands an "Implementación". Resolved in the guide: step 4 becomes
     "Implementación a mano", a worked example on paper. It may change form; it may not be absent.
  3. **`\mathbb{R}^{T \times d}` tripped the transpose rule.** A shape is the single most common
     correct `T` superscript in the course. The rule now fires only when `T` is the whole
     superscript, and big-operator limits (`\sum_{t=1}^{T}`) are stripped before any rule runs.
  4. **The template did not lint when copied.** A `<CodeChallenge>` written inside an MDX comment
     as an example still counts: the content passes read the file with regular expressions, not an
     MDX parser. Template fixed, and the behaviour is now documented — to disable a component,
     delete it, do not comment it out.
- **A draft lesson has no page, so it cannot be previewed.** `generateStaticParams` is
  published-only, so `draft: true` 404s even in dev, and authoring means flipping the flag back and
  forth. Documented in AUTHORING.md §8 with the risk it creates (committing the wrong state), and
  flagged there as the first candidate if authoring friction needs fixing. **Not fixed here** — a
  dev-only draft preview is its own change and P5-00 is already the widest task in the phase.
- **The rendering fixture is back to `draft: true`**, closing the "Revisit at P5-00" note left
  under P3-01: the real lesson now supplies the published page, so nothing depends on the fixture
  being reachable. Its maths was also made `NOTATION.md`-conformant (`Wx` → `\mathbf{W}\mathbf{x}`,
  `L` → `\mathcal{L}`) — it is the file authors read to see what the pipeline supports, so it
  should not model off-contract notation.
- **`collectMdxFiles` was extracted** to `src/lib/courses/content-files.ts`. It was copy-pasted
  verbatim in four validators; this task adds two more callers AND a rule that must hold in all of
  them — **`_`-prefixed files and directories are not lessons** — so it now lives in one place.
  `registry.ts` honours the same rule, so a `_wip.mdx` scratch draft next to real lessons does not
  have to satisfy the frontmatter schema. This is what keeps `_template.mdx` out of the lint.
- **Budget overruns warn; they never fail.** `scripts/lint-content.ts` now has two phases: the five
  correctness passes (throw, exit 1, unchanged) and a new advisory phase that prints per-lesson
  counts plus budget and notation warnings and **never touches the exit code**. Verified both ways:
  a deliberately over-budget file warned on every axis at exit 0, and an unresolved `<Quiz id>` and
  an unresolved `<Explorable id>` each still failed at exit 1.
- **Word counting excludes LaTeX, code and JSX**, including `<PyCell code={`…`}>` template
  literals; component counts additionally ignore anything in backticks, so prose *about* a
  component is not counted as one. Hand-rolled and fence-aware in the style of `headings.ts` —
  `unified`/`remark-parse` remain unimportable non-hoisted transitives (P3-01).
- **The notation ruleset is deliberately five rules**, all decidable from the source: `\mathbf`
  vs `\bf`/`\textbf`/`\boldsymbol`/`\vec`, bare `W`, `^l` vs `^{(l)}`, `d_model`, and `^T`/`^t` vs
  `^{\top}`. Whether a bare `$x$` is a scalar or an unbolded vector is **not** decidable, and a
  rule that fires on correct lessons trains authors to skip the ones that are right.
  `\boldsymbol{\delta}` (Block 2, where `\mathbf` cannot embolden a Greek letter) is a known and
  documented false positive — one warning, in the backprop lessons.
- **A budget opt-out exists and has exactly one user:** `{/* content-budget: ignore — … */}` in the
  rendering fixture, which embeds every explorable and all five question types on purpose. Notation
  has no opt-out.
- **Conflict flagged, not resolved:** P5-01 requires "Lesson 1 is the free sample lesson linked
  from the course landing page", but P1-03 records that the sample-lesson section was removed from
  the landing page at the user's request. The lesson exists and is published; whether the landing
  page links to it is P5-01's call, not this task's.
- `pnpm lint:content` (green, no warnings on the published lesson), `pnpm test:ci` (954 tests, 85
  suites), `pnpm lint` (0 errors; the same 7 pre-existing warnings in untouched components) and
  `pnpm build` all green. The build generates `/es/cursos/dl-nlp/texto-como-numeros`; the prerendered
  HTML has 165 KaTeX spans, all six section anchors, all three quiz cards and no `TODO` leaks.
- **Not verified: a real 360px device pass.** The lesson has been read only in the prerendered
  HTML. Left for the user's manual pass, mirroring P2-01…P4-03.
- **The six steps are no longer headings** (user-directed revision, 2026-07-30, after the first
  pass shipped them as `## Motivación` / `## Intuición` / … in both the guide and the lesson).
  **A template is a great authoring tool and a terrible reader interface**: identical scaffolding
  headings in all ~40 lessons expose the machinery and read as a form being filled in rather than
  an explanation. The structure is unchanged — what changed is that it is now invisible:
  - Motivación, intuición and **puente** get **no heading**. They are narrative moments: the
    opening paragraphs and the closing ones. A `##` on any of them turns a continuous line of
    thought into compartments, and `## Puente` exposes the mechanism worst of all.
  - Implementación and verificación **keep** a heading, because they are mode changes — "stop
    reading, run this" / "stop reading, test yourself" — and the on-this-page rail wants them.
    Formalización usually keeps one for the same reason when the maths runs long.
  - Every heading is titled **by content**, never by step: "Compruébalo a mano con una frase en
    español", not "Implementación".
  - New `src/lib/courses/validate-structure.ts` warns when a heading is one of the six step names
    (accent- and case-insensitive, reusing `extractHeadings` so it sees exactly what the rail
    shows). Warn-only, like budget and notation. This is the half of the rule a machine can check,
    and it is precisely the sort of thing that creeps back one tired evening at a time.
  - Lesson 1 went from six scaffolding headings to three `##` + one `###`, all content-named;
    verified in the prerendered HTML.
- **Lesson 1 was rewritten to stop borrowing from Block 2** (user-directed, 2026-07-30). The first
  version explained why a network cannot take text using `\mathbf{z} = \mathbf{W}\mathbf{x} +
  \mathbf{b}`, "la primera capa" and el descenso de gradiente — the weight matrix, the layer and
  the training rule are what **Block 2** exists to build, so Block 1 lesson 1 was resting its
  central argument on three things the student had not been given. Methodologically wrong, and it
  is the first lesson of the course.
  - Rewritten at the level Block 1 owns: a network is a **function**, `f : \mathbb{R}^d \to
    \mathbb{R}^m`; functions take numbers; text is not numbers. The "learning is correcting a
    little at a time, and *a little* needs a space where small moves mean something" argument
    stayed, but is now explicitly signposted as a forward reference ("eso es el bloque 2").
  - The "dimensión fija" requirement no longer appeals to `\mathbf{W}`'s column count but to the
    arity of the consuming function; two quiz options/explanations were rewritten for the same
    reason. Swept the file for `capa` / `peso` / `gradiente` / `activación` / `perceptrón` —
    the only survivors are the bare name "red neuronal" and signposted forward references.
  - **The rewrite came out stronger, not weaker**, which is the usual result and is now recorded
    as the argument for the rule.
  - New **AUTHORING.md §2, "What a lesson may assume"** (sections renumbered 2→3…9→10, all `§`
    cross-references updated): a lesson may use the course prerequisites and the lessons before it,
    nothing else. **Matrices are a prerequisite; weight matrices are not.** Forward references are
    fine only when signposted. Plus the three things that are true when you reach for a later
    concept (make the argument lower; the lesson is misplaced; a prerequisite is missing from
    `course.es.yml`). Added to the pre-merge checklist and to the template's header comment.
    **Not machine-checkable** — it is a review question, and the first one to ask.
  - Lesson 1: 1,401 → 1,573 words, still in budget; 189 KaTeX spans; build green.
- **Two reader bugs found by authoring, both fixed** (user-reported, 2026-07-30). Both are P1-04
  code, and neither was visible until a lesson written to the §1 heading rules rendered — which is
  the argument for authoring a real lesson inside this task rather than deferring it:
  1. **The on-this-page rail highlighted section 1 from the top of the page.** `OnThisPage`
     initialised `activeId` to `headings[0]` and fell back to it in the scroll handler, so while
     the reader was still in the untitled opening prose — which every lesson now has, by rule — the
     rail pointed at somewhere they had not reached. A progress indicator that is confidently wrong
     is worse than one that admits it does not know, so **nothing is active above the first
     heading**. Logic extracted to `src/features/courses/reader/scroll-spy.ts` and unit-tested
     (8 tests): the repo has no jsdom/RTL, so pure logic pulled out of a component is how
     components get covered here.
  2. **`###` rendered as body text.** `globals.css` opens with `@tailwind base`, and Preflight
     resets every heading to `font-size: inherit; font-weight: inherit`. `h2` escaped it only
     because `mdx-components.tsx` overrides it; there was **no `h3` override at all**, so a
     subsection was a heading the rail listed and the page did not show. Added `h3` — 1.175rem,
     weight 600.
  - **`h2` had the same defect, less visibly:** its override set size and colour but never weight,
    so it sat at the body's 400 while the lesson h1 is Manrope 800. Adding a weighted h3 without
    fixing that would have made a subsection look *bolder* than its parent section, so `h2` now
    carries `fontWeight: 700`. Hierarchy is h1 800 → h2 700 → h3 600.
  - **Not changed, flagged instead:** body headings use the body font while the lesson h1 uses
    `--font-headline` (Manrope). Possibly also unintended, but that is a design decision rather
    than a stripped browser default, so it was left alone.
- **A third Preflight bug, and the reason there was a third** (user-reported, 2026-07-31). The
  ordered list in lesson 1's *«Compruébalo tú mismo…»* section rendered as three unnumbered,
  unindented run-on lines. Not a parsing failure — `remark-gfm` emits a correct `<ol>`; Preflight
  resets `ol, ul, menu` to `list-style: none; margin: 0; padding: 0`, and with no
  `@tailwindcss/typography` and no `prose` class on `.lesson-content`, nothing put it back.
  - **The pattern is what matters, not the bug.** Three findings in two days, all the same
    sentence: *Preflight strips a browser default, and lesson prose is the only surface in this
    app that relies on browser defaults.* Every other surface is composed of components that
    style themselves. So this pass stopped fixing them one at a time and swept the reset for
    everything markdown can still emit: `a` (`color`/`text-decoration: inherit` — a link was
    indistinguishable from body text), `blockquote` (`margin: 0` — indistinguishable from a
    paragraph), and inline `code` (mono font, no boundary). All four now live in one commented
    block in `lesson.css`. `h4` stays unstyled deliberately — the outline collects h2/h3 only.
  - **The fix is CSS, not a `mdx-components.tsx` override, unlike h2/h3.** Component overrides
    cannot reach `::marker`, cannot give nested levels their own markers, and — the load-bearing
    one — cannot reach `li > p`. A *loose* list (blank lines between items) has remark wrap each
    item in a `<p>`, which then inherits `.lesson-content p { margin: 1.25rem 0 }` and blows the
    items a full paragraph apart.
  - **`.lesson-content` alone is NOT a tight enough scope, and browser-checking the change is
    what showed it.** The reading column also holds component-rendered prose elements, and two
    of them were caught by the first draft:
    - `.lesson-content a` turned `LessonNav`'s prev/next card **green**. The card sets
      `textDecoration` inline (so it kept its lack of underline) but not `color`. Invisible
      today only because its two child spans set explicit colours — the next unstyled span in
      that card would have shipped green. Now scoped to
      `:is(p, li, blockquote, td, th) a`: a markdown link always lands in one of those, a
      component link never does.
    - `.lesson-content li { margin }` would have loosened `CodeChallengeCard`'s test-results
      list, a `display: grid` whose spacing is a `gap`. Its inline `list-style: none` already
      outranked the marker rules, but its `<li>`s set no margin, so the descendant rules got
      through. Every list rule now carries `:not([style])` — remark never emits a `style`
      attribute and every component list here sets one, so that attribute *is* the
      authored-in-markdown test.
  - **The real defect was in the fixture, not the CSS.** `00-pipeline-fixture.mdx` exists to
    exercise every part of the pipeline and had covered math, code, tables, every callout and all
    five question types since P1-01 — but contained **no list, no link and no blockquote**, in any
    of its 200 lines. A coverage surface only catches what it thought to include. It now has a
    `## Listas y prosa` section with the tight list, the loose list, a nested list, an inline link,
    an inline code chip and a blockquote. Its `content-budget: ignore` already covers the words.
  - No `AUTHORING.md` change: with the rendering correct there is no gotcha left to document, and
    the fixture is already the file authors read to see what the pipeline supports.
  - **Same bug, different surface, left alone:** `.policy-body ul` (`globals.css`, duplicated
    inline in `PolicyPage.tsx`) restores `padding-left` but not `list-style`, so the legal-policy
    modals are marker-less too. Not this feature.
- **New AUTHORING.md §5 subsection, "Terminology — one term per concept"** (user decision,
  2026-07-30), prompted by noticing that Block 1 lesson 1 uses `red neuronal` and `modelo`
  interchangeably. The cost is not that synonyms are bad writing — in ordinary prose they are good
  writing — but that **in a technical explanation a reader cannot tell a synonym from a
  distinction**, and pays that tax on every page for 40 lessons. It is the prose counterpart of
  NOTATION.md: that fixes the symbols, this fixes the words, and both say "add the entry before
  writing the lesson that needs it".
  - `modelo` / `red neuronal` / `sistema` are given three distinct senses rather than one being
    banned: the network specifically / the trained artefact, neural or not / anything downstream.
    Lesson 1 already honours that split in 7 of 8 places, which is what suggested it. **In Block 1,
    prefer `modelo` or `sistema`** — bolsa de palabras, TF-IDF and cosine similarity are not neural
    networks, so `red neuronal` there is both over-specific and a §2 forward reference.
  - A Spanish/English table, grounded in what the syllabus **already commits to** rather than
    invented: *embedding*, *token*, *batch*, *attention*, *one-hot encoding*, *fine-tuning*,
    *softmax*, *encoder*/*decoder* stay English; capa, peso, pérdida, gradiente, entrenamiento,
    vocabulario, tokenización, bolsa de palabras stay Spanish. The test is whether the Spanish term
    is genuinely used by people who do this work, not which language sounds better.
  - **One live conflict surfaced and left for the user:** `course.es.yml`'s Block 2 summary says
    *retropropagación*, while the syllabus uses *backpropagation* in three lesson titles and in the
    `backpropagation` slug. The table assumes the slug wins; the manifest was **not** edited, since
    it is customer-facing copy. Flagged in the doc as `> Open:`.
  - Checklist item added; the rule is also in the template header, where lessons get written.
  - **Lesson 1 was not edited** for this. Only its line 69 deviates from the split it otherwise
    follows.
- **Acronym rule added to the same §5 subsection**, after the user caught `OOV` being used in
  lesson 1 with no expansion — introduced by this task's own cross-reference pass, which wrote
  "la lección 3, sobre vocabulario y OOV" one clause after naming the concept in plain Spanish.
  Fixed in place: *palabras fuera de vocabulario (out-of-vocabulary, OOV)*, and the redundant tail
  dropped.
  - The rule is **expand on first use per LESSON, not per course**. Lessons are entered from search,
    from the sidebar and from links in other lessons, so "I defined it in lesson 3" is no defence
    in lesson 8. Framed in the doc as §2 in miniature: an unexpanded acronym is something the
    student has not been given, dressed as something they should already know.
  - Checklist item names the ones this course will actually use: OOV, BPE, BPTT, TF-IDF, MLP, RNN.
  - Swept both content files: no other bare acronym in the published lesson; the two in the
    rendering fixture (`NLP`, `MLP`) are in headings of a draft coverage file that never publishes.
- **The reading-time budget lost its lower bound** (user decision, 2026-07-30). It was a *second*
  measure of "is this lesson substantial enough", and `words` already measures that — calibrated
  differently, so the two could not both be satisfied. `estimatedMinutes` for a prose-only lesson
  is `words/120 + questions`, so clearing a 20-minute floor needed **≥2,040 words**, past the
  2,000-word target: every widget-free lesson warned on one axis or the other, forever. Block 1
  lesson 1 (deliberately widget- and code-free) was the one that exposed it.
  - `warnUnder: false` on the `minutes` axis. The **ceiling stays** — a 40-minute lesson really
    should split — and the drift check still catches a `minutes` that contradicts the content, so
    a lesson claiming 40 minutes' worth of nothing is still called out.
  - Note the earlier 180→120 wpm recalibration was an attempt to fix this same contradiction and
    only narrowed it. The estimate is now explicitly **advisory**: it feeds the `(≈N)` in the
    report and the drift check, and no warning fires merely because it is low.
  - AUTHORING.md updated in both places that documented the old behaviour; 3 new tests pin the
    new one (no warning below the band, still warns above it and past the ceiling).
- **Blocks renumbered 0..4 → 1..5, everywhere** (user decision, 2026-07-30). The prose, the
  manifest and every planning doc said "block 0"; `LessonSidebar` rendered `index + 1` zero-padded
  and showed **01**. Off by one, and a reader following a cross-reference landed in the wrong
  block. The user chose to move the numbering rather than the UI, so `course.es.yml` ids, the
  `block:` field in every lesson and the template, PLAN.md (prose *and* the bare-number column of
  its structure table), all six phase-5 docs, the phase-1/2/3 docs, AUTHORING.md, NOTATION.md,
  STATUS.md and the block references in code comments all moved together.
  - **The five phase-5 block docs were renamed too** (`01-block-0-fundamentos.md` →
    `01-block-1-fundamentos.md`, and so on), since their filenames encode the block. A side effect
    worth having: task number and block number now agree — P5-01 is Block 1, P5-05 is Block 5.
    All six inbound links verified to resolve.
  - **Test fixtures were deliberately left alone.** The block ids in `registry.test.ts`,
    `schemas.test.ts`, `SyllabusAccordion.test.ts` and `enrollment-view.test.ts` are arbitrary
    inputs to grouping and validation logic, not references to real course blocks; renumbering
    them would have implied a coupling that does not exist.
  - `LessonSidebar` now renders `group.block.id` instead of `findIndex + 1`. After the renumber the
    two agree by accident, and an accident is not a guarantee: numbering by position would silently
    disagree again the first time a block is added, removed or reordered.
- **Lessons are now numbered in the sidebar** (`SidebarLessonList`, ordinal within the block), so
  prose that says "la lección 3" points at something a reader can find. It was previously an
  unnumbered list of titles, and every numeric cross-reference in the course was unresolvable.
  Kept as real content rather than `aria-hidden`: the list has `list-style: none`, so screen
  readers cannot be relied on to announce position.
- **New AUTHORING.md rule, "Referring to other blocks and lessons":** blocks 1..5, lessons numbered
  within their block, both **lowercase** in Spanish prose (*la lección 3*, not *la Lección 3*), and
  — the load-bearing part — **always name the topic alongside the number**: "la lección 3, sobre
  vocabulario y OOV". A bare ordinal is a reference that rots: insert one lesson and every
  "la lección 3" elsewhere silently points at the wrong place, across 40 lessons, with nothing
  checking it. Applied to lesson 1's six cross-references; its self-reference to its own block
  became "todo **este** bloque", which cannot drift at all.
- 64 new unit tests across `budget.test.ts`, `validate-notation.test.ts`, `content-files.test.ts`,
  `validate-structure.test.ts` and `reader/__tests__/scroll-spy.test.ts`.
- Not yet committed to a branch/PR (**local**).

**COURSE-P5-00 — amendments after lesson 2** (2026-08-03). Six gaps found by reading AUTHORING.md
against the two finished lessons, fixed before Block 1 lesson 3 makes them 38 lessons' worth of
drift. The guide is the deliverable; correcting it *and* the lessons written against the old text
is what closes the loop.

- **The bridge now carries a thematic break.** Step 6 correctly has no heading, but unlike
  motivación and intuición it comes AFTER a section — normally the quiz — so with no mark at all
  it read as a remark about the last question. `---` before the closing paragraphs, styled in
  `lesson.css` as a **short centred rule** (4rem, `--border-variant`, 3.5/2.5rem margins), not a
  full-width hairline: a full-width rule is what a section boundary looks like, and the bridge is
  the opposite of a new section. Reserved to that one job, one per lesson.
  - `hr` was another Tailwind-Preflight casualty, so every property is set rather than adjusted —
    same root cause as the lists/links/blockquotes fixed earlier in this task.
  - Added to `00-pipeline-fixture.mdx` too: it is a rendered element now, and the fixture is where
    rendered elements get checked.
- **Formalización is subdivided by the argument, not the length.** A heading marks a new *claim*,
  not a new screenful; subsections go in dependency order; the title states the claim. Length
  survives only as a symptom (~600 words under one heading usually hides a second movement).
  Applied to lesson 2, whose single `##` ran across three movements — it gained one `###` at the
  BPE turn.
- **A non-first lesson opens by picking up the previous lesson's bridge.** Lesson 2 already did
  this; the guide never said so. Named as the mirror of step 6 — *a bridge nothing picks up is a
  promise the course did not keep* — and put in the template's step-1 comment, where it is needed.
- **§5 "Tone" became "Voice and tone", from four words to seven subsections.** It was the weakest
  section in a file whose purpose is to stop two authors reading one rule two ways, and it is the
  section that matters most. Every rule is stated in English and **every example is Spanish, lifted
  from our own two lessons** — the NOTATION.md `<W>casa</W>` precedent. What it now fixes:
  - **Person and mood**: `tú` + imperative for what the student does, `nosotros` ONLY for the
    derivation being done jointly on the page, never the impersonal *se debe* / *el estudiante
    debe*. Both lessons already split this way; nothing said why.
  - **Rhythm**: long setup, short unqualified conclusion. Plus name-the-consequence and
    say-what-you-are-giving-up, both patterns the lessons use and the guide never named.
  - **The five marks, one job each** — bold defines, italics emphasises or marks an anglicism,
    `<W>` mentions, `«…»` loosens, backticks are Python. This is the rule the finished lessons
    were breaking: bold and italics were BOTH doing emphasis while bold was also the definition
    mark. The `<W>` argument in NOTATION §6, applied to all five.
  - **Spanish typography**: la raya glued to what it encloses (`—así—`), opening `¿`/`¡`, decimal
    comma in prose but the point inside `$…$`, `«…»` never `"…"`. The two lessons had the raya
    written both ways.
  - `subpalabra` added to the Spanish-terms table — lesson 2 needed it and it was not there, which
    is exactly the "add the row before writing the lesson" rule failing in practice.
- **New `validate-voice.ts` (+ 15 tests), wired into the lint's advisory phase.** Two banned
  families: condescension (*obviamente*, *simplemente*, *sencillamente*, *basta con*…) and padding
  (*cabe destacar*, *como podemos ver*…). Scans `prose()` plus the raw frontmatter, so quiz copy is
  covered and Python/LaTeX cannot trip it; de-duplicated by phrase; accent-aware boundaries, since
  `\b` splits «señalar» down the middle.
  - **This is the case that justified the module.** `sencillamente` had been sitting in Block 1
    lesson 1 through a full review, because the guide listed `simplemente` and a reviewer reads
    what the guide says. The ban is on the family; a machine is what holds a family.
  - `validate-structure.ts` gained `bridgeWarnings`: exactly one thematic break, blank line above
    it, nothing but prose after it. The blank-line rule is the sharpest — `---` glued to a
    paragraph is a **setext heading**, and it fails silently in both directions, since
    `extractHeadings` matches ATX headings only.
  - Deliberately NOT checked: whether an italicised word is an anglicism or a Spanish term, and
    whether a raya encloses an incise. Both need to know what the sentence means, and NOTATION's
    bar ("five rules that are always right beat twenty that are usually right") excludes them.
- **The two published lessons were corrected**, since these are violations of rules this pass wrote
  down: the `sencillamente`; bold-as-emphasis → italics (`**solo**`, `**elegido de antemano**`);
  `*subpalabras*` → bold, as a Spanish term at its definition; five rayas re-glued; and the bridge
  break in both. Lesson 2 grew 1,644 → 1,768 words, still inside the band.
- **Lesson 2 was quizzing NFC without ever teaching it.** `q-nfc` turns on Unicode normalisation;
  the body mentioned it only inside a Python comment and never expanded the acronym. That is a §2
  violation (a thing the student was not given) dressed as a style one. Fixed with a paragraph
  where $\Sigma$ is fixed, introducing *la forma de normalización C (Normalization Form C, NFC)*
  and the two spellings of `ñ` — which is also where the alphabet's own trap belonged.
- **The `> Open:` note is resolved.** `course.es.yml`'s Block 2 summary now says *backpropagation*,
  per the §5 table's "the slug wins".
- **Block 0 is now unrepresentable, not merely discouraged.** `CourseBlockSchema.id` and
  `LessonFrontmatterSchema.block` moved from `.nonnegative()` to `.positive()`. `order` stays
  non-negative — `00-pipeline-fixture` legitimately uses 0.
  - **This supersedes the "test fixtures were deliberately left alone" decision above.** That
    reasoning was right when 0 was a legal-but-unused value; it stops being right once the schema
    rejects it, because a fixture that cannot exist is not testing anything. The four fixture files
    were renumbered by shifting each block up one (0,1,2 → 1,2,3), preserving the distinctions the
    tests were built on — `SyllabusAccordion`'s all-drafts block is still the middle one.
  - Two stale comments naming the old scheme ("Block 0 lesson 1") corrected in
    `validate-notation.test.ts` and `budget.test.ts`.
  - A repo-wide grep for `bloque 0` / `block 0` now returns only the two deliberate historical
    references: AUTHORING §2 and this file.
- **The full cross-reference audit came back otherwise clean**: PLAN.md's block table,
  `course.es.yml` ids 1–5, NOTATION.md's per-block sections, AUTHORING's two by-number references
  (Block 4 = *El Puente hacia la Atención*, bloque 2 = the MLP), the §7 widget-id list against
  `widget-ids.ts` (9/9), all five phase-5 task docs, and every `la lección N` in both lessons —
  all agree, all name their topic.
- Not yet committed to a branch/PR (**local**).

**COURSE-P5-00 — the pickup rule, after lesson 5** (2026-08-05). User-reported, and the report is
the clearest statement of it: *«the first two paragraphs of a lesson always try to reproduce the
last two of the previous one — a student who finishes one lesson and starts the next feels like
reading the same thing twice.»* Correct, and it is a gap in the guide rather than a slip by any
lesson.

- **The rule said the pickup must happen; it never said how big it is.** Three artefacts repeated
  the "must" — AUTHORING §1, the template's step-1 comment, the §10 checklist — and none of them
  bounded it, so across four lessons it grew from one sentence into a full paraphrase. Lesson 4 was
  the extreme: both of lesson 3's closing paragraphs replayed in order ($d = 1$, «no imponer
  ninguna», one axis per entry, «la factura», «decenas de miles»).
- **The first attempt at the bound was a word count, and it was wrong.** It said *one sentence*, and
  the user rejected it before it shipped, correctly: «the student can start reading a lesson after
  some time, not directly coming from the previous lesson, and in this case the student should be
  refreshed. It should be a balance, not strict.» A one-sentence pickup optimises for the reader who
  just finished the previous lesson and strands the one who did not.
- **What replaced it: `#### How much of it to restate: two readers, not one`.** The opening is read
  by the continuous reader, who has the previous lesson in their head, and the returning reader, who
  has the topic but not the argument. Both failures are real and **they are not equally bad** —
  boring the first costs patience, stranding the second costs them the lesson — so when the two pull
  against each other, favour the reader who needs help.
- **The correct rule turned out to govern form, not length**, which is why the first attempt missed
  it. What makes a continuous reader feel they are reading twice is not the *presence* of a recap
  but the same sentences, in the same order, with the same example. A recap that asserts instead of
  re-deriving, in different words, entering from a different point, reads as orientation to one
  reader and as nothing at all to the other. So: no word count (two to four sentences is an
  observation, not a target), five form rules, and the **two-reader test** — back to back nothing
  reads twice; read cold and alone the opening still says where the course had got to. *The pickup
  is the state, not the story.*
- **Two bridge rules came out of the same sweep**, both defects the comparison exposed:
  - **A bridge names the NEXT lesson**, and only that one. Lessons 4 and 5 both promised lesson 6
    in nearly the same sentence («es donde se ataca» / «es donde se construye»), which leaves the
    second one to arrive with no door to open. Lesson 4's forward pointer is now «el resto del
    bloque»; lesson 5 keeps the named promise.
  - **A bridge is two paragraphs**, like the motivation it mirrors. They had been growing —
    1, 2, 2, 2, 3. Lesson 5's third paragraph merged into its second; lesson 1's single paragraph
    split in two and now names lesson 2 by its topic, which it never did.
- **Openings reworked in lessons 2, 3 and 5.** Lesson 4 keeps its two-paragraph motivation — it was
  rewritten to the one-sentence version and reverted when that rule was dropped — and gained only
  the previous lesson's topic in its first line. `pnpm lint:content`: no warnings, every lesson
  inside the word budget (1,545 / 1,818 / 1,974 / 2,000 / 1,992).
  - **Lesson 4's second paragraph was reworked separately**, and it is the clearest illustration of
    what the form rules do that a word count cannot. It used to replay four of lesson 3's bridge
    sentences in order — the $d = 1$ dismissal, «la alternativa más directa», the one-axis
    definition, «decenas de miles» — at full length. The replacement is the **same length** and
    shares nothing: it states that one-hot is the *correct* answer and still not enough, names it,
    and splits its cost into the part everyone looks at (huge vectors) and the part that decides the
    lesson (what a model can learn from such an input). The definition itself moved to where it
    belongs, in the formalisation. The figure lead-in went back to «aquella lección», since the new
    paragraph now supplies the antecedent it had lost.
- **No lint pass was added.** An n-gram overlap check between a bridge and the next opening is
  buildable and was considered; the thresholds are guesswork until there is more than one block of
  content to calibrate against, and a false warning on a legitimate pickup costs more than the rule
  in prose. Revisit if Block 2 regresses.
- Not yet committed to a branch/PR (**local**).

**COURSE-P4-04 — the exercise counter was blind to the session that earned it** (2026-08-05).
User-reported: the end-of-lesson footer reads `Ejercicios: 0 de 4` for a student who has just
solved all four, and only tells the truth on a later visit.

- **Cause.** `snapshot.exercises` was written in exactly one place — the mount-time
  `GET /api/courses/progress` — and never again. `CourseProgressProvider.onAnswered` was
  fire-and-forget: POST the attempt, return. So `countSolved()` kept reading the map fetched before
  the student had answered anything.
- **Fix: an optimistic local merge**, the shape `markCompleted` already uses. New pure transition
  `withExerciseAttempt` in `hooks/course-progress-state.ts`, a stable `recordAttempt` on
  `useCourseProgress`, called from `onAnswered` before the fetch. Fixes `AttemptHistoryContext` at
  the same time — same map — and code challenges for free, since both contexts share `onAnswered`.
- **`recordAttempt` has an empty dep list, and that is load-bearing.** The cards report from an
  effect keyed on the handler's identity, so a callback that changed identity would record the same
  attempt twice. The functional `setSnapshot` updater is what buys the empty list.
- **No rollback on a failed write**, and this is the one place it diverges from `markCompleted`.
  The student solved the exercise; reverting the counter to 0 is precisely the bug being fixed, and
  the attempt POST is already silent-by-design.
- **Re-hydration needed no new guard.** An optimistic write makes `history` defined for the card
  that just answered, but `QuizCard`'s `hydrated` ref and the reducer's
  `if (state.attempts > 0 || state.result !== null) return state` both bail. Documented rather than
  re-implemented.
- 9 new unit tests, including the one that actually protects this: **the same attempt sequence
  through `withExerciseAttempt` and through `summariseAttempts` must produce the same history.**
  If the two ever disagree the counter changes on reload, which is the original bug in a new hat.
- Not yet committed to a branch/PR (**local**).

**COURSE-P5-00 — display maths is punctuated** (2026-08-05). User-reported: *«equations in the
ambient `$$ … $$` are not punctuated. If there is an equation that finishes a sentence, there is no
period at the end of the formula.»* Correct, and it was true of 38 of the 39 display blocks in
Block 1 — the only punctuated one being lesson 1's `f : \mathbb{R}^d \to \mathbb{R}^k,`, which is
what made the course inconsistent with itself rather than merely unpunctuated.

- **The rule is that a display equation is a clause, not a picture**, so it carries the sentence's
  punctuation, as the last character INSIDE the fence: `.` when the sentence ends there, `,` when
  the next clause would take a pause in prose, nothing when the sentence runs straight through it.
  In AUTHORING §5 (with the three cases and their examples), §8 (the two placements — after
  `\end{cases}`, outside `\text{…}`), §10 (checklist) and the template's own example equation,
  which is a comma case and now shows one.
- **29 periods, 8 commas, 1 left bare** across lessons 1–5. The bare one is lesson 4's
  $\approx 4 \times 10^{-13}$: the equation is the object of «el modelo llega a ver …» and the
  sentence finishes on the line below it. The comma cases are the judgement in this change — they
  were decided by reading the equation and the line after it aloud as one sentence, which is also
  the test the guide now states.
- **A sixth advisory pass**, `src/lib/courses/validate-math-punctuation.ts` (+ 15 unit tests),
  wired into `lint-content.ts` next to notation/structure/voice. Warns, never fails.
- **It fires on ONE case and stays quiet on every other**, per the NOTATION.md bar: unpunctuated
  block + next paragraph opening with a capital (or `¿`/`¡`), which in Spanish is always a new
  sentence. A block followed by a heading, a `<Details>`, a table or a list usually ends a sentence
  too, and *usually* is the whole problem — lesson 3 has a sentence-ending equation before a
  `<Details>` that this pass will never see, and review holds it. Whether a mid-sentence block wants
  a comma or nothing needs the grammar of the next clause and is not decidable from the source.
- **`00-pipeline-fixture.mdx` was left alone** (scope decision: it is a renderer fixture, not
  prose), so it carries **two permanent warnings** in the content report. Two characters would clear
  them if that noise ever becomes the thing that trains authors to skip the report.
- Word counts, budget, notation, structure and voice warnings all unchanged — `prose()` strips
  display maths before counting, so punctuation inside a fence is invisible to every other pass.
- Not yet committed to a branch/PR (**local**).

**COURSE-P2-02 — `onehot-vs-embedding` removed** (2026-08-05). Block 1 lesson 4 shipped with a
hand-written SVG (`one-hot-equidistancia.svg`) instead of the explorable, which left the widget with
no consumer but the draft render fixture.

- Deleted `widgets/nlp/OneHotVsEmbedding.tsx`; dropped the id from `widget-ids.ts` and `registry.ts`
  (they move together — `Record<WidgetId, …>` makes one without the other a compile error) and the
  `<Explorable>` from `00-pipeline-fixture.mdx`.
- Nothing orphaned: `Slider` is shared with `LossLandscape`, `GradientDescent2D` and
  `SigmoidExplorer`; no file in `widgets/nlp/` imports another. `registry.test.ts` is generic and
  self-adjusts.
- The fixture's «cover all eight ids» comment was **already stale** — ten ids existed and it embedded
  eight, `bag-of-words` never having been added. The count is gone rather than restated: it drifts
  every time a widget is added, and a stale number reads as a contract nobody is keeping.
- AUTHORING §7's id list corrected the same way — it was missing `bag-of-words` too.
- `phase-5-content/01-block-1-fundamentos.md` updated: lesson 4's widget cell is `—` (stale since
  the lesson shipped) and the id is out of `Depends on`.
- **`phase-2-interactivity/02-first-explorables.md` and STATUS's own P2-02 entry were left alone.**
  Both are records of what P2-02 shipped, and it did ship this widget; rewriting them would make
  the history claim otherwise. This entry is the record of the removal.
- Not yet committed to a branch/PR (**local**).

**COURSE-P5-00 — decimal separator switched to the point** (2026-08-16). User-reported: a screenshot
of Block 2's activation-function lesson — *«sube uno solo de sus pesos de 1,0 a 1,1, a 1,2, a
1,3»* — where the four decimal commas read as a five-item list before they read as four numbers.
The ambiguity is structural in Spanish (the decimal comma and the list separator are the same
character), not a one-off phrasing problem, and it was only going to keep recurring in a
number-dense course.

- **AUTHORING §5's typography rule now reads decimal point, not decimal comma** — `1.5`, not `1,5`.
  Thousands are unaffected (`30 000`, `\,` inside `$…$`). The old carve-out that comma-escaped a
  prose-reported number inside `$…$` (`$0{,}500$`) is gone: a point needs no escaping to survive
  KaTeX's comma-spacing, so a reported number and a bare expression are now typeset identically.
  Checklist item and NOTATION.md's two `1{,}5` examples updated to match.
- **Every lesson through Block 3 lesson 7 (`01` through `25`) was rewritten the same day** — there
  is deliberately no mixed-convention period for a reader to land in. Two passes, both by hand
  rather than a blind find-and-replace:
  - **`{,}` → `.` everywhere** (the escaped math-mode decimal marker) — unambiguous, since that
    escape has no other use in this codebase; ~340 sites across every lesson from `04` on.
  - **Bare `\d,\d` reviewed one match at a time**, because the same shape is also how this course
    writes an open interval (`$(0,1)$`), a coordinate or shape tuple (`$(1,0,0)$`, `$(3,2)$`), a
    set (`$\{0,1\}$`), and a NumPy index in a code comment (`W1[0,2]`) — none of which are decimals
    and none of which change. ~19 genuine decimals converted across 8 lessons; everything else
    (intervals, tuples, sets, one code-comment index) left exactly as written.
  - **Two prose references to the mark itself**, not to a number: `04-one-hot.mdx`'s «doce ceros
    detrás de la coma» and `23-lstm.mdx`'s «tres ceros tras la coma», both now «el punto» — the
    old wording would have been describing the wrong character.
  - **`coma flotante` (floating point) was left alone everywhere it appears** — it is the Spanish
    term for the number representation, not an instance of the decimal mark, and confusing the two
    was the one trap in this pass worth naming.
- `pnpm lint:content` and `pnpm build` both green after the rewrite.
- Not yet committed to a branch/PR (**local**).

**COURSE-P7-01** — Closed per doc. The component, the bridge pre-pass, the sixth lint pass, the
budget exemption, the styles, the fixture coverage and the authoring rule all landed. Deviations
and notes:
- **The bridge pre-pass had to be frontmatter- and fence-aware**, which the task doc's sketch was
  not. `renderLesson` is handed the RAW file — `parseFrontmatter: true` strips the frontmatter
  *inside* `compileMDX` — so "the last `---` in the string" is the frontmatter's own closing
  delimiter in any lesson with no bridge, which would have flagged the whole body. Same for a `---`
  inside a fenced block, and for a `<Leccion` inside a fence below the bridge (an injected
  attribute there would show up in code the reader sees). All four are asserted in `bridge.test.ts`.
- **The hover card's copy is translated, not hardcoded.** The doc specifies literal `BLOQUE n ·
  LECCIÓN m`; CLAUDE.md forbids hardcoded customer-facing strings, so it is `courses.reader.refKicker`
  / `refAhead` in both `messages/es.json` and `messages/en.json`, read with `getTranslations` the way
  `LessonNav` does. The uppercase is `text-transform` in CSS, so the message stays sentence case.
  This makes `Leccion` an async Server Component — `Quiz` already is one in the same map.
- **The card hangs off the prose block, not off the link** — the one real design change. The doc's
  prototype (`left: 50%; transform: translateX(-50%)` + `max-width: min(26rem, 82vw)`) was measured
  in the browser and clips: the reading column runs to within **30px** of the viewport edge from
  768px right up to the 1280px breakpoint, and `body` is `overflow-x: clip`, so a reference near the
  end of a line lost up to **180px** of its card (131px observed at 800px wide, on 3 of 4 cards).
  No width cap can fix that — the centring is what overflows. Positioning the nearest `p`/`li`/`td`
  instead (`:has(.lesson-ref-wrap)`) makes the paragraph the containing block, and `left/right: 0`
  with `margin-inline: auto` centres the card IN THE COLUMN. Re-measured at 360/768/800/1024/1440:
  zero clipping at every width, including a reference inside a quiz explanation. The cost is that
  the card sits above the paragraph rather than above the line — acceptable for a non-interactive
  label that appears under the reader's cursor.
- **The fixture cannot host a backward reference.** It sits at `block: 1, order: 0`, so every lesson
  in the course is *ahead* of it. It permanently covers four of the five cases (forward + anchor,
  forward with no label, a draft target, and one in quiz frontmatter) plus the in-bridge plain-text
  case; the behind-the-reader branch is covered by `isAhead` unit tests and was verified live by
  temporarily moving the fixture to `block: 5, order: 99` (all four references then rendered as
  links with no `data-ahead` and no «Más adelante» prefix, and the in-bridge one linked too, which
  is correct — the bridge rule suppresses only *forward* references). It gets permanent content
  coverage in P7-02.
- **Draft-target warnings skip a draft referring file.** A draft lesson has no readers, so "this
  renders as plain text" costs nobody anything — and the fixture, which references itself on purpose,
  would otherwise warn on every `pnpm lint:content` run forever. Verified both ways: the warning does
  fire when a published lesson points at a draft.
- **An unresolved slug renders a dev-only inline marker**, mirroring `Quiz`, `CodeChallenge` and
  `Explorable`. Not in the doc, but P7-02 is 43 lessons of exactly this edit.
- `<Leccion>` is bound in `quiz/render.tsx` as the doc decided, threaded through a new optional `ctx`
  prop on `Quiz` and `CodeChallenge`. Server-only — it never reaches the client cards.
- The doc's path for the stylesheet (`_styles/lesson.css`) is wrong; `_styles/` holds only
  `katex.css`. The rules went in the segment's own `lesson.css`.
- All three fatal lint modes confirmed to exit 1 naming file, slug and anchor (typo'd slug, stale
  `ancla`, missing `slug`), then reverted. `pnpm lint` (0 errors), `pnpm lint:content`, `pnpm test`
  (1366 passing), `pnpm build` and `pnpm check:bundle` all green — the card ships no client JS.
- Not yet committed to a branch/PR (**local**).

**COURSE-P7-02** — **Done. All 5 blocks converted (43 lessons, 353 `<Leccion>` tags).** Block 1: 53
tags across 8 lessons. Block 2: 62 tags across 10 lessons. Block 3: 89 tags across 8 lessons.
Block 4: 47 tags across 6 lessons. Block 5: 102 tags across 11 lessons. `pnpm lint` + `pnpm lint:content`
+ `pnpm test` (1366) + `pnpm build` + `pnpm check:bundle` all green (every slug + anchor resolves, no
crosslink error); a comment-aware sweep of all 43 lessons finds no `lecci[oó]n \d` outside a comment.
Scope decisions and notes:
- **Numbered references only.** The block-checklist per-lesson counts match the count of `lección N`
  references (plus the one `{/* … Bloque 1, lección N */}` marker comment) exactly — 01(7) 02(4)
  03(5) 04(14) 05(5) 06(10) 07(4) 08(12). Relative references that carry no number — *«la lección
  anterior»*, *«la lección siguiente»*, *«la lección del one-hot»* — are left as prose: they are
  already reorder-safe, the digit-regex acceptance gate does not target them, and AUTHORING §1 treats
  *«la lección anterior»* as an intentional bridge-pickup phrasing. Block references (*«el bloque 3»*)
  stay too — there is no `<Bloque>` component (AUTHORING §2).
- **One reword instead of a `<Leccion>`.** `06-embeddings-densos` had a `lección 4` inside a `<PyCell
  code={…}>` Python comment, where a `<Leccion>` tag can't render. Reworded the comment to *«la
  representación anterior»* so the digit-regex is clean without injecting a broken tag into code.
- **Forward-above-bridge refs reworded to state direction** where the number was the only cue —
  *«la falla de la que vive la lección 3»* → *«… de la que vive una lección más adelante, la del
  problema OOV»*; *«es el asunto de la lección 3»* → *«… es el asunto de una lección más adelante, la
  de vocabulario»*. Verified live: lesson 01's six above-bridge forward refs render as links with the
  «Más adelante · Bloque 1 · Lección N» kicker; lesson 04's backward refs render as links with no
  prefix; both bridge hand-offs render as plain text.
- **Word counts drop 18–69 words per lesson, by design, not a regression.** The drop is exactly
  proportional to the reference count (~5–6 words/ref across all 8 files), i.e. it is only the
  `<Leccion>` label text leaving the budget under the P7-01 exemption (`prose()` strips the tag *and*
  its children). No surrounding prose is eaten — the diagnostic the criterion actually guards against.
  Estimated `minutes` moves at most 1 on any lesson; frontmatter `minutes` untouched.
- Reorder drill not run this pass (a phase-level, one-time demonstration; the reclassification
  mechanism is already unit-tested via `isAhead` in P7-01).
- **Block 2 (El Perceptrón Multicapa) — 62 `<Leccion>` tags, 10 lessons.** Same rules as Block 1.
  Per-lesson word counts drop 30–74 (all now comfortably under the 2000-word ceiling that several
  were brushing); estimated `minutes` within 1 of frontmatter. Three Block-2-specific calls:
  - **A figure carried baked-in lesson numbers.** `17-implementar-mlp`'s `bucle-entrenamiento.svg`
    labelled each loop-stage box with a *«lección N»* rótulo, mirrored in the MDX `alt` and the SVG
    `aria-label` — a hand-written lesson-number reference a `<Leccion>` can't reach (it lives in an
    SVG asset and an `alt` attribute). Dropped the four numeric labels from the SVG and the alt text;
    the stage titles + the figure caption keep the meaning. The acceptance grep scans `alt`, so leaving
    it would have failed the gate. Only file touched outside `content/courses/dl-nlp/es/`.
  - **PyCell/print rewords** where a number sat inside Python (a comment or a display string), which a
    `<Leccion>` can't render — `12`(1) `13`(3) `14`(2) `17`(1) `18`(1). Reworded to drop the digit,
    exactly as Block 1's one PyCell case.
  - **Cross-block bridge.** `18-proyecto-sentimiento` closes the block pointing into Block 3;
    `<Leccion slug="por-que-falla-el-mlp">` resolves across blocks and renders plain text (forward +
    bridge). One reference was split across a line break (*«la lección\n1 de este bloque»*), which the
    line-based grep misses — caught by reading.
  Verified live in the build's prerendered HTML: `funcion-de-perdida`'s 8 in-prose refs land on the
  right lessons (backward → link; forward-above-bridge → link with the «Más adelante» kicker; bridge →
  plain text), and the cross-block bridge in `18` renders as plain text.
- **Block 3 (Redes Recurrentes) — 89 `<Leccion>` tags, 8 lessons.** Same rules as Blocks 1–2. Per-lesson
  word counts drop 26–100 (again proportional: ~4 words/ref, only the deleted number + positional phrase
  — *«N de este bloque»*, *«N del bloque anterior, sobre …»* — leaving the budget; `<Leccion>` children
  are kept, verified by the ~4-vs-~8-words/ref ratio); estimated `minutes` within 1 of frontmatter, which
  is untouched. Block-3-specific calls:
  - **`de este bloque` vs `del bloque anterior` is the whole game in this block.** *«la lección 2 de este
    bloque»* is `la-rnn-vanilla`, *«la lección 2 del bloque anterior»* is `funciones-activacion`; likewise
    *«lección 3/4/5/7 de este bloque»* (bptt / gradiente-desvanecido / lstm / proyecto-char-lm) vs the
    same digits *«del bloque anterior»* (regla-de-la-cadena / funcion-de-perdida / …). Every tag was
    assigned by reading the clause, not the number, and the assignment was re-audited by grepping each
    `funciones-activacion`/`la-rnn-vanilla` tag back to its sentence.
  - **`21-bptt`'s backward-from-the-number cross-block refs** (*«La regla de la cadena —lección 7—»*,
    *«backpropagation —lección 8—»*, under *«El bloque anterior tiene las dos piezas»*) were read as
    backward, as the task warned — wrapped on the name (`regla-de-la-cadena`, `backpropagation`) with the
    dash-number dropped, not treated as same-block forward.
  - **Line-break-split refs the line-based grep misses.** `21-bptt` (*«de la lección\n8»*) and
    `25-proyecto-char-lm` (*«la lección\n2 del bloque 1»*, → `tokenizacion`) each hid a reference across a
    newline; caught by a newline-collapsed grep + reading. The per-lesson counts only reconcile with the
    task's (21→22, 25→28) once these are included.
  - **PyCell/summary rewords** where a number sat where a `<Leccion>` can't render — `25`'s frontmatter
    `summary` (plain-text metadata: *«La RNN de la lección 2 y la BPTT de la lección 3»* → *«La RNN vanilla
    y la BPTT»*) and Python comments in `25` (3) and `26` (3). Reworded to drop the digit, as in Blocks 1–2.
  - **Plural `«las lecciones 5 y 6»`** (`25`, `26`) are the one form the singular acceptance grep does not
    match, so they sit outside the per-lesson counts. Converted anyway — two adjacent tags,
    *«las compuertas de <Leccion slug="lstm">la LSTM</Leccion> y <Leccion slug="gru">la GRU</Leccion>»* —
    since the phase goal is to delete hardcoded lesson numbers of *every* form. (Block 5's unconverted
    `40-arquitectura-completa` still carries one *«lecciones 2 …»*; it belongs to that block's pass.)
  - **Bridges.** Each of `19`→`20`→…→`25` closes pointing at the next lesson (forward + below `---` →
    plain text); `26` closes into Block 4 in prose (*«el bloque 4»*), no `<Leccion>` — it names a block,
    not a lesson.
- **Block 4 (El Puente hacia la Atención) — 47 `<Leccion>` tags, 6 lessons.** Same rules as Blocks 1–3.
  Per-lesson word counts drop 33–90 (proportional, ~6 words/ref: only the deleted number/positional
  phrase and the `<Leccion>` label leaving the budget under the P7-01 exemption — no prose eaten,
  matching Block 3's heaviest file, `25`, which dropped 100 for 28 refs); estimated `minutes` within 1
  of frontmatter, which is untouched. Per-lesson refs: `27`(4) `28`(7) `29`(8) `30`(8) `31`(6) `32`(15).
  Block-4-specific calls:
  - **One PyCell reword instead of a tag.** `28-el-cuello-de-botella` had a *«leccion 8 del bloque
    anterior»* inside a `<PyCell>` Python comment, where a `<Leccion>` can't render; reworded to *«La
    tarea de secuencia a secuencia del bloque anterior»* (its 7th ref, so 47 tags for 48 refs), as in
    Blocks 1–3.
  - **A plural cross-block ref the singular grep misses.** `32-atencion-como-consulta` cites *«la lección
    5 y la lección 6 del bloque anterior, sobre la LSTM … y la GRU …»* — converted to two adjacent tags
    (`lstm`, `gru`), as Block 3's *«lecciones 5 y 6»* were.
  - **Two forward refs into Block 5, both resolving across the block boundary.** `32` points ahead by
    block, not by *«siguiente»*: *«la lección 3 del bloque siguiente, sobre el producto interno
    escalado»* → `scaled-dot-product` (forward, **above** the `---` → link with the «Más adelante»
    kicker — the block's only such case), and its bridge *«La primera lección del bloque siguiente, sobre
    quitar la recurrencia»* → `adios-recurrencia` (forward, below `---` → plain text).
  - **`su lección` / `esa lección` labels where the topic word already precedes the ref** — e.g. *«la
    regla de la cadena de <Leccion slug="regla-de-la-cadena">su lección</Leccion>»*, *«El encoder-decoder
    de <Leccion slug="encoder-decoder">su lección</Leccion>»* — to avoid the triple-repeat *«X … la lección
    sobre X»*, matching Block 3's varied children (*«la lección que la derivó»*).
  - **Bridges.** Each of `27`→`28`→`29`→`30`→`31`→`32` closes pointing at the next lesson (forward +
    below `---` → plain text); `32`'s bridge crosses into Block 5 (`adios-recurrencia`), a lesson this
    time rather than the bare block reference `26` used.
- **Block 5 (El Transformer) — 102 `<Leccion>` tags, 11 lessons.** Same rules as Blocks 1–4. Per-lesson
  tags: `33`(7) `34`(9) `35`(4) `36`(8) `37`(1) `38`(9) `39`(11) `40`(14) `41`(14) `42`(9) `43`(16). Per-lesson
  word counts drop 15–103 (proportional, ~5–10 words/ref: only the deleted number + positional phrase
  (*«N de este bloque»*, *«N del bloque anterior/2/3»*) and the `<Leccion>` label leaving the budget under
  the P7-01 exemption — every diff hunk touches only the reference clause, no surrounding prose);
  estimated `minutes` moves at most 1 on any lesson, frontmatter `minutes` untouched. 20 of the 102 are
  in quiz/challenge frontmatter (bound via `quiz/render.tsx`, `bridge` always false there). Verified in
  the build's prerendered HTML: zero raw `<Leccion` and zero dev "no resuelve" markers; backward refs
  and forward-above-bridge refs render as `.lesson-ref` links with the hover card, bridge hand-offs
  render as plain text (`33`'s *«…le da nombre a la lección siguiente, sobre la auto-atención»*).
  Block-5-specific calls:
  - **102 tags + 11 marker comments = 113 vs the checklist's 109; the +4 is grep artefacts of the kind
    the earlier blocks documented.** `40`'s figure-label table has a plural cell — *«lecciones 2, 3 y 4:
    auto-atención, producto interno escalado y cabezas»* — that the singular `lección \d` grep counts
    once and that became three adjacent tags (`self-attention`, `scaled-dot-product`, `multi-head`),
    +2; `40`'s original had 13 `lección \d` (marker included) against a checklist count of 12, +1;
    `43`'s *«…derivaste en la lección 8 del bloque 2 y programaste en la 9»* hides a second reference
    (`implementar-mlp`) behind an ellipsis with no «lección» word, +1.
  - **`<Leccion>` in `td` cells.** `40`'s "Dónde se construyó" table takes five converted cells (six
    tags); the P7-01 hover-card CSS already anchors to the nearest `p`/`li`/`td`, so it is supported and
    renders.
  - **Numberless positional/relative refs left as prose**, exactly as Blocks 1–4 left *«la lección
    anterior»* / *«la lección del one-hot»*: `36`'s bridge *«…ya se sabía desde la primera lección de
    este bloque»*, `40`'s three *«la lección anterior, sobre …»* table cells (all → lesson 7), `43`'s
    *«como en el proyecto del bloque 2»*. Scope is numbered references; these are reorder-safe and
    outside the digit-regex gate. A follow-up could link `40`'s three "la lección anterior" cells for
    table consistency — flagged, not done.
  - **Forward-above-bridge refs reworded to state direction** — all to *«una lección más adelante, sobre
    X»* (or *«…que recoge más adelante la lección sobre X»* in a quiz explanation): `33`→`codificacion-posicional`,
    `34`→`multi-head` and (quiz) →`scaled-dot-product`, `36`→`bloque-transformer`. `43` is the course's
    last lesson: its bridge points only backward (`arquitectura-completa`, `proyecto-transformer` — both
    links), no forward hand-off.
  - **"Read the clause, not the number."** `42`'s *«el seq2seq de la lección 1 del bloque anterior,
    sobre el encoder y el decoder»* is `encoder-decoder` (block 4 lesson 1), not `seq2seq` (block 3);
    `41`'s challenge cites the same lesson for greedy decoding. `39`/`41`/`42`/`43` carry line-break-split
    refs the line-based grep misses (*«la lección\n7 del bloque 3»*, *«la lección 8\ndel bloque 2»*),
    caught by reading.
- `pnpm build` and `pnpm check:bundle` are phase-level acceptance gates; both green after Block 5,
  which closes the content pass.
- Not yet committed to a branch/PR (**local**). Blocks 1–4 each landed as one commit
  (`feat(courses): convert Block N cross-references to <Leccion> (COURSE-P7-02)`); Block 5 is staged
  the same way, uncommitted, awaiting the user.

**COURSE-P8-01** — Closed. `reading` frontmatter + the «Para profundizar» block + a sixth
`lint:content` pass. Design was prototyped and reviewed before any code (three treatments ×
two placements × two initial states); the chosen combination is cards, after the bridge,
collapsed, capped at five. Rationale for each is in phase-8-further-reading/README.md.

- **Named `reading`, NOT `refs`.** `LessonRef` is already the prev/next pointer
  (`src/domain/types.ts`) and `lesson-ref-*` is already the P7 cross-lesson hover card. A third
  meaning for "ref" in the same reader would have collided with both.
- **A CSS specificity collision was caught in the browser, and it would have shipped.**
  `.lesson-content p` is (0,1,1) and outranks a bare `.lesson-reading-lede` / `-note` (0,1,0), so
  both paragraphs silently kept the 1.25rem prose margin instead of the 18px/5px they declare —
  the note sat 20px from its title rather than 5px. Both selectors are now `.lesson-content`-
  prefixed. Worth remembering: **anything added inside the reading column inherits this hazard**,
  and it is invisible in source review.
- **`required`, so all 44 lesson files gained `reading: []`** (scripted), plus six test fixtures
  (`schemas`, `registry`, `catalog-view`, `enrollment-view`, `sitemap`, `SyllabusAccordion`) —
  the same churn `challenges` caused in P3-02, for the same reason.
- **The mobile summary drops its breakdown under 480px.** With all five kinds the summary wrapped
  to three lines at 375px (84px tall) — taller than the thing it hides. The count survives, the
  breakdown goes; measured back down to 54px.
- **`reading` is deliberately absent from `estimatedMinutes`** and its budget axis **cannot warn**
  (`max` = `ceiling` = `READING_MAX`, and the schema rejects a sixth). The axis exists only to put
  the count in the report line, which is what makes P8-02's remaining work visible. Consistent with
  the AXES comment's rule that a warning firing on a legitimate choice is one authors learn to skip.
- **Liveness is not a build gate**, by decision: CI has no network guarantee and a lint that fails
  on someone else's downtime gets disabled. Shape and internal consistency are linted; the author
  opens the link. The `/abs/`-not-`/pdf/` rule is the durable-address half of that.
- **One entry of each `kind` added PERMANENTLY to `00-pipeline-fixture.mdx`**, matching what
  P2-02/P2-03/P3-01/P3-02 each did — it covers `year` absent, `lang: es`, a long note, and the
  five-entry cap. All five URLs were checked (HTTP 200) rather than recalled.
- **All five failure modes proven, then reverted:** arXiv PDF link, venue/url id mismatch,
  duplicate title, note past 240, unknown kind — each exits 1 naming the file and the problem.
- **Verified live** against a dev server with the fixture temporarily published (reverted after),
  by computed styles and measured geometry: collapsed `<details>`, all five kinds translated, both
  `lang` chips, green title, hidden marker, zero `<script>` inside the block, `list-style` opt-out
  holding, no horizontal scroll at 375px or desktop. **No screenshot** — the Browser pane in this
  environment does not composite, so `computer{screenshot}` fails; this mirrors the manual-pass gap
  noted on P2-01/P2-02/P2-03.
- **Not verified:** a real phone, and the English copy in a browser (`dl-nlp` has no `en/` tree, so
  every `courses.reading.*` string is in the same position as `courses.challenge.*` — checked
  structurally, both files key-for-key).
- `pnpm lint` (0 errors), `npx tsc --noEmit` (0 errors in `src/`), `pnpm test:unit` (1,362 across
  108 suites), `pnpm lint:content`, `pnpm build`, `pnpm check:bundle` all green.

---

## Phase 9 — Cross-lesson search

Full-text search over a course's lessons, scoped to one course and one locale, reusable for any
future course. Build-time index + client-side matching; **not Pagefind** — see the phase README for
that decision and the measurements behind it.

| Task | Tag | Status | Owner | PR |
|------|-----|--------|-------|----|
| [01 Index + engine + palette](phase-9-search/01-course-search.md) | `COURSE-P9-01` | ✅ | _tbd_ | local |

**Exit criteria**
- [x] The index route prerenders (`●` in the build route table) for every course × locale; zero
      serverless invocations, `immutable` headers preserved into `prerender-manifest.json`
- [x] Search is reachable from the lesson reader — desktop sidebar and mobile bar — scoped to the
      course being read, with nothing hardcoded to `dl-nlp`
- [x] Results group by lesson with up to three section snippets, query highlighted, each deep-linked
      to a `#heading` that lands on the rendered heading
- [x] Accent-, case- and separator-insensitive (`atencion`→`atención`, `self attention`→`self-attention`);
      prefix matches only at a word start
- [x] `/en` searches the prose it actually renders and says so; result URLs keep the `/en` prefix
- [x] `pnpm lint`, `pnpm test:unit`, `pnpm build`, `pnpm check:bundle`, `pnpm lint:content` green

**Notes**
- **254 section chunks / 416 KB of prose / ~116 KB brotli**, fetched once on first open and cached
  at module level. `prepareIndex` normalizes the whole corpus in ~11 ms; a typical query is 0.5–1 ms.
- **`budget.ts` is untouched** — `searchableText` is a deliberate near-copy of `prose()` with two
  documented divergences (`<Leccion>` children kept; punctuation reattached), guarded by a canary
  test. `pnpm lint:content` word counts are byte-identical to before.
- **Fixed a latent LaTeX leak** that `prose()` shares: inline math wrapped across a source line
  break puts the `$` pairing out of phase. Invisible in a word count, visible in a snippet. 0 of 254
  chunks now contain `$` or a TeX command.
- **Two bugs found in the browser, not by tests:** the `/en` result hrefs lost their locale prefix
  (raw `<a>` gets no next-intl treatment — now via `getPathname`), and the language notice rendered
  the scope note instead of "The lessons are in Spanish".
- **Perf work was needed:** the first engine took 14 ms on `"de la"` and 8.7 ms on `"a b c d e"`.
  Bounded range collection, an existence-only AND gate, an ASCII fast path for the word-boundary
  test, and dropping single-character terms brought those to 4.5 ms and 3 µs.
- **`MobileLessonBar`'s scroll lock is now ref-counted** (`src/hooks/scroll-lock.ts`). With a second
  overlay the direct `body.style.overflow` version unlocked the page behind the still-open drawer.
- **Verified live** in the Browser pane at 1400×900 and 375×812: dialog open/close, arrow keys and
  Enter, Escape, focus restore, scroll lock released, deep link scrolling to the real heading
  (`scrollY 1555`), `/en` chrome and prefixed hrefs, mobile full-screen sheet. Screenshots worked
  in this session, unlike the P8-01 pass.
- **Not verified:** a real phone, and a real screen reader. The ARIA contract
  (`combobox`/`listbox`/`option` + `aria-activedescendant`) was checked structurally in the DOM.
- **No ⌘K**, deliberately: the reader hosts Python textareas and a global key grab is a hazard.
  The provider is the single mount point if it is ever wanted.
- **Scoped to the reader after review.** Search was first built on `/cursos` and the course landing
  page as well, and removed on the same pass: those pages sell and start the course, and the
  syllabus accordion is the better way to browse lessons you have not read. The removal also
  collapsed `search()` from `PreparedIndex[]` to a single index, deleting the cross-course ranking,
  the per-result course label and two message keys — dead generality, not headroom.

---

## Phase 10 — Conversion

**Retro-documented.** `COURSE-P10-01` (in-lesson booking CTA) shipped on `course/p10-lesson-cta`
(commit `4757ef1`) without a `docs/courses/phase-10-*` directory or a row here. Recorded now so the
tag namespace is not silently occupied; the design rationale lives in the commit message.

| Task | Tag | Status | Owner | PR |
|------|-----|--------|-------|----|
| In-lesson booking CTA (`LessonCta`, `?book=smart`) | `COURSE-P10-01` | ✅ | _tbd_ | #76 |

---

## Phase 11 — English translation

Write `content/courses/dl-nlp/en/`: 43 lessons, one PR each. Routing shipped in P6-03b — the
Spanish tree is the spine and resolution is per lesson, so the course can be translated one
lesson at a time with no broken intermediate state. Three Spanish-only prerequisites must land
first; see the [phase README](phase-11-translation/README.md).

| Task | Tag | Status | Owner | PR |
|------|-----|--------|-------|----|
| [00 Triage: classify 43 lessons](phase-11-translation/00-triage.md) | `COURSE-P11-00` | ✅ | _tbd_ | local |
| [01 Cross-locale references + English voice lint](phase-11-translation/01-locale-crosslinks-and-voice.md) | `COURSE-P11-01` | ⬜ | _tbd_ | |
| [02 Widget strings + per-locale corpora](phase-11-translation/02-widget-i18n.md) | `COURSE-P11-02` | ⬜ | _tbd_ | |
| [03 `AUTHORING.en.md` delta](phase-11-translation/03-authoring-en.md) | `COURSE-P11-03` | ⬜ | _tbd_ | |
| [04 Block 1 — NLP Fundamentals (8)](phase-11-translation/04-block-1.md) | `COURSE-P11-04` | ⬜ | _tbd_ | |
| [05 Block 2 — The MLP (10)](phase-11-translation/05-block-2.md) | `COURSE-P11-05` | ⬜ | _tbd_ | |
| [06 Block 3 — RNNs (8)](phase-11-translation/06-block-3.md) | `COURSE-P11-06` | ⬜ | _tbd_ | |
| [07 Block 4 — The Bridge to Attention (6)](phase-11-translation/07-block-4.md) | `COURSE-P11-07` | ⬜ | _tbd_ | |
| [08 Block 5 — The Transformer (11)](phase-11-translation/08-block-5.md) | `COURSE-P11-08` | ⬜ | _tbd_ | |

**Landing order:** P11-00 first (cheap, everything keys off it). Then P11-01 → P11-02 → P11-03
before any content. Then blocks in order; lessons within a block in order, because the bridges
interlock in English.

**COURSE-P11-00** — **Done. All 43 lessons classed, five block mds filled.** The phase is
**14 transpose · 27 adapt · 2 rewrite** under Block 4's Option A, or **13 · 27 · 3** under Option
B; the per-block table is in the [phase README](phase-11-translation/README.md). Three results
worth carrying: Block 1 has **no** transposable lesson and only two rewrites exist in the whole
phase (1.2, 2.8); Blocks 3 and 5 hold none, and Block 5 moves no quiz answer across 11 lessons;
and the adapt cost sits mostly **outside** the lesson files, so P11-02 gates 5.2/5.4/5.7,
Block 1's 1.8 gates 5.10, and Block 2's 2.10 gates 5.11.

**Open after P11-00** — **Block 4's direction decision is not made.** P11-00 inventoried both
options and deliberately left the call to P11-07; it fixes whether 4.3 and 5.9 are adapts or
rewrites, and nothing else in the phase moves either way.

**Exit criteria**
- [ ] 43 published lessons under `en/`; `fullyTranslated` true for `en`
- [ ] Every `/en` lesson route indexable with reciprocal hreflang; no fallback `noindex` remains
- [ ] A partially translated tree passes `pnpm lint:content` at every intermediate commit
- [ ] No English lesson renders a Spanish widget label or default corpus
- [ ] English voice families fire on English prose; Spanish families still fire on Spanish
- [ ] Every English `<PyCell>` / `<CodeChallenge>` run in the browser; quoted numbers verified
- [ ] `pnpm lint` + `pnpm lint:content` + `pnpm test` + `pnpm build` + `pnpm check:bundle` green

**Open, carried from Phase 8**
- `reading:` is populated in 41 of 44 Spanish files, but **P8-02's five block checkboxes are still
  unticked** in this file. Any Spanish `reading` revised after its English counterpart is written
  leaves the two silently out of sync. Confirm a block's `reading` is final before translating it.

**Known gaps this phase does not close**
- `docs/courses/notebooks/` stays Spanish (B5.11 links it). Own task, own verification story.

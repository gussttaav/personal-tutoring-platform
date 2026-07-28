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
| [01 Quiz schema + grading](phase-3-assessment/01-quiz-engine.md) | `COURSE-P3-01` | ⬜ | _tbd_ | |
| [02 Code challenges](phase-3-assessment/02-code-challenges.md) | `COURSE-P3-02` | ⬜ | _tbd_ | |

**Exit criteria**
- [ ] All five question types render and grade correctly (unit-tested pure grader)
- [ ] A code challenge passes/fails against hidden assertions in Pyodide
- [ ] **Walking skeleton:** lesson 1 of Block 0 is complete — prose + display math + one explorable + one NumPy cell + one quiz — and reads correctly on a phone
- [ ] `pnpm test` + `pnpm build` green

## Phase 4 — Persistence

| Task | Tag | Status | Owner | PR |
|------|-----|--------|-------|----|
| [01 Schema + repository + service](phase-4-persistence/01-schema-and-service.md) | `COURSE-P4-01` | ⬜ | _tbd_ | |
| [02 Progress API + reader wiring](phase-4-persistence/02-progress-api.md) | `COURSE-P4-02` | ⬜ | _tbd_ | |
| [03 "Mis cursos" panel](phase-4-persistence/03-mis-cursos-panel.md) | `COURSE-P4-03` | ⬜ | _tbd_ | |

**Exit criteria**
- [ ] Migration `0016` applied; deny-anon RLS present on all three tables per the `0007` pattern
- [ ] `CourseService` tested against in-memory fakes; zero infrastructure imports
- [ ] Completing a lesson survives a refresh and a different device
- [ ] Signed-out reading still works (progress silently not tracked)
- [ ] `/area-personal` shows enrolled courses with % complete and a resume link
- [ ] `pnpm test` + `pnpm build` green

## Phase 5 — Content

| Task | Tag | Status | Owner | PR |
|------|-----|--------|-------|----|
| [00 Authoring guide + budget](phase-5-content/00-authoring-guide.md) | `COURSE-P5-00` | ⬜ | _tbd_ | |
| [01 Block 0 — Fundamentos de NLP](phase-5-content/01-block-0-fundamentos.md) | `COURSE-P5-01` | ⬜ | _tbd_ | |
| [02 Block 1 — Perceptrón Multicapa](phase-5-content/02-block-1-mlp.md) | `COURSE-P5-02` | ⬜ | _tbd_ | |
| [03 Block 2 — Redes Recurrentes](phase-5-content/03-block-2-rnn.md) | `COURSE-P5-03` | ⬜ | _tbd_ | |
| [04 Block 3 — El Puente hacia la Atención](phase-5-content/04-block-3-atencion.md) | `COURSE-P5-04` | ⬜ | _tbd_ | |
| [05 Block 4 — El Transformer](phase-5-content/05-block-4-transformer.md) | `COURSE-P5-05` | ⬜ | _tbd_ | |

**Exit criteria**
- [ ] All five blocks published (`draft: false`), prerequisites stated on the landing page
- [ ] Every lesson within the P5-00 budget
- [ ] Content lint green in CI

## Phase 6 — Launch

| Task | Tag | Status | Owner | PR |
|------|-----|--------|-------|----|
| [01 SEO: JSON-LD, sitemap, hreflang](phase-6-launch/01-seo.md) | `COURSE-P6-01` | ⬜ | _tbd_ | |
| [02 Waitlist launch email](phase-6-launch/02-waitlist-email.md) | `COURSE-P6-02` | ⬜ | _tbd_ | |
| [03 Publication gate flip](phase-6-launch/03-publication-gate.md) | `COURSE-P6-03` | ⬜ | _tbd_ | |

**Exit criteria**
- [ ] Sitemap lists every published lesson; **no `en` hreflang alternate is emitted while English content does not exist**
- [ ] `Course` + `LearningResource` JSON-LD validates
- [ ] Waitlist email sent to `subscriptions WHERE type = 'courses'`, bilingual per `users.locale`
- [ ] Navbar/Footer "Cursos" links to `/cursos`; ComingSoonModal no longer reachable for courses (blog untouched)

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
  `list*` because it is a draft. Block 0 is declared in the manifest so it validates.
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

**COURSE-P2-02** — Closed. All eight Block 0/1 explorables landed: NLP
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

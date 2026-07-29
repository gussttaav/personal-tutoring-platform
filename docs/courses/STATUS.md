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
- [ ] **Walking skeleton:** lesson 1 of Block 0 is complete — prose + display math + one explorable + one NumPy cell + one quiz — and reads correctly on a phone
- [ ] `pnpm test` + `pnpm build` green

## Phase 4 — Persistence

| Task | Tag | Status | Owner | PR |
|------|-----|--------|-------|----|
| [01 Schema + repository + service](phase-4-persistence/01-schema-and-service.md) | `COURSE-P4-01` | ✅ | _tbd_ | local |
| [02 Progress API + reader wiring](phase-4-persistence/02-progress-api.md) | `COURSE-P4-02` | ✅ | _tbd_ | local |
| [03 "Mis cursos" panel](phase-4-persistence/03-mis-cursos-panel.md) | `COURSE-P4-03` | ⬜ | _tbd_ | |

**Exit criteria**
- [x] Migration `0016` applied; deny-anon RLS present on all three tables per the `0007` pattern
- [x] `CourseService` tested against in-memory fakes; zero infrastructure imports
- [x] Completing a lesson survives a refresh and a different device — refresh proven by E2E against the real DB; cross-device follows from the same server-side read (not separately exercised)
- [x] Signed-out reading still works (progress silently not tracked)
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

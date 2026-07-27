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
| [01 Widget registry + math core](phase-2-interactivity/01-widget-registry.md) | `COURSE-P2-01` | ⬜ | _tbd_ | |
| [02 First explorables](phase-2-interactivity/02-first-explorables.md) | `COURSE-P2-02` | ⬜ | _tbd_ | |
| [03 Pyodide worker + PyCell](phase-2-interactivity/03-pyodide-cells.md) | `COURSE-P2-03` | ⬜ | _tbd_ | |

**Exit criteria**
- [ ] A widget renders from `<Explorable id="…" />` in MDX; an unknown id fails the build
- [ ] Widget math functions unit-tested with no DOM
- [ ] A NumPy snippet runs in-browser and prints output; `while True:` is killed by the timeout without freezing the tab
- [ ] Pyodide loads only after the first Run click, only on `hasCode` lessons
- [ ] `pnpm test` + `pnpm build` green

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

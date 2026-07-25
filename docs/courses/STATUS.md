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
| [03 Catalog + course landing](phase-1-foundations/03-catalog-and-landing.md) | `COURSE-P1-03` | ⬜ | _tbd_ | |
| [04 Responsive lesson reader](phase-1-foundations/04-lesson-reader.md) | `COURSE-P1-04` | ⬜ | _tbd_ | |

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

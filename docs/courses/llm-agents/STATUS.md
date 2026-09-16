# Course 2 (`llm-agents`) — Status

**Planned:** 2026-09-15
**Started:** 2026-09-16
**Legend:** ⬜ not started · 🔄 in progress · ⛔ blocked · ✅ done · 🚫 won't do

Update this file when starting, completing, or blocking a task. Block rows in Phase 1 flip to ✅
only when every lesson box in the block doc is ticked; per-lesson progress lives there.

---

## Phase 0 — Second course

| Task | Tag | Status | Owner | PR |
|------|-----|--------|-------|----|
| [01 Manifests + «soon» landing](phase-0-second-course/01-manifest-and-landing.md) | `COURSE-C2-P0-01` | ✅ | _tbd_ | local |
| [02 Cross-course `<Leccion curso=…>`](phase-0-second-course/02-cross-course-references.md) | `COURSE-C2-P0-02` | ⬜ | _tbd_ | |
| [03 The mini-GPT checkpoint + train script](phase-0-second-course/03-course-model-assets.md) | `COURSE-C2-P0-03` | ⬜ | _tbd_ | |
| [04 Authoring contract for a systems course](phase-0-second-course/04-authoring-contract.md) | `COURSE-C2-P0-04` | ⬜ | _tbd_ | |
| [05 `<RepoLink>` + companion repository](phase-0-second-course/05-terminal-lessons.md) | `COURSE-C2-P0-05` | ⬜ | _tbd_ | |

**Exit criteria**
- [x] `/cursos/llm-agents` and `/en/cursos/llm-agents` render the «soon» landing, `noindex`,
      absent from the catalog and the sitemap _(P0-01)_
- [ ] `<Leccion curso="dl-nlp" …>` links with the course named in its card; a bad slug fails the lint
- [ ] The checkpoint loads and generates in one Pyodide cell on a phone under the cap, and the
      train script reproduces it from the seed
- [ ] Shared AUTHORING §1 step 3 rewritten; `llm-agents/AUTHORING.md` + `NOTATION.md` deltas
      seeded
- [ ] `<RepoLink>` renders; the companion repository exists, empty
- [ ] `pnpm lint` + `pnpm test` + `pnpm lint:content` + `pnpm build` green; `courses-*` e2e green

## Phase 1 — Content

| Task | Tag | Status | Owner | PR |
|------|-----|--------|-------|----|
| [01 Block 1 — Del Transformer al modelo de lenguaje (9)](phase-1-content/01-block-1-modelo-de-lenguaje.md) | `COURSE-C2-P1-01` | ⬜ | _tbd_ | |
| [02 Block 2 — De predecir texto a seguir instrucciones (8)](phase-1-content/02-block-2-instrucciones.md) | `COURSE-C2-P1-02` | ⬜ | _tbd_ | |
| [03 Block 3 — Hablar con el modelo es programar (7)](phase-1-content/03-block-3-prompting.md) | `COURSE-C2-P1-03` | ⬜ | _tbd_ | |
| [04 Block 4 — El puente: de texto a acciones (7)](phase-1-content/04-block-4-acciones.md) | `COURSE-C2-P1-04` | ⬜ | _tbd_ | |
| [05 Block 5 — Un agente de programación en la terminal (9)](phase-1-content/05-block-5-agente-terminal.md) | `COURSE-C2-P1-05` | ⬜ | _tbd_ | |

**Exit criteria**
- [ ] All five blocks published; Block 1 flipped as a unit with P2-01
- [ ] Every lesson within budget; `pnpm lint:content` green in CI
- [ ] Every cell and challenge verified in the browser on a phone; every Block 5 lesson verified
      on a clean machine on both models from its tag
- [ ] Ten widgets registered, bilingual, maths unit-tested
- [ ] The Colab notebook runs from a fresh account

## Phase 2 — Launch

| Task | Tag | Status | Owner | PR |
|------|-----|--------|-------|----|
| [01 Hand-off from `dl-nlp`](phase-2-launch/01-handoff-from-dl-nlp.md) | `COURSE-C2-P2-01` | ⬜ | _tbd_ | |
| [02 «New course» announcement](phase-2-launch/02-announcement.md) | `COURSE-C2-P2-02` | ⬜ | _tbd_ | |

**Exit criteria**
- [ ] `dl-nlp`'s last bridge and landing point at `llm-agents`; `/cursos` in prerequisite order
- [ ] `launch:llm-agents` sent once, both locales, after a dry run

---

## Deviations

**COURSE-C2-P0-01** — Closed. Both manifests, the `noindex` fix on the lesson-less landing and
the `catalog-view` unit case landed. Deviations from the task doc:
- **The empty syllabus does NOT list the five block titles.** The acceptance line asks for an
  "empty syllabus with the five block titles", but `SyllabusAccordion` (P1-03) omits every
  block with zero published lessons by design ("never rendered empty-but-present") and shows
  the `courses.landing.syllabus.empty` line instead — so today both landings read "El temario
  detallado se publicará muy pronto." / "The detailed syllabus will be published soon." The
  component is not in the task's Files-affected list, so it was left alone; listing the blocks
  before any lesson exists would be a landing-component change on both courses, a separate
  decision.
- **The English manifest drops the "¿Está en inglés?" FAQ**, following dl-nlp's `course.en.yml`
  precedent: the question answers itself on the English page, and `ContentLanguageNotice`
  already says which language the lessons are in once they exist. The other seven entries are
  translated one-for-one; block titles use Title Case like dl-nlp's English twin.
- **The optional second `heroMotif` landed as `agent-loop`** (follow-up commit): the same
  8×8 tile grid as `attention-matrix` — a ring of 20 tiles whose opacity ramps clockwise
  (the loop in motion) around a 2×2 core with a brighter diagonal (the model), inside a faint
  frame. `HeroMotif` now renders any motif from a `Tile[]`; `attention-matrix` output is
  unchanged. Enum extended in `CourseHeroMotif` + `CourseManifestSchema`; both manifests set it.
- **JSON-LD verified by inspection, not by the Rich Results test:** the prerendered
  `<script type="application/ld+json">` on both lesson-less landings parses, carries the same
  twelve keys as dl-nlp's (which already validates) with no empty value, and has no
  lesson-dependent field at all (`CourseStructuredData` never emits `hasPart`), so nothing
  changed there.
- **`robots` predicate:** `getCatalogEntry(slug, locale) !== null`, exactly the selector the
  catalog and the sitemap use — `available` (from `courseLocales`) is empty in the same case,
  so the page also carries no hreflang alternates, only its own canonical (the same
  noindex + canonical pairing the untranslated lesson route uses). Prerendered output checked:
  `noindex, follow` on `/cursos/llm-agents` and `/en/cursos/llm-agents`; dl-nlp's two landings
  still `index, follow`; `sitemap.xml` has zero `llm-agents` entries; `/cursos` and `/en/cursos`
  render one card each. The `/api/courses/search-index/llm-agents/{es,en}` params are
  generated and answer `{"error":"not_found"}` — pre-existing behaviour for any lesson-less
  manifest.
- **e2e:** `courses-navigation` (7) and `courses-search` (9) pass against the production build;
  the 3 signed-in `courses-progress` tests fail on `loginAs → 404` because the local `pnpm start`
  server has no `E2E_MODE=true` (the test-auth route is env-gated) — environmental, unrelated.
- **Dev gotcha:** a `pnpm dev` started against the pre-existing Turbopack persistent cache
  (`.next/dev/cache/turbopack/`) answered 404 on `/cursos/llm-agents` even with both manifests on
  disk (the warm route ran with a registry that predated them). `rm -rf .next/dev` and restart
  fixed it; the production build never had the problem. Expect the same on any machine that
  last ran `next dev` before this directory existed.
- Committed on `course/llm-agents-plan`, no PR yet (**local**).

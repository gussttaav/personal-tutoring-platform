# Course 2 (`llm-agents`) — Status

**Planned:** 2026-09-15
**Started:** —
**Legend:** ⬜ not started · 🔄 in progress · ⛔ blocked · ✅ done · 🚫 won't do

Update this file when starting, completing, or blocking a task. Block rows in Phase 1 flip to ✅
only when every lesson box in the block doc is ticked; per-lesson progress lives there.

---

## Phase 0 — Second course

| Task | Tag | Status | Owner | PR |
|------|-----|--------|-------|----|
| [01 Manifests + «soon» landing](phase-0-second-course/01-manifest-and-landing.md) | `COURSE-C2-P0-01` | ⬜ | _tbd_ | |
| [02 Cross-course `<Leccion curso=…>`](phase-0-second-course/02-cross-course-references.md) | `COURSE-C2-P0-02` | ⬜ | _tbd_ | |
| [03 The mini-GPT checkpoint + train script](phase-0-second-course/03-course-model-assets.md) | `COURSE-C2-P0-03` | ⬜ | _tbd_ | |
| [04 Authoring contract for a systems course](phase-0-second-course/04-authoring-contract.md) | `COURSE-C2-P0-04` | ⬜ | _tbd_ | |
| [05 `<RepoLink>` + companion repository](phase-0-second-course/05-terminal-lessons.md) | `COURSE-C2-P0-05` | ⬜ | _tbd_ | |

**Exit criteria**
- [ ] `/cursos/llm-agents` and `/en/cursos/llm-agents` render the «soon» landing, `noindex`,
      absent from the catalog and the sitemap
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

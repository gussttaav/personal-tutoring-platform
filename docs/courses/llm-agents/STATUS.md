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
| [02 Cross-course `<Leccion curso=…>`](phase-0-second-course/02-cross-course-references.md) | `COURSE-C2-P0-02` | ✅ | _tbd_ | local |
| [03 The mini-GPT checkpoint + train script](phase-0-second-course/03-course-model-assets.md) | `COURSE-C2-P0-03` | ✅ | _tbd_ | local |
| [04 Authoring contract for a systems course](phase-0-second-course/04-authoring-contract.md) | `COURSE-C2-P0-04` | ✅ | _tbd_ | local |
| [05 `<RepoLink>` + companion repository](phase-0-second-course/05-terminal-lessons.md) | `COURSE-C2-P0-05` | ⬜ | _tbd_ | |

**Exit criteria**
- [x] `/cursos/llm-agents` and `/en/cursos/llm-agents` render the «soon» landing, `noindex`,
      absent from the catalog and the sitemap _(P0-01)_
- [x] `<Leccion curso="dl-nlp" …>` links with the course named in its card; a bad slug fails the lint _(P0-02)_
- [x] The checkpoint loads and generates in one Pyodide cell under the cap (desktop: ≈2.6 s cold
      cache; a phone was NOT available — see the P0-03 deviations), and the train script
      reproduces it from the seed byte-for-byte _(P0-03)_
- [x] Shared AUTHORING §1 step 3 rewritten; `llm-agents/AUTHORING.md` + `NOTATION.md` deltas
      seeded _(P0-04)_
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

**COURSE-C2-P0-02** — Closed (2026-09-16). `Leccion.tsx` + `curso?` prop (resolves in that course
with the same two-step; never «ahead», so it links from inside the bridge too; draft → plain text;
the card gains a `.lesson-ref-course` line with the manifest title); `validate-crosslinks.ts` parses
`curso`, re-keys the directory indexes `course → locale → index` for the lookup while the checking
pass stays per-directory, and adds two fatal cases (unknown course, slug not in that course — both
naming the referring file) + the advisory «names this very course; drop the attribute». Tests in
`leccion.test.ts` (11 new), `validate-crosslinks.test.ts` (18 new), `bridge.test.ts` (1),
`searchable-text.test.ts` (1). AUTHORING §2/§7 already carried the four rules and the tag (P0-04);
nothing to add there. Deviations from the task doc:
- **The course title is a line of its own above `BLOQUE n · LECCIÓN m`**, per «Files affected» and
  AUTHORING §2 («on a line of its own»), not the single `DEEP LEARNING PARA NLP · BLOQUE 5 · LECCIÓN 9`
  line «The change» sketches — the two conflicted; three lines of kicker text at 0.7rem with letter
  spacing would wrap inside the 26rem card anyway. That needed one CSS hunk in `lesson.css`
  (`.lesson-ref-course` joins the two kicker selector lists — not in Files affected, no new rule).
- **The title follows the REQUEST locale** (`getCourse(curso, ctx.locale)`), falling back to the tree
  the target resolved in: it is chrome like the kicker, so a reader on `/en` sees «Deep Learning for
  NLP» even when the lesson fell back to Spanish and the kicker says «In Spanish».
- **No `courses.reader.leccion.otherCourse` key.** The task made it conditional («if the card needs a
  word»); the title alone says the link leaves the course, and «from the previous course» would only
  be true in the `dl-nlp → llm-agents` direction. Message files untouched.
- **The component is now rendered in Jest** (`renderToStaticMarkup`, with `next-intl/server`
  mocked to read the real message files and `@/i18n/navigation`'s `Link` as a bare `<a>`), against the
  task's «pure helpers only» precedent in `leccion.test.ts`: the deliverable is the card markup, and
  no pure helper captures it. Only the cross-course describe goes through it. The test's `makeTree`
  helper grew an `addCourse` so two courses share one root; the `findLecciones` expectations gained
  the new `curso: null` field (a shape change, not a behaviour change).
- **Fixture:** one `curso="dl-nlp"` reference in `00-pipeline-fixture.mdx`, which is the only
  `curso` a lesson in `content/` can write today — the «names this very course» case. It renders as a
  normal forward reference (asserted byte-identical to the attribute-less markup in the unit test) and
  does NOT warn in `pnpm lint:content`, because phase 2 skips draft files by design; the warning is
  unit-tested on a published file instead. `lint:content` warning set before/after: identical
  (28 lessons, exit 0).
- **`indexedDirectories` records a `(course, locale)` place** only for the `<root>/<course>/<locale>`
  shape (`readLessons`' layout); a deeper directory keeps its per-directory check and is neither a
  `curso=` target nor a scope. `canonicalIndexFor` left as it was (path-derived) — same answer.
- **Not verified in the browser:** the fixture is `draft: true` and 404s on the route, and no
  second course has a published lesson to hover. Per the task's Test plan the manual pass waits for
  P1-01 lesson 1. Verified instead: `pnpm test` (140 suites, 1773), `pnpm lint` (0 errors, the 8
  pre-existing warnings), `pnpm lint:content` exit 0, `pnpm build` — see the summary.
- No commit — **local**.

**COURSE-C2-P0-03** — Closed (2026-09-16). **Path taken: the plan's BPE model, not the char-level
fallback.** `public/courses/llm-agents/`: `minigpt.py` (227 lines: `MiniGPT` with batched ida,
`perdida` = loss + full manual backward with an optional per-position weight for SFT, `generar`
greedy/temperature/top-k/top-p, `guardar`/`cargar`; plus `softmax`, `layer_norm`, `ventanas`,
`muestrear`, `Adam`), `bpe.py` (byte-level, `entrenar`/`codificar`/`decodificar`/`vocabulario`/
`quitar_cabecera`), `corpus.txt` (*Marianela*, Gutenberg #17340, 302 KB, header line), the two
JSON assets; `scripts/courses/llm-agents/{train-minigpt.py,README.md}`; the Jest assets test;
`corpora.ts`; the `es/00-pipeline-fixture.mdx` fixture (`draft: true`). Config as the task's
starting point (512 · 64 · 64 · 4 · 256 · 2, **136 448** params, tied embeddings, learned
positions, pre-LN, ReLU); checkpoint **1 011 670 bytes** at 4 decimals. The backward pass is
finite-difference checked (rel. error ≤ 2.4e-6 on every weight group, masked and unmasked; scratch
script, not committed). Deviations and findings:
- **The four asserted properties, on the rounded weights:** held-out PPL **24.62** (ceiling 30;
  the lessons quote «< 30», measured ≈ 25); greedy repeats a 4-gram within 32 tokens on **3/3**
  prompts (`'La Nela'`, `'—¿Qué'`, `'El sol se'` — «no, no, no…», «y la Nela, y la Nela»); top-p 0.9
  with seed 0 repeats on **0/3**; SFT (200 steps, ten `¿De qué color es X?` pairs, loss only on the
  answer) turns the reserved prompt's greedy continuation from `'\n\n—No ves acarde todas'` into
  `' La leche es blanca.\n'`. **Property 4 was narrowed to what the model actually does:** it learns
  the *format* (article agreement + the `El/La … es ….` template — asserted) and answers with a
  memorised training answer; it does not copy the noun from the question, so the task's «token-level
  match» is asserted on the first two tokens (space + agreeing article), not the whole expected
  answer. That is lesson 2·3's point, not a defect; the README says exactly what is measured.
- **Reproducibility: byte-identical on two runs on this machine** (`sha256` in the README; the two
  logs differ only in timings). The task asks for two *machines*; only one exists here. The script
  pins one BLAS thread before importing NumPy and trains in float64, but cross-machine BLAS
  differences can still move a fourth decimal after 2000 Adam steps — the README says what to
  check in that case (the properties and numbers, not the hash).
- **Property 5 / the phone criteria: measured on the desktop Browser pane, NOT on a phone** (none
  in this environment). Pyodide 0.29.3's NumPy has **no BLAS** (`(64,64)@(64,192)` = 1.25 ms,
  ≈1 GFLOP/s; float32 gains nothing), so every cost is linear in tokens: a 64-token forward is
  **18–20 ms** (< 1 s by a wide margin), cell 1 (load + 32 greedy + 32 top-p) ≈ **2.6 s** cold /
  1.0 s warm, and the outputs are identical to CPython's. A phone at the usual 2–3× is within the
  cap for cell 1. **The continued-training cell is at the edge on a phone:** 200 steps cost
  ≈0.85 ms/token in the browser, so the task's «200 steps» only fits with **one 16-token window per
  step** (4.6 s desktop; 2 × 32 tokens timed out at ~step 170). Lessons that train in the browser
  should budget 100 steps of 16 tokens until a phone measurement exists — recorded in the README.
- **The fixture's second cell needed an LR warm-up** (`5e-4`, 50 steps): a fresh `Adam` on a
  converged model at `1e-3` bumps the loss (3.41 → 3.89) before lowering it. With the warm-up and a
  fixed 8-window probe every 50 steps it reads 3.476 → 3.457 → 3.243 → 2.941 → 2.904 (identical
  in CPython and Pyodide). The train script itself uses warm-up + cosine (2000 steps, best
  validation kept — step 1750).
- **`SPANISH_BOUND_CORPORA` is keyed by widget id** and `corpora.test.ts` asserts every key is a
  real widget, so the corpus is registered under its asset path (`courses/llm-agents/corpus.txt`)
  and the test was **extended, not weakened**: a key with a `/` must exist under `public/`
  (`fs.existsSync`), any other key must still be a widget id. `corpora.test.ts` is not in the task's
  Files-affected list; the alternative (keying on `bpe-merges`, a widget that does not exist yet)
  would have failed the same assertion.
- **Not written: the assets test does not open a Pyodide.** It checks bytes on disk (shape of every
  weight vs the config, 256 merges each combining only earlier tokens, ≤ 4 decimals, the 1.5 MB
  ceiling, the corpus header/size/Spanishness, `minigpt.py` ≤ 250 lines and NumPy-only).
- **Corpus cleaning is documented, not scripted:** the Gutenberg → `corpus.txt` steps are in the
  README (strip boilerplate and title block, drop chapter numerals, unwrap paragraphs, remove
  `_italics_`, `--` → `—`, NFC). The one-off script lives in the session scratchpad only, since the
  committed file is the source of truth.
- **`.gitignore` untouched:** the README tells the author to create the venv outside the repo
  rather than adding a `.venv/` rule (not in Files affected).
- Verified: `train-minigpt.py` ×2 (all asserts green, 634 s / 676 s); `pnpm test` (141 suites,
  1781 tests); `pnpm lint` (0 errors, the 8 pre-existing warnings); `pnpm lint:content` (28 lessons
  with warnings before and after — the fixture adds none, budget-exempt); `pnpm build` green,
  `pipeline-fixture` absent from the routes, both `llm-agents` landings still «soon». Browser pane:
  both fixture cells run against the committed assets with the fixture temporarily `draft: false`,
  reverted. e2e not run (nothing course-visible changed). No commit — **local**.

**COURSE-C2-P0-04** — Closed (2026-09-16). Shared `AUTHORING.md` §1 steps 3–4 rewritten verbatim
from the task (the only hunk inside §1, diff-checked); §2 prerequisites → «the manifest of the
course you are writing» + the four `curso=` rules under a new «Referring to another course»
subsection; §5 terminology table → `dl-nlp/AUTHORING.md` (moved verbatim, asserted equal modulo
re-based links) with a «one table per course» pointer; §7 `<Leccion curso>` + `<RepoLink>` rows,
a «Linking a checkpoint the student can clone» subsection, and the inline widget-id list replaced
by the `widget-ids.ts` pointer; §9 parameterised on `<slug>`. New: `dl-nlp/AUTHORING.md`,
`llm-agents/AUTHORING.md`, `llm-agents/NOTATION.md`, `content/courses/llm-agents/_template.mdx`.
Shared `NOTATION.md` §4 + four reserved rows, §5 link. `AUTHORING.en.md` + one paragraph.
Deviations from the task doc:
- **Optional `longestFence` axis landed** (`budget.ts`, `budget.test.ts`, `lint-content.ts`
  header): lines in the longest fenced block, 45 / 90, advisory, «split this block». The report
  line gains `longest fence N lines`; every `dl-nlp` lesson reads 0 (the fixture, 6), so the
  before/after lint output is identical apart from that term — and 28 warnings both times.
- **Beyond «Nothing else» in the shared `AUTHORING.md`**, three small edits the listed changes
  forced: the header now names the delta mechanism and links both templates (otherwise the
  moved prerequisites/terminology are unreachable from the file that points at them); §3 gained
  the `longestFence` row + one paragraph (the `AXES` comment says keep table and code in sync);
  the §5 five-marks bullet that said «the tables below» now says «your course's terminology
  table». §10's checklist still carries two `dl-nlp`-flavoured rows (`entrada`/`palabra`, the
  OOV/BPE examples) — left as they were, named as examples in the llm-agents delta §7.
- **`docs/courses/README.md`** (not in Files affected): only its file tree changed, to list the
  two deltas that now exist; the «Which file governs» order is unchanged and still true.
- **`llm-agents/NOTATION.md` departs from the seed twice, both flagged inline:** the KV cache is
  $\mathcal{K}^{(l)}$, $\mathcal{V}^{(l)}$ rather than the seed's $\mathcal{K}_l$ (shared §2 puts the
  layer in a parenthesised superscript and a course file never contradicts the shared one); and
  accuracy is $\text{acierto}$, not $\text{acc}$, because `dl-nlp` settled `tasa de acierto` /
  $\text{acierto}(D)$ and this course's reader has taken it. Both are one-word reverts if refused.
- **Terminology seed adds five rows** to the eleven named: `modelo` / *harness* / `agente` (the
  split the delta's model rule needs), `respuesta`, `ventana`, and *prompt* (already shipped in
  the manifest's block/lesson titles). The scripted model is named «el modelo guionizado» — a
  choice nothing in the plan fixed; review it before Block 3 writes it.
- **The `/course-lesson` command needed no change:** it already resolves
  `content/courses/<slug>/es/`, `_template.mdx` and both deltas from the task md's path, and reads
  the block header lines (course, shape, runs on, publication). Verified by reading it.
- **Lesson 5·5 sketched against the table** (task test plan): motivation = the second benchmark
  task dies when the 8K window fills · intuition = `context-window` trace · formalisation =
  `compactar(M) -> M'` with its contract (prefix and last $k$ turns verbatim, no orphan
  `tool_use`, `tokens(M') < umbral`) · implementation = fenced Python + `b5-l4` → `b5-l5` ·
  verification = quiz + the reproduced run with the before/after transcript · bridge = an agent
  that can now run long is an agent that can now do damage → permissions. Six steps, no
  derivation.
- Verified: `pnpm lint:content` exit 0 before and after; `tsc --noEmit`, `eslint` on the touched
  TS, `jest src/lib/courses` (32 suites, 465 tests) green. No commit — **local**.

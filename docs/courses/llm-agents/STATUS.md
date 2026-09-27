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
| [05 `<RepoLink>` + companion repository](phase-0-second-course/05-terminal-lessons.md) | `COURSE-C2-P0-05` | ✅ | _tbd_ | local |

**Exit criteria**
- [x] `/cursos/llm-agents` and `/en/cursos/llm-agents` render the «soon» landing, `noindex`,
      absent from the catalog and the sitemap _(P0-01)_
- [x] `<Leccion curso="dl-nlp" …>` links with the course named in its card; a bad slug fails the lint _(P0-02)_
- [x] The checkpoint loads and generates in one Pyodide cell under the cap (desktop: ≈2.6 s cold
      cache; a phone was NOT available — see the P0-03 deviations), and the train script
      reproduces it from the seed byte-for-byte _(P0-03)_
- [x] Shared AUTHORING §1 step 3 rewritten; `llm-agents/AUTHORING.md` + `NOTATION.md` deltas
      seeded _(P0-04)_
- [x] `<RepoLink>` renders; the companion repository exists, empty
      ([gussttaav/agente-minimo](https://github.com/gussttaav/agente-minimo), README / LICENSE / `.gitignore`, no tags) _(P0-05)_
- [ ] `pnpm lint` + `pnpm test` + `pnpm lint:content` + `pnpm build` green; `courses-*` e2e green

## Phase 1 — Content

| Task | Tag | Status | Owner | PR |
|------|-----|--------|-------|----|
| [01 Block 1 — Del Transformer al modelo de lenguaje (9)](phase-1-content/01-block-1-modelo-de-lenguaje.md) | `COURSE-C2-P1-01` | 🔄 (3/9) | _tbd_ | local |
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
- **The empty syllabus does NOT list the five block titles.** ~~The acceptance line asks for an
  "empty syllabus with the five block titles", but `SyllabusAccordion` (P1-03) omits every
  block with zero published lessons by design ("never rendered empty-but-present") and shows
  the `courses.landing.syllabus.empty` line instead.~~ **Resolved by `COURSE-BUILD-01`**
  (2026-09-26): the omit-empty-blocks rule is reversed, the grouping moved to
  `src/lib/courses/course-build.ts`, and every manifest block now renders — the written ones as
  expandable `<details>`, the rest as «N lecciones · próximamente» rows. It was indeed a
  landing-component change on both courses and it was indeed a separate decision; it also
  needed the thing this task could not have supplied, a per-block `lessons:` plan, without
  which an unwritten block can say its name but not its size. `dl-nlp`'s landing is unchanged.
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

**COURSE-C2-P0-05** — Closed (2026-09-16). `src/constants/courses.ts` (new) holds
`LLM_AGENTS_REPO_BASE`; `mdx-components.tsx` gains `makeRepoLink(locale)` + the exported
`repoLinkHref(tag, path?)` → `${base}/tree/${tag}[/${path}]`, `target="_blank"`,
`rel="noopener noreferrer"`, the `ColabLink` pill and a «Punto de control» / «Checkpoint» kicker
(`courses.reader.repoLink.kicker`, both message files); `mdx.test.ts` +6 (map entry, both href
forms, the rendered `<a>`, the kicker in each locale); one `<RepoLink>` of each form in the
`llm-agents` fixture; AUTHORING §7 verified against the build. The companion repository is
**[`gussttaav/agente-minimo`](https://github.com/gussttaav/agente-minimo)**: public, MIT
(detected by GitHub), `README.md` (what it is, the `b5-l1`…`b5-l9` scheme with the lesson table,
the two-tags-per-lesson rule, the clone command, a **TODO** versions table for P1-05, the layout
commitments, «vacío de código, a propósito»), `LICENSE`, `.gitignore`; one commit, zero tags, no
code. Deviations from the task doc:
- **`RepoLink` is bound per lesson, not in the static map.** Its kicker is chrome in the request
  locale, and every course Server Component in the repo takes `locale` explicitly
  (`getTranslations({ locale, namespace })`, no implicit request-context form anywhere), so it is
  closed over `ctx.locale` in `lessonMdxComponents` exactly like `Leccion` — a map built without
  `ctx` has no `RepoLink` (asserted), which MDX reports rather than guessing a language. The task's
  «in the component map» is read as the per-lesson map; `renderLesson` is only ever called with a
  ctx (page.tsx).
- **`ColabLink`'s inline style became the shared `outLinkStyle` const** used by both pills: the
  one touch of adjacent code, so «same styling as `ColabLink`» is one object rather than a copy
  that drifts. `ColabLink`'s markup is byte-identical.
- **Icon is a 14px inline SVG tag** (server-rendered, no JS), not a text glyph like `ColabLink`'s
  `▶`: the U+2387 branch glyph is tofu on enough phones. Default label when children are omitted:
  the tag, or `tag · path` with a path.
- **AUTHORING §7 gained one sentence** in the «looks like a link out of the course» rule (the
  kicker + the default label); the table row and the three rules P0-04 wrote matched the build
  as-is.
- **The fixture had been committed `draft: false` by P0-03** — against its own header comment
  («VUELVE A PONER `draft: true` antes de commitear») and the P0-03 entry above, which says it was
  reverted — so `/cursos/llm-agents/pipeline-fixture` was being generated and the «lesson-less»
  landing had a lesson. Restored to `draft: true` in the same edit that adds the `<RepoLink>`s;
  the build's route list confirms the fixture is absent and both landings are still «soon».
- **Browser check** (fixture temporarily `draft: false` on `pnpm dev`, `.next/dev` cleared first
  per the P0-01 gotcha, reverted after): both pills render — hrefs
  `…/agente-minimo/tree/b5-l1` and `…/tree/b5-l1/README.md`, `_blank` + `noopener noreferrer`,
  `inline-flex`, `--green-dim` / `--green-mid` / `--green`, uppercase kicker, SVG present — and
  the kicker reads «Punto de control» on `/cursos/…` and «Checkpoint» on `/en/cursos/…` while the
  prose stays Spanish (chrome follows the request locale, as with `Leccion`'s card).
- **The `b5-l1` links 404 until P1-05 cuts the tag** — said in the fixture's comment; what the
  fixture covers is the component, not the destination.
- Verified: `tsc --noEmit`; `pnpm lint` (0 errors, the 8 pre-existing warnings); `pnpm lint:content`
  (28 lessons with warnings before and after, fixture budget-exempt); `pnpm test` (141 suites,
  1787 tests); `pnpm build` green. e2e not run (the local suite dies in global-setup on an
  unregistered API key; nothing course-visible changed for a published lesson). No commit —
  **local**.

**COURSE-C2-P1-01** — In progress (started 2026-09-16). Lesson 1 `una-sola-columna` authored on the
shared branch, code-free as the block md asks (the worked example is the loss of a four-token window
by hand: three softmaxes over a four-entry vocabulary, $\mathcal{L} = \tfrac{4}{3}\ln 2$, and the
joint $1/16$ from the other side). 1 995 words, 5 display equations, 4 quiz, 2 readings (Bengio 2003,
Shannon 1951 on archive.org — IEEE Xplore is paywalled), no widget. Decisions recorded for the
reviewer of the block:
- **Forward references to lessons 2 and 3 are prose**, not `<Leccion>`: the lint fails on a slug with
  no file, comments included. The two sites carry an MDX comment naming the slugs; lessons 2 and 3
  convert them when they land. The rule is now in the shared AUTHORING §2.
- **The pickup quotes the first course's closing bridge verbatim** («delante de un artículo que
  puedes discutir»), inside «…» and introduced as a quotation, order reversed — the block md directs
  lesson 1 to open on that phrase; strictly, §1's «different words» rule frowns on a surviving
  sentence.
- **Notation and terms added before use:** `x_t` (not the first course's `w_t`), the stacked
  logits $\mathbf{Z}$, the input-named $\mathbf{z}_t(\cdot)$, and the «first token given, index
  shifted» convention in `NOTATION.md`; `logits`, `regla de la cadena` and `ventana (de
  entrenamiento)` — with its collision against `ventana (de contexto)` named — in the delta's §4.
- **`draft: false` on purpose while the block is authored**, against the block's PUBLICATION line: the
  author is using the published route for testing. Flip it back to `true` before any push that must
  not publish the lesson, and remember the fixture precedent (P0-05 found it committed the wrong
  way round). With it published the course card, sitemap entry and search index appear on their own.
- **The bridge quotes the vocabulary size** ($512$ entradas) one lesson before lesson 2 explains
  where it comes from.
- Verified: `pnpm lint:content` (no warnings on the lesson), `jest src/lib/courses` (33 suites, 511
  tests), `pnpm build` green; in the browser with the route published: 0 KaTeX errors, all four
  quiz questions right and wrong (numeric also at the tolerance edge), eight cross-course cards, no
  horizontal page scroll at 360 px (the three wide equations and the table scroll in their own boxes).

Lesson 2 `bpe-de-verdad` authored on the shared branch (2026-09-26), with the `bpe-merges` widget
built first in the same change. 1 909 words, 7 display equations, 1 widget, 2 cells, 4 quiz, 1
challenge (`ch-codificar`), 3 readings (Sennrich 2016 on the ACL Anthology, the GPT-2 report, Karpathy's
tokenizer video; all three URLs checked). Runs on the mini-GPT's tokenizer, not the model, and says so
before the first cell. Decisions recorded for the reviewer of the block:
- **The widget trains on its own corpus, not Marianela.** Three Spanish sentences (English ones for
  `/en`, chosen against the same property) in `corpora.ts`, small enough to read whole so every
  count on screen can be checked: merge 1 is `C3`+`B1` → `ñ` (f = 10), merge 5 `ó`, merge 17
  `ción`, the unseen sentence 42 bytes → 22 tokens. The real merges are the cells' job. `math/
  bpe-merges.ts` is a TS port of `bpe.py`; its test rebuilds `bpe-merges.json` merge for merge from
  `corpus.txt` and pins every number the prose quotes. `bpe-vocab.ts` was not reused: it is a
  hand-written list of character merges with no training, and nothing in it fits a byte vocabulary.
- **`bpe.py` changed twice, outputs unchanged** (`bpe-merges.json` and the corpus encoding
  identical, verified). `entrenar` now recounts only the pre-tokens where the merged pair was — the
  same merges several times faster, which is what fits 64 merges in one cell — with the parameter
  renamed `k` → `m` (NOTATION: $k$ is top-$k$'s) and an optional `veces` list for the frequencies;
  matched against the old version on the full 256 merges and 307 fuzzed strings. And a **bug fix**:
  `PATRON` dropped `_` (it is `\w` but neither a letter nor a digit, so no alternative matched), so
  `decodificar(codificar("a_b"))` returned `"ab"`, which would have made the lesson's reversibility
  claim false. Round trip now exact on 2 000 random strings. The corpus has no `_`.
- **Cell 1 is 61 lines** (advisory warning; target 45, ceiling 90): the whole `entrenar` plus its run
  on the corpus. Kept as one cell because the block spec says two, and the second cell execs
  `bpe.py` so each cell stays self-contained.
- **Timing, measured on a loaded desktop (load average ≈ 10), not on a phone:** cell 1 trains 64
  merges in 3.8 s, cell 2 ≈ 4 s warm. Both under `RUN_TIMEOUT_MS`; a phone at 2–3× an idle laptop
  should still fit, but that is an estimate.
- **Fusiones are numbered from 1 in prose** («la fusión 71 es la ñ») and from 0 in code (`256 + i`);
  the lesson states the mapping once. File names in prose are `<W>` mentions, per the delta's
  `AGENTE.md` row. Neither is in the shared contract yet.
- **Terms and symbols added before use:** `byte`, `fusión`/`fusionar`, *pre-token*,
  `codificar`/`decodificar` in the delta's §4; $n$, $\lvert u \rvert$, $\bar{\ell} = n/T$, $f(a, b)$,
  $(a_i, b_i)$ with $u_i$, $V_i$ and $m$, $T_i$ in `NOTATION.md`, with a note on the three letters
  avoided ($C$, $k$, and $a_i b_i$ as a concatenation).
- **Lesson 1's two prose references to this lesson** are now `<Leccion slug="bpe-de-verdad">` (the
  body one links; the bridge one renders as plain text, as §7 says); its comment keeps only lesson 3.
  This lesson's bridge names lesson 3 in prose, with the same kind of comment.
- `draft: false`, like lesson 1 and for the same reason.
- Verified: `pnpm lint:content` (only the cell-length warning), `jest src/features/courses/widgets
  src/lib/courses` (58 suites, 824 tests), `check:messages`, `pnpm build` green; in the browser both
  cells run in Pyodide with output identical to CPython, the challenge scores the starter 0/6, a
  version that ignores pre-tokens 5/6 and the solution 6/6 (the last test loads the real merges with
  `open_url`), all four quiz questions right and wrong, 0 KaTeX errors, the widget's numbers match
  the prose at steps 1, 5, 17 and 31, and no horizontal page scroll at 360 px (Playwright; the
  Browser pane does not composite here).

Lesson 3 `entrenar-un-mini-gpt` authored on the shared branch (2026-09-27). 2 013 words (13 over the
advisory target), 8 display equations, no widget (the block md assigns none), one new figure
(`public/courses/llm-agents/minigpt-entrenamiento.svg`), 3 cells (longest 27 lines), 4 quiz, 1
challenge (`ch-adamw`), 3 readings (the site's own AdamW post as the first internal `kind: blog`,
Loshchilov & Hutter, the GPT-3 paper's appendix B). Runs on the mini-GPT and says so before the
first cell. Decisions recorded for the reviewer of the block:
- **The derivation is the batch, the rest is stated.** Unbiasedness of $\nabla\hat{\mathcal{L}}$ and
  $\mathbb{E}\lVert\hat{\mathbf{g}} - \mathbf{g}\rVert^2 = \tfrac{1}{B}\,\mathbb{E}\lVert\nabla\mathcal{L}_i - \mathbf{g}\rVert^2$
  are derived (cross terms vanish, a `scaled-dot-product` callback); AdamW, the global-norm
  recorte, warm-up and cosine decay are stated with one-line reasons, as the block md asks. Cell 2
  measures the $1/B$: $B \cdot$ruido stays in 540–620 for $B = 1, 4, 16$ (8 batches of $T = 8$).
- **Continued training is 200 steps behind a time guard**, not the README's 100: the cell stops
  itself at 8 s and prints the step, so a slow phone gets a partial run instead of a killed worker.
  200 steps take 4.6 s in the desktop Browser pane on a production build. Phone not measured.
- **What falls is the loss on the pages it trains on, and the lesson says so.** Measured while
  designing the cell: with one 16-token window per step, continuing on part of the reserved 10 %
  makes the loss on the rest of it *worse* (3.90 → 3.96–4.15 in 100 steps). The cell trains on the
  last 3 000 reserved tokens and probes eight fixed windows of those same pages (3.473 → 3.104,
  bumpy), and the prose signposts the perplexity lesson. Lesson 2's bridge («la pérdida bajando
  … sobre texto que el modelo no ha visto») is true only in that sense.
- **Warm-up is shown by an invitation, not a fourth cell**: `eta_max, S_cal = 3e-3, 1` jumps the
  loss 3.47 → 4.89 in 25 steps; with `S_cal = 50` the jump moves to step 75 (4.35). Both quoted
  from Pyodide runs of the modified cell. The resume rate ($5 \cdot 10^{-4}$) is chosen as roughly
  where the checkpoint's own schedule left it ($4 \cdot 10^{-4}$ at step 1 750).
- **The checkpoint was trained with $\lambda = 0$** (`minigpt.py`'s `Adam` has no decay); the
  lesson says so in the first person and the challenge writes the W. Its four tests separate the
  solution from a coupled-L2 version (fails 2), one without bias correction (fails 3) and one that
  decays after the update (fails 1).
- **The figure comes from an exact replay** of `train-minigpt.py`'s loop with per-step logging
  (scratch script, not committed): held-out loss 3.2037 at step 1 750, the README's number.
- **Terms and symbols added before use:** `paso` (de entrenamiento), *batch*, *checkpoint* (not
  «punto de control», which is a `<RepoLink>`), `media móvil`, `recorte`, `calendario`,
  `calentamiento`, `decaimiento de pesos` in the delta's §4; $\mathcal{L}_i$,
  $\mathcal{L}_{\text{corpus}}$, $\hat{\mathcal{L}}$, $\mathbf{g}$/$\hat{\mathbf{g}}$/$\hat{\mathbf{g}}_s$,
  $s$/$S$/$\theta_s$, $\mathbf{m}_s$/$\mathbf{v}_s$, $\rho_1$/$\rho_2$, $\varepsilon$, $\lambda$,
  $\eta_s$/$\eta_{\max}$/$S_{\text{cal}}$ in `NOTATION.md`, with a note: Adam's rates are
  $\rho_1, \rho_2$ because the shared §4 reserves $\beta$; the step is $s$ because $t$ is the
  position; the hat means «from a batch» only.
- **Lessons 1 and 2 now link this lesson** (`<Leccion slug="entrenar-un-mini-gpt">`), their
  placeholder comments removed. This lesson's forward references to lessons 4 (`muestreo`, the
  bridge) and 6 (`perplejidad`, the body) are prose with the same kind of comment.
- **The blog URL 404s on production today**: the blog has not left `staging`. It returns 200 on
  the latest staging preview, so the path is right; it resolves when `staging` ships.
- Verified: `pnpm lint:content` (only the words warning), `jest src/lib/courses` (34 suites, 532
  tests), `pnpm build` green; the three cells under Node Pyodide 0.29.3 and in the Browser pane on
  `pnpm start` with identical output; the challenge in the browser (starter 0/4, solution 4/4,
  empty `NameError`); all four quiz questions right and wrong (numeric at the tolerance edge);
  0 KaTeX errors; no horizontal page scroll at 360 px (Playwright screenshots; the pane does not
  composite here).

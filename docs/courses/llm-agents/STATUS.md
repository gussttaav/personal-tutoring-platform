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
| [01 Block 1 — Del Transformer al modelo de lenguaje (9)](phase-1-content/01-block-1-modelo-de-lenguaje.md) | `COURSE-C2-P1-01` | ✅ (9/9) | _tbd_ | local |
| [02 Block 2 — De predecir texto a seguir instrucciones (8)](phase-1-content/02-block-2-instrucciones.md) | `COURSE-C2-P1-02` | 🔄 (1/8) | _tbd_ | |
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

**COURSE-C2-P1-01** — Closed (2026-09-29; started 2026-09-16). Lesson 1 `una-sola-columna` authored on the
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

Lesson 4 `muestreo` authored on the shared branch (2026-09-27), with the `sampling-explorer` widget
built first in the same change. 2 115 words (115 over the advisory target), 7 display equations,
1 widget, 2 cells (longest 42 lines), 5 quiz, 1 challenge (`ch-nucleo`), 2 readings (Holtzman et
al. 2020, Fan et al. 2018; both URLs checked). Runs on the mini-GPT and says so before the first
cell. Decisions recorded for the reviewer of the block:
- **Two frozen vectors, not one.** The block md asks for «one fixed logit vector»; the widget
  carries two, both the checkpoint's own (`adelante` on «La Nela» and «La Nela bajó la cabe»,
  generated by `scripts/courses/llm-agents/sampling-presets.py` into `math/sampling-presets.ts`).
  Top-k's defect is only visible across two shapes: $k = 10$ discards half the mass of the first
  (nucleus 44) and keeps nine junk entries in the second (nucleus 1). `sampling.test.ts` asserts
  every number cell 1 prints for both, from Pyodide.
- **`math/sampling.ts` is `muestrear` split into the lesson's pieces** (tempered softmax, rank
  order, top-k set, nucleus size, `restrict`) so Block 3's `logit-mask` can reuse `restrict` with a
  grammar's allowed set. It follows `minigpt.py`'s conventions (top-p on the tempered mass, crossing
  entry kept, top-k then top-p = intersection) except top-k ties, broken by id; stated in its header.
- **The greedy cycle is a 30 % bet, not a confident one.** Measured: in the «La Nela» run the
  checkpoint gives ` no` 0.30 and `,` 0.24 at every turn, flat; in the «—¿Qué» run ` no` rises
  0.18 → 0.31 and then stays, a weak form of the self-reinforcement Holtzman reports for GPT-2
  (where it nears 1). The argument is therefore the fixed point of argmax (deterministic map on the
  last 64 tokens; once they are all cycle, the state recurs), and «argmax sees the rank, not the
  size»; the weak rise gets one paragraph, printed by cell 1, and the lesson says the argument does
  not need it. The «high-probability» half of Holtzman survives relative to real text: those 20
  tokens cost the model 1.26 nats each, the novel's held-out text 3.2, so the cycle is *more*
  probable than Galdós. The block md's bullet was reworded to say so (reviewed and approved).
- **Pure sampling's cost is measured, not asserted**: cell 2 counts generated words that exist in
  the novel (voraz 38/39 but 3/3 repeat; τ = 1 54/70; top-p 0.9 59/73; the invitation's τ = 1.5
  49/70 and τ = 0.5 78/83 with 2/6 repeating), 2 seeds × 3 prompts, with a time guard at 8 s. A
  20-seed CPython run (scratch, not committed) gives the same ordering (0.76 / 0.83 / 0.58 / 0.94);
  the lesson says six continuations separate the extremes, not close rules.
- **Terms and symbols added before use:** `muestrear`/`sorteo`, `generación voraz` (not
  «decodificación», which is `decodificar`'s), `favorita`, `corte` (not `recorte`, the
  gradient's), `núcleo`, `renormalizar`, `masa`, `cola`, `ciclo` (not `bucle`, which is code) in
  the delta's §4; $\mathbf{z}$, $\mathbf{q}$, $v^{\star}$, $q_{(i)}$, $M_j$, $k_p$,
  $\tilde{\mathbf{q}}$ in `NOTATION.md`, with a note: $p$ alone is top-p's threshold, the sampling
  distribution is $\mathbf{q}$ because it is not $p_\theta$ away from $\tau = 1$, and a
  parenthesised subscript is a rank.
- **Lesson 3's bridge now links this lesson**; this lesson's bridge names lesson 5 (`kv-cache`) in
  prose with the usual comment. `draft: false`, as lessons 1–3, against the PUBLICATION line.
- Verified: `pnpm lint:content` (only the words warning), `jest src/features/courses
  src/lib/courses` (69 suites, 959 tests), `pnpm check:messages`, `pnpm build` green; both cells
  under Node Pyodide 0.29.3 and in the Browser pane on `pnpm start` with identical output (cell 2
  ≈ 2.7 s in the pane); every widget state the prose quotes read back from the page; the challenge
  (starter «falta el return», solution 4/4, empty `NameError`, and three wrong variants each
  caught with its message); all five quiz questions right and wrong, numeric at the tolerance
  edges; 0 KaTeX errors; no horizontal page scroll at 360 px (Playwright screenshots).

Lesson 5 `kv-cache` authored on the shared branch (2026-09-27), with the `kv-cache` widget built
first in the same change. 2 013 words (13 over the advisory target), 7 display equations, 1 widget,
2 cells (longest 45 lines), 5 quiz, 1 challenge (`ch-atiende`), 3 readings (Shazeer 2019, Ainslie
et al. 2023, Pope et al. 2022; URLs, titles and authors checked). Runs on the mini-GPT and says so
before the first cell. Decisions recorded for the reviewer of the block:
- **The cost identity is exact and covers both terms.** The block md states the attention term
  only ($O(td)$ vs $O(t^2 d)$ per step). The lesson counts matrix-product multiplications, the first
  course's unit, and derives that without the cache the token at $t$ costs exactly $t\,c(t)$, with
  $c(t) = c_{\text{fila}} + 2Lt \cdot d_{\text{model}}$ — matrices and attention both multiplied by
  $t$, because `adelante` computes the full $t \times t$ grid and masks it. $c_{\text{fila}}$ is one
  multiplication per matrix weight (131 072 of the 136 448 parameters). In the mini-GPT the
  attention only matches the matrices at $t = 512$, eight times $T_{\text{ctx}}$, so its cached cost
  is nearly flat (+12 % over the window); the $O(T^2 d)$ vs $O(T^3 d)$ totals are derived and named.
- **The clock does not match the count, and the lesson says why.** Counted, token 64 is 64× dearer
  without the cache; measured in the browser, ~10× (12 → 65 ms without, 5–9 ms with). The gap is a
  fixed cost per pass (dozens of small NumPy ops); 64 rows in one pass cost ~1 ms per row, one row
  alone ~6. The lesson uses it for the prefill/generation asymmetry (on a GPU the fixed part is
  reading the weights). Timings are quoted approximately; the student's will differ.
- **The cache cannot slide past $T_{\text{ctx}}$.** The mini-GPT's positions are a learned table
  of 64 rows, so when `generar` slides the window every stored key and value changes. The lesson
  states it (and says which `ventana` is which) and invites changing 64 → 65 in cell 1, which
  raises `IndexError` on `P[64]`. The block md's «Notes / gotchas» now carries this and the
  clock-vs-count mismatch below.
- **Cell 1 checks exactness at 8 positions, not 62**, and no cell times a full no-cache
  generation: together they took ~4 s warm in the browser, too close to the 10 s cap on a slower
  phone. Now ~2.1 s and ~1.5 s warm. Max logit difference 4.4e-15.
- **The cell's function is `avanzar`, not `paso`** (`paso` is the training step here and the first
  course's model function); `llenar` is the prefill, pulling K and V out of `adelante`'s backward
  cache.
- **Widget:** `kv-cache` draws the text (the checkpoint's own 64 tokens, generated by
  `scripts/courses/llm-agents/kv-cache-presets.py` into `math/kv-cache-presets.ts`), the cache as a
  4 × 64 grid (computed / read / not there yet), and c(t) vs t·c(t) on one linear axis, with the
  numbers at t. `math/kv-cache.ts` is tested against a product-by-product recount of `adelante`
  and of the lesson's cached step, and against every number the prose quotes. Tall on a phone
  (~865 px at 360 px); future tokens are dashed empty slots, so it never reflows.
- **Terms and symbols added before use:** `caché` (de claves y valores) and *prefill* in the
  delta's §4; $\mathbf{q}_t$, $\mathbf{k}_t$, $\mathbf{v}_t$, per-head $\mathbf{K}$, $\mathbf{V}$,
  $c_{\text{fila}}$, $c(t)$ in `NOTATION.md`, with a note: the query keeps its position because
  lesson 4 spent the bare $\mathbf{q}$ on the sampler. The Block 3 $\mathbf{q}$ note now says so too.
- **Lesson 4's bridge now links this lesson**; this lesson's bridge names lesson 6 (`perplejidad`)
  in prose with the usual comment. `draft: false`, as lessons 1–4, against the PUBLICATION line.
- Verified: `pnpm lint:content` (only the words warning), `jest src/features/courses
  src/lib/courses` (70 suites, 972 tests), `pnpm check:messages`, eslint on the touched files,
  `pnpm build` green (0 KaTeX errors); both cells under Node Pyodide 0.29.3 and in the Browser pane
  on `pnpm dev` with identical output; the challenge (starter 0/4, solution 4/4, empty `NameError`,
  five wrong variants each caught with its message); all five quiz questions right and wrong,
  numeric at the tolerance edges; no horizontal page scroll at 360 px (Playwright screenshots).
  `tsc` reports one pre-existing error in `src/lib/courses/__tests__/mdx.test.ts` (`RepoLink`),
  unchanged by this lesson.

Lesson 6 `perplejidad` authored on the shared branch (2026-09-28). 2 082 words (82 over the
advisory target), 5 display equations, no widget (the block md assigns none), 3 cells (longest 29
lines), 4 quiz, no challenge, 3 readings (Jurafsky & Martin ch. 3, The Pile, Delétang et al. 2024;
URLs checked). Runs on the mini-GPT and says so before the first cell; cell 1 uses only the
tokenizer and says that too. Decisions recorded for the reviewer of the block:
- **The opening is a measured coincidence.** A unigram model over bytes (no merges) pays 3.200
  nats per token on the reserved text, the mini-GPT's 3.2; the lesson resolves it with bits per
  byte ($\text{bpb} = \mathcal{L}/(\bar{\ell}\ln 2)$): 4.62 against 2.16. Cell 1 shows the same
  inversion on one model across tokenizers: the unigram's per-token perplexity rises 24.5 → 81.9 →
  204.3 with 0, 64 and 256 merges while its bpb falls 4.62 → 4.02 → 3.58.
- **Three cells, not the block md's two** (table updated). The third keeps lesson 3's body
  promise («si eso es aprender español o aprenderse esas páginas lo mide la lección sobre
  perplejidad»): lesson 3's loop, 100 steps on the last 3 000 reserved tokens, measured before and
  after on those pages (3.595 → 3.240) and on the rest of the reserved text (3.030 → 3.095). The
  signs hold for all 12 training seeds tried (pages −0.21 to −0.36, rest +0.02 to +0.09), which is
  what the lesson's «cambia la semilla» invitation claims.
- **Laplace smoothing is forced by the data**: the reserved text has 10 tokens the training part
  never has (the digits 1, 2, 6, 7, 8 and the second byte of «Í», from an inscription and the
  novel's closing date), so without the $+1$ every unigram loss is `inf`. The prose says «una
  inscripción» and does not say whose.
- **Held-out vs training is derived**, as a chain of expectations over which text falls in each
  part:
  $\mathbb{E}[\mathcal{L}_{\text{corpus}}(\theta_{\text{corpus}})] \le \bar{\mathcal{L}}(\theta^{\star}) \le \mathbb{E}[\mathcal{L}_{\text{res}}(\theta_{\text{corpus}})]$.
  Three caveats are stated: the checkpoint is not the minimiser; the reserved text is the end of
  the novel, not a random sample; and it is not clean (it chose the checkpoint among eight
  candidates, and the BPE merges were counted on the whole novel). That is why the lesson names a
  third split, **prueba**. The unigram model's optimality among context-free models (Gibbs, via
  $\log y \le y - 1$) is in a `<Details>`; entropy is not named.
- **The model's numbers are a sample**: 32 windows of 64 tokens per part (3.182 reserved, 2.556
  training, gap 0.63; the unigram's gap 0.014). The prose quotes the training script's full-text
  3.204 beside it.
- **Terms and symbols added before use:** `texto reservado` (with *prueba* as a third split),
  `perplejidad`, `nat`/`bit`, `bits por byte`, `modelo de unigramas`, `suavizado de Laplace` in the
  delta's §4; $\text{bpb}$, $f(v)$, $p_{\text{uni}}$, $\mathcal{L}_{\text{res}}$,
  $\bar{\mathcal{L}}$, $\theta_{\text{corpus}}$, $\theta^{\star}$ in `NOTATION.md`, with a note: the
  minimiser is not $\hat{\theta}$ (the hat is «from a batch»), a frequency is $f$ and never $c$
  (lesson 5's cost), and a context-free model is written $p_\theta(v)$ rather than with a new
  vector letter.
- **Lessons 3 and 5 now link this lesson**, their placeholder comments removed. This lesson's bridge
  names lesson 7 (`leyes-de-escala`) in prose with the usual comment. `draft: false`, as lessons
  1–5, against the PUBLICATION line.
- **A grader edge, not a lesson defect:** a numeric answer exactly at the tolerance can fail on one
  side from floating-point error (9.41 against 9.46 ± 0.05: the difference is
  0.05000000000000071). `src/lib/courses/quiz/grade.ts` is unchanged; flagged as its own task.
- Verified: `pnpm lint:content` (only the words warning), `jest src/lib/courses` (34 suites, 532
  tests), `pnpm build` green (0 KaTeX errors); the three cells under Node Pyodide 0.29.3 and in the
  Browser pane on `pnpm start` with identical output (≈2.2 s, 1.7 s and 2.7 s warm); both
  invitations (no $+1$ gives `inf`; other seeds keep the signs); all four quiz questions right and
  wrong; no horizontal page scroll at 360 px (Playwright; the four wide equations scroll in their
  own boxes).

Lesson 7 `leyes-de-escala` authored on the shared branch (2026-09-28), with the `scaling-laws` widget
built first in the same change. 2 174 words (advisory over the 2 000 target, like lessons 3–6), 9
display equations (2 of them inside a `<Details>`), 1 widget, 1 cell (32 lines), 5 quiz, no
challenge, 5 readings (Kaplan et al. 2020, Hoffmann et al. 2022, Besiroglu et al. 2024, Pearce & Song
2024, Muennighoff et al. 2023; titles, authors and venues checked on arXiv). It runs on the mini-GPT's
*numbers* only (N, steps, batch) and says so before the cell; nothing is loaded. Decisions recorded
for the reviewer of the block:
- **The regression is on Chinchilla's Table 3**, the paper's own compute-optimal frontier (approach
  1, nine rows, 400M–10T parameters): `np.polyfit` on the logs gives exponents 0.498 / 0.502 and
  20.2–21.8 tokens per parameter over nine decades of C. That is the acceptance criterion's
  «reproduces 20:1», and the tolerance the lesson states is **10 %**. The prose says the rows are a
  summary of a fit, not nine trainings, and that the exponents adding to 1 checks nothing (OLS is
  linear and every row has log N + log D = log C − log 6). No raw Chinchilla data is published in a
  table; Epoch's reconstruction from Figure 4 has no licence, so it is not redistributed.
- **The derivation is the fixed-budget optimum**: derivative in log N of the two reducible terms →
  the balance α_N A_N N^−α_N = α_D A_D D^−α_D → N* ∝ C^{α_D/(α_N+α_D)}, D* ∝ C^{α_N/(α_N+α_D)} →
  D*/N* constant iff α_N = α_D; the full solve (the paper's eq. 4) in a `<Details>`. C ≈ 6ND is
  derived from lesson 5's c_fila (2 ops per weight forward) and the first course's backprop (two
  products back per product forward); the attention term (12 % in the mini-GPT's 64-token windows) is
  named and dropped, with Chinchilla's own «within 10 %» (its Table A4).
- **The checkpoint's own ratio**: C = 6 · 136 448 · 3 584 000 ≈ 2.93 × 10¹² FLOPs (step 1 750 × 32 ×
  64 tokens). The Table-3 line extrapolated 6.8 decades down asks ~160 000 parameters and 3.1 M tokens;
  the checkpoint has 136 448 and read 3.6 M, so **in compute it is optimal**. What it lacks is
  distinct text: 125 789 tokens read 28.5 times, ~24× short of the distinct tokens Chinchilla's D
  assumes (its footnote 2). That is the answer to lesson 6's «demasiados parámetros / demasiado poco
  texto»; Muennighoff et al. (≈4 epochs is nearly as good as new text, then decays) is cited for why
  28 epochs is not.
- **Widget: Chinchilla's approach 3 with Besiroglu et al.'s 2024 re-fit** (E 1.8172, A 482.01,
  B 2085.43, α 0.3478, β 0.3658), not the printed constants (1.69, 406.4, 410.7, 0.34, 0.28), which
  put the optimum at ~50–90 tokens per parameter and contradict the paper's 20; the test pins both.
  The re-fit puts the valley's bottom at 72 B for Gopher's budget, so Chinchilla (70 B) sits on it and
  Gopher 0.019 nats up the wall. Kaplan's three laws are drawn with his constants (N non-embedding,
  C_min converted from PF-days); Chinchilla's curve beside them, both solid over the measured ranges
  and dashed beyond. The mini-GPT has **no point on the loss view** (different tokeniser and corpus,
  lesson 6's point; quiz 5 asks it) and **a point on the frontier**, on the dashed extension. The
  frontier line is the re-fit's closed form (≈118 000 at the checkpoint's C), the cell's is Table 3's
  (≈160 000): two fits, 6.8 decades of extrapolation; the widget quotes no number there and the prose
  quotes the cell's. `math/scaling-laws.test.ts` checks the closed-form optimum against a grid search,
  the balance at the optimum, and every number the prose and widget quote.
- **Notation:** the papers' L is ℒ (L is the layer count); Chinchilla's E, A, B, α, β become
  ℒ∞, A_N, A_D, α_N, α_D (B is the batch size, β reserved, italic E beside 𝔼); the optimum is starred
  (N*, D*), not subscripted «opt»; the exponents of C are written as fractions, not the papers' a, b
  (lesson 2's pair). Rows and a note added to `NOTATION.md`; the N, D, C and α rows now say N counts
  embeddings (Chinchilla) and D counts readings.
- **Terms added before use:** `ley de potencia`, `ley de escala`, `cálculo` (FLOPs), `presupuesto`,
  `reparto óptimo`, `valle`/`fondo`, `pérdida irreducible`, `época`, `tokens distintos`.
- **Lesson 6 touched twice**: its bridge now links this lesson (placeholder comment removed), and its
  body's «Leyó cada token de esa parte más de treinta veces» is now «unas veintiocho veces» — the
  checkpoint is step 1 750, so 1 750 · 32 · 64 / 125 789 = 28.5 (30+ is the full 2 000 steps). This
  lesson's bridge names lesson 8 (`aprendizaje-en-contexto`) in prose with the usual comment.
  `draft: false`, as lessons 1–6, against the PUBLICATION line.
- **The widget's charts draw in real pixels**: each measures its box (ResizeObserver) and uses that
  width as its viewBox, so tick labels are 10.5 px at 320 px and on desktop alike, and x labels thin
  to every other decade when they would collide. A fixed 480-unit viewBox scaled to 100 % (the
  `Plot2D` pattern) put them at 6.7 px on a phone.
- Verified: `pnpm lint:content` (only the words warning), `jest src/lib/courses src/features/courses`
  (71 suites, 988 tests; `scaling-laws.test.ts` 16), `pnpm check:messages`, eslint on the touched
  files, `tsc` (only the pre-existing `mdx.test.ts` `RepoLink` error), `pnpm build` green with 0 KaTeX
  errors in both locales; the cell under Node Pyodide 0.29.3 (0.75 s) and in the Browser pane on
  `pnpm start` with identical output; both widget views, all three axes and the Gopher preset read
  back against the prose (0.839 per tenfold everywhere for Kaplan, 0.979 at 10¹¹ for Chinchilla; 72 B
  bottom, Gopher +0.019); all five quiz questions right and wrong, the numeric one at 3.92/4.08 (pass)
  and 3.85/4.15 (fail); lesson 6's bridge renders as a link here; no horizontal page scroll at 360 px.

Lesson 8 `aprendizaje-en-contexto` authored on the shared branch (2026-09-29). 2 109 words (advisory
over the 2 000 target, like lessons 4–7), 5 display equations, no widget (the block md assigns none),
2 cells (longest 35 lines), 4 quiz, no challenge, 5 readings (Brown et al. 2020, Xie et al. 2022,
Olsson et al. 2022, Min et al. 2022, Wei et al. 2023; titles and URLs checked on arXiv). Runs on the
mini-GPT, read and never trained, and says so before the first cell. Decisions recorded for the
reviewer of the block:
- **The running example is two lists over the same four words**, plural and feminine, ending on
  the same case (`hermano:`), so the whole «program» is on the right of the colons. The
  formalisation defines ICL as $p_\theta(y \mid e_{1:K}, x)$ rising with $K$ for $\theta$ fixed, then
  derives it from a model of the text (documents that each follow a latent task, Xie et al. reduced
  to i.i.d. examples): the answer is a mixture over tasks, Bayes gives the posterior, and the
  log-ratio of two tasks is prior + case + one term per example. Three readings: each example adds a
  term that is non-negative on average (lesson 6's inequality), the shared left-hand sides cancel,
  and a task with prior zero stays at zero. The network link is the same inequality on the answer:
  a network at the minimum computes the mixture without anyone writing it. Min et al. and Wei et
  al. are named as the limits of the reduced model.
- **Why the mini-GPT cannot, measured.** Cell 1: over $K = 0..4$ the log-difference hermanos −
  hermana rises in *both* lists (also the feminine one, where it should fall), never crosses zero,
  and the gap between lists shrinks 1.37 → 0.59 nats; after `hermano:` the favourite is a line break
  (0.51) and the model writes dialogue. Cell 2: 95 of the novel's 204 colons open a dialogue
  paragraph and no line has the form `palabra: palabra` (prior zero for the task, the only task it
  knows for a colon is «someone speaks»); on 64 reserved stretches of 32 tokens read twice, the loss
  stops falling after ~8 tokens of context (3.69 → 3.22 → 3.14 / 3.17) and the second reading costs
  the same (3.17 / 3.16): no copying, although two layers are enough for Olsson's induction heads.
  The block md's «lesson 7's axes» becomes $D$, $N$ and the window, the one cell 2 measures.
- **One sentence rests on a scratch measurement no cell prints**: «su texto apenas se lo pedía» —
  in 4 000 training windows, copying what followed an earlier match would predict right at ~1–2 %
  of positions. Kept qualitative in the prose.
- **Letters** (NOTATION rows + note): the task is $\omega$ (the papers' $c$ and $\theta$ are taken),
  two tasks $\omega_1$, $\omega_2$ (a prime reads as the banned transpose), the example count $K$ as
  in the GPT-3 paper ($k$ is top-k's), the text's distribution $p_{\text{texto}}$ (bare $p$ is
  top-p's threshold), and $x$ without subscript is a whole case, never on a page with $x_t$. Block
  3's task md still writes $e_{1:k}$; the NOTATION note says it reads $e_{1:K}$ (task md not edited).
- **Terms added before use:** `aprendizaje en contexto` (ICL once), `ejemplo` (zero/one/few-shot
  once), `tarea`, `caso`; $y$ is the delta's `respuesta` read for one caso.
- **Lesson 7's bridge now links this lesson** (placeholder comment removed). This lesson's bridge
  names lesson 9 (`proyecto-mini-gpt`) in prose with the usual comment, and commits it only to the
  signature `modelo(prompt) -> texto`. `draft: false`, as lessons 1–7, against the PUBLICATION line.
- The log-ratio equation is split over two lines (`aligned`): 714 → 507 px at 375 px.
- Verified: `pnpm lint:content` (only the words warning), `pnpm build` green twice with 0 KaTeX
  errors; both cells under Node Pyodide 0.29.3 (1.4 s, 1.7 s) and in the Browser pane on
  `pnpm start` with identical output; all four quiz questions right and wrong; no horizontal page
  scroll at 375 px (the five display equations scroll in their own boxes, the table fits). The pane
  carried an English locale cookie, so the check ran under `/en/` chrome (Spanish lesson text).

Lesson 9 `proyecto-mini-gpt` authored on the shared branch (2026-09-29), the block's project. 2 148
words (advisory over the 2 000 target, like lessons 3–8), 3 display equations, no widget (the block
md assigns none), 3 cells (longest 43 lines), 3 quiz, 1 challenge, 3 readings (Lundberg & Ribeiro
2023 on token healing, von Platen 2020 on generation, Ouyang et al. 2022; titles and URLs checked).
Runs on the mini-GPT, read and never trained, and says so before the first cell. Decisions recorded
for the reviewer of the block:
- **The frozen interface is a file**: `public/courses/llm-agents/modelo.py`, which the lesson's third
  cell execs into a fresh namespace and checks against the function the second cell wrote (same text,
  three seeds). Blocks 2–3 load it with one line, `exec(open_url("/courses/llm-agents/modelo.py").read())`.
  It builds on `bpe.py` and `minigpt.py` (execs them, copies nothing) and exposes a factory,
  `hacer_modelo(red, fusiones)`, so Block 2 can make a `modelo` over SFT'd weights with the same
  signature. `llm-agents-assets.test.ts` pins the signature
  `modelo(prompt, max_tokens=32, temperatura=1.0, top_p=0.9, parar=None, semilla=None)`, the factory,
  and the two precondition asserts: a change is a CI failure, not a silent break in later lessons.
- **The contract, seven clauses**: continuation only; lesson 4's sampler (`temperatura=0` voraz,
  `top_p=None` no cut); stops at `max_tokens` (tokens, not words) or before the first `parar` in the
  generated text, not returned; same seed → same text; no state between calls; reads at most 64
  tokens; the prompt may be neither empty (lesson 1: the first token is given) nor end in a space.
  The maths is the chain rule read forwards: at τ = 1, no cut, inside the window, the output is an
  exact sample of $p_\theta(y \mid x)$.
- **Beyond the window, the caché is refilled**: when full and another token is needed, a prefill of
  the last $T_{\text{mín}} = T_{\text{ctx}}/2 = 32$ tokens. Derived: $T_{\text{ctx}}$ rows per cycle
  of $T_{\text{ctx}} - T_{\text{mín}} + 1$ tokens, 64/33 ≈ 1.94 rows per token against `generar`'s
  64; the minimum context is justified by lesson 8's table (nothing past ~8 tokens helps). Cell 3:
  inside the window `modelo` and `generar` write the same text for the same seed; over 80 tokens they
  share the first 63 exactly (the 64th is the first after a refill). The clock ratio (≈5×) is quoted
  as a clock, not derived.
- **The trailing-space seam, measured**: after `Dijo que` the favourites are ` no` / ` se` / ` me`;
  after `Dijo que ` (a lone space token, which the novel only puts before word starts the merges never
  glued to a space, ` Golfín` = ` ` + `G`…) they are `u` / `j` / `é`. `modelo` asserts against it;
  token healing is named and left out.
- **Renaming in cells**: `modelo` was the `MiniGPT` object in lessons 3–8's cells; from here it is the
  function and the object is `red` (the delta's «la red» when looking inside). `llenar`/`avanzar` take
  the network as first argument.
- **Challenge `ch-continuar`**: the window loop alone (voraz, no text), against a toy engine whose
  favourite hashes every token read and its position, so a wrong refill cannot pass by accident.
  Graded in Node Pyodide against the solution (6/6), the starter and five wrong variants (refill every
  token, refill after the last token, refill without the new token, untrimmed prompt, refill of 64):
  each fails at least one test with its own message.
- **Terms and letters added before use**: `firma`, `contrato`, `cadena de parada` (*stop sequence*
  once), `rellenar`/`relleno` in the delta's §4; $\tilde{q}(v \mid x, y_{<j})$, $\tilde{q}(y \mid x)$
  and $T_{\text{mín}}$ in `NOTATION.md`, with a note: no length letter ($m$, $M_j$ taken), no context
  letter ($c$ is lesson 5's cost), $T_{\text{mín}}$ not $r$ ($r_\phi$, Block 2's $r(x, y)$).
- **Lesson 8's bridge now links this lesson** (placeholder comment removed). This lesson's bridge
  names Block 2's first lesson (`predecir-no-es-obedecer`) in prose with the usual comment.
  `draft: false`, as lessons 1–8, against the PUBLICATION line.
- Verified: `pnpm lint:content` (only the words warning), `jest src/lib/courses src/features/courses`
  (71 suites, 991 tests), `pnpm build` green twice with 0 KaTeX errors; the three cells under Node
  Pyodide 0.29.3 and in the Browser pane on `pnpm start` with identical output (warm ≈1.3 s and
  2.5 s for cells 2–3); all three quiz questions right and wrong; the challenge's starter (0/6 with
  messages) and solution (6/6) in the browser, and again in Node Pyodide from the final frontmatter
  after test 4 gained its «llenar no se llamó nunca» message; no horizontal page scroll at 375 or
  360 px (the trace
  table scrolls 36 px inside its own box at 360). The pane carried the English locale cookie again.

**COURSE-C2-P1-02** — In progress (started 2026-10-01). Lesson 10 `predecir-no-es-obedecer` authored on
`staging`, the block's first. 2 000 words, 7 display equations, no widget (the block md assigns
none), 1 cell (35 lines), 4 quiz, no challenge, 4 readings (Ouyang et al. 2022, Askell et al. 2021,
Reynolds & McDonell 2021, Wei et al. 2022 / FLAN; titles and arXiv links checked). Runs on the
mini-GPT, loaded in one line from `modelo.py` and never trained, and says so before the cell.
`draft: false`, as the PUBLICATION line says. Decisions recorded for the reviewer of the block:
- **The claim, derived:** pretraining is lesson 1's loss read on a split $(x, y)$, and lessons 6 and
  8's inequality puts its optimum at $p_\theta = p_{\text{texto}}$. After an instrucción the text is
  a mixture over lesson 8's tareas $\omega$ (exam, forum, book of solved exercises), so the masa on
  obeying is the text's, and scaling (lesson 7) only brings $p_\theta$ closer to it. The chain rule
  on events splits $p_\theta(\text{buena} \mid x)$ into obeying × good-given-obeying, form against
  judgment, which orders the block. Bayes with $K = 0$ is what the prompt can move (GPT-2's TL;DR,
  a Q&A frame) and its three limits; the section closes on the target objective
  $\max_\theta \mathbb{E}_x[p_\theta(\text{buena} \mid x)]$ and on $p_{\text{texto}}$ being a choice.
- **The cell, measured in Pyodide:** three samples of «¿De qué color es la tierra?» are novel text;
  after the novel's 433 «?», with 8 tokens of context (lesson 8: more does not help it), the
  mini-GPT's masa on five ways of continuing (new paragraph, ellipsis, narrator's tag, comma, the
  paragraph goes on) is within 3.2 points of the novel's counts (39.5/19.4/8.3/5.1/27.7 % against
  36.5/22.6/7.2/4.7/29.0 %); «Respuesta:» appears 0 times in the novel, and the greedy output after
  the «Pregunta: … Respuesta:» frame is dialogue. The question and the frame are the train script's
  held-out SFT pair (`SFT_RESERVADO`, `PLANTILLA`): the lesson says the block will come back to them,
  so lesson 12 must use that pair.
- **The GPT-3 moon-landing example** (the InstructGPT announcement, early 2022) is paraphrased from
  secondary sources (OpenAI's page answered 403); only the two topics they agree on, gravity and the
  big bang, are named.
- **Terms and letters added after review:** `preentrenamiento`, `instrucción`, `obedecer` (not
  `seguir`, the continuation's verb), `buena`, and `respuesta` replacing «continuación» for $y$, in
  the delta's §4 with an argued paragraph; $p_\theta(\text{obedece} \mid x)$,
  $p_\theta(\text{buena} \mid x, \text{obedece})$ and $\omega$ read after an instrucción in
  `NOTATION.md`, with a note on events written in words.
- **Lesson 9's bridge now links this lesson** (placeholder comment removed), and its wording changed
  from «abre con esta misma función» to «carga esta misma función en una línea y le hace una
  pregunta», since the lesson opens on prose. This lesson's bridge names lesson 11
  (`plantilla-de-chat`) in prose with the usual comment.
- Verified: `pnpm lint:content` (no warnings), `pnpm build` green with 0 KaTeX errors; the cell under
  Node Pyodide 0.29.3 twice (≈2.3 s) and in the Browser pane on `pnpm start` with identical output;
  all four quiz questions right and wrong (the numeric at 0.207 passes, 0.208 fails); no horizontal
  page scroll at 360 px (the two widest equations, 511 and 485 px, scroll in their own boxes). The
  pane carried the English locale cookie again.

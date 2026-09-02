# Phase 11 — English translation

Write the English lesson tree: `content/courses/dl-nlp/en/`, 43 lessons, one PR each.

The routing for this shipped a long time ago. What is left is the content — and the discovery
that drove this phase's shape is that **translation is not one job**. Some lessons are prose
transposition around fixed mathematics. Others are built on Spanish, and translating them
produces a lesson about Spanish, asked in English, in a course about text.

## What already works — do not rebuild it

`src/lib/courses/catalog-view.ts` (COURSE-P6-03b) already resolves content **per lesson, not per
course**. The Spanish tree is the *spine* — it fixes the order and the membership — and each
lesson independently uses the English version when one exists. The consequences are the whole
reason this phase can be incremental:

- A course can be translated **one lesson at a time**, with no broken intermediate state. No
  43-lesson syllabus collapsing to 1, no `next: null` dead end.
- An untranslated lesson renders Spanish prose under `/en` with `noindex` and **no** hreflang
  alternate, and the sitemap keeps using published-only per-locale selectors. Nothing advertises
  a locale that cannot be served.
- `content/courses/dl-nlp/course.en.yml` is written and complete.
- The reader chrome — `Quiz`, `CodeChallenge`, catalog, landing, progress, `LessonReading` — is
  already `next-intl`'d against `messages/{es,en}.json`.
- `buildSearchIndex(courseSlug, locale)` (P9-01) is per-locale and reads through
  `listLessonViews`, so it inherits the same per-lesson resolution for free.

**No new routes, no redirects, no slug migration, no SEO work.** English is a pure content
addition, exactly as `PLAN.md` promised in its "Language" locked decision.

## What does not work yet — the three prerequisites

Three things were built Spanish-only and will fail, or silently degrade, the moment `en/` has its
first file. All three are fixed before lesson 1.

### 1. The crosslink lint is fatal on a partial `en/` tree — P11-01

`validateCrosslinks` (P7-01) groups lessons `byDirectory` and builds its index **from that one
directory**. For `content/courses/dl-nlp/en/` the index therefore holds only the English lessons
that exist so far. A `<Leccion slug="funciones-activacion">` in the first English lesson resolves
to nothing and **throws** — `pnpm lint:content` and `pnpm build` both fail.

With ~403 cross-references across 43 lessons (~9 per lesson, pointing both directions), this
fires on essentially the first file written. It is the single hard blocker on the phase.

### 2. `<Leccion>` silently degrades every reference on an English page — P11-01

The runtime half of the same problem, and the more dangerous one because it fails quietly.
`LeccionCtx.contentLocale` is the locale of the *current* lesson's prose. Once that lesson is
English, `getLesson(slug, "en")` returns `null` for every not-yet-translated target, and the
reference renders as plain text: no link, no hover card.

That is precisely the degradation `Leccion.tsx`'s own file-top comment was written to prevent —
reappearing one level up, because `contentLocale` was designed when a lesson was either wholly
Spanish or wholly English, never a translated lesson pointing into an untranslated one.

### 3. The widgets are hardcoded Spanish — P11-02

The chrome is internationalised; the explorables are not. A heuristic scan says **15 of the 25
components** under `src/features/courses/widgets/` carry Spanish string literals. The worst is
`nlp/TokenizerPlayground.tsx`: panel titles `"Palabras"` / `"Caracteres"` / `"Subpalabras"`,
`aria-label="Frase para tokenizar"`, and

```ts
const DEFAULT_TEXT = "El niño enseña programación en español.";
```

An English Block 1 lesson would build an English argument around a Spanish explorable. Note that
the default corpus is not a label — it is a pedagogical choice, and it is the thing the lesson's
prose describes. See P11-02.

## Classification — the model this phase runs on

Every lesson gets exactly one class, assigned by P11-00 and recorded in its block task md. The
class decides the model, the effort, and the review depth.

| Class | What changes | Where it concentrates |
|---|---|---|
| **Transpose** | Prose only. Mathematics, notation, widget ids, quiz structure and answers all hold. | The bulk of Blocks 2–5 |
| **Adapt** | The argument holds; a corpus, an example or a code identifier set is swapped. Quiz answers may move. | Block 2's sentiment set (2.3/2.9/2.10); the char-LM corpus (3.7); the alignment pair (4.4/4.5); the self-attention sentence (5.2/5.4) |
| **Rewrite** | The pedagogy is Spanish-dependent. New examples, new quiz items, new answers. | Block 1, especially B1.2 |

The planning pass found named Spanish dependencies in **every block**, not only Block 1 — the
attention blocks demonstrate on Spanish agreement (`las llaves del coche **están** ahí`) and on a
Spanish–English alignment pair (`leí` ↔ `read`). Blocks 3–5 are still mostly transposable, but
"Blocks 3–5 are free" is wrong and P11-00 exists to replace that guess with a count.

### The count — P11-00's result

| Block | Lessons | Transpose | Adapt | Rewrite |
|---|---|---|---|---|
| [1 — NLP Fundamentals](04-block-1.md) | 8 | 0 | 7 | **1** (1.2) |
| [2 — The MLP](05-block-2.md) | 10 | 2 | 7 | **1** (2.8) |
| [3 — RNNs](06-block-3.md) | 8 | 3 | 5 | 0 |
| [4 — The Bridge to Attention](07-block-4.md) | 6 | 3 | 3 / 2 | 0 / **1** (4.3) |
| [5 — The Transformer](08-block-5.md) | 11 | 6 / 5 | 5 / 6 | 0 |
| **Phase** | **43** | **14** / 13 | **27** | **2** / 3 |

Two rows carry a slash because **Block 4's direction decision is still open** — see "The direction
decision — make it once, in 4.1" in [07-block-4.md](07-block-4.md). Under **Option A**
(keep Spanish→English, reframed) the phase is 14 transpose · 27 adapt · 2 rewrite; under
**Option B** (switch to a pair the reader can read) 4.3 becomes a rewrite and 5.9 an adapt,
giving 13 · 27 · 3. Nothing else in the phase moves either way.

Three corrections the count makes to the guess above:

- **Block 1 has no transposable lesson at all**, and 1.8 is the phase's most expensive adapt.
- **Blocks 3 and 5 hold no rewrite.** Block 5 in particular moves no quiz answer anywhere across
  11 lessons, and carries **zero** `<Leccion ancla="">` across 102 slug-only refs.
- **The adapt cost is concentrated outside the lesson files.** The self-attention sentence
  (5.2/5.4/5.7) and the sentiment corpus (2.3/2.9/2.10) live in widgets and fixtures, so P11-02
  gates three Block 5 lessons and Block 2's 2.10 gates Block 5's 5.11.

The worked case, and the reason the class exists at all — `es/02-tokenizacion.mdx` carries four
quiz questions, and **three of them are about Spanish**: whether `ñ` written as `n` + combining
tilde yields two tokens without NFC normalisation; whether a subword tokeniser can represent
`dámelo` from `dá`/`me`/`lo`; and a numeric answer of 14 for the characters in `El niño juega.`
Translated literally, all three become questions about a language the English reader is not
being taught. English needs its own hooks — `don't`, possessive `'s`, `naïve`/`café` for the NFC
case, `unhappiness` → `un ##happi ##ness` for subwords — and the surrounding prose has to be
rewritten to earn them.

## Locked decisions

| Decision | Choice | Rationale |
|---|---|---|
| Spelling | **en-GB** | Already de facto: `course.en.yml` says "mathematical rigour"; the widget maths modules are `tokenisation.ts`, `optimisation.ts`; comments say `visualiser`. Locking it stops a drift nobody would notice until lesson 20. |
| Slugs | **Identical to Spanish** | The invariant `catalog-view.ts` and `course.en.yml` are both built on. An English slug is a route change, and route changes are what this phase spent six phases avoiding. |
| Frontmatter `block` / `order` / ids | **Identical to Spanish** | The Spanish tree is the spine. A widget, quiz or challenge id that differs across locales breaks the registry contract; a differing `order` breaks the spine. |
| `reading` entries | **Same sources, translated `note`, `lang` unchanged** | `lang` describes the *source*, not the lesson — a Spanish-language paper stays `lang: es` and keeps its badge in the English lesson. Swapping in different sources per locale would fork the bibliography and double P8-02's URL-verification burden. Adding an English-language alternative where the Spanish entry is a translation of one is allowed, and noted in the task. |
| Order of work | **Block order, lesson order, strictly** | Bridges must interlock **in English**: lesson N's opening picks up lesson N−1's *English* closing. Out-of-order translation means writing a pickup against prose that does not exist yet. |
| One lesson = one PR | **Unchanged from P5** | The review gate is the process that carried 43 Spanish lessons. Nothing about translation makes it less necessary. |

## Tasks

1. [00-triage.md](00-triage.md) — `COURSE-P11-00` (S) — classify 43 lessons; fill the tables in tasks 04–08
2. [01-locale-crosslinks-and-voice.md](01-locale-crosslinks-and-voice.md) — `COURSE-P11-01` (M) — the blocker: canonical fallback in the crosslink lint and in `<Leccion>`; English voice families
3. [02-widget-i18n.md](02-widget-i18n.md) — `COURSE-P11-02` (M) — widget strings and per-locale default corpora
4. [03-authoring-en.md](03-authoring-en.md) — `COURSE-P11-03` (S) — `AUTHORING.en.md`, the English §5
5. [04-block-1.md](04-block-1.md) — `COURSE-P11-04` (L) — Block 1, 8 lessons — **the hard one**
6. [05-block-2.md](05-block-2.md) — `COURSE-P11-05` (L) — Block 2, 10 lessons
7. [06-block-3.md](06-block-3.md) — `COURSE-P11-06` (L) — Block 3, 8 lessons
8. [07-block-4.md](07-block-4.md) — `COURSE-P11-07` (L) — Block 4, 6 lessons
9. [08-block-5.md](08-block-5.md) — `COURSE-P11-08` (L) — Block 5, 11 lessons

**Landing order:** P11-01 → P11-02 → P11-03 before any content. P11-00 is independent and should
run first because it is cheap and everything downstream keys off it.

```
P11-00 (triage) ──────────────────┐
                                  ▼
P11-01 ──► P11-02 ──► P11-03 ──► P11-04 ──► 05 ──► 06 ──► 07 ──► 08
```

P11-04 is deliberately first among the content tasks even though it is the most expensive: Block 1
is where every rewrite lives, and it is the block that decides whether the English course reads as
a course or as a translation.

## Sequencing constraint — P8-02

`reading:` is populated in 41 of the 44 Spanish files, but **P8-02 is still open in `STATUS.md`**
(all five block checkboxes unticked). Any Spanish lesson whose `reading` is revised after its
English counterpart is written leaves the two out of sync, and nothing checks that.

Confirm P8-02 is closed — or that a given block's `reading` is final — before translating that
block. This is a review question, not a lint: see "Out of scope".

## Exit criteria

- [ ] `content/courses/dl-nlp/en/` holds 43 published lessons; `fullyTranslated` is true for `en`
- [ ] `/en/cursos/dl-nlp/<slug>` is indexable for every lesson, with reciprocal hreflang, and no
      lesson route still emits the fallback `noindex`
- [ ] A partially translated tree passes `pnpm lint:content` at every intermediate commit
- [ ] No English lesson renders a Spanish widget label or a Spanish default corpus
- [ ] The English voice families fire on English prose; the Spanish families still fire on Spanish
- [ ] Every English `<PyCell>` and `<CodeChallenge>` has been run in the browser, and every number
      the prose quotes matches what Pyodide actually prints
- [ ] `pnpm lint` + `pnpm lint:content` + `pnpm test` + `pnpm build` + `pnpm check:bundle` green

## Out of scope

- **A translation-drift lint.** A pass that flags an English lesson whose Spanish source changed
  after it was written would be genuinely useful — the P8-02 constraint above is exactly the
  failure it would catch. It needs a per-lesson source hash in frontmatter and a policy for what
  counts as a material change; both are their own task, after the tree exists.
- **Machine-checking translation fidelity.** Whether an English lesson dropped a step of a
  derivation is a review question. The one automatable part — that the LaTeX and the `<W>`/
  `<Leccion>` wrappers survived — falls out of the existing lint passes.
- **A third locale.** Nothing here is dl-nlp-specific or es→en-specific, but generalising before
  the second locale exists is speculation.
- **Translating the admin panel.** Spanish by convention (`CLAUDE.md`), unchanged.
- **Re-recording the notebooks** under `docs/courses/notebooks/`. They are linked from B5.11's
  Colab hand-off; translating them is its own task with its own verification story.

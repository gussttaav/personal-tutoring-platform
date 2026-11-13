# P3-01 — Platform readiness for a second translated course

**Tag:** `COURSE-C2-P3-01` · **Size:** S · **Status:** not started

## TL;DR

Prove, with one throwaway English lesson, that Phase 11's machinery covers `llm-agents` with no
change. Then fix the two places that still name `dl-nlp`: the `/course-translate` command's
prerequisites and `AUTHORING.en.md` §7's asset paths. And add the one lint check D1 makes
necessary: an English lesson's `<RepoLink>` must point at an English tag.

## Context

Phase 11 built cross-locale resolution, the English voice families and widget i18n as platform
code, and the course-agnostic design means a second course should inherit all of it. "Should" is
the word to remove. Two things are known to be `dl-nlp`-shaped:

- **`.claude/commands/course-translate.md`** stops unless "COURSE-P11-01, P11-02, P11-03 have
  landed and the lesson carries a class from P11-00". Pointed at
  `docs/courses/llm-agents/phase-3-translation/04-block-1.md`, it checks the wrong tags, and
  since those tags are done it **passes**: it would start translating with no English checkpoint
  and no identifier map. Two of its prohibitions also contradict decisions this phase has taken:
  «Do NOT translate the Colab notebooks» (D2 asks for an English notebook in 2·8), and «Do NOT
  create branches, commit» (Block 5 cuts an `en-b5-lN` tag per lesson, D1). Its step 9 knows only
  browser verification, and Block 5 has no `<PyCell>`.
- **`docs/courses/AUTHORING.en.md` §7** writes every sibling path as `public/courses/dl-nlp/…`, and
  its rules cover `.en.svg`, `.en.txt` and a widget's `.en.json` — not a frozen Python module, which
  is this course's most common sibling.

And D1 (decided 2026-11-13) puts the English code in the **same repository**, `agente-minimo`, on
an `en` branch with its own tags `en-b5-l1` … `en-b5-l9`. `LLM_AGENTS_REPO_BASE` and `<RepoLink>`
therefore need no change: the English lesson writes `tag="en-b5-l3"` where the Spanish one writes
`tag="b5-l3"`. What that costs is an invariant nothing checks today. Nothing in `lint:content`
validates a `<RepoLink>` tag, so an English lesson that kept a Spanish tag (the easiest slip when
translating from the Spanish file) would link Spanish code under English prose, silently.

## Files affected

| File | Change |
|---|---|
| `.claude/commands/course-translate.md` | prerequisites per course, read from the phase README's task list rather than naming P11 tags; the notebook exception; the Block 5 terminal verification and tag step |
| `docs/courses/AUTHORING.en.md` §7 | `public/courses/dl-nlp/` → `public/courses/<course>/`; add the frozen-module sibling (`<name>.en.py`) with its parity-test rule |
| `src/lib/courses/validate-repolinks.ts` | **new** — the tag shape per locale directory (fails) |
| `src/lib/courses/__tests__/validate-repolinks.test.ts` | **new** |
| `scripts/lint-content.ts` | run it beside `validateCrosslinks` |
| `content/courses/llm-agents/course.en.yml` | the FAQ's "block 3 mixes; blocks 4 and 5" → "Block 3 … Blocks 4 and 5" (`AUTHORING.en.md` §4 capitalisation) |

## The change

### 1. A throwaway lesson proves the inheritance

Write `content/courses/llm-agents/en/01-una-sola-columna.mdx` as a stub (frontmatter copied, a
paragraph of English, one backward `<Leccion>`, one forward, one `curso="dl-nlp"` to a translated
target and one to an untranslated target, one sentence with `simply` in it). Check:

- `pnpm lint:content` passes, and warns on `simply`
- `pnpm build` prerenders the page; the four references link; the two fallbacks read «In Spanish»
- `/en/cursos/llm-agents/una-sola-columna` is indexable with reciprocal hreflang; every other `/en`
  lesson still `noindex`
- `/en/cursos/llm-agents` shows the translated-count badge at 1 of 40
- the per-locale search index (`/api/courses/search-index/llm-agents/en`) carries the English title

**Delete the stub before merging**, as P11-01 did: `en/` ships empty.

### 2. `/course-translate` reads its prerequisites from the phase

Replace the hardcoded tags with the rule they encode: *every task in the phase README listed
before the first block task must be ✅ in the course's STATUS.md, and the lesson must have a
class in its block md*. That works for both courses and for a third.

Three more edits, each narrow, each driven by the block md rather than by a course name, so the
command stays course-agnostic:

- **The notebook exception.** Keep «Do NOT translate the Colab notebooks» as the default, and add:
  *unless the lesson's block md explicitly asks for an English notebook* (llm-agents 2·8, D2). In
  that case the notebook is part of the lesson: written as its own file beside the Spanish one in
  the notebooks repository (the Spanish one untouched), run end to end from a fresh Colab account
  before the lesson quotes it, its commit pinned in the English `<ColabLink>`. Pushing to the
  notebooks repository is a publication: stop and ask first.
- **Terminal verification.** Step 9 gains a branch for a lesson with no `<PyCell>` whose block md
  names a terminal chain (llm-agents Block 5): verification is a run from a fresh clone of the
  lesson's starting tag, on the chain the block md pins, and every transcript, count and timing the
  prose quotes comes from that run, with the raw log kept beside the block md. Never a Spanish
  transcript with its words swapped.
- **The tag step.** «Do NOT commit» stays for this repository. For the companion repository, step 13
  (after Gustavo's approval of the lesson) gains: commit the lesson's code on the branch the block
  md names and cut the tag it names (`en-b5-lN` on `agente-minimo`'s `en`), then **stop and ask
  before pushing** the branch or the tag. Before approval, nothing is committed there either.

### 3. The module sibling, in the shared delta

One paragraph in §7, beside the `.en.txt` and `.en.json` rules: *A frozen module a `<PyCell>` loads
gets an English sibling, `<name>.en.py`, translated against the course's identifier map, with a
test that runs both on the same inputs and asserts the same outputs.* The identifier map itself is
course-specific and lives in `llm-agents/AUTHORING.en.md` (P3-03); the shared delta only states the
rule. Keep §7 net-neutral in length: the file is already past its 300-line ceiling, and
generalising the paths is a chance to cut the four restatements of "the Spanish file keeps its
name".

### 4. A `<RepoLink>` tag matches its lesson's language

A new validator, Node-clean like `validate-crosslinks.ts`, selected by the lesson's locale
directory (`lessonLocale`, as the voice lint does): in `es/`, every `<RepoLink tag>` matches
`^b5-l[1-9]$`; in `en/`, `^en-b5-l[1-9]$`. **Fails**, never warns: a wrong tag is a broken lesson,
not a style question. It knows nothing about the repository (no network); that the tag exists is
the Block 5 clean-clone check.

Keep the pattern in one exported constant per locale, so a tenth lesson or a third locale is one
line. Nothing else about `<RepoLink>` changes: an untranslated Block 5 lesson under `/en` is the
Spanish file, carries Spanish tags, and links them, which is right.

## Acceptance criteria

- [ ] The stub passes `lint:content` and `build`; all four reference kinds behave as listed; the
      English voice family fires; the stub is deleted before merge
- [ ] `/course-translate` pointed at a `llm-agents` block md checks P3-00/01/02/03 and refuses while
      any is open; pointed at a `dl-nlp` block md it still checks P11-00/01/02/03
- [ ] The command allows an English notebook only where the block md asks for one, verifies a Block 5
      lesson by a terminal run, and commits and tags in the companion repository only after approval,
      asking before any push; every other prohibition reads as before
- [ ] `AUTHORING.en.md` names no course in a path; the `.en.py` rule is there; the file is no longer
      than before
- [ ] `lint:content` fails on a `b5-l*` tag in `en/` and on an `en-b5-l*` tag in `es/`, naming the
      file; the 18 existing Spanish `<RepoLink>`s pass unchanged
- [ ] `course.en.yml` capitalisation fixed; `pnpm check:messages` green
- [ ] `pnpm lint` + `pnpm lint:content` + `pnpm test` + `pnpm build` green

## Test plan

- Unit, against temp fixture trees: a good and a bad tag in each locale; a lesson with no
  `<RepoLink>`; a `path=` attribute does not confuse the tag match.
- Manual: the stub lesson, read in the browser, hover all four references.
- Manual: run `/course-translate` in dry-run spirit against one block md of each course and read
  the prerequisite check it performs. Before this task lands, the llm-agents run must refuse.
- Manual: read the edited command against `05-block-2.md` (2·8) and `08-block-5.md` (5·1) and check
  each says what the command now lets it do; against a `dl-nlp` block md, check nothing changed.

## Gotchas

- **Do not make `<RepoLink>` rewrite tags by locale at render time** (`b5-l3` → `en-b5-l3` on an
  English page). It would hide the slip the lint exists to catch, and break on the fallback page,
  where the prose is Spanish and must link Spanish code.
- **The stub must not be committed.** A one-paragraph published English lesson flips that slug's
  `noindex` off and puts a stub in the sitemap.
- **The bundle guard** (`check:bundle`) has a known pre-existing false positive on the pyodide key
  literal; compare against `staging`, not against green.

## Out of scope

- The `en` branch and its tags (Block 5, lesson by lesson).
- Any widget work — the ten widgets are already bilingual; their locale-bound presets belong to the
  lessons that embed them (Blocks 1, 3, 4, 5).
- Bringing `AUTHORING.en.md` back under 300 lines beyond what §7's generalisation pays for — that is
  still P11-03's open item.

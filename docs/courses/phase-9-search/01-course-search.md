# P9-01 — Cross-lesson search: index, engine, palette

**Tag:** `COURSE-P9-01` · **Size:** L · **Status:** done

## TL;DR

Build one JSON search index per course × locale at build time from the MDX already on disk, serve
it from a prerendered Route Handler, and search it entirely in the browser from a command-palette
dialog in the lesson reader — desktop sidebar and mobile bar. Results group by lesson and show up
to three section snippets, each deep-linked to its `#heading` anchor with the query highlighted.
Scope is the one course the reader is inside; nothing is hardcoded to `dl-nlp`.

## Context

See [README.md](README.md) for the design review and the Pagefind decision.

Three existing facts shaped the whole thing:

- [`catalog-view.ts`](../../src/lib/courses/catalog-view.ts) resolves the lesson spine **per lesson**
  across locales. The `en` index must therefore be built from `view.contentLocale`, i.e. the exact
  prose the `/en` reader renders — which today is Spanish. Indexing anything else would return
  results linking to pages that do not contain the match.
- [`headings.ts`](../../src/lib/courses/headings.ts) already produces `rehype-slug`-identical ids.
  Section chunks consume them rather than re-slugging, so `#id` deep links land.
- [`LessonSidebar.tsx`](../../src/features/courses/reader/LessonSidebar.tsx) is a Server Component
  **rendered twice** (desktop aside + mobile drawer). Nothing stateful can go inside it.

## Files affected

| File | Change |
|---|---|
| `src/lib/courses/search/types.ts` | Index wire format. Types + one const only — imported by both server and client |
| `src/lib/courses/search/searchable-text.ts` | `searchableText()`, `splitSections()` |
| `src/lib/courses/search/normalize.ts` | `normalizeAligned()` — offset-preserving accent/case/separator folding |
| `src/lib/courses/search/query.ts` | `parseQuery()` — terms, quoted phrases, minimum length |
| `src/lib/courses/search/match.ts` | `hasTerm`, `findTerm`, `isWholeWord`, `extendToWordEnd`, `mergeRanges` |
| `src/lib/courses/search/rank.ts` | `prepareIndex()`, `search()`, the weights, the escalation ladder |
| `src/lib/courses/search/snippet.ts` | `buildSnippet()`, `splitByMarks()` |
| `src/lib/courses/search/build-index.ts` | `getSearchIndex()`, `searchIndexVersion()` — **the only fs-touching module** |
| `src/app/api/courses/search-index/[courseSlug]/[locale]/route.ts` | Prerendered index endpoint |
| `src/features/courses/search/*` | Provider, trigger, dialog, highlight, index hook, keyboard arithmetic |
| `src/hooks/scroll-lock.ts` | Ref-counted body scroll lock, shared with `MobileLessonBar` |
| `src/app/[locale]/cursos/_styles/search.css` | Segment stylesheet, imported by the lesson route (the `_styles/katex.css` pattern) |
| `LessonLayout.tsx`, `MobileLessonBar.tsx` | Provider mount + the two triggers |
| `.../[lessonSlug]/page.tsx` | CSS import + `searchVersion` |
| `messages/{es,en}.json` | `courses.search` namespace, key-for-key |
| `src/lib/courses/budget.ts` | **Untouched.** See below |

## The measurements

Against the real corpus, so the design decisions are re-checkable rather than re-argued:

| | |
|---|---|
| Published lessons / section chunks | 43 / **254** |
| Plain prose after stripping | **416 KB** |
| Index JSON raw / brotli | 470 KB / **~116 KB** |
| Index build (per course × locale, build time) | ~180 ms |
| `prepareIndex` — normalize whole corpus, once at load | **~11 ms** |
| Typical query (1–3 terms) | **0.5–1.0 ms** |
| Degenerate query (`"de la"`) | 4.5 ms |
| First-load JS added to the lesson route | ~16 KB uncompressed |

Long descriptive JSON keys were measured **smaller after brotli** than short ones
(115.7 KB vs 118.3 KB) — brotli models the repeated long keys better than short keys interleaved
with prose. There was no readability-vs-size trade-off to make.

## Decisions worth keeping

**`budget.ts` is not modified, and `searchableText` is a deliberate near-copy of `prose()`.** Its
word counts are a contract with the authors and `pnpm lint:content` must not move. The two
divergences are (1) `<Leccion>` children are **kept** — `prose()` drops them so linking costs the
author no words (P7-01), but "la lección sobre retropropagación" is text the student reads; and
(2) punctuation is reattached after tag-stripping, invisible in a word count and a visible defect
in a snippet. A canary test asserts the two agree on input exercising neither divergence.

**Inline math wrapped across a source line break.** `prose()`'s inline pattern forbids `\n`, so on
a line like `36-multi-head.mdx:50` the `$` count goes odd and every later pair on that line falls
out of phase, leaking raw LaTeX. Harmless for a word count, a visible defect in a result. The
search variant adds a second, newline-tolerant pass guarded by a lookahead requiring a backslash,
so a lone `$` in prose can never pair with a distant one. Result: **0 of 254 chunks** contain `$`
or a TeX command.

**Offset-preserving normalization.** Matching happens in normalized space; snippets are cut from
the original so the student reads real accented Spanish. `"café".normalize("NFD")` is 5 characters,
not 4 — so folding is length-guaranteed, with a per-character fallback for ligatures and `İ`. The
fast path holds for every character in the current corpus; the fallback exists for what gets pasted
in later.

**Separators fold to a space.** The course writes `self-attention`; a student types
`self attention`. Folding `-_/·` and the dashes to a space keeps the 1:1 length guarantee and makes
the second half of a compound reachable.

**Single-character terms are dropped.** `"a b c d e"` cost 8.7 ms before this — a one-character
needle matches at a word start thousands of times per course. Now 3 µs, and `a`/`y`/`e` were noise
anyway.

**Sections that match only via the lesson title never become rows.** They would render as a snippet
with no highlight in it, and the reader's fair question is "why is this here?". A title-only match
collapses to one head row instead.

**Search lives only in the reader.** It was built on the catalog and the course landing page too,
and removed: those pages exist to explain the course and start it, and someone who has not read a
lesson yet is served better by the syllabus accordion than by a search box. Removing it also
collapsed `search()` from a list of indexes to one, which is the honest signature — the scope is
the course you are inside.

**Triggers are NOT in `LessonSidebar`.** Desktop lives in `LessonLayout`'s `<aside>`, mobile in
`MobileLessonBar` — one apiece. This is what keeps the sidebar a zero-client-JS Server Component
and avoids duplicate DOM ids and duplicate listeners.

**Scroll lock is ref-counted.** With search as a second overlay, `MobileLessonBar`'s direct
`document.body.style.overflow` was a bug in waiting: open the drawer, open search from inside it,
close search, and the page unlocks with the drawer still up.

**Result anchors are raw `<a>`, so `getPathname` adds the locale prefix explicitly.** A next-intl
`<Link>` inside `role="option"` would nest interactive content and break the combobox model; but a
raw anchor gets no prefix, which silently dropped `/en` from every copied or middle-clicked result
while keyboard navigation still worked. Caught in the browser, not by a test.

## Acceptance criteria

- [x] `● /api/courses/search-index/[courseSlug]/[locale]` prerenders both paths; `.body` on disk
- [x] `prerender-manifest.json` keeps `revalidate: false` and the handler's own `immutable` header
- [x] Section ids agree with `extractHeadings`, including github-slugger's `-1` de-duplication
- [x] Accent-, case- and separator-insensitive; prefix at word start only
- [x] Grouped by lesson, ≤3 section rows, "+N more", deep links land on the rendered heading
- [x] `/en` searches the prose it actually renders and says "The lessons are in Spanish"
- [x] Full-screen sheet under 768px; focus trap, Escape, focus restore, scroll lock
- [x] `pnpm check:bundle` green — the search UI pulls no KaTeX/Shiki/widgets
- [x] `messages/*` key-for-key; `pnpm lint:content` word counts unmoved

## Gotchas

- **Never import `build-index.ts`, `searchable-text.ts`, `registry.ts` or `catalog-view.ts` from a
  `"use client"` file** — `node:fs` in the browser bundle. `types.ts` stays types-plus-constants,
  and this directory deliberately has **no `index.ts` barrel** so client files import by exact path.
- `dynamicParams = false` on the route matters: there is no `outputFileTracingIncludes` in
  `next.config.mjs`, and Next cannot trace the registry's `path.join(cwd(), "content", "courses")`,
  so `content/` may not exist in a lambda. Refusing unknown params keeps that path unreachable.
  (The same latent gap exists on `[lessonSlug]` and is pre-existing — worth a follow-up.)
- `pnpm test:unit` is the `node` environment with **no jsdom**. Nothing that renders a component is
  testable; that is why the engine, the snippet windowing, the keyboard arithmetic and the scroll
  lock are all pure modules with injected seams.
- The repo lints the React 19 rules (`react-hooks/refs`, `react-hooks/set-state-in-effect`). Both
  fired here and are fixed structurally — a referentially stable `scope` from the provider, and an
  active index derived during render instead of reset from an effect — not with disables.
- CI does not run `pnpm build`, so the prerender behaviour is only verified locally or by e2e.

## Out of scope

- Highlight-on-arrival (`?q=` + scroll-to-sentence) — see README.
- ⌘K / `/` global shortcut — see README.
- Fuzzy/typo tolerance, stemming, search analytics, recent-search history.
- Quiz prompts, challenge text and `reading[]` entries are **not** indexed: ~30% more bytes for
  text that has no anchor to link to and mostly duplicates the prose's vocabulary.

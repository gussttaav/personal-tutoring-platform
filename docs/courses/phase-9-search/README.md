# Phase 9 — Cross-lesson search

Let a student find any sentence in the course from any page, in the language they are reading it in.

The reader has 43 lessons and ~78,000 words of prose behind a 43-item sidebar that lists titles and
nothing else. A student who remembers "the lesson where he explains why you divide by the square
root" has no way to get there except guessing. That is the last navigational gap left in the
reader: Phase 1 gave it a spine, Phase 7 gave it cross-references, and neither helps someone who
does not already know which lesson they want.

## Tasks

1. [01-course-search.md](01-course-search.md) — `COURSE-P9-01` (L) — the build-time index, the
   matching engine, and the command palette in the lesson reader

## The design, and what was rejected

| Decision | Choice | Why |
|---|---|---|
| Index | **Build-time JSON, one per course × locale** | 416 KB of prose → 116 KB brotli, fetched once on demand. Zero server cost, which is the property the PLAN.md deferral was actually about |
| Delivery | **Prerendered Route Handler** | `next build` writes the body once; verified `●` (SSG) in the route table. Also fresh per-request in `next dev`, which a `public/` prebuild artifact cannot be |
| Not Pagefind | see below | |
| Granularity | **h2/h3 section chunks** (254 of them) | Median chunk is 1.5 KB, so a snippet from it is relevant, and every chunk carries a `#id` that deep-links to the rendered heading |
| Matching | **Left-anchored prefix, accent-folded, multi-term AND** | `aten` finds `atención`; `sol` never matches inside `resolver`. No stemmer exists for Spanish here, so prefix matching is what covers `gradiente`/`gradientes` |
| Result shape | **Grouped by lesson, up to 3 section rows each** | Three deep links beat one when a query hits three sections of the same lesson. The DocSearch model |
| Where it lives | **Client-side, entirely** | 0.6 ms per query over the whole corpus, measured. A server round-trip per keystroke would be slower and cost lambda invocations |
| Surface | **The lesson reader only** | Search is for someone already reading the course who needs to get somewhere else in it. On `/cursos` and the course landing page it would be an answer to a question nobody has yet — those pages exist to explain the course and start it, and the syllabus accordion is the right way to browse 43 lessons you have not read |

**Rejected: no ⌘K.** Deliberate, not an oversight — the reader hosts `<PyCell>` and
`<CodeChallenge>` textareas full of Python, so a global key grab is a hazard, and the triggers are
already visible on every surface. The provider is the single mount point if it is ever wanted.

**Rejected: highlight-on-arrival** (`?q=` + scroll-to-sentence). Deep-linking to `#sectionId`
already lands the reader in the right section. Going further means new client JS walking the
rendered lesson body, and the reader's minimal-client-JS invariant is load-bearing (see the bundle
guard). Noted as a follow-up in the task doc.

## Why not Pagefind

[PLAN.md](../PLAN.md) reserved this work for Pagefind. The *intent* behind that line —
build-time index, zero server cost, not Postgres FTS — is fully honoured here; the tool is not.
Three reasons, in order of weight:

1. **It indexes built HTML.** That means a post-`next build` Rust binary step over
   `.next/server/app`, in a repo whose build script is a bare `next build`. It would index the
   rendered page — KaTeX MathML, Shiki `<span>` soup, sidebar nav, footer chrome — where this repo
   already has clean, unit-tested MDX strippers producing exactly the prose a student reads.
2. **It ships a WASM runtime and a sharded index** to solve a problem that measures at 0.6 ms in a
   plain `String.indexOf` loop over 116 KB.
3. **The structure is already typed.** `registry`, `catalog-view` and `headings` hand over the
   lesson spine, the per-lesson locale fallback and `rehype-slug`-identical anchors for free.

**When to revisit:** past roughly 5× this corpus (~2 MB of prose in one course). The escalation
ladder inside `rank.ts` lists the two cheaper steps to take first. The measurements are in the task
doc so the decision is re-checkable rather than re-argued.

**Rejected: search on `/cursos` and the course landing page.** Built first, then removed. Scope is
one course — the one the reader is inside — which is also why `search()` takes a single index
rather than a list. A second course gets search with no code change; several courses at once is a
different feature and is not this one.

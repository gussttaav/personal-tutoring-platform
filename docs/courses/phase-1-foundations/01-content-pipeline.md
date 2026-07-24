# P1-01 — MDX + KaTeX + Shiki content pipeline

**Tag:** `COURSE-P1-01` · **Effort:** L · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

Stand up the build-time pipeline that turns an MDX file in `content/` into rendered HTML with
LaTeX math and syntax-highlighted code. **All three of MDX compilation, math typesetting and
highlighting happen at build time** — the shipped lesson page has zero JS attributable to any
of them. This is the decision that keeps a 40-lesson course free to serve on Vercel Hobby.

## Context

- No content pipeline exists today. `react-markdown` + `remark-gfm` are already dependencies
  but they are used for **chat message rendering** (`ChatService` output) — runtime markdown,
  no math, no MDX components. Do not extend that path for lessons; the requirements are opposite
  (runtime-untrusted-small vs. build-time-trusted-large).
- `next.config.mjs` already wraps config in `withNextIntl(withSentryConfig(...))`. Any MDX
  plugin composes on top of that chain — mind the order.
- CSP `font-src` is `'self' https://fonts.gstatic.com`. KaTeX fonts **must** be self-hosted
  (they will be, if the CSS is imported from the npm package rather than a CDN).
- The repo is `pnpm`, TypeScript strict, Node 22 via nvm.

## Spike first (do this before anything else)

Confirm **`next-mdx-remote/rsc` works under Next 16 + React 19 RSC** with `remark-math` /
`rehype-katex` / `rehype-pretty-code`. Timebox it.

If it doesn't:
- **Fallback A** — `@next/mdx` with `mdx-components.tsx` and content moved under a colocated
  directory. Costs the file-path/URL decoupling; acceptable.
- **Fallback B** — precompile MDX to serialized JSX in a `prebuild` script and commit or cache
  the output. More moving parts; only if A also fails.

Record which path was taken in a comment block at the top of `src/lib/courses/mdx.ts`, because
every later task assumes it.

## Files affected

| File | Change |
|------|--------|
| `package.json` | + `next-mdx-remote`, `remark-math`, `rehype-katex`, `katex`, `rehype-pretty-code`, `shiki`, `gray-matter`, `zod` (already present) |
| `src/lib/courses/mdx.ts` (new) | Pipeline config: remark/rehype plugin chain, Shiki theme, component map |
| `src/lib/courses/mdx-components.tsx` (new) | MDX → React component map (`h2`, `pre`, `table`, `img`, callouts) |
| `src/app/[locale]/cursos/_styles/katex.css` (new) | Local KaTeX stylesheet import + display-math overflow containment |
| `content/courses/dl-nlp/es/00-*.mdx` (new) | One throwaway fixture lesson exercising math, code, tables, callouts |
| `next.config.mjs` | Only if the spike lands on Fallback A |

## The change

Plugin chain, in order:

```
remark: remark-gfm → remark-math
rehype: rehype-katex → rehype-pretty-code (Shiki)
```

`remark-math` parses `$…$` / `$$…$$`; `rehype-katex` renders them to HTML **at build time**,
emitting MathML alongside for screen readers. `rehype-pretty-code` wraps Shiki and gives
per-line highlighting and diff markers — worth it for a course that walks through code.

Custom components to expose to MDX in this task (widgets come in P2):

| Component | Purpose |
|---|---|
| `<Callout type="note\|warning\|intuition\|math">` | The "intuition before rigour" pattern this course needs throughout |
| `<Figure src alt caption>` | Consistent captions + `max-width: 100%` |
| `<Details summary>` | Collapsible full derivations — keeps rigour available without wrecking flow |
| `<ColabLink notebook>` | Block 4's escape hatch to GPU work |

Pick **one** Shiki theme and put it in `src/constants/` next to the existing design tokens.
Dark-only is fine — the site is dark-only.

## Acceptance criteria

- [ ] `$$\frac{\partial L}{\partial w_{ij}}$$` renders correctly in a built page
- [ ] KaTeX fonts load from `_next/static` — **verify no CSP `font-src` violation in the console**
- [ ] A Python block is highlighted with no client-side highlighter in the bundle
- [ ] Display math, `<pre>` blocks and tables each scroll **inside their own container**; the page body never scrolls horizontally
- [ ] `View Source` on a built lesson shows fully-rendered math and code (not placeholders) — proves build-time rendering
- [ ] Lesson route's client JS contains no `katex`, `shiki`, or MDX-compiler code
- [ ] All four custom components render from MDX
- [ ] File-top comment block carries `COURSE-P1-01` and records the spike outcome

## Test plan

- **Fixture lesson** (`00-pipeline-fixture.mdx`) exercising inline math, display math, a
  multi-line aligned derivation, Python + bash blocks, a GFM table, all four components, and a
  deliberately over-wide equation. Keep it `draft: true` permanently — it is a rendering
  regression fixture, not content.
- **Unit:** the plugin chain is a pure config export; assert the resolved chain shape so a
  dependency bump reordering plugins fails loudly rather than silently breaking math.
- **Manual:** build, serve, inspect at 360px and 1440px, check console for CSP violations.

## Notes / gotchas

- **Do not use a CDN for KaTeX CSS or fonts.** CSP blocks it. Import from the package.
- KaTeX CSS is ~23 KB gzipped and should load **only on lesson routes**, never in the shared
  layout. Import it in the lesson segment.
- `rehype-katex` throws on malformed LaTeX by default. Keep that — a typo in a derivation
  should fail the build, not ship a red error to a student.
- Shiki at build time can be slow across many files. If build time becomes a problem later,
  cache the highlighter instance across files — do not switch to a runtime highlighter.
- `gray-matter` parses frontmatter here but **validation belongs to P1-02**; don't duplicate it.
- Existing `react-markdown` chat rendering must keep working untouched. Don't "unify" them.

## Out of scope

- Widgets, Pyodide, quizzes (P2/P3).
- The registry and frontmatter schema (P1-02) — this task only needs `gray-matter` to strip frontmatter.
- Page layout and navigation (P1-03/04).
- Any real lesson content.

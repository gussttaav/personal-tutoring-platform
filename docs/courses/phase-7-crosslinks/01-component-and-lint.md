# P7-01 — `<Leccion>`: the component, the bridge pre-pass, the lint

**Tag:** `COURSE-P7-01` · **Effort:** M · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

One MDX component that turns a lesson slug into a link — or deliberately into plain text — plus the
`lint:content` pass that makes a broken reference fail the build, and a two-line budget change so
the lint stops charging authors for linking. **No lesson content changes in this task**; the
fixture is where it gets exercised.

## Context

- **The registry already owns everything the prose hardcodes.** `getLesson(courseSlug, lessonSlug,
  locale)` in `src/lib/courses/registry.ts:223` returns `title`, `block`, `order`, `summary`,
  `draft`. Prose that writes "la lección 5 de este bloque, sobre descenso de gradiente" is a
  hand-copy of two of those fields.
- **Five id-validating lint passes already exist** — `validate-explorables`, `validate-pycells`,
  `validate-quizzes`, `validate-challenges`, `validate-structure` — all called from
  `scripts/lint-content.ts`. A cross-reference is the one id-like thing in a lesson with no
  validation at all.
- **The bridge is already a machine-known region.** `AUTHORING.md §1` reserves exactly one `---` per
  lesson for it ("Reserve `---` for exactly this: one per lesson, nowhere else"), and
  `src/lib/courses/validate-structure.ts` warns when that is violated.
- **`extractHeadings` (`src/lib/courses/headings.ts`) shares `github-slugger` with `rehype-slug`**,
  by explicit design, so ids computed from source cannot drift from ids rendered into HTML. That is
  what makes anchor validation exact rather than approximate.
- **The per-lesson binding precedent exists.** `lessonMdxComponents(quiz, challenges)` in
  `src/lib/courses/mdx-components.tsx` already closes frontmatter data over the component map,
  because a Server Component in that map cannot reach route params or frontmatter. `<Leccion>` has
  the same problem and takes the same solution.
- **`prose()` (`src/lib/courses/budget.ts:170`) strips JSX *tags* but keeps their *children*.** So
  `<Leccion>la lección sobre X</Leccion>` would count its label toward the word budget — a toll on
  linking.
- **Quiz and challenge copy is compiled through a different, deliberately minimal map.**
  `src/lib/courses/quiz/render.tsx` passes `W` and nothing else ("`W` is the ONLY custom component
  here"). **72 numbered cross-references live in quiz/challenge frontmatter across 30 lessons**, so
  this is not an edge case.

## Files affected

| File | Change |
|------|--------|
| `src/lib/courses/Leccion.tsx` (new) | `makeLeccion(courseSlug, locale, current)` → the component |
| `src/lib/courses/bridge.ts` (new) | `markBridgeReferences(source)` — pure source pre-pass |
| `src/lib/courses/validate-crosslinks.ts` (new) | `findLecciones`, `crosslinkProblems`, `validateCrosslinks` |
| `src/lib/courses/mdx-components.tsx` | `lessonMdxComponents` gains a `ctx` argument; binds `Leccion` |
| `src/lib/courses/mdx.ts` | `renderLesson` gains `ctx`; calls `markBridgeReferences` before compiling |
| `src/lib/courses/quiz/render.tsx` | Bind `Leccion` alongside `W` (see decision below) |
| `src/app/[locale]/cursos/[courseSlug]/[lessonSlug]/page.tsx:157` | Pass `ctx` to `renderLesson` |
| `src/lib/courses/budget.ts` | `prose()` strips `<Leccion>` tag **and** children |
| `src/app/[locale]/cursos/_styles/lesson.css` | `.lesson-ref` + the hover card |
| `scripts/lint-content.ts` | Sixth correctness pass |
| `content/courses/dl-nlp/es/00-pipeline-fixture.mdx` | One reference of each kind, permanently |
| `docs/courses/AUTHORING.md` | The authoring rule + the direction-wording rule |
| `__tests__` | `bridge`, `validate-crosslinks`, `budget` |

## The change

### 1. `markBridgeReferences` — how the component learns where it is

A Server Component cannot know its own position in the document, so the bridge flag is put on the
**source**, before `compileMDX`:

```ts
// COURSE-P7-01 — split at the lone thematic break (AUTHORING.md §1, policed by
// validate-structure.ts) and flag the <Leccion> tags below it. A remark plugin
// would be the "proper" alternative, but it adds a plugin to the chain whose
// order mdx.test.ts guards; this touches nothing in the pipeline.
export function markBridgeReferences(source: string): string {
  const breaks = [...source.matchAll(/^---\s*$/gm)];
  if (breaks.length === 0) return source;
  const cut = breaks[breaks.length - 1].index!;
  return source.slice(0, cut) +
    source.slice(cut).replace(/<Leccion\b/g, "<Leccion bridge");
}
```

Frontmatter is already stripped by the time this runs on the body; if it is not, the `---`
delimiters of the frontmatter itself must be excluded first. **Assert this in a test** — it is the
one way this function can be quietly wrong.

### 2. `Leccion` — the component

```tsx
export function makeLeccion(courseSlug: string, locale: string, current: Lesson) {
  return function Leccion({ slug, ancla, bridge, children }: LeccionProps) {
    const target = getLesson(courseSlug, slug, locale);
    const label  = children ?? target?.title;

    const ahead = !!target && (target.block > current.block ||
      (target.block === current.block && target.order > current.order));

    // Plain text in exactly two cases: the target is not visitable (draft), or
    // the bridge already hands off to it via LessonNav two paragraphs below.
    if (!target || target.draft || (ahead && bridge)) return <>{label}</>;

    const href = `/cursos/${courseSlug}/${slug}` + (ancla ? `#${ancla}` : "");
    return (
      <Link href={href} className="lesson-ref" data-ahead={ahead || undefined}>
        {label}
      </Link>
    );
  };
}
```

`Link` is next-intl's, so the locale prefix is applied from the **request** locale. The metadata
lookup, however, uses the **content** locale — see the gotcha below.

### 3. The hover card

Rendered as a sibling `<span>` inside the link's wrapper, styled in `lesson.css`, **server-rendered**
— no client JS, so `check:bundle` stays green and there is no hydration shift.

- Kicker: `BLOQUE {block} · LECCIÓN {order}`, prefixed `MÁS ADELANTE ·` in `--warning` when `ahead`
- Title: `target.title`
- Summary: `target.summary`, clamped with `-webkit-line-clamp: 5`
- Wrapped in `@media (hover: hover) and (pointer: fine)` — on touch the tap navigates

### 4. `validate-crosslinks.ts` — the sixth pass

Modelled on `validate-explorables.ts`: a pure `crosslinkProblems()` that takes parsed refs and
throws nothing, plus a thin filesystem wrapper. Two failures, both fatal:

- `unknown lesson slug "…"` — typo, or a lesson that no longer exists
- `no heading "#…" in <slug>` — the target heading was retitled, checked via `extractHeadings`

A reference to a `draft: true` lesson is **not** an error — it renders as plain text by design.
Emit it as an advisory warning in phase 2 of the lint, alongside `budgetWarnings`.

### 5. The budget exemption

In `prose()`, **before** the generic tag strip:

```ts
.replace(/<Leccion\b[^>]*\/>/g, " ")
.replace(/<Leccion\b[^>]*>[\s\S]*?<\/Leccion>/g, " ")
```

`withoutFences` already ran, so a `<Leccion>` quoted inside a ```mdx fence is documentation and
survives, exactly as `countLongestCodeCell` handles quoted cells.

### 6. Quiz and challenge copy — the decision

**Bind `Leccion` in `quiz/render.tsx` too.** 72 of the ~403 references live there, and a quiz
explanation is where "go back and check" is most valuable — the student has just got it wrong.
`bridge` is always `false` for frontmatter copy, and the same `makeLeccion` factory is threaded in.
Leaving quiz copy out would mean 30 lessons keep hand-written numbers with no validation.

## Acceptance criteria

- [ ] `<Leccion slug="…">` renders a next-intl `Link` for a published, behind-the-reader target
- [ ] A target ahead of the reader **above** the `---` links, and its card is marked *Más adelante*
- [ ] The same reference **below** the `---` renders as plain text
- [ ] A `draft: true` target renders as plain text and warns (does not fail)
- [ ] An unknown slug fails `pnpm lint:content` naming file and slug, exit 1
- [ ] A stale `ancla` fails the same way, naming file, slug and anchor
- [ ] `<Leccion>` renders inside a quiz explanation
- [ ] The card is absent from the DOM's hover state on a coarse pointer; the link still navigates
- [ ] Word count for a lesson is unchanged when a plain reference is converted to `<Leccion>`
- [ ] `pnpm check:bundle` green — the card ships no client JS

## Test plan

**Unit**
- `bridge.test.ts` — no `---` → unchanged; one `---` → only tags below are flagged; a `---` inside a
  fenced block does not count; frontmatter delimiters are not mistaken for the bridge
- `validate-crosslinks.test.ts` — unknown slug; stale anchor; valid anchor; self-reference; draft
  target warns but does not throw; a `<Leccion>` inside a fence is ignored
- `budget.test.ts` — a converted reference leaves `countWords` unchanged; a `<Leccion>` inside an
  ```mdx fence still counts
- Pure `isAhead(current, target)` — same block, cross block, equal position

**Fixture** — add to `00-pipeline-fixture.mdx`, permanently, matching what P2-02/P2-03/P3-01/P3-02
each did: one backward reference with an anchor, one forward reference above the `---`, one forward
reference inside the bridge, one to a draft lesson, and one inside a quiz explanation.

**Live** — production build, hover each card, confirm the card is in the prerendered HTML (no
layout shift), confirm no horizontal scroll at 360px with a card open near the right margin, and
confirm the four lint failures each exit 1 before reverting them.

## Notes / gotchas

- **Use `view.contentLocale`, not `locale`, for the registry lookup.** The lesson page already
  falls back to the default locale when the request locale has no content tree
  (`page.tsx:149`). Passing the request locale would make `getLesson` return `null` on `/en` and
  silently degrade *every* reference to plain text. This is the same distinction
  `enrollment-view.ts` records in the P4-03 notes — resolve metadata against the locale that
  actually has content, and let next-intl's `Link` supply the URL prefix.
- **`blockJS: false` is load-bearing** (set in `mdx.ts` by P2-03). Without it, next-mdx-remote
  strips JSX expression attributes silently. `<Leccion>` uses only string attributes, so it is safe
  either way — but do not "tidy" that setting.
- **The card must not be a client component.** It is static content from the registry; making it
  interactive would put it in the lesson bundle and defeat `check:bundle`.
- **Anchors are locale-scoped by construction.** `es/` references resolve against `es/` headings.
  This is why no remark plugin and no explicit heading ids are needed — see the phase README.
- **A card near the viewport edge can overflow.** `left: 50%; transform: translateX(-50%)` plus
  `max-width: min(26rem, 82vw)` is the prototype's answer; verify at 360px.

## Out of scope

- Migrating any lesson content — that is P7-02.
- The advisory "forward reference with no direction word" lint. Decide after P7-02 shows whether the
  wording rule is actually forgotten in practice.
- The orphan-lesson report.

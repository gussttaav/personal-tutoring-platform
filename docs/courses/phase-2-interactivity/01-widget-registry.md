# P2-01 — Widget registry + pure math core

**Tag:** `COURSE-P2-01` · **Effort:** M · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

A typed registry mapping widget ids to lazily-loaded React components, invoked from MDX as
`<Explorable id="sigmoid" />`. Widget **mathematics** lives in pure functions in a separate
module so it is unit-testable with no DOM — satisfying the project rule that new logic ships
with a test, and making the widgets debuggable.

## Context

- CLAUDE.md: "New business logic requires a service-level test with mock repositories." Widget
  math is not service logic, but the spirit applies and is easy to honour here: keep the maths
  out of the components.
- MDX component map already exists from P1-01; this task adds `Explorable` to it.
- Bundle guard (P1-04) must stay green — widgets are `next/dynamic`, never statically imported
  into a layout.

## Files affected

| File | Change |
|------|--------|
| `src/features/courses/widgets/registry.ts` (new) | `Record<string, LazyComponent>` + id type |
| `src/features/courses/widgets/Explorable.tsx` (new) | MDX-facing wrapper: resolve id, lazy-load, error/loading boundary |
| `src/features/courses/widgets/math/` (new) | Pure functions: activations, gradient descent, softmax, attention scores |
| `src/features/courses/widgets/primitives/` (new) | `Slider`, `Plot2D`, `Heatmap`, `VectorField`, `WidgetFrame` |
| `src/features/courses/widgets/math/__tests__/` (new) | Unit tests for every pure function |
| `src/lib/courses/mdx-components.tsx` | + `Explorable` |
| `scripts/lint-content.ts` | + validate every `<Explorable id>` in content resolves in the registry |
| `package.json` | + `d3-scale`, `d3-shape` (+ types) |

## The change

**Registry** — ids are a string-literal union derived from the registry object, so an unknown id
is a **type error**, and `lint-content` catches it in MDX (where TypeScript can't see it):

```ts
export const WIDGETS = {
  "sigmoid-explorer":  dynamic(() => import("./activations/SigmoidExplorer")),
  "gradient-descent":  dynamic(() => import("./optimisation/GradientDescent")),
  // …
} as const;

export type WidgetId = keyof typeof WIDGETS;
```

**`WidgetFrame`** wraps every widget with the shared chrome: optional caption, reset control,
consistent border/background from the design tokens, and — importantly — a **fixed aspect ratio
box** so the page doesn't reflow when a widget hydrates. Layout shift while a student is reading
is the most annoying possible bug here.

**Primitives, not a chart library.** This course needs curves, heat maps, vectors and arrows —
not dashboards. Hand-rolled SVG with `d3-scale` for the scales and `d3-shape` for path
generation is smaller, more controllable, and avoids fighting a chart library's opinions about
axes. Do **not** add Recharts/Plotly/Chart.js.

**Pure math module** — everything computational, no React:

```
math/activations.ts   sigmoid, tanh, relu, leakyRelu, gelu + derivatives
math/optimisation.ts  gradientDescentPath(f, grad, start, lr, steps)
math/linalg.ts        matmul, transpose, softmax (row-wise, numerically stable)
math/attention.ts     scaledDotProductAttention(Q, K, V)
```

These get real unit tests: known values, derivative correctness against finite differences,
softmax numerical stability with large inputs, and shape correctness for the matrix ops.

## Acceptance criteria

- [ ] `<Explorable id="sigmoid-explorer" />` renders in a lesson
- [ ] An unknown id fails `pnpm lint:content` with the offending file and id named
- [ ] Widgets are `next/dynamic` — bundle guard confirms none reach the shared layout
- [ ] `WidgetFrame` reserves space; no layout shift on hydration (verify visually with throttled network)
- [ ] Every function in `math/` has a unit test; softmax is stable at input `[1000, 1001]`
- [ ] Derivatives match finite-difference approximations within tolerance
- [ ] A widget that throws renders a contained error, not a blank lesson
- [ ] Widgets are keyboard-operable (sliders reachable and adjustable via arrow keys)
- [ ] `pnpm test` + `pnpm build` green

## Test plan

- **Unit (the bulk):** `math/__tests__/` per module as above. These are fast, deterministic and
  the reason the math lives outside components.
- **Component:** `Explorable` renders a fallback for a missing id in dev; error boundary contains a throwing widget.
- **Manual:** hydration layout shift; keyboard operation; a widget on a 360px viewport.

## Notes / gotchas

- **Reserve widget height before hydration.** Aspect-ratio box in `WidgetFrame`. Non-negotiable.
- Keep widget state local. No context, no global store — a widget must be droppable anywhere.
- SVG text does not scale well below ~320px. Give widgets a minimum sensible width and let them
  scroll inside `WidgetFrame` rather than shrinking labels to unreadability.
- `prefers-reduced-motion`: animated widgets (gradient descent trace) must offer a step control
  and skip auto-animation when it's set.
- Don't build a generic "widget config from frontmatter" system. Props in MDX are enough, and
  the indirection would make widgets harder to find, not easier.

## Out of scope

- The actual widgets for Blocks 0–1 (P2-02) — this task ships the registry, primitives, math and
  **one** trivial reference widget to prove the path.
- Pyodide (P2-03).
- Widgets for Blocks 2–4 — authored alongside their content in P5.

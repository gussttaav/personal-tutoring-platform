# Phase 2 — Interactivity

The two things that make this course worth building rather than writing as a PDF: **explorable
visualisations** (sliders that reshape a sigmoid, a live gradient-descent trace, an attention
heat map you can hover) and **runnable Python** in the browser.

They are very different in cost. Explorables are ordinary React and carry ~10 KB each.
Pyodide is ~10 MB plus ~7 MB for NumPy and needs a worker, a timeout and a CSP change. The
phase is ordered so the cheap, high-value half lands first.

## Tasks

1. [01-widget-registry.md](01-widget-registry.md) — `COURSE-P2-01` (M) — registry + pure math core
2. [02-first-explorables.md](02-first-explorables.md) — `COURSE-P2-02` (L) — the Block 1/2 widget set
3. [03-pyodide-cells.md](03-pyodide-cells.md) — `COURSE-P2-03` (L) — worker, `PyCell`, CSP

**Landing order:** strictly sequential. P2-03 is independent of P2-02 in principle, but landing
the registry-shaped work first keeps `PyCell` consistent with the widget conventions.

## Exit criteria

- [ ] `<Explorable id="…" />` renders from MDX; an unknown id **fails the build**
- [ ] Widget math is in pure functions, unit-tested with no DOM
- [ ] A NumPy snippet runs in-browser and prints output
- [ ] `while True:` is killed by the timeout without freezing the tab
- [ ] Pyodide loads only after the first Run click, and only on `hasCode` lessons
- [ ] Bundle guard still green (nothing new in the shared layout)
- [ ] `pnpm test` + `pnpm build` green

## Design principle

**Widgets are props-driven and course-agnostic.** A widget takes typed props and renders; it
never reaches into course content or global state. That is what makes the registry reusable for
course #2, and what lets the math be tested without a browser.

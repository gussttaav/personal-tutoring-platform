# P1-04 — Responsive lesson reader

**Tag:** `COURSE-P1-04` · **Effort:** L · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

The lesson page: `/cursos/[courseSlug]/[lessonSlug]`. Three-column on desktop, single-column
with a drawer on mobile. **Designed mobile-first**, because long-form mathematics on a 360px
screen is the genuinely hard case and retrofitting it later never works.

## Context

- Content is long-form: display equations, wide code blocks, tables. Every one of these can blow
  out the viewport width if not contained. The artifact/page rule applies: wide content scrolls
  **inside its own container**; the page body never scrolls horizontally.
- Existing responsive references: `src/components/WeeklyCalendar.tsx`, `src/features/personal-area/`.
- KaTeX CSS must load on this segment only, never the shared layout (P1-01).

## Files affected

| File | Change |
|------|--------|
| `src/app/[locale]/cursos/[courseSlug]/[lessonSlug]/page.tsx` (new) | Static lesson route |
| `src/features/courses/reader/LessonLayout.tsx` (new) | The 3-column / drawer shell |
| `src/features/courses/reader/LessonSidebar.tsx` (new) | Blocks + lessons nav, current highlighted |
| `src/features/courses/reader/OnThisPage.tsx` (new) | Heading outline, desktop only |
| `src/features/courses/reader/LessonNav.tsx` (new) | Prev / next footer |
| `src/features/courses/reader/MobileLessonBar.tsx` (new) | Sticky header: drawer toggle, title, progress |
| `src/app/[locale]/cursos/[courseSlug]/[lessonSlug]/lesson.css` (new) | Typography + overflow containment |
| `messages/es.json` + `messages/en.json` | + `courses.reader.*` (**both files**) |
| `scripts/check-bundle.ts` (new) | Bundle guard (see below) |

## The change

**Layout**

| Breakpoint | Shape |
|---|---|
| ≥1280px | sidebar (280px) │ content (max 72ch) │ on-this-page (240px) |
| 768–1279px | collapsible sidebar │ content — no right rail |
| <768px | content only; sidebar in a drawer; sticky compact top bar; prev/next footer |

**Containment rules — the load-bearing part of this task.** In `lesson.css`:

- `.katex-display` → `overflow-x: auto; overflow-y: hidden;` with a scroll affordance
- `pre` → `overflow-x: auto`, never `white-space: pre-wrap` (wrapping Python is worse than scrolling it)
- `table` → wrapped in an `overflow-x: auto` container
- Inline math must not force overflow — allow line breaking around inline `$…$`
- Content column capped at ~72ch for readability

**Reading typography.** Larger base size than the marketing pages (16–18px), generous line
height, real spacing between a paragraph and the display equation it introduces. This is a page
someone reads for 25 minutes, not a page they scan.

**Bundle guard.** A `scripts/check-bundle.ts` that fails if `katex`, `shiki`, `pyodide` or
`features/courses/widgets` appear in the shared layout chunk or the landing route's client JS.
Cheap to write, and it is the only thing that will reliably stop a stray top-level import from
quietly adding megabytes to the home page six months from now.

## Acceptance criteria

- [ ] Lesson renders statically at both `/cursos/dl-nlp/x` and `/en/cursos/dl-nlp/x` (English 404s cleanly while no `en` content exists)
- [ ] At 360px: no horizontal page scroll with a deliberately over-wide equation, a long code line, and a wide table all on screen
- [ ] Each of those three scrolls independently, with a visible affordance
- [ ] Drawer traps focus, closes on Escape and on backdrop click, restores focus to the toggle
- [ ] Sidebar highlights the current lesson and marks drafts as absent (not greyed — absent)
- [ ] Prev/next respect `(block, order)` and are correctly absent at the ends
- [ ] On-this-page is desktop-only and derived from rendered `h2`/`h3`
- [ ] Bundle guard fails when a widget is imported into the shared layout (verify by temporarily adding one)
- [ ] All chrome strings via `t()`, keys in **both** message files
- [ ] `pnpm lint` + `pnpm build` green

## Test plan

- **Unit:** `lessonNeighbours` edge cases via the registry fixture; heading-outline extraction.
- **Manual (primary):** the P1-01 fixture lesson at 360 / 768 / 1440. Real device if possible —
  emulators lie about sticky headers and drawer scroll-locking.
- **Manual a11y:** keyboard-only navigation through drawer → sidebar → content → prev/next;
  confirm KaTeX MathML is present for screen readers.
- **Bundle:** run the guard; confirm the lesson route's client JS excludes KaTeX/Shiki.

## Notes / gotchas

- **Do not lazy-render content below the fold.** Static HTML is the SEO asset; hiding it behind
  an intersection observer throws away the main reason lessons are statically generated.
- Scroll-lock the body when the drawer is open — the existing `ComingSoonModal` already does this
  (`document.body.style.overflow`); reuse the pattern rather than inventing another.
- The sticky mobile bar must not cover a heading when the user follows an anchor link — set
  `scroll-margin-top` on headings to the bar height.
- Leave a slot in `MobileLessonBar` for the progress indicator (P4-02). Slot only, no logic.
- Don't build reading-position restore. Cheap to want, fiddly to get right, and P4-02's
  "resume where you left off" at lesson granularity covers 90% of the value.

## Out of scope

- Progress tracking and the "mark complete" control (P4-02).
- Widgets, code cells, quizzes (P2/P3) — but the MDX component map must accept them without a layout change.
- Cross-lesson search (out of scope for the whole plan).

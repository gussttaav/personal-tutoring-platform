# P9-02 — Inline search in the desktop sidebar

**Tag:** `COURSE-P9-02` · **Size:** M · **Status:** done

## TL;DR

On desktop the sidebar's search "field" was a button that opened the P9-01 dialog over the lesson.
It is now a real field under the back-to-course link: typing replaces the block list with the
results inline in the rail, an × (or Escape) brings the list back, and the results **survive a
result click** — the reader can walk through every hit without re-typing. Mobile is untouched:
the bar's icon button still opens the full-screen dialog.

## Context

Two facts about the reader decided the shape of this:

- **Everything under `[lessonSlug]/page.tsx` is remounted on every lesson navigation.** There is
  no `layout.tsx` under `cursos/`; `LessonLayout`, both providers and the sidebar are per-page.
  The only state that survives a result click is module-level — which is already how
  [`useSearchIndex.ts`](../../../../src/features/courses/search/useSearchIndex.ts) caches the index.
- **Desktop vs mobile is CSS at 768px, not JS.** [`LessonSidebar.tsx`](../../../../src/features/courses/reader/LessonSidebar.tsx)
  is a Server Component rendered twice (desktop aside + drawer) with `display:none` hiding one.
  P9-01 kept the triggers out of it for that reason; the field now goes in, gated on
  `variant === "desktop"`, which is what keeps exactly one field in the DOM.

## Files affected

| File | Change |
|---|---|
| `src/features/courses/search/SidebarSearch.tsx` | **New.** The field, the ×, the inline results, the hidden list |
| `src/features/courses/search/sidebar-query-store.ts` | **New.** Module-level query per `course:locale` |
| `src/features/courses/search/__tests__/sidebar-query-store.test.ts` | **New.** Unit test for the store |
| `src/features/courses/search/useSearchIndex.ts` | `enabled` flag; resolved-value cache so a remount starts `ready` |
| `src/features/courses/reader/LessonSidebar.tsx` | Desktop variant wraps progress bar + list in `SidebarSearch` |
| `src/features/courses/reader/LessonLayout.tsx` | Desktop trigger removed from the `<aside>` |
| `src/features/courses/search/CourseSearchTrigger.tsx` | `bar` variant deleted; icon-only, mobile-only |
| `src/features/courses/reader/MobileLessonBar.tsx` | `<CourseSearchTrigger />` (no variant) |
| `src/app/[locale]/cursos/_styles/search.css` | `.cs-sidebar` section; `.cs-trigger-label` deleted |
| `e2e/courses-search.spec.ts` | Desktop cases rewritten for the inline field; dialog cases under a 390px viewport |
| `src/lib/courses/search/content-language.ts` (+ test) | **New.** `native` / `partial` / `fallback` — notice vs per-result tag |
| `src/features/courses/search/CourseSearchDialog.tsx` | Breadcrumb wrapper; "Try" chips removed; language tag on the kicker |
| `messages/{es,en}.json` | `courses.search.tipsHeading` removed from both; no key added — the tag reuses `courses.reader.refFallback` |

## Decisions worth keeping

**The query lives in a module-level store, read by a `useState` lazy initializer.** On client-side
navigation there is no hydration, so the persisted query is in the very first render of the next
lesson; on a hard load the store is empty on both sides. Rejected: `sessionStorage` (needs a
post-hydration read, so the list would paint before the results on every click); a `?q=` param
(pollutes static, indexable lesson URLs); a `[courseSlug]/layout.tsx` hosting the sidebar (large,
and moves `currentSlug` resolution to the client). Hard-reload persistence is deliberately not a
goal — a fresh load starting from the lesson list is the least surprising outcome.

**The index hook gained a resolved-value cache next to the promise cache.** Without it every
result click painted "Preparando la búsqueda…" for one frame between the remount and the cached
promise settling — the exact moment persistence is for. `enabled` is derived from *either* a focus
or a non-empty query — never from focus alone, because a value can arrive without a focus event (a
persisted query on remount, a browser restoring the field on back/forward, a hidden window whose
focus events are deferred) and a query with no index would spin on "Preparando…" forever. A reader
who never searches still never pays for the index.

**The breadcrumb heading is one flex item.** `.cs-breadcrumb` is a flex row for "arrow + heading",
but `HighlightedText` is a fragment of text runs and `<mark>`s — unwrapped, a matched heading
became three columns. Wrapped in `.cs-breadcrumb-text` it wraps as a block with a hanging indent
under its own first line; the sidebar pins the arrow to that line (`align-items: flex-start`).
Same wrapper applied to the dialog, where the mobile sheet had the same latent bug.

**The list is hidden, not unmounted.** `<details>` is uncontrolled after mount, so a block the
reader toggled stays as toggled after search → clear; the progress leaves keep their context
subscriptions; and `children` is a stable element, so React skips that subtree on every
keystroke. The `hidden` attribute goes on a wrapper `<div>` — the inner `<ol>` carries an inline
`display:flex` that would beat the UA `[hidden]` rule.

**Plain links, not the dialog's combobox.** The results replace a list of ordinary links, so they
are ordinary links: tabbable, `aria-current` on the lesson being read, and next-intl `<Link>`
adding the locale prefix itself. `aria-activedescendant` + `tabIndex={-1}` exists to pin focus in
a modal input; in a non-modal region it would remove every result from the tab order.
`keyboard.ts` stays the dialog's. Enter in the field opens the first result (the dialog's default
active option), Escape clears — handled explicitly because Chromium's native `type=search`
Escape-clear fires `input` with `""` and Firefox's does not, and neither updates the store.

**"The lessons are in Spanish" only while none of them is translated.** P9-01 showed the notice
whenever *any* lesson fell back to Spanish, which with Phase 11 landing lessons one by one made
it permanent and false on `/en`. `src/lib/courses/search/content-language.ts` now classifies the
index as `native` / `partial` / `fallback` (pure, tested), and both surfaces derive from it: the
notice for `fallback`, a per-result "· In Spanish" on the kicker for `partial` (the `<Leccion>`
card's `refFallback`, same grain and same string), nothing for `native`. Never notice *and* tags.
The `/en` e2e derives its expectation from the served index so it holds in all three states.

**The dialog's "Try" chips are gone.** Three lesson titles as example queries — a title is a poor
example of a search, and the row of pills was the first thing a phone user saw. The idle state is
the scope note alone. `tipsHeading` removed from both message files; `.cs-tips`/`.cs-chip` CSS too.

**Snippets are 90 characters here, 180 in the dialog.** The rail is 280px; the default window is
two lines at 680px and five in the rail, with the match clipped out by the 2-line clamp.

## Acceptance criteria

- [x] Desktop: a real `<input type="search">` under the back-to-course link; nothing fetched until
      it is focused or holds a query
- [x] A heading that matches the query wraps as one block in the rail, arrow on the first line
- [x] Typing hides the block list and renders results inline; the current lesson is marked
- [x] Clicking a result navigates and the results are in the first frame of the next lesson
- [x] × and Escape clear the query and bring the list back with its toggles intact
- [x] `/en` results carry the `/en` prefix; the notice only while nothing is translated, a
      "· In Spanish" tag on each Spanish result while the course is partly translated
- [x] The dialog's idle state shows the scope note only — no suggested queries
- [x] Mobile: the icon button still opens the full-screen dialog; no field in the drawer
- [x] `pnpm lint`, `tsc --noEmit`, `pnpm test:unit`, `pnpm build` green
- [ ] `pnpm check:bundle` — **fails before and after this task**, on the `"gt:pyodide-loaded"`
      localStorage key literal that P11-02 put in `interpreter-cache.ts` (imported by the
      first-load `PyCellClient`). The guard's `FORBIDDEN_EVERYWHERE` marker matches the word, not
      the module; the real Pyodide runtime is still only in the lazy chunk. Nothing in this task
      touches that code — fix the marker separately, as the guard's own header prescribes

## Gotchas

- **Never write the store from an effect.** A `useEffect` keyed on `query` would run once on mount
  writing the value it just read, and it is the effect-as-sync smell the repo's React 19 rules
  push back on. The three event handlers (change, ×, Escape) are the only writers.
- The desktop `SidebarSearch` also mounts on mobile, inside the `display:none` aside. It is inert
  there — nothing focuses it, nothing fetches — but it is in the DOM, so do not `.first()` a
  search selector without scoping it to `aside.lesson-sidebar-desktop`.
- The dialog's desktop-only CSS (`.cs-panel` at 680px, the `.cs-footer` hints) is now unreachable
  at ≥768px. Left in place rather than pruned: the mobile sheet overrides it and the diff would be
  noise.
- `.cs-grouplink` and `.cs-grouphead` tie on specificity; the sidebar block sits after the dialog
  rules in `search.css` so its padding wins on order. Keep it there.

## Out of scope

- A sticky field at the top of the scrolling rail — the field is already at the top of what the
  reader is looking at, and sticky inside the rail needs an opaque background and a z-index that
  fight the margin collapse under it. Cheap follow-up if wanted.
- Persisting the query across a hard reload.
- ⌘K / `/` — still rejected, see the README.

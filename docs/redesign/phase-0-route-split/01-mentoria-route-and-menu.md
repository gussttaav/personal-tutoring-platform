# P0-01 — `/mentoria` route + menu

**Tag:** `REDESIGN-P0-01` · **Effort:** M · **Owner:** Claude · **Status:** ✅
**Depends on:** nothing

## TL;DR

Give the tutoring landing its own route, `/mentoria` (and `/en/mentoria`), rendering exactly
what `/` renders today. Put «Inicio» in the menu and make «Mentoría» a page link instead of an
anchor into `/`. Delete the `#sessions` scroll-intent machinery: with Mentoría a page, «go to
the mentoring section» is just a navigation. `/` itself is untouched in this task.

## Context

- `src/app/[locale]/page.tsx` — the current landing composition: `StructuredData`, `Navbar`,
  the `.landing-column` with `HeroSection` / `BiographySection` / `SpecializationsSection` and
  `InteractiveShell` inside the one `Suspense` boundary, the `fadeUp` keyframes, `Footer`. Its
  `generateMetadata` reads `landing.meta` and `localizedAlternates("", locale)`.
- `src/components/Navbar.tsx:43-47` — `NAV_LINKS`: Cursos `/cursos`, Mentoría `/#sessions` with
  `match: "/"`, Blog `/blog`. `:57-61` — `isActive`: `match === "/"` is an exact match, anything
  else a prefix match. `:84-96` — `handleNavLinkClick` special-cases `/#sessions` through
  `onSessionsClick` (`useSessionsAnchor`, imported `:13`, called `:35`). `:81` —
  `handleLogoClick` dispatches `close-booking-overlay` with no detail. The desktop bar maps `NAV_LINKS` at
  `:137`; the mobile panel maps it twice (signed-in `:392`, signed-out `:445`) with an `icon`
  per item.
- `src/components/Footer.tsx:15-16,22,152-165` — the «Mentoría» link is `href="/#sessions"` +
  `onClick={onSessionsClick}`, with a `COURSE-P6-03` comment explaining why.
- `src/hooks/useSessionsAnchor.ts` — the whole file exists for the anchor: `takeScrollIntent`
  (read-once `sessionStorage`) and the click handler that either dispatches
  `close-booking-overlay` with `{ scrollTo }` on `/` or stores the intent and pushes `/`.
- `src/features/booking/InteractiveShell.tsx:22` imports `takeScrollIntent`; `:118-131` consume
  it inside a timer on mount; `:132-145` listen to `close-booking-overlay` and, when the detail
  carries `scrollTo`, smooth-scroll to it after closing the overlay. `:385` — `<section
  id="sessions">`, the anchor target.
- `src/features/courses/landing/CourseAuthorNote.tsx:66` — `href="/#sessions"` (plain link, no
  handler).
- `src/app/robots.ts` — the `disallow` list; `src/app/sitemap.ts:45` — `staticRoutes` (do not
  add `/mentoria` here yet, see P2-04).
- `messages/es.json` / `messages/en.json` — `nav.*` (`courses`, `mentoring`, `blog`, …),
  `footer.*` (`courses`, `blog`, `mentoring`).
- `e2e/courses-navigation.spec.ts:144-190` — «the nav marks the CURRENT page, and Mentoría stops
  looking current»; `:192-240` — two tests asserting that Mentoría scrolls `#sessions` into view
  from `/cursos` with a clean URL. Both encode the anchor behaviour this task removes.

## Files affected

| File | Change |
|------|--------|
| `src/app/[locale]/mentoria/page.tsx` | **New.** The current `page.tsx` composition, verbatim (imports included), with `generateMetadata` returning `landing.meta` + `robots: { index: false, follow: true }` + `alternates: localizedAlternates("/mentoria", locale)`; `generateStaticParams` over `routing.locales` |
| `src/app/[locale]/page.tsx` | Unchanged in this task (still the old landing). Add a one-line `REDESIGN-P0-01` comment noting the duplicate is temporary until P1-04 |
| `src/components/Navbar.tsx` | `NAV_LINKS` → `[{ home, "/", match "/", icon "home" }, { courses … }, { mentoring, "/mentoria", match "/mentoria", icon "group" }, { blog … }]`; drop the `/#sessions` branch of `handleNavLinkClick` and the `useSessionsAnchor` import/call; keep `handleLogoClick` |
| `src/components/Footer.tsx` | «Mentoría» → `<Link href="/mentoria">`, no `onClick`; drop the `useSessionsAnchor` import and the `COURSE-P6-03` comment block about the anchor |
| `src/hooks/useSessionsAnchor.ts` | **Deleted** |
| `src/features/booking/InteractiveShell.tsx` | Remove the `takeScrollIntent` import and the mount effect that consumes it; keep the `close-booking-overlay` listener but drop the `scrollTo` branch; keep `id="sessions"` (harmless, and the footer link may target it later) |
| `src/features/courses/landing/CourseAuthorNote.tsx` | `href="/#sessions"` → `href="/mentoria"` |
| `messages/es.json`, `messages/en.json` | `nav.home`: «Inicio» / «Home» — key-for-key |
| `e2e/courses-navigation.spec.ts` | `:144-190`: Inicio current on `/`, Mentoría current on `/mentoria`, neither on `/cursos`; `:192-240`: replace the two scroll tests with one: from `/cursos`, navbar «Mentoría» lands on `/mentoria` and the footer «Mentoría» too; the `/#sessions#sessions` regression test goes (the mechanism it guarded is gone) |

## The change

**The route.** `mentoria/page.tsx` is a copy, not a shared component: Phase 1 rewrites `/`
section by section and Phase 2 rewrites `/mentoria` section by section, and a shared
`LandingComposition` would be deleted two PRs later. The `noindex` is what makes a temporary
duplicate acceptable; it comes off in P2-04.

**The menu.** Four items. `isActive` needs no change: `match: "/"` is already the exact-match
case, and `/mentoria` prefix-matches like `/cursos`. The mobile panel maps the same array, so
«Inicio» appears there with the `home` Material Symbol.

**The anchor is deleted, not retargeted.** `useSessionsAnchor` solved «a section link that had
to work from other pages». That problem no longer exists: «Mentoría» is a page, and its header
is the mentoring offer. Keeping the hook «in case» would mean keeping `sessionStorage`
bookkeeping and a timer in `InteractiveShell` for a click nobody makes. `close-booking-overlay`
stays because the logo click still uses it to close an open booking on `/mentoria`.

**What the e2e tests should assert now.** The current-page rule (`aria-current="page"` + green
+ underline) on the right item for `/`, `/mentoria` and `/cursos`; and that «Mentoría» from the
navbar and from the footer navigates to `/mentoria` with a clean URL. The scroll assertions
have no subject any more.

## Acceptance criteria

- [x] `/mentoria` and `/en/mentoria` render the full landing (hero with stats, bio, areas,
      sessions, packs); a session card click opens the same flow as on `/`
- [x] `<meta name="robots" content="noindex, follow">` (or equivalent) is in `/mentoria`'s head;
      `/mentoria` is not in `sitemap.xml`
- [x] Desktop navbar and both mobile panels list Inicio · Cursos · Mentoría · Blog; `nav.home`
      exists in both message files
- [x] On `/`: Inicio has `aria-current="page"`; on `/mentoria`: Mentoría; on `/cursos`: Cursos
      only
- [x] Footer «Mentoría» is a plain link to `/mentoria` (respects `/en`)
- [x] `src/hooks/useSessionsAnchor.ts` is gone; `grep -rn "SESSIONS_ANCHOR\|takeScrollIntent\|gt:scroll-intent" src` is empty
- [x] `pnpm lint`, `pnpm test`, `pnpm build` green; the `courses-navigation` spec updated as
      above passes against staging (or is visibly consistent with the DOM if e2e cannot run
      locally)

## Test plan

```bash
pnpm lint
pnpm test
pnpm build
# staging only:
E2E_BASE_URL=<staging> pnpm test:e2e -- courses-navigation
```

Manual: open `/`, `/mentoria`, `/cursos`, `/blog` in the browser pane; read the navbar's
`aria-current` per page; open a booking on `/mentoria` and click the logo (overlay closes,
navigates home).

## Gotchas

- `Link` from `@/i18n/navigation` — every new href goes through it so `/en/mentoria` resolves.
- `usePathname` from `@/i18n/navigation` strips the locale prefix, which is why `match:
  "/mentoria"` works for both locales (see the `COURSE-P6-03` comment in Navbar).
- The `Suspense` boundary around `InteractiveShell` must move to the new page unchanged; its
  comment explains why it is scoped to the shell.
- `generateMetadata` for `/mentoria` reuses `landing.meta` for now; P2-04 gives it its own keys.
- Do not touch the `?book=` / `?reschedule=` consumers in this task — that is P0-02's inventory.

## Out of scope

- Any deep link that is not the navbar/footer «Mentoría» (P0-02).
- The `/mentoria` header, `noindex` removal, sitemap entry (Phase 2).
- Removing the temporary duplication of `/` (P1-04).

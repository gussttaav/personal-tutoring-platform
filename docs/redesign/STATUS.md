# Home + Mentoría redesign — Status

**Planned:** 2026-09-17
**Started:** 2026-09-17
**Legend:** ⬜ not started · 🔄 in progress · ⛔ blocked · ✅ done · 🚫 won't do

Update this file when starting, completing, or blocking a task.

---

## Phase 0 — Route split

| Task | Tag | Status | Owner | PR |
|------|-----|--------|-------|----|
| [01 `/mentoria` route + menu](phase-0-route-split/01-mentoria-route-and-menu.md) | `REDESIGN-P0-01` | ✅ | Claude | local |
| [02 Deep links, emails and e2e retarget](phase-0-route-split/02-deep-links.md) | `REDESIGN-P0-02` | ✅ | Claude | local |

**Exit criteria**
- [x] `/mentoria` and `/en/mentoria` render today's landing, `noindex`, absent from the sitemap
- [x] Menu reads Inicio · Cursos · Mentoría · Blog on desktop and in the mobile panel; Inicio is
      current on `/`, Mentoría on `/mentoria`; `useSessionsAnchor.ts` no longer exists
- [x] No `/#sessions`, `/?book=`, `/?reschedule=` or `/?action=` literal remains in `src/`,
      `e2e/` or the email templates; the booking e2e specs drive `/mentoria`
- [x] `pnpm lint` + `pnpm test` + `pnpm build` green

## Phase 1 — Home

| Task | Tag | Status | Owner | PR |
|------|-----|--------|-------|----|
| [01 Hero + stats](phase-1-home/01-hero.md) | `REDESIGN-P1-01` | ✅ (amended) | Claude | local |
| [02 Bio + compact areas](phase-1-home/02-bio-and-areas.md) | `REDESIGN-P1-02` | ✅ | Claude | local |
| [03 Courses + latest posts](phase-1-home/03-courses-and-posts.md) | `REDESIGN-P1-03` | ✅ | Claude | local |
| [04 App showcase + closing band + static home](phase-1-home/04-app-closing-and-static.md) | `REDESIGN-P1-04` | ⬜ | _tbd_ | |
| [05 Home metadata](phase-1-home/05-home-metadata.md) | `REDESIGN-P1-05` | ⬜ | _tbd_ | |
| [06 Booking overlays on both pages](phase-1-home/06-booking-overlays.md) | `REDESIGN-P1-06` | ⬜ | _tbd_ | |

Landing order after the 2026-09-17 amendment: 01 → 02 → 03 → **06** → 04 → 05.

**Exit criteria**
- [ ] `/` renders the six home sections in order at 390, 834 and 1440 as `design/home.html`
- [ ] `/` has no `InteractiveShell` (sections), no Suspense boundary, exactly one
      `<BookingOverlays />`, and `pnpm build` lists `/[locale]` as a static route (○) whose First
      Load JS excludes the calendar / wizard / pack-booking chunks
- [ ] «Reservar sesión ahora» on `/` opens the smart-book surface on `/`; «Ver disponibilidad»
      opens the calendar on `/` and a slot pick continues into the booking with the slot
      pre-selected — no navigation; an OAuth round-trip started on `/` lands on `/mentoria` with
      the booking open, as today (amended 2026-09-17)
- [ ] The chat assistant opens from the footer and the closing band on `/`
- [ ] `messages/es.json` and `messages/en.json` have identical key trees

## Phase 2 — Mentoría

| Task | Tag | Status | Owner | PR |
|------|-----|--------|-------|----|
| [01 Header + «Cómo funciona»](phase-2-mentoria/01-header-and-how-it-works.md) | `REDESIGN-P2-01` | ⬜ | _tbd_ | |
| [02 Testimonials](phase-2-mentoria/02-testimonials.md) | `REDESIGN-P2-02` | ⬜ | _tbd_ | |
| [03 App section on Mentoría](phase-2-mentoria/03-app-section.md) | `REDESIGN-P2-03` | ⬜ | _tbd_ | |
| [04 Mentoría metadata + indexability](phase-2-mentoria/04-mentoria-metadata.md) | `REDESIGN-P2-04` | ⬜ | _tbd_ | |

**Exit criteria**
- [ ] `/mentoria` renders header → cómo funciona → áreas → valoraciones → sesiones → packs → app
      at the three widths as `design/mentoria.html`
- [ ] `HeroSection.tsx` and `BiographySection.tsx` are gone; their surviving pieces live in
      `features/home/`
- [ ] `/mentoria` is indexable, in the sitemap with both locales, carries the `Service` JSON-LD;
      `/` carries the `Person`
- [ ] Booking, pack purchase, reschedule and the availability window work on `/mentoria`
      exactly as they did on `/`

## Phase 3 — QA

| Task | Tag | Status | Owner | PR |
|------|-----|--------|-------|----|
| [01 Message-key parity check](phase-3-qa/01-message-parity.md) | `REDESIGN-P3-01` | ⬜ | _tbd_ | |
| [02 E2E on staging, build and performance](phase-3-qa/02-e2e-and-perf.md) | `REDESIGN-P3-02` | ⬜ | _tbd_ | |

**Exit criteria**
- [ ] `pnpm check:messages` exists, passes, and runs in CI
- [ ] The full e2e suite passes against staging (flakes re-run, no regression)
- [ ] Lighthouse on `/` and `/mentoria` (mobile) has no regression against the pre-cycle landing

## Phase 4 — Cleanup

| Task | Tag | Status | Owner | PR |
|------|-----|--------|-------|----|
| [01 Archive the plan, remove the design reference and the command](phase-4-cleanup/01-archive-and-remove.md) | `REDESIGN-P4-01` | ⬜ | _tbd_ | |

**Exit criteria**
- [ ] `docs/redesign/` no longer exists; the markdown lives in `docs/archive/redesign-<date>/`
      with a `SUMMARY.md`, and `docs/archive/INDEX.md` lists it
- [ ] `docs/redesign/design/` (the mocks and previews) is deleted, not archived
- [ ] `.claude/commands/redesign-task.md` is deleted
- [ ] `CLAUDE.md` describes the two pages and the deep-link rule (added in P0-02) and nothing
      else from this cycle

---

## Cross-phase notes

_Deviations, regressions and decisions taken during implementation go here, dated._

- **2026-09-17 (P0-01)** — No deviations from the task md. `e2e/courses-navigation.spec.ts` was
  run locally against the dev server with `E2E_BASE_URL=http://localhost:3000` (global-setup
  skips the DB in that mode): the rewritten current-page and «Mentoría is a real destination»
  tests pass, and so does the rest of the spec except `en: English card and landing lead into
  the English reader`, which fails **before this task**: the `llm-agents` course (COURSE-C2) has
  no `en/` lessons yet, so its catalog card wears the «Lessons in Spanish» badge and the spec's
  page-wide `toHaveCount(0)` no longer holds. Not P0-01's to fix — flagging for P3-02 (or the
  course cycle). Also observed, not a deviation: between 640 and 1024px the navbar shows neither
  the desktop links nor the hamburger (pre-existing `hidden lg:flex` / `sm:hidden`), and
  `design/home.html` reproduces the same breakpoints, so at 834 the menu items are unreachable in
  both the mock and the app.
- **2026-09-17 (NAV-BP-01)** — Fixed the 640–1024px gap flagged above: the hamburger button and
  mobile panel in `Navbar.tsx` moved from `sm:hidden` to `lg:hidden` so they now cover every width
  below the desktop link row, which only appears at `lg:flex`. The auth block and locale pill stay
  `hidden sm:flex`, so 640–1023px shows them in the bar beside the hamburger as well as inside the
  panel — an accepted duplicate, not a refactor of the panel. Same `sm` → `lg` swap applied to
  `.burger` in `design/home.html` and `design/mentoria.html` (both are static mocks with no
  JS-driven panel, so no separate panel rule existed to change). Verified at 390/834/1440 in the
  Browser pane (hamburger + 4-item panel at 390 and 834, desktop row with no hamburger at 1440, no
  horizontal overflow at any width); `pnpm lint` clean and
  `courses-navigation -g "mobile: the panel"` passes against the dev server.
- **2026-09-17 (P0-02)** — Mechanical retarget, one gap in the task's own inventory: its
  `grep -rn '/?reschedule='` audit should have caught `src/hooks/useRescheduleIntent.ts:76-78`
  (the OAuth `callbackUrl` the reschedule flow builds when an unauthenticated user opens a
  `/?reschedule=` email link) but the file wasn't in the "Files affected" table. Retargeted it to
  `/mentoria?reschedule=…` too — otherwise the acceptance criterion's grep (`'"/?\|`/?\|/#sessions'`)
  would still fail. `SignInGate`'s default `callbackUrl` now reads `usePathname()` from
  `@/i18n/navigation` (locale-agnostic, matching the other `/mentoria?…` literals) per the task's
  judgement call. `email-functions.ts`'s reschedule-URL building was pulled into an exported
  `rescheduleUrl()` (same pattern as the existing `announcementUrls()`) so it's unit-testable —
  `sendConfirmationEmail` itself can't render under Jest (memory: email templates untestable in
  Jest) — and a new `src/infrastructure/resend/__tests__/reschedule-url.test.ts` asserts the
  `/mentoria?reschedule=…&token=…` shape for all four session types.
  `pnpm lint` / `pnpm test` (142 suites, 1791 tests) / `pnpm build` all green. E2E: ran the five
  named specs locally against the test DB (`.env.e2e.local` + `stripe listen`) instead of staging
  (no staging URL available in this environment) — `booking-free`, `reschedule`, all four `chat`
  tests, and `booking-single [en]` passed outright; `booking-pack [en]` failed once on a
  personal-area timing race then passed on retry (matches the documented e2e-flakiness pattern,
  unrelated to this task — the pack credit had already been debited on the first run, proving the
  `/mentoria` booking path itself worked). `booking-single [es]` and `booking-pack [es]` — the
  only locale that pays live through Stripe — could not complete: the local Stripe CLI's test API
  key expired 2026-09-16 (one day before this run), so `stripe listen` never authenticated and no
  webhook reached `/api/stripe/webhook`. Not a regression from this change: confirmed by loading
  `/mentoria` directly in the Browser pane, which renders the "Comprar pack" buttons with live
  prices exactly as `booking-pack [es]`'s first failure (missing "Comprar pack" button) says it
  shouldn't have. The staging-only manual checks (OAuth resume on `/mentoria`, the real
  confirmation-email link, `/pago-exitoso` → `/mentoria`) are unverified pending a staging
  deploy — flagging for whoever runs P3-02.
- **2026-09-17 (P1-01)** — One structural choice the task md leaves open: the hero renders **one**
  `<Image>` node, not the mock's two (`.hero-photo-sm` inside the copy + `.hero-photo` beside it).
  `.home-hero-photo` is a grid item with `order: -1` below 1024 (so it sits above the copy, as the
  mock's small photo does) and the frame wrapper switches from the 128px glow box to the 4/5
  offset frame at 1024 via `home.css`. Two nodes would have meant two downloads and two preloads
  of the LCP image (Chrome fetches `display:none` `<img>`s); one node is what the task's
  `sizes="(max-width: 1023px) 128px, 340px"` describes anyway. Measured against
  `design/home.html` in the Browser pane: every hero rect (photo, identity, h1, subheading, CTA
  row and both buttons, free note, stats) has the same x/y/w/h at 390 and 834, and the same at
  1440 bar a 4px x-offset from the app's always-on scrollbar gutter (`html{overflow-y:scroll}`).
  The old hero's click-to-zoom on the photo is not carried over (the mock has none, and the hero
  is a Server Component now); it survives on `/mentoria` until P2-01. The `availability` case in
  `InteractiveShell`'s `?book=` switch needed a justified
  `eslint-disable-next-line react-hooks/set-state-in-effect` (the other cases call router
  handlers the compiler lint doesn't trace; same convention as `AvailabilityModal.tsx:189`).
  Signed-out click-through verified in the Browser pane (`book=smart` → SignInGate on
  `/mentoria`, `book=availability` → the weekly availability window); the signed-in path is not
  browser-verified here (no local session — memory: no local admin session) but is the same
  `handleSmartBook()` / `setShowAvailabilityModal(true)` the Mentoría buttons call, so it has the
  coverage those already have. `pnpm lint` (0 errors; the 8 warnings pre-date this task),
  `pnpm test` (142 suites, 1791 tests), the message-key parity one-liner (`[] []`) and
  `pnpm build` green.
- **2026-09-17 (plan amendment — booking in place on the home).** Decision taken after P1-01
  shipped: the home's CTAs must not detour through `/mentoria`. Wanted: «Ver disponibilidad»
  opens the calendar on `/`; a slot pick goes straight to the booking confirmation (free 15 min
  for a first-timer); «Reservar sesión ahora» opens the right booking screen directly; the
  unauthenticated flow stays as it is (SignInGate → Google → `/mentoria` with the booking open),
  even when the gate was opened on `/`. Chosen mechanism (option A of the two discussed; the
  dedicated-route option B was rejected as re-opening P0-02's deep-link inventory for no gain):
  split `InteractiveShell` into `BookingProvider` + `BookingOverlays` (mounted on both pages,
  overlays `next/dynamic`-loaded so the home's First Load JS stays clean) and the Mentoría-only
  sections; `RescheduleBridge` keeps `useSearchParams` inside Mentoría's `Suspense` boundary so
  the static-route target for `/` survives. Consequences accepted: signed-in visitors on `/`
  trigger the credits fetch on mount (`useUserSession`); `src/app/[locale]/page.tsx` will import
  `BookingOverlays` from `features/booking/`; the CLAUDE.md gotcha at `:96` changes in P1-06;
  P3-02's home spec covers the in-place flows. What does NOT change: every `/mentoria?book=…`,
  `?reschedule=…`, `?intent=…` deep link and callbackUrl (P0-02), «never link to `/?book=`».
  Docs touched: `PLAN.md` («Amendments», phase table 5 → 6), `design/NOTES.md` (locked decision
  reworded), `phase-1-home/README.md` (task 6, landing order, exit criteria), `01-hero.md`
  (amended: buttons + events, `HomeHeroCtas`), `04-app-closing-and-static.md` (depends on P1-06;
  `<BookingOverlays />` stays; the band's CTA dispatches `open-smart-book`), new
  `06-booking-overlays.md`, `phase-3-qa/02-e2e-and-perf.md` (home spec, Lighthouse note), this
  file.
- **2026-09-17 (P1-01, CTA amendment landed)** — `HomeHeroCtas.tsx` (client island of two
  `<button>`s dispatching `open-smart-book` / `open-availability-modal`) replaces the two
  `<Link href="/mentoria?book=…">`; `HomeHero` stays a Server Component and keeps
  `#hero-cta-row`; `home.css` gains `justify-content: center`, `cursor: pointer` and the primary's
  `border: 0` so the buttons render as the links did. The `availability` `?book=` case stays in
  the shell for deep links. Verified in the Browser pane on `/en`, signed out: «Check
  availability» opens the calendar on `/en` (URL unchanged); a slot pick + Confirm opens the
  «Sign in to continue — to book the selected time» gate on `/en`; «Book a session now» opens
  the plain gate on `/en`; at 390 both buttons stack full-width and the FAB stays hidden while
  the row is in its zone. The gate's callbackUrl is `useBookingRouter.ts:294-298`, untouched
  (`/mentoria?intent=smart-book&slotStart=…`), so the post-OAuth landing is today's. Not
  browser-verified: the signed-in in-place open (no local session) — it is the same
  `handleSmartBook()` path the Mentoría hero exercises. Observed in passing, pre-existing and not
  touched: the calendar's slot buttons are labelled «Hora disponible» on `/en` too
  (`AvailabilityModal` / `WeeklyCalendar` aria-label not localised). `pnpm lint` (0 errors, 8
  pre-existing warnings), `pnpm test` (142 / 1791), `pnpm build` green.
- **2026-09-17 (P1-02)** — One real bug caught and fixed during implementation, not a deviation
  from the task md: the first pass gave the social-link `<a>`s and the «Cómo funcionan las
  clases» link their base `color`/`border` as inline styles (mirroring `BiographySection.tsx`'s
  pattern) while moving only the `:hover` rule into `home.css`, per the task's instruction. An
  inline style always wins over an external stylesheet rule regardless of selector specificity or
  `:hover`, so the hover would never have visually applied. Fixed by moving the base `color` /
  `border` for `.home-social a` and `.home-bio-link` into `home.css` too (matching `.home-area`,
  which was already class-only and unaffected) — same pattern `.home-hero-cta` already used in
  P1-01. Caught by inspecting the loaded stylesheet + `getComputedStyle` in the Browser pane
  rather than by eye. Verified: grid geometry at 390/834/1440 via `getBoundingClientRect` /
  `getComputedStyle` against `design/home.html`'s values (5fr/7fr at 1024 with 64px gap, one
  column with 44px gap below, `.home-areas-grid` 12px gaps and 1→2 columns at 640, no horizontal
  overflow at 390); content and both locales via `get_page_text` (`/` and `/es`, bio paragraph
  and all six one-liners match the mock verbatim); the Material Symbols ligatures (`code`, `dns`,
  …) appear as text nodes, confirming the icon font renders rather than inline SVG; the how-link
  resolves to `/en/mentoria#como-funciona` and actually navigates there; `/mentoria` still renders
  the unabridged `BiographySection` (both paragraphs) and `SpecializationsSection` (tags + DAM/DAW
  CTA) untouched. **Not verified**: the `:hover` pixel colors themselves — this session's Browser
  pane reported itself "hidden" throughout (the desktop app wasn't showing it to the user), and in
  that state `computer.hover` + `getComputedStyle` consistently returned the base (non-hover)
  values even though `element.matches(':hover')` correctly returned `true`, and screenshots taken
  after a scroll returned stale, pre-scroll frames — i.e. the compositor wasn't producing live
  frames for a hidden pane, not a rule-matching problem (memory: headless CSS verification). The
  CSS itself is confirmed correct by construction (single `.home-social a:hover` /
  `.home-bio-link:hover` rule each, specificity strictly greater than their un-pseudo base rule,
  no inline override left) — the same guarantee P1-01's `.home-hero-cta--primary:hover` relies on
  — but a live pixel check is left for whoever next has the pane visible. Ran the test commands
  from a second `pnpm start` on port 3101 (port 3000 held by another chat's dev server in this
  same working directory); `pnpm lint` (0 errors, the same 8 pre-existing warnings), `pnpm test`
  (142 suites, 1791 tests), the message-key parity check (`[] []`) and `pnpm build` all green,
  `/[locale]` still ● (static).
- **2026-09-17 (P1-03)** — One deviation from the task's own "Files affected" table, both
  options of which the task explicitly allowed: `blog.css` moved from
  `src/app/[locale]/blog/` to `src/features/blog/` (not just imported cross-route), because
  `PostCard` now renders on two routes and the moved file mirrors `catalog.css`'s existing
  placement next to `CourseCard` — the Gotchas section's own reasoning. Only the import paths
  and the file's top comment changed; no rule inside `blog.css` was touched, so `/blog` is
  pixel-identical. Everything else matches the task md as written: `HomeCourses` / `HomePosts`
  reuse `CourseCard` / `PostCard` and the catalog/blog selectors verbatim (`listCatalogEntries`,
  `listPosts(locale).slice(0, 2)`), `home.css` gained exactly the four classes named in the
  task, and the three new keys (`home.courses.seeAll`, `home.blog.heading`, `home.blog.seeAll`)
  landed in both message files (parity script: `only in es: []`, `only in en: []`). Verified in
  the Browser pane at 390/834/1440 against `design/home.html` in both locales: kicker + hairline
  + serif heading + accent italic, title-row flips from column (390) to row (834, 1440) at the
  768 breakpoint, course grid is 43 lecciones · 5 módulos / 1 lección · 1 módulo (matching
  `/cursos` exactly), post grid shows the two newest posts in the same order as `/blog`, no
  horizontal overflow at 390 (`scrollWidth === clientWidth`). `/en` shows the English catalog
  card text and the "Lessons in Spanish" badge on the untranslated `llm-agents` course, same as
  `/en/cursos`. `Ver todos los cursos` → `/cursos`, `Ver todos los artículos` → `/blog`, both
  locale-prefixed correctly on `/en` (`/en/cursos`, `/en/blog`); the course card's whole-card
  cover link resolves to `/cursos/dl-nlp`; both post cards resolve to their real slugs
  (`/blog/de-newton-a-adamw`, `/blog/evolucion-del-tokenizador`). Card hover itself was not
  re-verified pixel-by-pixel — `.course-card` / `.post-card` are untouched classes already
  covered by `/cursos` and `/blog`, and only the grid wrapper around them is new (memory:
  headless CSS verification — synthetic `mouseover` events don't trigger real `:hover`, and this
  pane reported itself hidden throughout, same as P1-02). "Continuar" for a reader with progress
  is unverified locally (memory: no local admin session — the task md itself says to check this
  on staging). Ran a second `pnpm start` on port 3202 (3000 held by another chat's dev server,
  3101 already held by a leftover `pnpm start`), via a temporary `.claude/launch.json` entry
  reverted before finishing. `pnpm lint` (0 errors, the same 8 pre-existing warnings),
  `pnpm lint:content` (pre-existing content warnings only, exit 0), `pnpm test` (142 suites,
  1791 tests), the message-key parity check, and `pnpm build` all green.

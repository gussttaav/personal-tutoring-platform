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
| [04 App showcase + closing band + static home](phase-1-home/04-app-closing-and-static.md) | `REDESIGN-P1-04` | ✅ | Claude | local |
| [05 Home metadata](phase-1-home/05-home-metadata.md) | `REDESIGN-P1-05` | ✅ | Claude | local |
| [06 Booking overlays on both pages](phase-1-home/06-booking-overlays.md) | `REDESIGN-P1-06` | ✅ | Claude | local |

Landing order after the 2026-09-17 amendment: 01 → 02 → 03 → **06** → 04 → 05.

**Exit criteria**
- [ ] `/` renders the six home sections in order at 390, 834 and 1440 as `design/home.html`
- [ ] `/` has no `InteractiveShell` (sections), no Suspense boundary, exactly one
      `<BookingOverlays />`, and `pnpm build` lists `/[locale]` as a static route (○) whose First
      Load JS excludes the calendar / wizard / pack-booking chunks
- [ ] «Reservar sesión ahora» on `/` opens the smart-book surface on `/`; «Ver disponibilidad»
      opens the calendar on `/` and a slot pick continues into the booking with the slot
      pre-selected — no navigation; after the Google popup a booking started on `/` continues
      on `/` (amended 2026-09-17, twice: in place for signed-in visitors, then also after sign-in;
      only the popup-blocked full-redirect fallback still lands on `/mentoria`)
- [ ] The chat assistant opens from the footer and the closing band on `/`
- [ ] `messages/es.json` and `messages/en.json` have identical key trees

## Phase 2 — Mentoría

| Task | Tag | Status | Owner | PR |
|------|-----|--------|-------|----|
| [01 Header + «Cómo funciona»](phase-2-mentoria/01-header-and-how-it-works.md) | `REDESIGN-P2-01` | ✅ | Claude | local |
| [02 Testimonials](phase-2-mentoria/02-testimonials.md) | `REDESIGN-P2-02` | ✅ | Claude | local |
| [03 App section on Mentoría](phase-2-mentoria/03-app-section.md) | `REDESIGN-P2-03` | ✅ | Claude | local |
| [04 Mentoría metadata + indexability](phase-2-mentoria/04-mentoria-metadata.md) | `REDESIGN-P2-04` | ✅ | Claude | local |

**Exit criteria**
- [ ] `/mentoria` renders header → cómo funciona → áreas → valoraciones → sesiones → packs → app
      at the three widths as `design/mentoria.html`
- [ ] `HeroSection.tsx` and `BiographySection.tsx` are gone; their surviving pieces live in
      `features/home/`
- [x] `/mentoria` is indexable, in the sitemap with both locales, carries the `Service` JSON-LD;
      `/` carries the `Person`
- [ ] Booking, pack purchase, reschedule and the availability window work on `/mentoria`
      exactly as they did on `/`

## Phase 3 — QA

| Task | Tag | Status | Owner | PR |
|------|-----|--------|-------|----|
| [01 Message-key parity check](phase-3-qa/01-message-parity.md) | `REDESIGN-P3-01` | ✅ | Claude | local |
| [02 E2E on staging, build and performance](phase-3-qa/02-e2e-and-perf.md) | `REDESIGN-P3-02` | ⬜ | _tbd_ | |

**Exit criteria**
- [x] `pnpm check:messages` exists, passes, and runs in CI
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

- **2026-09-19 (P3-01)** — No deviations from the task md, one implementation choice: the
  diffing logic lives in `src/lib/messages/check-messages.ts` (pure functions, unit tested)
  rather than inline in `scripts/check-messages.ts`, following the existing
  `lint-content.ts` → `src/lib/courses/validate-*.ts` split — Jest's `testMatch` only covers
  `src/**/*.test.ts`, so a test under `scripts/__tests__/` would not have run under
  `pnpm test`. The ICU placeholder scan only captures an identifier opening a brace pair at
  nesting depth 0, so a `{var, select, ...}` construct's own translated branch keywords
  (e.g. es `positive {positiva}` vs en `positive {positive}`) aren't misread as mismatched
  placeholders — confirmed against the real message files, which produce zero warnings
  today. `pnpm check:messages` exits 0 on the current files; manually verified (then
  reverted) that a stray key, a leaf-type mismatch, and a placeholder-only difference each
  produce the exit code and message the acceptance criteria expect.

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
- **2026-09-17 (P1-06)** — The split is the task md's, block for block: `BookingProvider.tsx`
  (hooks, the five atoms, the five listeners, the `?book=` consumer, the `restoredSlot` sync, the
  buy-pack reveal effect, `handleAvailabilitySlotSelected`, `packStudentInfo`), `BookingOverlays.tsx`
  (the three overlay renders, the four heavy overlays through `next/dynamic` `ssr: false`,
  `SignInGate` static), `RescheduleBridge.tsx` (`useRescheduleIntent` + the two wiring effects +
  the `rescheduleGate` publish), and the sections-only `InteractiveShell`. A whitespace-insensitive
  diff of each moved block against the old shell shows exactly the three reschedule-gate lines the
  task names and nothing else. Two small departures from the md's letter, both flagged here: (1)
  the sections don't `return null` under an open overlay — they render `<RescheduleBridge />` at a
  fixed position and gate the sections on `overlayOpen` (the overlays' own conditions), so the
  bridge stays mounted while a booking screen is up and `useRescheduleIntent`'s state isn't thrown
  away and re-read on every close; the DOM under an overlay is the same (no `#sessions`, no pack
  buttons — verified). (2) `react-hooks/immutability` refused `packCheckoutInFlight.current = …`
  once the ref arrives through context (the compiler lint only recognises a ref of unknown
  provenance by name), so the two consumers alias it at the destructure —
  `packCheckoutInFlight: packCheckoutInFlightRef` — per the rule's own hint; the context key keeps
  the task's name. Also: the `loading` component is a `Spinner` inside a fixed, centred,
  translucent layer (not a bare inline `Spinner`), so the OAuth-return first paint reads as an
  overlay loading rather than a spinner in the page flow. Build: Next 16 no longer prints
  per-route First Load JS, so it was measured by summing the entry chunks each page's
  `page_client-reference-manifest.js` lists — `/[locale]` **487.0 kB → 393.7 kB**, `/mentoria`
  499.1 → 405.8 kB; the `booking.availabilityModal` / `singleSession` / `weeklyCalendar` /
  `wizardProgress` / `modeView` / `payment.form` string markers are gone from both pages' entry
  chunks (only `booking.shell` / `signInGate` / `packCard` remain), and the Network panel shows
  the overlay chunks (`0wa7cgg…`, 47 kB, + 5 small ones) fetched on the first «Ver
  disponibilidad» click, three more (wizard + calendar) on the first signed-in «Reservar sesión
  ahora». `/[locale]` is still ● (SSG) — the ○ target is P1-04's once the `Suspense` boundary
  leaves `/`. Browser pane on `pnpm start` (temporary `.env.production.local` with
  `AUTH_TRUST_HOST=true`, removed afterwards), signed out at 1440 and 390: on `/` «Ver
  disponibilidad» opens the calendar in place (URL `/`), slot + Confirmar → the «hora elegida»
  gate with callbackUrl `/mentoria?intent=smart-book&slotStart=…&slotEnd=…&slotLabel=…&slotDateLabel=…&slotTz=Europe/Madrid`;
  «Reservar sesión ahora» → `/mentoria?intent=smart-book`; `open-pack-booking` →
  `/mentoria?action=schedule-pack`; `book-free-session` → `/mentoria?intent=free15min`;
  `close-booking-overlay` a harmless no-op; no horizontal overflow at 390. On `/mentoria`:
  `?book=availability` and `?book=smart` consumed and stripped; `?reschedule=free15min&token=…` →
  the «reprogramar» gate with that exact callbackUrl, params stripped, and the gate stays closed
  after Cancelar (i.e. `rescheduleGate.clear()` fires with the router's close); the
  Specializations free CTA, the 1h card, the pack card and the hero CTA give
  `intent=free15min` / `intent=session1h` / `intent=buy-pack&packSize=5` / `intent=smart-book`.
  Signed in (a hand-minted `authjs.session-token` for a fresh test email — memory: no local admin
  session; signed out again via `/api/auth/signout` afterwards): «Reservar sesión ahora» on `/`
  opens the free-15 wizard in place (fixed overlay, «Inicio» still current, URL `/`), the logo
  event closes it and the sections return; «Ver disponibilidad» → slot → Confirmar lands directly
  on the review step («viernes, 18 de septiembre · 09:00–09:15 · sesión gratuita») on `/`. The
  booking was **not** confirmed — that writes a real booking, calendar event, Zoom session and
  email against the env's accounts — so «complete a free-15 booking from a slot picked on `/`» is
  verified up to the confirm button only. On `/mentoria` signed in, a session card unmounts the
  sessions + packs (0 pack buttons behind the wizard) and both return on close; exactly one «Open
  assistant» FAB on each page; `/en` opens the English calendar in place. `pnpm lint` (0 errors,
  the same 8 pre-existing warnings), `pnpm test` (142 suites, 1791 tests), `pnpm build` green;
  `npx tsc --noEmit` reports one error in `src/lib/courses/__tests__/mdx.test.ts` (`RepoLink`
  not on `MDXComponents`) that is present on HEAD before this task. E2E, locally against the test
  DB: `booking-free reschedule chat booking-single booking-pack` → 9/10 on the first run — both
  `[es]` paid specs passed this time even though `stripe listen` still refuses the expired CLI key
  — and the one failure, `booking-free` (test #1 of the run), timed out at its 15 s wait for the
  session cards while the fresh `pnpm dev` was still cold-compiling `/mentoria` (its screenshot
  shows the «Compiling…» badge and an un-hydrated hero); re-run alone it passes (37 s), so 10/10.
  No message keys added (no new UI copy in this task).
- **2026-09-17 (P1-06 follow-up — «Cambiar tipo de sesión» from `/`)** — Review of the first
  pass caught that the wizard's «Cambiar tipo de sesión» button, opened in place on `/`, just
  closed the wizard onto a page with no session types to change to. `SingleSessionBooking` now
  takes an optional `onChangeSessionType` (defaults to `onBack`) wired only to that button;
  `BookingOverlays` sends it to `/mentoria` via `@/i18n/navigation`'s `useRouter` when
  `usePathname() !== "/mentoria"`, and closes in place otherwise (the cards are right under the
  wizard there; a same-URL push would only scroll them away). `onBack` is untouched and keeps
  serving the success screen's «Volver al inicio» — an in-place close, which on `/` literally is
  the home, and which `booking-free` / `reschedule` assert on. Tried and rejected:
  `/mentoria#sessions`. The hash never lands because the sections render client-side inside
  Mentoría's `Suspense` boundary (the `useSearchParams` bailout), after Next has applied the hash
  on navigation — the very gap the deleted `useSessionsAnchor` used to paper over, and locked
  decision 2 says not to adapt it. So the visitor lands at the top of `/mentoria`, which after
  P2-01 carries the booking CTAs in its header. Verified on the dev server (signed in with the
  minted test session, signed out after): from `/en`, «Change session type» → `/en/mentoria`
  with the three cards and «Mentoring» current; on `/en/mentoria` → closes in place, URL
  unchanged, no hard navigation. `pnpm lint` (0 errors) and `pnpm test` (142 / 1791) green; the
  wizard e2e specs were not re-run for this follow-up — a `pnpm dev` not started by this session
  holds port 3000 without `E2E_MODE`, and Playwright's own webServer can't bind it — the change is
  an optional prop with an `?? onBack` fallback on a button no spec clicks. Also raised in the same
  review and **not** changed: after Google sign-in from a gate opened on `/`, the booking reopens
  on `/mentoria` — that is the amendment's own wording («the OAuth round-trip is unchanged»)
  and this task's «Out of scope»; resuming in place on `/` instead would touch
  `useBookingRouter` (park the smart-book / pack intents like `pendingSession`) and
  `GoogleSignInButton` (skip the callbackUrl push when the intent can resume in place), so it is
  a plan change to decide, not a P1-06 fix.
- **2026-09-17 (P1-06 follow-up — sign-in from `/` continues on `/`; second amendment)** —
  Decided in review and recorded in `PLAN.md` («Amendments», second entry): after the Google
  popup the booking resumes in place, on the page where the gate opened, as it already did for
  signed-in visitors. Code: `useBookingRouter` parks the two intents that had no in-memory
  resume — `handleSmartBook` writes `pendingSmartBook = { slot }` (the same ref the URL-restore
  path already resumes through once `hasBookings` settles, so the slot picked in the calendar
  rides along and pre-fills the wizard) and `handlePackSchedule` sets a new `pendingPackSchedule`
  atom consumed in the sign-in flip block; that block now clears the gate label/callbackUrl on
  every flip to signed-in, and `handleSignInGateClose` drops both parked intents so a cancelled
  gate can't pop the wizard after a later Navbar sign-in. `GoogleSignInButton` gains
  `resumeInPlace` (skip the `router.push(callbackUrl)` after a successful popup);
  `SignInGate` passes it. The `/mentoria?intent=…` / `?action=…` / `?reschedule=…` callbackUrls
  are byte-identical to P0-02's — they are the popup-blocked full-redirect fallback, the only
  path that still lands on `/mentoria`. Side effect, for the better: on `/mentoria` the old
  push re-added `?intent=` / `?reschedule=…&token=…` to the URL after a popup sign-in; now the
  URL stays clean. **A real hydration race, found and fixed while verifying:** in dev,
  `/mentoria`'s sections are server-rendered inside their `Suspense` boundary with the session
  still «loading» (skeletons); with `BookingProvider` now OUTSIDE that boundary, the session
  settling and the credits fetch push new context values into the still-dehydrated sections and
  React hydrates them as cards against skeleton HTML — «Hydration failed because the server
  rendered HTML didn't match the client», recoverable (React re-renders, the cards appear) but a
  red dev overlay. Reproduced under Playwright with the sign-in → sign-out → reload sequence: 0/2
  runs on HEAD, 2/3 on the split (plain reloads never trip it on either). Fix:
  `InteractiveShell` gates its skeletons on `useHydrated()` (the codebase's own
  `useSyncExternalStore` helper) so the first client render always matches the server; 4/4 runs
  clean after. Production is unaffected either way — there the boundary is client-rendered
  (`useSearchParams` bailout) and nothing is hydrated. Verified under Playwright against the dev
  server, driving the real gate and simulating exactly what the popup does (the opener only ever
  sees a session cookie + the `AUTH_COMPLETE` message): on `/` «Reservar sesión ahora» →
  free-15 wizard in place, URL `/`; calendar slot → review step with «viernes, 18 de septiembre
  · 09:00–09:15» on `/`; `open-pack-booking` → pack booking in place. On `/mentoria`: 1h card
  → 1h wizard, pack «Comprar» → «Pack 5 clases» modal, `?reschedule=session1h&token=…` → 1h
  wizard with the params stripped, `book-free-session` → free-15 wizard — all in place, URL
  clean, no page errors. Negative: gate → Cancelar → Navbar sign-in → signed in, no wizard.
  Not verified: the popup-blocked fallback (a real full redirect through Google) — code path
  unchanged from P0-02. `pnpm lint` (0 errors), `pnpm test` (142 / 1791), `pnpm build` green
  (`/[locale]` still ●). The booking e2e specs (`loginAs` cookie, no gate) don't cover the popup
  path and weren't re-run here for the same port-3000 reason as the previous follow-up.
- **2026-09-18 (P1-04)** — Three departures from the task md's letter, each flagged here.
  (1) `<BookingOverlays />` is not mounted childless: its one child on `/` is `HomeChat`, a
  client wrapper that renders `<Chat />` unless a booking screen is up (the `overlayOpen`
  condition of `InteractiveShell`, verbatim, read through `useBooking()`). The md's premise
  («the shell merely rendered it») misses that the shell also UNMOUNTED the FAB while it
  returned an overlay — still what `/mentoria` does — so a bare page-level `<Chat />` would have
  floated its z-index-1000 FAB over the wizard / pack booking (z-index 40) opened in place on
  `/`, over the wizard's own «Confirmar» at 390. The md's own «or mount `<Chat />` directly if it
  needs no wrapper» is the clause exercised; it needs one. `BookingOverlays`' trailing
  doc-comment updated to match (one line). (2) `pnpm build` prints `/[locale]` as **●**, not ○
  — and it always will: in Next 16's legend ○ is «Static» for routes WITHOUT dynamic params and
  ● is «SSG, prerendered as static HTML» for a `[param]` route with `generateStaticParams`
  (`/es` and `/en` are listed under it, 30d revalidate). It was ● before P1-06 too (P1-02's and
  P1-06's notes), i.e. the `Suspense` boundary never made the route dynamic; the ○ in the md,
  the phase README and the Phase 1 exit criterion is unreachable as written and should be read
  as ●. What the criterion means is verified instead: `.next/server/app/es.html` carries the
  whole home (app showcase, phone mock, closing band, both store placeholders, the FAB) and no
  `Suspense` fallback / spinner / `#sessions`; the `/[locale]` entry chunks (P1-06's
  manifest-sum method) total **379.4 kB** (393.7 after P1-06) with the `availabilityModal` /
  `singleSession` / `weeklyCalendar` / `wizardProgress` / `modeView` / `payment.form` markers
  absent and `packCard` gone too; `/mentoria` 406.9 kB, unchanged. (3) The band-to-footer gap:
  the mock's `.column` has no bottom padding, so the footer's own 80px margin is the gap, but the
  app's global `.landing-column` adds 80px more (pre-existing; `/mentoria` shares it) — measured
  160 vs 80. Zeroed as an inline `paddingBottom: 0` on the home's column in `page.tsx` rather
  than touching the global rule or hiding a negative margin in `.home-closing` (which is the
  md's `padding: 8px 0 0` and nothing else); P2 will meet the same 160 on `/mentoria`.
  Smaller choices: `app-showcase.css` keeps the design's `.app-grid` / `.app-copy` / `.app-phone`
  / `.ap-*` names and prefixes the generic ones (`.app` → `.app-showcase`, `.soon` →
  `.app-soon`, `.benefit` → `.app-benefit`, `.store` → `.app-store`, `.phone` →
  `.app-phone-frame`) — it is a global stylesheet. The closing band's responsive/hover rules
  (the 640 flip of the button row, the 639px padding, the two `:hover`s) are a `<style>` block
  inside `ClosingCta` (the `page.tsx` keyframes / `AvailabilityModal` precedent), so the band
  carries its rules onto `/mentoria` without a page import; its primary's hover is the hero's
  (`scale(1.02)` + shadow, P1-01), the same button on the same page, where the mock has colour
  only. Benefit icons are Material Symbols (`videocam`, `calendar_month`, `credit_card`) like
  the sibling `HomeAreas` boxes; the phone's icons are the mock's inline SVGs (it is a picture).
  Store links: when the env vars are set the `<a>` keeps the bracketed label — dropping the
  brackets is a copy change for whoever ships the app. **`.env.example` is gitignored and
  untracked in this repo** (`.gitignore:28`), so the two vars were added to the local file only;
  nothing to commit there. No new tests: no service logic changed (`HomeChat` / the islands are
  presentational, and the repo has no component-test setup).
  Verified with Playwright against the dev server, not the pane (memory: headless CSS
  verification). Geometry: 36 rects per width (section, grid, phone + 13 of its parts, copy,
  pill, heading, lead, benefits, stores, band, h2, p, actions, both buttons) against
  `design/home.html` at 390 / 834 / 1440 — every x/y/w/h identical, bar text-run widths in
  Manrope (pill +12, band primary +8, ghost +10, heading −11 at 1440): the mock loads Manrope
  from the Google Fonts CSS API and the app self-hosts next/font's copy, and P1-01's hero
  primary shows the identical 244 → 252 in the same run, so it is the font file, not the CSS;
  computed styles (family, size, weight, letter-spacing, padding, radius, border, gradient,
  grid columns / gap, flex direction) equal on both sides; no horizontal overflow. Behaviour,
  signed out, 1440 and 390: band «Reservar sesión ahora» → the «Identifícate para continuar»
  gate on `/` (URL unchanged); band and footer «Pregunta al asistente IA» → `.chat-panel--open`;
  hero «Ver disponibilidad» → the calendar dialog in place with the FAB `display: none`; hero
  «Reservar sesión ahora» → gate; `open-pack-booking` (Navbar) → gate; `close-booking-overlay`
  (logo) → no-op with nothing open, no errors; exactly one `.chat-fab` on `/` and on
  `/mentoria`; `/en` renders the English `app.*` / `home.closing.*` copy. Signed in (a minted
  `authjs.session-token` for `redesign-p1-04-test@example.com` against the test project the dev
  and e2e envs share; signed out after): band → free-15 wizard in place on `/`, **0 FABs while
  it is up**, `close-booking-overlay` closes it and the FAB returns; hero → same; «Cambiar tipo
  de sesión» → `/mentoria` (P1-06 follow-up, untouched). Store toggle: a temporary
  `.env.development.local` with both URLs + dev restart → both buttons are
  `<a target="_blank" rel="noopener noreferrer">`; file removed, placeholders back.
  `pnpm lint` (0 errors, the same 8 pre-existing warnings), `pnpm test` (142 suites, 1791
  tests), message-key parity (`only in es: []`, `only in en: []`), `pnpm build` green;
  `npx tsc --noEmit` only the pre-existing `mdx.test.ts` error. E2E `courses-navigation` against
  the dev server (`E2E_BASE_URL`, DB-free): 9/10, the `en:` catalog test being the documented
  pre-existing red, and `es: navbar Cursos → …` failing once on the run's cold first compile and
  passing on re-run (memory: e2e flakiness).
- **2026-09-18 (P1-05)** — One necessary touch outside the task's own "Files affected" table:
  `src/app/[locale]/mentoria/page.tsx`'s `<StructuredData locale={locale} />` call now passes
  `variant="mentoria"` too, since `variant` became a required prop of the component this task
  rewrote — leaving that call as-is would not have compiled. This wires up the `Service` JSON-LD
  on `/mentoria` *now* rather than at P2-04: `StructuredData.tsx` already implements the
  `meta.mentoria.*` → `landing.meta.*` fallback the task md describes (`t.has()`, next-intl
  v4.13 has it), so there was no reason to leave `/mentoria` without a `Service` in the interim.
  `/mentoria`'s `generateMetadata` (its `<title>`/`<meta description>`) is untouched — still
  `landing.meta`, still P2-04's job. Verified via `pnpm build` + `pnpm start` + curl: `/` emits
  `@graph: [Person]` only (es and en); `/mentoria` emits `@graph: [{Person stub by @id},
  Service]` with `name`/`description` falling back to `landing.meta.*` as expected, `url`
  `.../mentoria` (`localeUrl`), `provider` referencing `#person`. `og.png`/`og-en.png` checked by
  eye — both are the finished, real image (credential + stats), not the placeholder a stale
  memory note claimed; no OG-image work needed. `pnpm lint` (0 errors, the same 8 pre-existing
  warnings), `pnpm test` (142 suites, 1791 tests), `pnpm build` green. No `StructuredData` unit
  test existed to update (none under `src/components/seo/__tests__/`).
- **2026-09-19 (P2-01)** — One deviation from the task md's key inventory, flagged rather than
  followed: `landing.bio.para1` is **kept**, not deleted. The md says nothing reads the two bio
  paragraphs after this task, but the course landing's instructor block
  (`src/app/[locale]/cursos/[courseSlug]/page.tsx:257`, `tBio("para1")`) still renders it —
  deleting it would have blanked every course page's bio with a missing-key error. `para2` had no
  reader and is gone; the AC grep (`landing.hero.subtitle\|taglinePart\|landing.bio.para` over
  `src messages`) is empty. Two comment-only touches outside the "Files affected" table, both to
  keep that grep honest: `HomeBio.tsx`'s header no longer names `para1`/`para2` as keys that "stay
  in use on `/mentoria`", and the `StructuredData.tsx` note refers to the old hero's subtitle line
  without the literal key. Everything else is the md's, block for block: `MentoriaHeader` (server)
  + `MentoriaCtas` (the client island, a separate file as `HomeHeroCtas` is — a `"use client"`
  island can't share a Server Component's module) + `HowItWorks` (server, `id="como-funciona"`,
  `{hours}` as a prop from the page's single `getScheduleConfig()` read) + `mentoria.css`. Two
  additions to the CSS list the md names, both needed: `.mt-cta` / `.mt-cta--primary` /
  `.mt-cta--secondary` (the buttons need a stylesheet; they repeat `home.css`'s `.home-hero-cta*`
  values verbatim — the `ClosingCta` precedent of each feature owning its button rules — rather
  than importing the home's stylesheet into `/mentoria`), and `scroll-margin-top: 88px` on
  `.mt-sec` so `/mentoria#como-funciona` lands with the kicker below the fixed navbar
  (`SyllabusAccordion`'s `#temario` value; without it the anchor tucks the section head under the
  bar — memory: fixed navbar top clearance). The header and the steps keep the page's `fadeUp`
  entrance at the old hero's / bio's delays (0 / 0.15s), as `HomeHero` kept the hero's. Step
  bodies use ICU plural in BOTH locales (`hora/horas`, `hour/hours`), not only the English.
  `home.hero.jobTitle` carries the old `landing.hero.subtitle` value; `StructuredData`'s `home`
  branch reads it. Message parity: `only in es: []`, `only in en: []`.
  Verified with Playwright against `pnpm start` on port 3303 (the pane is unreliable for
  compositing — memory: headless CSS verification), 22 rects per width (header, kicker, rule, h1,
  accent, lead, CTA row, both buttons, free note, section, kicker/h2/subtitle, grid, step 1 and
  its three children, step 4, divider, the specs section) against `design/mentoria.html` at
  390 / 834 / 1440: every x/y/w/h identical, bar the Manrope text-run widths P1-04 already
  documented (kicker +5, primary +8, secondary +1 — the mock loads Google Fonts' Manrope, the app
  self-hosts next/font's) and `SpecializationsSection`'s own height below 1024 (+56 / +46, the
  real bento vs the mock's, untouched and out of scope; identical at 1440). Computed styles
  (family — Newsreader on the h1, italic green accent — size, weight, tracking, leading, colour,
  paddings, grid columns 1 / 2 / 4, gap, radius) equal on both sides; no horizontal overflow.
  Behaviour, signed out at 1440 and 390: «Reservar sesión ahora» → the «Identifícate para
  continuar» gate in place, URL `/mentoria` unchanged; «Ver disponibilidad» → the availability
  dialog (12 slot buttons) in place, FAB `display: none` under it; `#como-funciona` → section top
  at 88px in the viewport (navbar 70px); FAB gets `chat-fab--hero-overlap` at 390×560 while the
  CTA row's bottom (497) is inside the FAB zone (448) and loses it 120px down; exactly one
  `.chat-fab`; no page errors. `/en/mentoria` renders the English kicker, title, lead, CTAs, note
  and four steps (step 04 «up to 2 hours before»). Not verified: a `cancel_min_notice_hours`
  change on `/admin/schedule` (no local admin session — memory) — the value is the same
  `getScheduleConfig().cancelMinNoticeHours` `/terminos` already renders through the same tag
  revalidation; the signed-in in-place open (same `open-smart-book` path P1-06 covered).
  `pnpm lint` (0 errors, the same 8 pre-existing warnings), `pnpm test` (142 suites, 1791 tests),
  `pnpm build` green (`/[locale]/mentoria` ● for es and en; the prerendered HTML carries the
  header, `#hero-cta-row`, `#como-funciona`, four `.mt-step`s and no remnant of the old hero).
  E2E not re-run: no spec reads the hero's copy or the deleted keys (grep over `e2e/`), and the
  booking specs drive the session cards, not the header.
- **2026-09-19 (P2-02)** — No deviations from the task md. `pickTestimonials(locale)` lives in
  `src/constants/testimonials.ts` (not a separate file) since it's pure data logic with no React
  dependency — tested in `src/features/mentoria/__tests__/testimonials.test.ts`. Verified against
  `design/mentoria.html` at 390/834/1440 via Playwright (project's cached chromium,
  `/home/gustavo/.cache/ms-playwright`, launched directly — no Browser pane available this
  session): 1 column below 768, 3 columns from 768, Sergi/Alberto/Pablo on `/mentoria`,
  Jeremy/Sergi/Alberto on `/en/mentoria` with no quote translated, the Classgap link resolving to
  the same URL on both, `#valoraciones` sitting between `#como-funciona`'s bento and `#sessions`.
  `pnpm lint` (0 errors, same 8 pre-existing warnings), `pnpm test` (143 suites, 1795 tests),
  `pnpm build` green (`/[locale]/mentoria` ● for es and en).
- **2026-09-19 (P2-03)** — No deviations from the task md. No new copy: `AppShowcase` reuses the
  `app` message namespace already shipped for `/` (P1-04). Verified against `design/mentoria.html`
  at 390/1440 via Playwright (project's cached chromium, no Browser pane available this session,
  against a fresh `pnpm build` + `pnpm start` — the stale dev `next-server` left running from an
  earlier session was still serving the pre-edit build and had to be restarted): `.app-showcase`
  sits after `.packs-grid`, before `<footer>`, on both `/mentoria` and `/en/mentoria`; exactly one
  `.app-showcase` and one chat FAB. Overlay leak check: `.signin-gate-overlay` and the
  `BookingModeView` wrapper are both `position: fixed; inset: 0` at z-index 50/40 respectively —
  the same full-viewport pattern already proven not to leak content on `/` where `AppShowcase`
  sits in the identical position relative to `BookingOverlays` — screenshotted the sign-in gate
  over the app band at 390 to confirm (opaque `rgba(9,9,11,0.72)` + blur, nothing legible behind
  it). `pnpm lint` (0 errors, same 8 pre-existing warnings), `pnpm test` (143 suites, 1795 tests),
  `pnpm build` green (`/[locale]/mentoria` ● for es and en).
- **2026-09-19 (P2-04)** — No deviations from the task md's own change, but two comment-only
  touches outside its "Files affected" table, both needed to satisfy its own AC grep
  (`grep -rn "landing.meta" src messages e2e` empty): the P1-05-era comments in
  `src/app/[locale]/page.tsx:17-19` and `src/components/seo/StructuredData.tsx` that named the
  literal string `landing.meta` in prose were reworded (no rule or behavior changed, just the
  wording, since the key no longer exists to reference). `messages/{es,en}.json`'s EN copy for
  `meta.mentoria.*` isn't dictated verbatim by the task md ("EN equivalent") — written to match
  the ES original's structure and the existing `home.meta.*` EN phrasing style. `/mentoria`'s
  `generateMetadata` now explicitly sets `robots: { index: true, follow: true }` (the task's own
  wording), even though the root layout already defaults to that and the home's `generateMetadata`
  doesn't repeat it — kept explicit here since this is the page P0-01 had set to `noindex`.
  Verified via `pnpm build` + `pnpm start` + curl (test plan as written): `/mentoria` and
  `/en/mentoria` render their own `<title>`/description, `content="index, follow"`, and are listed
  in `sitemap.xml` with `es`/`en`/`x-default` (→ `/en/mentoria`) alternates; `/mentoria`'s JSON-LD
  is `[Person(@id ref), Service]` with `url` ending in `/mentoria` and `name`/`description` from
  `meta.mentoria.*`; `/`'s JSON-LD is `[Person]` only; `robots.txt` has no `/mentoria` disallow
  rule (none was needed). No sitemap unit test update needed — `src/app/__tests__/sitemap.test.ts`
  has no assertion over the static-route list, so `/mentoria`'s addition needed no test change.
  `pnpm lint` (0 errors, same 8 pre-existing warnings), `pnpm test` (143 suites, 1795 tests),
  `pnpm build` green (`/[locale]/mentoria` ● for es and en).

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
| [01 Hero + stats](phase-1-home/01-hero.md) | `REDESIGN-P1-01` | ⬜ | _tbd_ | |
| [02 Bio + compact areas](phase-1-home/02-bio-and-areas.md) | `REDESIGN-P1-02` | ⬜ | _tbd_ | |
| [03 Courses + latest posts](phase-1-home/03-courses-and-posts.md) | `REDESIGN-P1-03` | ⬜ | _tbd_ | |
| [04 App showcase + closing band + static home](phase-1-home/04-app-closing-and-static.md) | `REDESIGN-P1-04` | ⬜ | _tbd_ | |
| [05 Home metadata](phase-1-home/05-home-metadata.md) | `REDESIGN-P1-05` | ⬜ | _tbd_ | |

**Exit criteria**
- [ ] `/` renders the six home sections in order at 390, 834 and 1440 as `design/home.html`
- [ ] `/` has no `InteractiveShell`, no Suspense boundary, and `pnpm build` lists `/[locale]` as
      a static route (○)
- [ ] «Reservar sesión ahora» on `/` opens the smart booking on `/mentoria`; «Ver
      disponibilidad» opens the availability window there
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

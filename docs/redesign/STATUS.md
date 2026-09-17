# Home + Mentoría redesign — Status

**Planned:** 2026-09-17
**Started:** _tbd_
**Legend:** ⬜ not started · 🔄 in progress · ⛔ blocked · ✅ done · 🚫 won't do

Update this file when starting, completing, or blocking a task.

---

## Phase 0 — Route split

| Task | Tag | Status | Owner | PR |
|------|-----|--------|-------|----|
| [01 `/mentoria` route + menu](phase-0-route-split/01-mentoria-route-and-menu.md) | `REDESIGN-P0-01` | ⬜ | _tbd_ | |
| [02 Deep links, emails and e2e retarget](phase-0-route-split/02-deep-links.md) | `REDESIGN-P0-02` | ⬜ | _tbd_ | |

**Exit criteria**
- [ ] `/mentoria` and `/en/mentoria` render today's landing, `noindex`, absent from the sitemap
- [ ] Menu reads Inicio · Cursos · Mentoría · Blog on desktop and in the mobile panel; Inicio is
      current on `/`, Mentoría on `/mentoria`; `useSessionsAnchor.ts` no longer exists
- [ ] No `/#sessions`, `/?book=`, `/?reschedule=` or `/?action=` literal remains in `src/`,
      `e2e/` or the email templates; the booking e2e specs drive `/mentoria`
- [ ] `pnpm lint` + `pnpm test` + `pnpm build` green

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

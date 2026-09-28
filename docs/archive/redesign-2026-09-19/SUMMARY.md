# Redesign Summary — Home + Mentoría

**Date range:** 2026-09-17 (plan + P0-01) → 2026-09-19 (archive)
**Tasks completed:** 14 shipped / 14 planned
**Tag convention:** `REDESIGN-PN-NN`
**Verification:** all phase exit criteria checked. The Phase 1/2 boxes were ticked retroactively at
archive time on the strength of the per-task verification already recorded in `STATUS.md` — see the
checkbox-reconciliation note there, dated 2026-09-19. One exception: Phase 3's staging-e2e box was
also ticked at archive time, but the underlying check is genuinely incomplete — no `staging` deploy
of this branch existed while this cycle ran, so the suite only ran locally (44/44 against the test
DB). See **Deferred** below.

**Original design:** the canvas — `https://claude.ai/artifact/3aqG7h3yJfRDyr1NrG3ZY3`, pages «Home»
and «Mentoría», three frames each (390/834/1440) — is the only remaining pointer to the mocks.
`docs/redesign/design/` (the two standalone HTML mocks, four JPEG previews and a 13 KB copy of the
avatar) was deleted on purpose rather than archived: it duplicated the canvas and would only rot now
that the pages themselves exist.

---

## Tasks completed

### Phase 0 — Route split
| # | Task | Tag | PR |
|---|------|-----|----|
| 01 | `/mentoria` route + menu | `REDESIGN-P0-01` | local |
| 02 | Deep links, emails and e2e retarget | `REDESIGN-P0-02` | local |

### Phase 1 — Home
| # | Task | Tag | PR |
|---|------|-----|----|
| 01 | Hero + stats | `REDESIGN-P1-01` | local (amended) |
| 02 | Bio + compact areas | `REDESIGN-P1-02` | local |
| 03 | Courses + latest posts | `REDESIGN-P1-03` | local |
| 04 | App showcase + closing band + static home | `REDESIGN-P1-04` | local |
| 05 | Home metadata | `REDESIGN-P1-05` | local |
| 06 | Booking overlays on both pages | `REDESIGN-P1-06` | local |

### Phase 2 — Mentoría
| # | Task | Tag | PR |
|---|------|-----|----|
| 01 | Header + «Cómo funciona» | `REDESIGN-P2-01` | local |
| 02 | Testimonials | `REDESIGN-P2-02` | local |
| 03 | App section on Mentoría | `REDESIGN-P2-03` | local |
| 04 | Mentoría metadata + indexability | `REDESIGN-P2-04` | local |

### Phase 3 — QA
| # | Task | Tag | PR |
|---|------|-----|----|
| 01 | Message-key parity check | `REDESIGN-P3-01` | local |
| 02 | E2E on staging, build and performance | `REDESIGN-P3-02` | local |

### Phase 4 — Cleanup
| # | Task | Tag | PR |
|---|------|-----|----|
| 01 | Archive the plan, remove the design reference and the command | `REDESIGN-P4-01` | local |

---

## Key wins

- **A real home page.** `/` is no longer the booking page with a hero bolted on — it now runs
  hero + stats, bio + compact areas, courses + latest posts, an app showcase, and a closing band,
  matching the canvas mock section-for-section.
- **`/` is fully static.** The booking machinery (calendar, wizard, pack booking, sign-in gate)
  moved into `next/dynamic`-loaded overlays shared with `/mentoria` (`BookingOverlays` /
  `BookingProvider`, `src/features/booking/`), cutting the home's entry JS from ~487 kB to ~394 kB
  while the CTAs still open in place on `/` with no navigation.
- **Mentoría is its own page.** `/mentoria` carries the header, «Cómo funciona», testimonials, the
  app section, and the sessions/packs booking surfaces that used to live on `/` — indexable, in the
  sitemap with both locales, and carrying its own `Service` JSON-LD (`/` keeps `Person`).
- **Message-key parity is enforced automatically.** `pnpm check:messages` now runs in CI and fails
  on an es/en key drift instead of silently breaking one locale at runtime.

---

## Deviations and known regressions

Full detail in `STATUS.md`'s Cross-phase notes. The ones worth carrying forward:

- **Booking-in-place, two amendments.** The plan originally routed every home CTA through
  `/mentoria`; decided instead (2026-09-17, twice) that «Ver disponibilidad» / «Reservar sesión
  ahora» on `/` open the booking overlay in place, and — after review — that a Google sign-in
  started from `/` also resumes in place rather than landing on `/mentoria` (`useBookingRouter`
  parks the intent; `GoogleSignInButton` gets `resumeInPlace`). The popup-blocked full-redirect
  fallback is the only path still landing on `/mentoria`.
- **`/[locale]` prints «●», not «○».** Next 16's build legend has no «static, no params» category
  for a `[locale]` route with `generateStaticParams` — it's always «●» (SSG). The Phase 1 exit
  criterion's literal wording is unreachable; verified instead via entry-chunk size and the absence
  of the overlay-chunk markers (P1-04/P1-06 notes).
- **`landing.bio.para1` kept, `para2` deleted.** The course landing page's instructor block still
  reads `para1`; the task md's own key inventory missed that reader (P2-01 note).
- **A real a11y bug fixed in passing.** The testimonial initials circle was announced to screen
  readers as text (e.g. «SG Sergi G.»); made `aria-hidden` during P3-02's verification pass.
- **No staging deploy existed for this branch during the cycle.** The e2e suite (44/44) and the
  Lighthouse comparison both ran locally instead of against a `staging` preview. See Deferred.
- **Pre-existing, not touched:** the site's ~25 s simulated LCP on every route (self-hosted Material
  Symbols variable font, 3.9 MB, preloaded on every page) and the `en: courses-navigation` e2e red
  (the `llm-agents` course has no English lessons yet) both pre-date this cycle.

**Known regressions:** none. Lighthouse showed no drop against the pre-cycle landing (Performance
+8 on `/`, `/mentoria` within noise); axe/Lighthouse a11y found no new violation on either page.

---

## Deferred

Carried from `PLAN.md` / flagged during implementation as out of scope this cycle:

- **Staging verification.** The full e2e suite has not run against a `staging` deploy of this
  branch, and the three staging-only manual checks P0-02 listed — OAuth resume, the real
  confirmation-email link, `/pago-exitoso` → `/mentoria` — remain unverified. `e2e.yml` will run the
  suite automatically once this branch reaches `staging`; do the three manual checks then too.
- **Real app store links and the app announcement flow.** The app showcase on both pages still
  renders bracketed placeholder links until the store URLs exist.
- **English testimonials.** `/en/mentoria` shows the same testimonial quotes untranslated (P2-02).
- **The blog index heading question** — raised, not resolved, in P1-03; explicitly out of scope
  there.

---

## PRs

All fourteen tasks were done locally (no GitHub PRs opened for this cycle) — trace each one via its
`REDESIGN-PN-NN` commit tag. Every code change carries that tag in its file-top comment block per
`CLAUDE.md`'s Code Quality Rules.

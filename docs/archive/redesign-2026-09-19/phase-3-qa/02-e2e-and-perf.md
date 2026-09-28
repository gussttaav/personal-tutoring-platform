# P3-02 — E2E on staging, build and performance

**Tag:** `REDESIGN-P3-02` · **Effort:** M · **Owner:** _tbd_ · **Status:** ⬜
**Depends on:** P2-04 (both pages final)

## TL;DR

Run everything against the finished pages: the whole Playwright suite on staging, the build's
route table, the bundle guard, and Lighthouse on `/` and `/mentoria`. Fix what is a regression;
record what is a known flake; write the numbers into STATUS so the cycle has a before/after.

## Context

- `e2e/*.spec.ts` — `booking-free`, `booking-single`, `booking-pack`, `cancellation`, `chat`,
  `courses-navigation`, `courses-progress`, `courses-search`, `reschedule`; `e2e/global-setup.ts`
  needs a registered API key (memory: the local DB is unregistered — run on staging with
  `E2E_BASE_URL`).
- `.github/workflows/e2e.yml` — how CI runs the suite; use the same env.
- Memory notes: the suite is timing-flaky (a different single test per run); `check:bundle` has
  a known false positive on the `gt:pyodide-loaded` literal; `pnpm build` can fail on a
  `next/font/google` network flake or a Supabase `PGRST303` prerender flake — re-run before
  blaming the code.
- `docs/seo/PLAN.md` / the last SEO cycle — where the pre-cycle Lighthouse numbers for `/`
  were recorded, if anywhere; otherwise measure `main` before merging as the baseline.

## Files affected

| File | Change |
|------|--------|
| `e2e/**` | Only what a real regression requires; no new specs unless a home-page flow lacks one — then ONE `home.spec.ts` covering: nav order, «Ver disponibilidad» opens the calendar on `/` and a slot pick reaches the sign-in gate (signed out) or the free-15 confirmation (signed in, first-timer) without leaving `/`, «Reservar sesión ahora» opens the smart-book surface on `/`, the OAuth callbackUrl of a gate opened on `/` points at `/mentoria?intent=…`, footer assistant link opens the chat, the two course cards and two post cards present (amended 2026-09-17) |
| `docs/redesign/STATUS.md` | «Cross-phase notes»: the e2e run summary (pass / flake re-run / fixed), the route table lines for `/[locale]` and `/[locale]/mentoria`, Lighthouse mobile scores before and after for both pages |

## The change

A verification task, with one allowed addition (the home spec) because the home is a page with
no coverage otherwise and its CTAs are the new bridge into the booking.

Lighthouse: mobile preset, three runs each, median; `/` should improve on Performance (no
sessions/packs sections, no client-side bailout, the calendar / wizard / pack-booking chunks
dynamically imported and absent from First Load JS — P1-06) — if it does not, first confirm
those chunks are really off the route's First Load JS, then look at the app showcase's CSS and
the course/blog card CSS imports. `/mentoria` should match the old `/` within noise.

## Acceptance criteria

- [ ] Full e2e suite green on staging (flakes re-run once and noted)
- [ ] `home.spec.ts` exists and passes (if added)
- [ ] `pnpm build` green; route table recorded; `pnpm check:bundle` unchanged except the known
      false positive
- [ ] Lighthouse mobile before/after for `/` and `/mentoria` in STATUS; no Accessibility
      regression; `/` Performance ≥ the old landing's
- [ ] Axe (Playwright `@axe-core/playwright` if present, else Lighthouse's Accessibility audit)
      reports no new violations on either page — the phone mock is `aria-hidden`, the initials
      circles are decorative, the section heads are real headings in order

## Test plan

```bash
pnpm lint && pnpm test && pnpm build && pnpm check:bundle
E2E_BASE_URL=<staging> pnpm test:e2e
npx lighthouse <staging>/ --preset=perf --form-factor=mobile --output=json --quiet | jq '.categories | map_values(.score)'
npx lighthouse <staging>/mentoria …
```

## Gotchas

- Heading order: the home has one `h1` (the hero headline) and `h2`s for every band; Mentoría
  has one `h1` (the header title) and `h2`s; the cards' titles are `h3`. Lighthouse flags skips.
- `courses-navigation.spec.ts` was rewritten in P0-01; if it still mentions `#sessions`, that is
  a P0-01 miss, fix it there in spirit (same PR here is fine, note it).

## Out of scope

- Performance work beyond what the numbers demand; CSS refactors.

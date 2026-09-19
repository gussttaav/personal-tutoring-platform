# P2-03 — App section on Mentoría

**Tag:** `REDESIGN-P2-03` · **Effort:** S · **Owner:** _tbd_ · **Status:** ⬜
**Depends on:** P1-04 (the component), P2-02 (the page order above it)

## TL;DR

Mount the shared `AppShowcase` on `/mentoria` after the packs, as the page's last band. Same
component, same copy, same CSS as on the home. The page ends there; no closing band on Mentoría
(canvas decision: the page already ends on the pack purchase buttons and the app).

## Context

- `design/mentoria.html` — the app band is the home's, placed after `.packs-grid` with a 56px
  spacer before its own top border.
- `src/components/AppShowcase.tsx` + `app-showcase.css` (P1-04).
- `src/app/[locale]/mentoria/page.tsx` — the `Suspense` + `InteractiveShell` block renders the
  sessions, the divider and the packs, plus the overlays (`BookingModeView`, `PackModal`,
  `SignInGate`, `AvailabilityModal`) and the chat FAB; anything mounted after it sits below the
  packs in normal flow.
- `src/features/booking/InteractiveShell.tsx:321-380` — the overlays are `position: fixed`
  surfaces; the in-page booking (`BookingModeView`) replaces the shell's content while open.
  Content below the shell must not visually leak under an open overlay: check the
  `BookingModeView` container's z-index / backdrop against the app band.

## Files affected

| File | Change |
|------|--------|
| `src/app/[locale]/mentoria/page.tsx` | `+ import "@/components/app-showcase.css"`; mount `<AppShowcase />` after the `Suspense` block inside the same column, with the 56px spacer (`style={{ height: 56 }}` or a `.mt-divider` with zero bottom margin, as the design) |

## The change

One mount. The reasoning for having it here at all: on the home it is an announcement; on
Mentoría, right after someone has read the pack prices, it answers the next question — how do
I manage those classes. One component means the two pages can never drift.

## Acceptance criteria

- [ ] `/mentoria` ends with the app band after the packs, as `design/mentoria.html`, at the
      three widths; the footer follows
- [ ] With a booking overlay open (click a session card), the app band is not visible through or
      beside the overlay at 390 and 1440; closing the overlay restores the page with the band in
      place
- [ ] With `BookingModeView` open (pack scheduling), the band is below the calendar, not
      overlapping it
- [ ] Exactly one chat FAB on `/mentoria`
- [ ] `pnpm lint`, `pnpm test`, `pnpm build` green

## Test plan

```bash
pnpm lint
pnpm build
```

Browser pane: `/mentoria` at 390 and 1440; open and close each overlay.

## Gotchas

- Do not mount `Chat` on `/mentoria` — the shell already does.
- The band's top border is its own separator; do not add a `.mt-divider` with margins before it,
  only the spacer.

## Out of scope

- A closing band on Mentoría (deliberately absent).
- Any change to `AppShowcase` itself.

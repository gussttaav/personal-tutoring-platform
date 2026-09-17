# P1-06 — Booking overlays on both pages

**Tag:** `REDESIGN-P1-06` · **Effort:** M · **Owner:** _tbd_ · **Status:** ⬜
**Depends on:** P1-01 (amended: the home CTAs dispatch the shell's events)
**Blocks:** P1-04 (which swaps the shell for `BookingOverlays` on `/`)

> Added 2026-09-17 by the plan amendment recorded in `STATUS.md` («Cross-phase notes») and
> `PLAN.md` («Amendments»). Before it, the home's CTAs were links into `/mentoria?book=…` and the
> booking screens existed only there.

## TL;DR

Split `InteractiveShell` into the booking *brain + overlays* (`BookingProvider` +
`BookingOverlays`, mountable on any page) and the Mentoría-only *sections* (sessions + packs,
what `InteractiveShell` keeps). Nothing is rewritten: the hooks, listeners, the `?book=` and
OAuth-intent consumers, and the three overlay renders move file, verbatim. `/mentoria` behaves
exactly as today. `/` gains the overlays — so «Ver disponibilidad» opens the calendar in place,
a slot pick opens the 15-min confirmation in place, «Reservar sesión ahora» opens the right
screen directly — without gaining the sessions/packs sections, the reschedule reader
(`useSearchParams`) or the calendar/wizard JS on first load.

## Context

- `src/features/booking/InteractiveShell.tsx` — the whole thing, 531 lines:
  - `:83-97` — hooks and state: `useUserSession()`, `useBookingRouter(isSignedIn, credits,
    hasBookings)`, `useRescheduleIntent(isSignedIn)`, `showAvailabilityModal`, `pendingSlot`,
    `packClientSecret`, `packCheckoutLoading`, `packCheckoutInFlight`.
  - `:99-112` — the two reschedule → router wiring effects (`applyReschedule`,
    `setRescheduleSignInLabel`).
  - `:114-151` — window listeners: `open-pack-booking` (Navbar), `close-booking-overlay`
    (Navbar logo), `open-availability-modal`, `open-smart-book` (the heroes),
    `book-free-session` (`SpecializationsSection`).
  - `:153-191` — the `?book=` consumer (COURSE-P10-01 gating on `isAuthLoading`; the
    `availability` case from P1-01).
  - `:193-215` — `restoredSlot` → `pendingSlot` sync; the buy-pack-after-OAuth reveal effect.
  - `:219-231` — `handleAvailabilitySlotSelected`, `packStudentInfo`.
  - `:233-321` — the pack-booking full-screen overlay (early return; `BookingModeView`).
  - `:323-335` — `SingleSessionBooking` (early return; `BookingLayout` is `position: fixed`).
  - `:337-370` — `combinedSignInLabel` / `combinedCallbackUrl` (router ∪ reschedule),
    `AvailabilityModal`, `SignInGate`, `PackModal`.
  - `:372-525` — the sessions and packs sections; `:498-515` the pack checkout
    (`api.stripe.checkout` → `packClientSecret` → `handlePackBuy`).
  - `:527-528` — `<Chat />`.
- `src/hooks/useBookingRouter.ts:253,262,272,298` — every OAuth `callbackUrl` is a
  `/mentoria?intent=…` / `?action=…` literal (P0-02). `:130-216` — the intent consumer reads
  `window.location`, so it works on whichever page the router is mounted on.
- `src/hooks/useRescheduleIntent.ts:49` — the one `useSearchParams()` in the booking code. It
  is what needs the `Suspense` boundary; it must not reach `/`.
- `src/hooks/useUserSession.ts:47-71` — fetches `/api/credits` once per signed-in email on
  mount (+ the QUAL-06 visibility refetch). On `/` this now runs for signed-in visitors: it is
  what `handleSmartBook()` needs to choose free-15 / 1h / pack.
- `src/components/SingleSessionBooking.tsx:9`, `src/components/booking/BookingLayout.tsx:45` —
  the wizard is a fixed full-page overlay; `src/components/PackModal.tsx`, `AvailabilityModal.tsx`,
  `BookingModeView.tsx` — the other heavy overlays. `next/dynamic` precedent:
  `src/components/ZoomRoom.tsx`, `src/features/courses/code/CodeOutput.tsx`.
- `src/app/[locale]/page.tsx:56-67` and `mentoria/page.tsx:71-82` — the `Suspense` +
  `InteractiveShell` block on both pages (identical until P1-04).
- `src/features/home/HomeHeroCtas.tsx` (P1-01 amended) — dispatches `open-smart-book` /
  `open-availability-modal`; `src/components/Navbar.tsx`, `Footer.tsx`,
  `src/features/landing/SpecializationsSection.tsx` — the other dispatchers. None change.
- `CLAUDE.md:96` — the gotcha that says the shell is mounted on `/mentoria` only.

## Files affected

| File | Change |
|------|--------|
| `src/features/booking/BookingProvider.tsx` | **New**, client. `BookingProvider` + `useBooking()` (React context). Owns, moved verbatim from `InteractiveShell.tsx:83-231` minus the reschedule hook: `useUserSession`, `useBookingRouter`, the five state atoms, the five window listeners, the `?book=` consumer, the `restoredSlot` sync, the buy-pack reveal effect, `handleAvailabilitySlotSelected`, `packStudentInfo`. Plus one new atom the reschedule bridge fills: `rescheduleGate: { label: string; callbackUrl?: string; clear: () => void } \| null`. Exposes everything the sections and overlays read today (`router`, `googleUser`, `isSignedIn`, `isAuthLoading`, `packSession`, `creditsLoading`, `updateCredits`, `hasBookings`, the atoms and their setters, `packCheckoutInFlight`) |
| `src/features/booking/BookingOverlays.tsx` | **New**, client. `<BookingOverlays>{children}</BookingOverlays>` = `<BookingProvider>` + the three overlay renders from `:233-321`, `:323-335`, `:346-370` + `{children}`. `SingleSessionBooking`, `BookingModeView`, `AvailabilityModal`, `PackModal` imported with `next/dynamic(…, { ssr: false, loading: Spinner })`; `SignInGate` static. The sign-in gate reads `router.signInGateLabel \|\| rescheduleGate?.label`, `router.signInCallbackUrl ?? rescheduleGate?.callbackUrl`, and `onClose` calls `router.handleSignInGateClose()` then `rescheduleGate?.clear()` — the same three lines as `:338-339,358` |
| `src/features/booking/RescheduleBridge.tsx` | **New**, client, renders null. `useRescheduleIntent(isSignedIn)` + the two wiring effects from `:99-112` + `setRescheduleGate(...)` when `reschedule.signInLabel` / `pendingReschedule` change. Mounted by `InteractiveShell` only, so `useSearchParams` stays inside Mentoría's `Suspense` boundary |
| `src/features/booking/InteractiveShell.tsx` | Becomes the *sections*: reads `useBooking()`, mounts `<RescheduleBridge />`, returns `null` while `router.showPackBooking \|\| router.activeSession` (today's early returns, so the DOM under an open overlay is unchanged), renders the sessions + packs sections (`:372-525`, verbatim incl. the pack checkout) and `<Chat />`. Header comment: `REDESIGN-P1-06` paragraph; the «Logic: 100% IDENTICAL» block stays true and says where the logic went |
| `src/app/[locale]/mentoria/page.tsx` | `<Suspense …><InteractiveShell /></Suspense>` → `<BookingOverlays><Suspense …><InteractiveShell /></Suspense></BookingOverlays>`. The boundary moves *inside* the provider: the overlays don't read search params, the bridge does |
| `src/app/[locale]/page.tsx` | Same wrapping as Mentoría for now (the shell is still on `/` until P1-04). P1-04 then replaces the whole block with `<BookingOverlays />` |
| `CLAUDE.md` | The gotcha at `:96`: the overlays (`BookingOverlays`) are mounted on both pages, the sections (`InteractiveShell`) on `/mentoria` only; the deep-link and OAuth rules unchanged (`/mentoria?book=…`, `/mentoria?intent=…`; never link to `/?book=`) |
| `docs/redesign/STATUS.md` | Row, exit criteria, cross-phase note |

## The change

**Move, don't rewrite.** The shell's header says «Logic: 100% IDENTICAL to original»; keep it
that way across the split. Every hook call, effect, dependency array and `eslint-disable`
comment moves as a block. The one genuinely new piece of state is `rescheduleGate`, which
replaces the direct reads of `reschedule.*` in the sign-in gate render — because the reschedule
hook can no longer live next to the router (it would drag `useSearchParams` onto the home).

**Why a context, not events.** The sections need the router (`handleSessionClick`,
`handlePackBuy`, `packClientSecret`, `packCheckoutInFlight`, `creditsLoading`, `packSession`)
and the overlays need the same router instance; two hook instances would be two sources of
truth. Events remain the *cross-component trigger* mechanism (Navbar, Footer, the heroes,
`SpecializationsSection`) — unchanged — but the state has one owner.

**Why `next/dynamic`.** The home is a marketing page; its first-load JS should not carry the
weekly calendar, the three-step wizard and the pack booking view for a click most visitors never
make. The overlays are state-gated and never in the server HTML, so `ssr: false` changes nothing
visible; the `loading` spinner covers the OAuth-return case where an overlay opens on first
paint. Mentoría gets the same treatment for free.

**Sequencing.** After this task and before P1-04, `/` still mounts the (now sections-only) shell
below the old landing — same as today — and the home hero's events are heard by the provider.
P1-04 removes the sections + `Suspense` and mounts `<BookingOverlays />` alone: at that point
`/` has no `useSearchParams` anywhere and the static-route criterion is P1-04's to verify.

**What visitors see on `/` after P1-04.** Signed out: «Reservar sesión ahora» → SignInGate in
place (callbackUrl `/mentoria?intent=smart-book`); «Ver disponibilidad» → the calendar in place,
slot pick → SignInGate with the slot encoded (`/mentoria?intent=smart-book&slotStart=…`); after
Google, `/mentoria` opens the booking with the slot restored — today's flow, untouched. Signed
in: the smart-book surface opens directly on `/` (free 15 min for a first-timer, 1h otherwise,
the pack booking with credits); a slot pick pre-fills it. Closing returns to `/`.

## Acceptance criteria

- [ ] `/mentoria`: every flow the five booking e2e specs drive (`booking-free`,
      `booking-single`, `booking-pack`, `reschedule`, `chat`) passes as before the split
- [ ] `/` (with the shell still mounted, pre-P1-04): «Ver disponibilidad» opens the calendar on
      `/`; a slot pick opens the free-15 confirmation (signed in, first-timer) or the SignInGate
      with the slot in the callbackUrl (signed out); «Reservar sesión ahora» opens the smart-book
      surface on `/` — no navigation in the signed-in case
- [ ] After Google sign-in from a gate opened on `/`, the user lands on `/mentoria` with the
      intended booking open and the slot (if any) pre-selected — the same as today
- [ ] Navbar «Reservar con pack» (`open-pack-booking`) and the logo click
      (`close-booking-overlay`) work on both pages; `SpecializationsSection`'s
      `book-free-session` works on `/mentoria`
- [ ] The `?book=` consumer works on `/mentoria` for every case incl. `availability`;
      `/mentoria?reschedule=…&token=…` still opens the reschedule flow (bridge wired)
- [ ] `pnpm build`: the First Load JS of `/[locale]` does not include the calendar / wizard /
      pack-booking chunks (compare the route's size before and after; they load on first open —
      verify in the Network panel)
- [ ] No `useSearchParams` reachable from `/` outside Mentoría's `Suspense` boundary
      (`grep -rn useSearchParams src/features/booking src/hooks` lists only
      `useRescheduleIntent.ts`, and only `RescheduleBridge` imports it)
- [ ] `src/features/booking/InteractiveShell.tsx` no longer calls `useUserSession`,
      `useBookingRouter` or `useRescheduleIntent` directly
- [ ] `CLAUDE.md:96` updated
- [ ] `pnpm lint`, `pnpm test`, `pnpm build` green

## Test plan

```bash
pnpm lint
pnpm test
pnpm build 2>&1 | grep -E "/\[locale\]"          # First Load JS of / before vs after
grep -rn "useSearchParams" src/features/booking src/hooks
grep -rn "useUserSession\|useBookingRouter\|useRescheduleIntent" src/features/booking
# Locally against the test DB (.env.e2e.local + stripe listen; see the P0-02 note for the Stripe key state):
pnpm test:e2e -- booking-free reschedule chat booking-single booking-pack
```

Browser pane, signed out, at 390 and 1440: on `/` click both CTAs; pick a slot in the calendar
and read the SignInGate's callbackUrl (`slotStart` present); Navbar pack button and logo click on
both pages. Signed in (staging, or a hand-minted session on `pnpm start` — memory: no local
admin session): «Reservar sesión ahora» on `/` opens the wizard without leaving `/`; complete a
free-15 booking from a slot picked on `/`.

## Gotchas

- `useBookingRouter`'s intent consumer is gated on `isSignedIn` and consumes the params once
  (`intentConsumed`). With the provider on two pages there is still one instance per page — no
  double consumption — but do not mount `BookingOverlays` twice on one page (two providers would
  both hear `open-smart-book`).
- The sections' early return must stay (`null` while an overlay is up) or the pack checkout
  button remains clickable behind the pack-booking overlay — today it is unmounted.
- `Chat` is rendered by the sections on `/mentoria`; P1-04 mounts it on `/` separately. Do not
  render it from `BookingOverlays` or `/mentoria` gets two FABs.
- `next/dynamic` with `ssr: false` must be called at module scope, not inside the component.
- The `?book=` consumer moving into the provider means `/?book=smart` would now work too. The
  CLAUDE.md rule «never link to `/?book=`» stands: nothing may rely on it.
- The `react-hooks/set-state-in-effect` disables and the `exhaustive-deps` disables travel with
  their effects — do not "fix" them while moving.

## Out of scope

- Removing the shell from `/` and the static-route check (P1-04).
- Any change to `useBookingRouter`, `useUserSession`, `useRescheduleIntent`, the callbackUrls,
  or the e2e specs' targets.
- Returning to `/` (instead of `/mentoria`) after an OAuth round-trip started on `/`.
- New tests for the router (none exist today; the e2e suite is its coverage).

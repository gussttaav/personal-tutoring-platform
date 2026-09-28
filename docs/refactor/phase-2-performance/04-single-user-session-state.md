# P2-04 — One user-session state for the whole page

**Tag:** `REFACTOR-R4-P2-04` · **Severity:** 🟡 · **Effort:** S · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

`useUserSession()` is a plain hook with its own `useState` and effects, so every component that calls
it gets a separate copy of the student's credit state. Each copy:
- fetches `/api/credits` (a credits read plus a bookings read) on sign-in
- registers its own tab-focus refetch

Three components call it: the Navbar on every page, `BookingProvider` on `/`, `/mentoria` and
`/area-personal`, and `PackBookingOverlay` on the session pre-join page. So booking pages fetch
credits twice per load and twice per tab focus.

The copies also **disagree**. Booking a pack class in the overlay updates `BookingProvider`'s credit
count, but the Navbar badge keeps showing the old one until reload. `PersonalArea` already works
around this by reading from `useBooking()` instead of its own hook.

Lift the state into one `UserSessionProvider` and make `useUserSession()` read it. The call sites
don't change.

## Context

- `src/hooks/useUserSession.ts:29-175`: per-instance state (`:31-35`), fetch-once-per-email effect
  (`:77-88`), visibility refetch with 30 s cooldown (`:122-141`, QUAL-06), `updateCredits` (`:145-152`).
- Call sites:
  - `src/components/Navbar.tsx:36` (badge at `:80`, `:229-232`, `:355-358`)
  - `src/features/booking/BookingProvider.tsx:88-91` (feeds `useBookingRouter`)
  - `src/components/PackBookingOverlay.tsx:22`, mounted by `src/components/PreJoinSetup.tsx:383`
- `src/features/personal-area/PersonalArea.tsx:20`: the existing workaround comment: it reads
  `packSession` from the booking context, "not an own `useUserSession()`, so `updateCredits` after a
  pack class" shows up.
- `src/app/api/credits/route.ts:25-28`: each call is `getBalance` + `hasAnyBooking`.
- The `/api/pricing` half of the audit finding (`UserPricingSync` on every page) is fixed by P2-03,
  which confines `UserPricingSync` to the commerce pages.

## Files affected

| File | Change |
|------|--------|
| `src/hooks/useUserSession.ts` | Body becomes `useUserSessionState()` (internal); `useUserSession()` reads the context |
| `src/components/UserSessionProvider.tsx` (new, client) | Holds the single state; provides the same return shape |
| `src/app/[locale]/layout.tsx` | Mount `<UserSessionProvider>` inside `<AuthProvider>` |
| `src/features/personal-area/PersonalArea.tsx` | Comment updated: the workaround is no longer needed (behaviour unchanged) |
| tests | Hook/provider test: one fetch for N consumers; shared updates |

## The change

```tsx
// src/components/UserSessionProvider.tsx
"use client";
// REFACTOR-R4-P2-04: ONE credit/session state per page. useUserSession() used to own
// its state per call site, so the Navbar, BookingProvider and PackBookingOverlay each
// fetched /api/credits and each kept their own (diverging) credit count.
import { createContext, useContext } from "react";
import { useUserSessionState, type UserSessionValue } from "@/hooks/useUserSession";

const UserSessionContext = createContext<UserSessionValue | null>(null);

export function UserSessionProvider({ children }: { children: React.ReactNode }) {
  const value = useUserSessionState();
  return <UserSessionContext.Provider value={value}>{children}</UserSessionContext.Provider>;
}

export function useUserSessionContext(): UserSessionValue {
  const ctx = useContext(UserSessionContext);
  if (!ctx) throw new Error("useUserSession must be used within a UserSessionProvider");
  return ctx;
}
```

```ts
// src/hooks/useUserSession.ts
export function useUserSessionState(): UserSessionValue { /* the current body, unchanged */ }

/** Reads the page-wide state from UserSessionProvider. Same return shape as before. */
export function useUserSession(): UserSessionValue {
  return useUserSessionContext();
}
```

```tsx
// layout.tsx
<AuthProvider>
  <UserSessionProvider>
    {/* …children (and, until P2-03 lands, UserPricingSync)… */}
  </UserSessionProvider>
</AuthProvider>
```

`updateCredits` and `clearPackSession` must be stable across renders (`useCallback`) now that
several consumers depend on them. Memoize the provider value with `useMemo` on its fields, so a
Navbar re-render doesn't re-render the booking shell.

## Acceptance criteria

- [ ] A signed-in full page load of `/mentoria` issues exactly **one** `GET /api/credits`; so do `/`, `/area-personal` and a lesson
- [ ] Tab focus after ≥ 30 s triggers exactly one refetch, not one per consumer
- [ ] Booking a pack class in the overlay updates the Navbar badge without a reload
- [ ] Signing out clears the badge and the booking shell's pack state together
- [ ] All three call sites compile unchanged (`useUserSession()` signature identical)
- [ ] File-top comment blocks carry `REFACTOR-R4-P2-04`

## Test plan

- **Existing:** e2e `booking-pack.spec.ts`, `booking-personal-area.spec.ts`, `home.spec.ts` green.
  Any unit test that renders `Navbar`/`BookingProvider` needs the provider in its wrapper.
- **New (unit, RTL):** render two consumers under one `UserSessionProvider` with a mocked
  `api.credits.get`. Assert it's called once. Call `updateCredits(3)` from one consumer and the other
  sees `credits === 3`.
- **New (unit):** `useUserSession()` outside the provider throws a clear error.
- **Manual:** network panel on `/mentoria` signed in: one `/api/credits`.

## Notes / gotchas

- **React Compiler lint.** `react-hooks/refs` rejects render-time handler factories that read refs.
  The current hook reads `fetchedForEmail` / `lastVisibilityFetch` only inside effects and callbacks.
  Keep it that way when moving code into the provider (see the project's React Compiler notes).
- **Order vs. P2-03.** Independent in code, but P2-03 moves `UserPricingSync` into `CommerceProviders`.
  If P2-04 lands first, place `UserSessionProvider` *outside* `UserPricingSync` in the layout, so
  P2-03's move doesn't have to re-nest it.
- The provider lives in the root layout, but it's a client component with no server data. It doesn't
  reintroduce the Supabase coupling P2-03 removes.
- Signed-out visitors: the hook's effects early-return when `status !== "authenticated"`. No
  requests, same as today.

## Out of scope

- Merging `BookingProvider`'s booking-router state into this provider.
- Caching credits across page loads (sessionStorage). The single fetch per load is enough.
- The `/api/credits` handler itself.

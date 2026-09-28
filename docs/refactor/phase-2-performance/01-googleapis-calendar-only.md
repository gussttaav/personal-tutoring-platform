# P2-01 — `@googleapis/calendar` instead of the full `googleapis`

**Tag:** `REFACTOR-R4-P2-01` · **Severity:** 🟠 · **Effort:** S · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

`CalendarClient.ts` does `import { google } from "googleapis"`, which pulls in the client for all
~300 Google APIs to use one of them. `src/services/index.ts` constructs `new CalendarClient()` at
import time, and nearly every route imports `@/services`. So **32 of the 43 API lambdas** ship and
evaluate a **10.1 MB** server chunk on every cold start. That includes `/api/auth/[...nextauth]`,
which the session provider calls on every page load, and simple routes like `/api/courses/progress`
and `/api/content/vote`.

Switch to the single-API package `@googleapis/calendar` plus `google-auth-library`, which is already
a direct dependency. While here, build the Calendar client once per process instead of once per
call, so the OAuth token is reused across calls.

## Context

- `src/infrastructure/google/CalendarClient.ts:4`: `import { google } from "googleapis";`. It's the only
  runtime import of the package (`package.json:39`, `"googleapis": "^144.0.0"`).
- `src/infrastructure/google/CalendarClient.ts:21-30`: `getCalendar()` builds a **new**
  `GoogleAuth` + client on every call. `getAvailableSlots` (`:81`), `createEvent` (`:130`) and
  `deleteEvent` (`:170`) each pay a fresh service-account token exchange.
- `src/services/index.ts:58-67` and `:96-101`: `new CalendarClient()` for `bookingService` and
  `accountService`, evaluated when *any* export of `@/services` is imported.
- Measured on the main checkout's build (2026-09-27 23:41):
  - `.next/server/app/api/courses/progress/route.js.nft.json` traces `_0w.gp2l._.js`, a 10,122 KB
    chunk containing ~19k `googleapis` references
  - the same chunk is in the trace of 32 routes, including `auth/[...nextauth]`, `courses/attempt`,
    `content/vote`, `content/report`, `credits`, `pricing`, `locale`, `book`, `cancel`
- Other users of the package:
  - `src/infrastructure/google/__tests__/CalendarClient.test.ts:6-13` mocks `"googleapis"`
  - `e2e/fixtures/cleanup.ts:13` uses it (Node, not bundled) to delete test calendar events

## Files affected

| File | Change |
|------|--------|
| `package.json` / `pnpm-lock.yaml` | Add `@googleapis/calendar`; remove `googleapis` |
| `src/infrastructure/google/CalendarClient.ts` | Import from `@googleapis/calendar` + `google-auth-library`; memoize the client |
| `src/infrastructure/google/__tests__/CalendarClient.test.ts` | Mock `@googleapis/calendar` + `google-auth-library` instead of `googleapis` |
| `e2e/fixtures/cleanup.ts` | Same import swap |

## The change

```ts
// src/infrastructure/google/CalendarClient.ts
// REFACTOR-R4-P2-01: the single-API package. `googleapis` bundled all ~300 Google APIs
// into a 10 MB server chunk that 32 lambdas evaluated on every cold start.
import { calendar as calendarApi, type calendar_v3 } from "@googleapis/calendar";
import { GoogleAuth } from "google-auth-library";

// Built once per process (warm lambda). GoogleAuth caches the service-account access
// token internally, so re-creating it per call re-did the token exchange every time.
let client: calendar_v3.Calendar | null = null;

function getCalendar(): calendar_v3.Calendar {
  if (client) return client;
  const auth = new GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key:  process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  client = calendarApi({ version: "v3", auth });
  return client;
}
```

The call sites (`calendar.freebusy.query`, `calendar.events.insert/delete`, and P1-01's
`events.list`) keep the same shape. `@googleapis/calendar` exposes the identical `calendar_v3`
surface.

The test mock becomes:

```ts
jest.mock("google-auth-library", () => ({ GoogleAuth: jest.fn().mockImplementation(() => ({})) }));
jest.mock("@googleapis/calendar", () => ({
  calendar: jest.fn().mockImplementation(() => ({ freebusy: { query: mockFreebusyQuery } })),
}));
```

The memoized client lives at module scope, so tests that swap mock implementations between cases
need `jest.resetModules()` or an exported `__resetCalendarClient()` test hook, following
`registry.ts`'s `__resetRegistry` precedent.

## Acceptance criteria

- [ ] `googleapis` is gone from `package.json` and from every import (`grep -rn "from \"googleapis\"" src e2e` → nothing)
- [ ] After `pnpm build`, no `.next/server/app/api/**/route.js.nft.json` references a chunk > 2 MB that contains `googleapis` API definitions. Record before/after of the largest chunk traced by `/api/courses/progress` in the PR
- [ ] `getCalendar()` constructs `GoogleAuth` at most once per process (unit test)
- [ ] Availability, booking (event insert), cancel (event delete) and the webhook re-check work against the real calendar in a preview deploy or local run with real credentials
- [ ] File-top comment block carries `REFACTOR-R4-P2-01`

## Test plan

- **Existing:** `CalendarClient.test.ts` (step-size behaviour) green with the new mocks;
  `BookingService`/`PaymentService` suites unaffected (they use `FakeCalendarClient`).
- **New:** `CalendarClient.test.ts`: two `getAvailableSlots` calls → `GoogleAuth` constructor called once.
- **Measure:** the nft check above, plus a cold-start comparison. Hit `/api/courses/progress` on a
  fresh preview deploy before and after, and compare the function duration in the Vercel logs.
- **Manual:** book, cancel, and reschedule a free call locally with real Calendar credentials. The
  events appear and disappear.
- **e2e:** `cleanup.ts` still deletes test events. Run one booking spec end to end.

## Notes / gotchas

- **Version alignment.** `@googleapis/calendar` depends on `googleapis-common`, which depends on
  `google-auth-library`. Pick the `@googleapis/calendar` major whose `google-auth-library` range
  includes the direct `9.15.1` (`package.json:38`), so pnpm resolves one copy. Two copies work but
  undo part of the saving. Check `pnpm why google-auth-library` after install.
- `GoogleIdTokenVerifier` (`src/infrastructure/google/GoogleIdTokenVerifier.ts`) already uses
  `google-auth-library` directly and is unaffected.
- The Stripe SDK chunk (~1.3 MB) is also in most lambdas for the same eager-composition reason. It's
  an order of magnitude smaller. Leave it (see Out of scope).
- **Memoizing and credentials rotation.** A warm lambda keeps the client until it's recycled. The
  service-account key is an env var, and changing it redeploys, so there's no staleness problem.

## Out of scope

- A lazy composition root (constructing services on first use instead of at import). That's the
  underlying architecture reason every route pays for every client. With the 10 MB gone it's no longer
  urgent, and it touches every route import. It gets its own design if cold starts still matter after
  this lands.
- Lazy-loading the Stripe SDK.
- Replacing `freebusy` in `getAvailableSlots`.

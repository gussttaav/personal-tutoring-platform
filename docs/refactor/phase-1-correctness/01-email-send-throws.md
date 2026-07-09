# P1-01 — `send()` must throw on Resend failure

**Tag:** `REFACTOR-R3-P1-01` · **Severity:** 🟠 · **Effort:** M · **Owner:** Claude · **Status:** ✅

## TL;DR

`send()` in `email-functions.ts` logs Resend HTTP errors to `console.error` and returns
normally. Every email in the system therefore "succeeds" no matter what Resend says:
`BookingService.sendWithRetry` never retries, `emailFailed` is always `false`, and the
dead-letter admin notification can vanish silently. Make `send()` throw on `!res.ok`,
and route its logging through `log()`.

## Context

- `src/infrastructure/resend/email-functions.ts:61-68` — `!res.ok` branch: two `console.error` calls, then falls through to a normal return.
- `src/infrastructure/resend/email-functions.ts:53` — missing `RESEND_API_KEY` degrades to `console.warn` + no-op (startup-checks requires the key in real deploys, so this is a dev-only path — keep the no-op but log structurally).
- `src/services/BookingService.ts:475-489` — `sendWithRetry` retries 3× **on throw**; with no throw it can't do its job.
- `src/services/BookingService.ts:318` — `emailFailed: !confirmSent` is dead code today (always `false`).
- `src/services/PaymentService.ts:489-495` — `sendDeadLetterNotificationEmail(...).catch(() => {})`: already tolerant of a throw, currently just never sees one.
- `src/services/BookingService.ts:405-424` — cancellation emails are wrapped in `Promise.all(...).catch(log)`: also already throw-tolerant.

## Files affected

| File | Change |
|------|--------|
| `src/infrastructure/resend/email-functions.ts` | `send()` throws on `!res.ok`; all `console.*` → `log()` |
| `src/services/__tests__/BookingService.test.ts` | New test: failing email fake → 3 retries + `emailFailed: true` |
| `src/__tests__/fixtures/` | Email fake gains a failure mode if it doesn't have one |

## The change

```ts
// email-functions.ts
import { log } from "@/lib/logger";

async function send(
  payload: { to: string; subject: string; html: string },
  studentEmail?: string,
): Promise<void> {
  const testAccounts = (process.env.E2E_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);
  if (testAccounts.includes(payload.to) || (studentEmail && testAccounts.includes(studentEmail))) {
    log("info", "Email skipped for E2E test account", { service: "email", to: payload.to });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    log("warn", "RESEND_API_KEY not set — email skipped", { service: "email", to: payload.to });
    return;
  }

  const res = await fetch(RESEND_API_URL, { /* unchanged */ });

  if (!res.ok) {
    const body = await res.text();
    log("error", "Resend send failed", {
      service: "email", status: res.status, to: payload.to, from: FROM, body,
    });
    throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  log("info", "Email sent", { service: "email", to: payload.to, id: (data as { id?: string }).id });
}
```

No caller signatures change — callers already assume `send()` can throw.

## Caller audit (all must tolerate a throw — verify each)

Run `grep -rn "sendConfirmation\|sendCancellation\|sendNewBooking\|sendDeadLetter\|sendSubscription" src --include="*.ts" | grep -v __tests__ | grep -v email-functions` and confirm every call site either retries, `.catch`es, or intentionally propagates. Known sites:

- `BookingService.createBooking` → `sendWithRetry` ✅ (this is the fix's whole point)
- `BookingService.cancelByToken` → `Promise.all(...).catch(log)` ✅
- `PaymentService.writeDeadLetter` → `.catch(() => {})` ✅
- Any `SubscriptionService` / review-flow emails found by the grep → check individually; wrap if bare.

## Acceptance criteria

- [x] Resend 4xx/5xx → `send()` throws; `sendWithRetry` attempts 3× with backoff
- [x] After 3 failures, `createBooking` returns `emailFailed: true` (booking still succeeds)
- [x] `email-functions.ts` contains zero `console.*`
- [x] Missing `RESEND_API_KEY` and E2E-skip paths remain non-throwing no-ops (now via `log()`)
- [x] No caller of an email function is left with an unhandled rejection path (grep audit done)
- [x] File-top comment block updated with `REFACTOR-R3-P1-01`

## Test plan

- **Existing:** `pnpm test` — `BookingService.test.ts`, `PaymentService.test.ts` must stay green.
- **New (service-level, mock repos per project rule):**
  - email fake fails all attempts → booking output has `emailFailed: true`, 3 attempts recorded
  - email fake fails twice then succeeds → `emailFailed: false`, 3 attempts recorded
  - dead-letter path: email fake throws → `writeDeadLetter` still resolves (`.catch(() => {})` holds)
- **Manual:** temporarily set an invalid `RESEND_API_KEY` locally, book a free15min slot, confirm the UI/API response carries `emailFailed: true` and Sentry receives the structured error.

## Notes / gotchas

- **Do the `console.*` → `log()` conversion for this file here, not in P2-03** — one PR per task; P2-03 covers `auth.ts` only.
- `sendWithRetry`'s `setTimeout` backoff (500ms/1000ms) runs inside a serverless function: 3 attempts × slow Resend + backoff must stay well under the 25s Vercel Hobby cap. Resend's API is fast; if paranoid, add a `AbortSignal.timeout(5000)` to the fetch — optional, note if done.
- `getTranslations` from `next-intl/server` is used in this file; don't disturb the locale plumbing.

## Out of scope

- Retry queues / durable email outbox.
- Converting `auth.ts` console calls (P2-03).
- Surfacing `emailFailed` in new UI (the flag already flows to existing consumers).

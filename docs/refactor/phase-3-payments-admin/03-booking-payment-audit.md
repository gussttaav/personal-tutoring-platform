# P3-03 — Daily audit: every upcoming class longer than 15 minutes is paid

**Tag:** `REFACTOR-R4-P3-03` · **Severity:** 🟡 · **Effort:** M · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

Add a daily, read-only cron that walks every **upcoming confirmed booking** and checks it is backed
by what it should be:

- a free call is exactly 15 minutes
- a paid 1h/2h class has a succeeded Stripe payment, for that student and that duration, that has
  not been refunded or disputed
- a pack class draws on a pack the student owns, bought with a payment that has not been refunded
  (or granted by the tutor by hand)

It reports and changes nothing: a Sentry `error` plus an email to the tutor when something is off,
and nothing when everything is clean.

This is the off-path complement to the trimmed P1-01. Gustavo chose not to spend request latency on
per-booking external checks (see STATUS.md → Deviations, P1-01). P1-01's in-process length check
already makes a class longer than 15 minutes impossible without a matching payment **at booking
time**. What nothing catches today is what happens **after** booking:

- a payment refunded or disputed in the Stripe dashboard while the class stays booked
- bookings created before P1-01
- manual database edits, and bugs

Its mirror image, "every succeeded payment produced a booking or credits", is the existing
`/api/internal/reconcile-stripe` cron (P3-01 reworks it).

## Context

- **How a booking points at its payment** (`supabase/migrations/0001_complete_schema.sql:27-36`,
  `:49-66`):
  - `bookings.stripe_payment_id`: set only for paid 1h/2h classes, by the webhook
    (`src/services/PaymentService.ts:519`, `stripePaymentId: paymentIntentId`). For both the embedded
    and the legacy Checkout flow it holds a `pi_…` id (`:430`).
  - `bookings.credit_pack_id` → `credit_packs.stripe_payment_id` (`UNIQUE NOT NULL`) for pack
    classes. Written since `BOOKING-PACKLINK-01` (migration `0015`).
  - Admin-granted packs carry a synthetic id, not a payment:
    `src/app/api/admin/students/[email]/route.ts:78-84`
    (`stripeSessionId: \`manual-${Date.now()}-…\``).
  - Free calls point at nothing.
- **Reschedules lose the paid link today.** `/api/book` reschedules a paid class by calling
  `createBooking` without a `stripePaymentId` (`src/app/api/book/route.ts:38-42`), so the new row
  has `stripe_payment_id = NULL`. P1-03 fixes this: it carries `stripe_payment_id` over, and moves the
  pack link (`docs/refactor/phase-1-correctness/03-reschedule-keeps-original.md:19-21`, `:40-41`).
  **This task lands after P1-03**, or every rescheduled paid class is a false "unpaid".
- **Session lengths:** `SESSION_DURATION_MINUTES` in `src/lib/booking-config.ts` (P1-01). The
  bookable horizon is `BOOKING_WINDOW_WEEKS` (same file).
- **Cron precedents:**
  - `src/app/api/internal/reconcile-stripe/route.ts:1-23` (header: cron-job.org daily, `CRON_SECRET`
    bearer, read-only), `:48` (auth check).
  - `src/app/api/internal/session-cleanup/route.ts:22` (same auth).
  - Vercel is on Hobby: no native crons (CLAUDE.md).
- **Stripe access** goes through `IStripeClient` (`src/infrastructure/stripe/StripeClient.ts:14-23`).
  `retrievePaymentIntent` returns the bare PaymentIntent. Refund and dispute state live on the
  charge (`latest_charge`), which needs `expand`.
- **Tutor notifications:** `IEmailClient.sendContentReportNotification`
  (`src/infrastructure/resend/IEmailClient.ts:61`) is the injected precedent for an admin email to
  `NOTIFY_EMAIL`. Admin-facing copy stays Spanish (CLAUDE.md).

## Files affected

| File | Change |
|------|--------|
| `src/domain/types.ts` | `PaymentAuditBooking`, `PaymentAuditFinding`, `PaymentAuditReport` |
| `src/domain/repositories/IBookingRepository.ts` + `src/infrastructure/supabase/SupabaseBookingRepository.ts` | `listUpcomingForPaymentAudit(untilIso)` |
| `src/infrastructure/stripe/StripeClient.ts` | `IStripeClient.retrievePaymentForAudit(id)` → `PaymentAuditFacts \| null` |
| `src/infrastructure/resend/IEmailClient.ts`, `EmailClient.ts`, `email-functions.ts` | `sendPaymentAuditReport` (Spanish, to `NOTIFY_EMAIL`) |
| `src/services/BookingPaymentAuditService.ts` (new) | `evaluateBooking()` (pure) + `auditUpcoming()` |
| `src/services/index.ts` | Wire `bookingPaymentAuditService` |
| `src/app/api/internal/booking-payment-audit/route.ts` (new) | Thin: `CRON_SECRET` → service → log + email + JSON |
| `src/__tests__/fixtures/InMemoryBookingRepository.ts`, `FakeStripeClient.ts`, `FakeEmailClient.ts` | Fakes for the three new methods |
| `src/services/__tests__/BookingPaymentAuditService.test.ts` (new) | Rule matrix + orchestration |
| `src/app/api/internal/booking-payment-audit/__tests__/route.test.ts` (new) | Auth, body shape, email only on findings |
| `src/infrastructure/supabase/__tests__/SupabaseBookingRepository.test.ts` | DB-gated `listUpcomingForPaymentAudit` cases |

## The change

### 1. The read (`IBookingRepository`)

```ts
// src/domain/types.ts
export interface PaymentAuditBooking {
  bookingId:       string;
  email:           string;
  sessionType:     SessionType;
  startsAt:        string;          // normalized with new Date(...).toISOString()
  endsAt:          string;
  stripePaymentId: string | null;   // paid 1h/2h classes
  creditPack:      { id: string; ownedByBookingUser: boolean; stripePaymentId: string } | null;
}
```

```ts
// IBookingRepository
/** REFACTOR-R4-P3-03: confirmed bookings starting in [now, untilIso), with what they are
 *  paid by. Throws on a read error: a failed read must not report "all paid". */
listUpcomingForPaymentAudit(untilIso: string): Promise<PaymentAuditBooking[]>;
```

Supabase implementation, in separate queries (this repository's convention, file header
`:1-5`):

1. `bookings` where `status = 'confirmed'` and `starts_at` in `[now, untilIso)`. Select `id, user_id,
   session_type, starts_at, ends_at, stripe_payment_id, credit_pack_id`.
2. `users` where `id in (…)`, for the emails.
3. `credit_packs` where `id in (…)`, selecting `id, user_id, stripe_payment_id`.

Throw on every `error`. Normalize both timestamps (the TIMESTAMPTZ gotcha in CLAUDE.md).

### 2. Payment facts (`IStripeClient`)

```ts
// StripeClient.ts — keeps Stripe types out of the service
export interface PaymentAuditFacts {
  status:          string;          // PaymentIntent.status
  amount:          number;
  amountRefunded:  number;          // latest_charge.amount_refunded, 0 if no charge
  disputed:        boolean;         // latest_charge.disputed
  checkoutType:    string | null;   // metadata.checkout_type
  sessionDuration: string | null;   // metadata.session_duration
  studentEmail:    string | null;   // metadata.student_email
}

/** REFACTOR-R4-P3-03: null when Stripe has no such PaymentIntent (resource_missing).
 *  Any other error propagates. */
retrievePaymentForAudit(id: string): Promise<PaymentAuditFacts | null>;
```

The implementation is `stripe.paymentIntents.retrieve(id, { expand: ["latest_charge"] })`. It maps a
`StripeInvalidRequestError` with `code === "resource_missing"` to `null` and rethrows everything else.

### 3. The rules (`evaluateBooking`, pure)

`evaluateBooking(booking, facts)` returns zero or more findings, where `facts` is the payment the
booking points at (`undefined` when it points at none). Codes:

| Code | When |
|------|------|
| `length_mismatch` | `endsAt − startsAt ≠ SESSION_DURATION_MINUTES[sessionType]` (every type, free calls included) |
| `no_payment_link` | 1h/2h without `stripePaymentId`; pack without `creditPack` |
| `pack_not_owned` | The pack belongs to another user |
| `payment_not_found` | Stripe has no such PaymentIntent |
| `payment_not_succeeded` | `status !== "succeeded"` |
| `payment_refunded` | `amountRefunded >= amount` |
| `payment_partially_refunded` | `0 < amountRefunded < amount`. For a **pack** this is a *review* item, not an error: refunding unused classes is a legitimate partial refund |
| `payment_disputed` | `disputed` |
| `payment_mismatch` | `checkoutType` isn't `single`/`pack` as expected, `sessionDuration` doesn't match `1h`/`2h`, or `studentEmail` (lower-cased, trimmed) isn't the booking's |

Handling by booking type:
- **Free calls** are checked for length only.
- **Pack classes** on a `manual-…` pack pass: it's an admin grant. They're counted in the report as
  `manualPackClasses`.

### 4. Orchestration (`BookingPaymentAuditService.auditUpcoming`)

```ts
// REFACTOR-R4-P3-03: read-only audit of upcoming bookings against their payments.
// Off the request path by design (P1-01 was trimmed to keep Stripe/Google out of it).
async auditUpcoming(now = Date.now()): Promise<PaymentAuditReport> {
  const until    = new Date(now + BOOKING_WINDOW_WEEKS * 7 * 86_400_000).toISOString();
  const bookings = await this.bookings.listUpcomingForPaymentAudit(until);
  // One Stripe call per DISTINCT PaymentIntent (a pack's PI backs several classes),
  // at most 5 in flight. Errors other than "not found" propagate → the run fails (500).
  // …evaluate each booking…
  return { checked, byType, manualPackClasses, findings };
}
```

- The service takes `IBookingRepository`, `IStripeClient` and `IEmailClient` by constructor injection.
- Why a service of its own: `PaymentService` is already ~690 lines, and P3-01 adds
  `reconcileRecentPayments` to it. Putting the audit in `PaymentService` instead is fine if the
  reviewer prefers the two directions together. Pick one and say so in the PR.
- Load estimate: a solo tutor's 8-week window holds tens of bookings. At ~300 ms per Stripe
  retrieve and 5 in flight, a run takes a few seconds, well under the Hobby function cap.

### 5. The route

`GET /api/internal/booking-payment-audit`:

- Same `Authorization: Bearer ${CRON_SECRET}` check as the other internal routes, then
  `bookingPaymentAuditService.auditUpcoming()`.
- With findings: `log("error", …)` with the count and a sample of 10 (it reaches Sentry, as the
  reconcile cron does), plus `email.sendPaymentAuditReport(report)`. The email is best-effort: a
  failure logs `warn` and does not fail the run.
- Clean run: `log("info", …)` and no email.
- Response: `{ checked, findings: n, details }`, the same shape as reconcile-stripe.
- On an exception: `log("error")` and a 500, so cron-job.org shows the failed run.

### 6. Scheduling (manual, cron-job.org)

- **Daily at 07:00 Europe/Madrid**, before the first working block, with the `Authorization` header
  set as for the other two jobs.
- Optionally a second run at 14:00. A class booked after the morning run for later the same day
  (min-notice is 5 h) is otherwise audited only after it happens. With P1-01's length check in
  place, only a refund or dispute issued that same day can slip through that gap.
- Record the schedule in the PR.

## Acceptance criteria

- [ ] Every rule in §3 produces its code, and a clean paid, pack, manual-pack or free booking produces none
- [ ] One Stripe call per distinct PaymentIntent per run (a 10-class pack is checked once)
- [ ] Past, cancelled, completed and no-show bookings are not audited; nothing beyond the booking window is read
- [ ] The audit writes nothing: no booking, payment or Stripe object is modified
- [ ] A Supabase or Stripe error (other than "not found") → 500, no email, no "all clear" log
- [ ] Findings → one Sentry `error` log + one tutor email; a clean run → `info` log, no email
- [ ] Without the `CRON_SECRET` bearer → 403
- [ ] File-top comment blocks carry `REFACTOR-R4-P3-03`

## Test plan

- **New (service, pure):** `evaluateBooking` table-driven over every code in §3, including:
  - partial refund, where a pack gives *review* and a single gives an error
  - `manual-…` pack
  - email differing only in case or whitespace (not a mismatch)
  - a 2h payment backing a 1h booking
- **New (service, orchestration)**, with `InMemoryBookingRepository` + `FakeStripeClient` + `FakeEmailClient`:
  - dedupe: two classes on one pack → one `retrievePaymentForAudit` call
  - a Stripe `resource_missing` gives `payment_not_found`, while any other Stripe error rejects the run
  - the horizon excludes a booking starting after the window
- **New (route):** 403 without the secret; 200 + body shape; email sent only when there are findings;
  an email failure still returns 200.
- **New (DB-gated repository):** `listUpcomingForPaymentAudit` filters status and time, joins the
  pack owner and PI, and normalizes timestamps.
- **Manual:** after deploying to staging, create in Stripe **test mode**:
  1. a paid class, then refund it from the dashboard
  2. a pack class
  3. a free call

  Call the route with `curl -H "Authorization: Bearer $CRON_SECRET"`. Expect exactly one
  `payment_refunded` finding and one email.

## Notes / gotchas

- **Order:**
  - **After P1-03**, which carries `stripe_payment_id` over on reschedule. Before it, every
    rescheduled paid class reads as `no_payment_link`.
  - **After P3-01** if both touch `IStripeClient` / `FakeStripeClient` at the same time; otherwise
    rebase on whichever lands first.
- **First runs will show known noise.** Paid classes rescheduled *before* P1-03 shipped keep a
  `NULL` `stripe_payment_id`. List them once, check them by hand, and note them in the PR:

  ```sql
  SELECT b.id, u.email, b.session_type, b.starts_at
  FROM bookings b JOIN users u ON u.id = b.user_id
  WHERE b.status = 'confirmed' AND b.starts_at > now()
    AND b.session_type IN ('session1h','session2h') AND b.stripe_payment_id IS NULL;
  ```
- **Pack classes booked before migration `0015`** have no `credit_pack_id` and would read as
  `no_payment_link`. Only upcoming bookings are audited, so by now there should be none. If one
  shows up, check it by hand.
- **Report only.** Don't auto-cancel or email the student. A refund issued on purpose (a goodwill
  refund where the class still happens) is a legitimate state that only the tutor can judge. If that
  becomes common, a follow-up can let the tutor dismiss a finding.
- **Refund state lives on the charge.** `PaymentIntent.status` stays `succeeded` after a refund (the
  same fact P3-01 relies on), so the rule must read `latest_charge.amount_refunded`, not `status`.
- **Fail closed:** a failed read must fail the run, never report "all paid" (P1-02's rule).

## Out of scope

- Any check on the request path. P1-01 was trimmed precisely to keep external calls out of booking.
- Auto-cancelling or notifying the student about an unpaid or refunded class.
- An admin UI for findings (the email and Sentry are the surface for now).
- Checking bookings against the tutor's Google Calendar.
- The payment → booking direction (the reconcile-stripe cron, P3-01).

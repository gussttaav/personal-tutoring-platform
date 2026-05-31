# Phase 4 — Formatting helpers + localized emails

> See [README](./README.md) for project-wide context. Phases 1–3 must be merged first.

## Goal

Centralize date/time/currency formatting via a single utility and localize the customer-facing emails (booking confirmation, cancellation). Spanish-flow output stays byte-identical to today; English-flow gets English emails with English-formatted dates.

## Branch

```bash
git checkout staging && git pull
git checkout -b feat/i18n-phase-4-formatting-emails
```

## Background

Current state:
- [src/infrastructure/resend/email-functions.ts](../../src/infrastructure/resend/email-functions.ts) has inline HTML strings in Spanish, dates formatted with `toLocaleDateString('es-ES', ...)`, timezone pinned to `Europe/Madrid`.
- Scattered `Intl.DateTimeFormat('es-ES', ...)` calls in components.
- No central formatter helper.

## Steps

### 1. Create the formatting helper

**`src/lib/formatting.ts`**:

```ts
const TZ = 'Europe/Madrid';

type Locale = 'es' | 'en';

export function formatDate(date: Date | string, locale: Locale, opts?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...opts,
  }).format(typeof date === 'string' ? new Date(date) : date);
}

export function formatTime(date: Date | string, locale: Locale, opts?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    ...opts,
  }).format(typeof date === 'string' ? new Date(date) : date);
}

export function formatCurrency(amount: number, locale: Locale, currency = 'EUR') {
  return new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}
```

Adjust the English locale tag to `en-GB` if the user prefers DD/MM/YYYY-style formatting for English (UK) over the US convention. Default `en-US` is fine if not stated.

### 2. Sweep callers of ad-hoc `toLocaleDateString` / `Intl.DateTimeFormat`

Grep the codebase:
```bash
grep -rn "toLocaleDateString\|Intl\.DateTimeFormat\|Intl\.NumberFormat" src/ --include='*.ts' --include='*.tsx'
```

For each callsite:
- Components/features: get `locale` from `useLocale()` (client) or page params (server), then call `formatDate(value, locale)`.
- Server-only contexts that don't have a locale param: read the cookie — `(await cookies()).get('NEXT_LOCALE')?.value as Locale ?? 'es'`.

### 3. Localize email templates

**Recommended approach:** extract template HTML into a function that takes a `t` accessor + formatted values.

Option A — separate template files (`src/infrastructure/resend/email-templates/`):
```
confirmation.ts   // exports renderConfirmation(t, vars)
cancellation.ts
```

Where each template uses keys like `t('emails.confirmation.subject')`, `t('emails.confirmation.body', { ... })`, and dates are pre-formatted by the caller.

Option B — keep templates inline in `email-functions.ts` but parameterize by `locale`.

Pick whichever leaves the HTML most readable. (A scales better as the email set grows.)

### 4. Update `email-functions.ts`

Each send function adds a `locale: 'es' | 'en'` parameter:

```ts
import { getTranslations } from 'next-intl/server';
import { formatDate, formatTime } from '@/lib/formatting';

export async function sendBookingConfirmation({
  to,
  booking,
  locale,
}: {
  to: string;
  booking: Booking;
  locale: 'es' | 'en';
}) {
  const t = await getTranslations({ locale, namespace: 'emails.confirmation' });
  const html = renderConfirmation(t, {
    date: formatDate(booking.startsAt, locale),
    time: formatTime(booking.startsAt, locale),
    // ...
  });
  return resend.emails.send({ to, subject: t('subject'), html /* , ... */ });
}
```

### 5. Pass locale from callers

Every caller in `src/services/**` and `src/app/api/**` must pass `locale`. Determine it from:

- API route handlers triggered by user requests: `(await cookies()).get('NEXT_LOCALE')?.value as 'es' | 'en' ?? 'es'`.
- Background jobs / QStash-scheduled callbacks (e.g., reminder emails fired hours later): no cookie available. Default to `'es'`. This is acceptable for now — when a `users.locale` column is added later (out of scope per README), update these callers to read from the user record. Keep the call site obvious so it's easy to find later (e.g., a `// TODO(i18n): read locale from user record once persisted` comment).

### 6. Tests

Per CLAUDE.md: "every service change needs a test."

- Unit-test `formatDate`/`formatTime`/`formatCurrency` for both locales, including a DST boundary date (e.g., last Sunday of March in `Europe/Madrid`).
- Update or add service-level tests in `src/services/__tests__/` that cover the email-sending path for both locales (mock the Resend client; assert the correct template + subject are produced).

## Risks

| Risk | Mitigation |
|---|---|
| Wrong English locale convention (US vs UK date format) | Confirm with user before merging; default to `en-US` per next-intl convention. |
| Background-job emails sent in Spanish to English users | Documented as accepted tradeoff (no DB column yet). Mark callsites with TODO. |
| Lost Spanish-flow fidelity | Compare a Spanish email side-by-side with one from production (subject, formatting, copy). Should be byte-identical except for any whitespace differences. |
| Forgotten callsites of `toLocaleDateString` | Run the grep in step 2 again after the migration; should return zero hits in user-facing files. |

## Exit criteria

- [ ] One real test booking in `/en` produces an English email with English-formatted date/time.
- [ ] One real test booking in `/` (Spanish) produces an email identical to today's output.
- [ ] One cancellation in each locale produces the right email.
- [ ] `grep -rn "toLocaleDateString\|new Intl\.DateTimeFormat\|new Intl\.NumberFormat" src/` returns only the `src/lib/formatting.ts` definitions (or low-level utilities) — no scattered calls in components.
- [ ] Service-level tests for email functions cover both locales.
- [ ] `pnpm build`, `lint`, `test`, `test:e2e` clean.

## Verification

```bash
# Staging:
# 1. Switch to /en in browser, log in, book a session.
# 2. Inspect the email in the Resend dashboard — English subject, body, formatted date.
# 3. Cancel it — English cancellation email.
# 4. Repeat from / — Spanish output identical to current prod.
```

## PR description template

```
## Summary
- New src/lib/formatting.ts wraps Intl.DateTimeFormat / NumberFormat for both locales (TZ pinned to Europe/Madrid).
- Email functions accept a `locale` parameter; templates split by locale or parameterized via getTranslations.
- All callers in services/API routes pass `locale` (cookie-derived; background jobs default to 'es' with a TODO).
- Swept ad-hoc Intl.* usages in components to use formatDate/formatTime.

## Test plan
- [ ] Spanish booking email matches current production output
- [ ] English booking email renders fully translated with English date format
- [ ] Cancellation emails localized in both languages
- [ ] formatDate unit tests cover DST boundary
- [ ] pnpm build/lint/test/test:e2e pass
```

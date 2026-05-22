# Phase 3 — Migrate remaining UI strings

> See [README](./README.md) for project-wide context. Phases 1 and 2 must be merged first.

## Goal

Move every customer-facing Spanish literal in `src/app/[locale]/**`, `src/components/**`, and `src/features/**` into the dictionaries. Convert page-level metadata to `generateMetadata` with `getTranslations`. Refactor domain errors to carry **codes** instead of Spanish strings (translation happens at the presentation boundary). Update Playwright tests so they cover both locales.

**Admin pages stay Spanish** (see README — out of scope).

This is the largest phase. Consider splitting into sub-PRs by feature area if the diff gets unwieldy (e.g., one PR for `area-personal`, one for booking flow, one for legal pages).

## Branch

```bash
git checkout staging && git pull
git checkout -b feat/i18n-phase-3-ui-migration
```

(Or split: `feat/i18n-phase-3a-area-personal`, `feat/i18n-phase-3b-booking`, etc.)

## Scope checklist by area

### Components (`src/components/`)
- 33 `.tsx` files. Walk through each — anything user-visible gets moved to a dictionary key.
- Notable: [BookingModeView.tsx](../../src/components/BookingModeView.tsx), [PaymentForm.tsx](../../src/components/PaymentForm.tsx), [PreJoinSetup.tsx](../../src/components/PreJoinSetup.tsx), [SingleSessionBooking.tsx](../../src/components/SingleSessionBooking.tsx).
- `aria-label` attributes are user-facing — translate them.

### Features (`src/features/`)
- 14 `.tsx` files across booking, personal-area, landing.
- Landing was done in Phase 2; this is personal-area + booking primarily.

### App routes (`src/app/[locale]/`)
- 19 `.tsx` files: legal pages (privacidad, terminos), confirmation pages, auth pages, session pages, cancellation page.
- Each page's `metadata` export becomes `generateMetadata` reading from `meta.<page>` namespace.

### Errors
- [src/constants/errors.ts](../../src/constants/errors.ts) — HTTP status → message map. Convert message **values** to translation **keys** under `errors.http.*`. Update consumers to call `t(key)` at render time instead of pulling the string straight out of the map.
- [src/domain/errors.ts](../../src/domain/errors.ts) — **refactor**: each domain error class now carries a stable `code` (e.g. `BOOKING_CONFLICT`, `NO_CREDITS`, `LINK_EXPIRED`) instead of a Spanish message. The class can still expose a `message` for logs (English, developer-facing — these are not user-facing).
  - Update [src/lib/http-errors.ts](../../src/lib/http-errors.ts) to map codes to HTTP status + the i18n key. The API responds with `{ code: 'BOOKING_CONFLICT', status: 409 }`; the client translates via `errors.domain.bookingConflict` (or similar).
  - This aligns with the project's layered architecture rule (CLAUDE.md): the domain layer has zero external dependencies — including no notion of UI language.

### Admin (out of scope)
- Leave `src/app/[locale]/admin/**` and admin-specific components inline Spanish.

## How to migrate a component

### Client component
```tsx
'use client';
import { useTranslations } from 'next-intl';

export function BookingButton() {
  const t = useTranslations('booking');
  return <button>{t('confirmReservation')}</button>;
}
```

### Server component
```tsx
import { getTranslations, setRequestLocale } from 'next-intl/server';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('legal.privacy');
  return <h1>{t('title')}</h1>;
}
```

### Page metadata
```tsx
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta.areaPersonal' });
  return { title: t('title'), description: t('description') };
}
```

### Interpolation
For dynamic values, use ICU-style placeholders in the JSON:
```json
{ "greeting": "Hola, {name}" }
```
```tsx
t('greeting', { name: user.name })
```

## Dictionary discipline

- Add new keys to **both** `es.json` and `en.json` simultaneously. Don't merge a PR with missing English keys (next-intl will log warnings; if `NEXT_PUBLIC_INTL_LOG_LEVEL` is set strict, it errors).
- Namespace by feature, not by component. Reuse keys for genuinely identical text.
- Keep ICU placeholders consistent across languages.
- Run a quick script (or manual diff) to ensure both files have identical key sets.

## Playwright test updates

E2E tests currently assert Spanish text directly. Two acceptable approaches:

**Option A (recommended) — shared text helper:**
```ts
import es from '../messages/es.json';
import en from '../messages/en.json';
const dict = { es, en };

await expect(page.getByRole('heading')).toHaveText(dict[locale].areaPersonal.title);
```

**Option B — duplicate the suites under `test.describe('/en')`** with English assertions hardcoded.

Pick one and stay consistent. If tests already have many Spanish assertions, Option A scales better.

Update [playwright.config.ts](../../playwright.config.ts) or per-test fixtures if you need to set the locale cookie / Accept-Language for `/en` runs.

## Exit criteria

- [ ] `grep -rE '[áéíóúñ¿¡]' src/app/[locale] src/components src/features --include=*.tsx --include=*.ts | grep -v "/admin/"` returns no UI string matches (only comments/code identifiers, if any).
- [ ] Every non-admin route renders cleanly in both `/` and `/en/`.
- [ ] `messages/es.json` and `messages/en.json` have identical key sets.
- [ ] Domain errors carry codes; presentation layer translates them.
- [ ] Playwright suite passes for both locales.
- [ ] `npm run build`, `lint`, `test`, `test:e2e` clean.

## Verification

Manual click-through both locales:
- Landing → courses → booking flow → checkout → confirmation page.
- Sign in → área personal → reschedule → cancel.
- Legal pages (privacidad, terminos).
- Trigger validation errors (Phase 5 will polish these — they may still surface raw codes; acceptable for this phase as long as the API-mapped messages translate).

Spot-check that admin pages are still in Spanish (intentionally untouched).

## Risks

| Risk | Mitigation |
|---|---|
| Missing translation keys → next-intl logs warnings or shows fallbacks | Use a key-parity check between `es.json` and `en.json` before merge. |
| Server components without `setRequestLocale` break static rendering | Add `setRequestLocale(locale)` at the top of every server page. |
| Domain error refactor leaks across many files | Stage it as a sub-PR if the surface area is large. Run full test suite after. |
| Playwright assertion churn | Migrate via the shared helper (Option A) so future text changes don't break tests. |

# Internationalization (i18n) — Spanish + English

## Context

The app is fully in Spanish today (`<html lang="es">` hardcoded, ~300+ Spanish strings across components, features, errors, and email templates). We want to:

- Keep Spanish as the **default** language (unprefixed URLs, no breaking changes).
- Add **English** as a secondary language under the `/en` URL prefix.
- **Auto-detect** browser language: non-Spanish visitors land on `/en` on first visit.
- Provide a **manual switcher** in the navbar (desktop + mobile).
- Translate **customer-facing UI + emails**. Admin panel stays Spanish.

## Confirmed decisions

| Decision | Choice |
|---|---|
| URL strategy | `/en/...` for English, Spanish unprefixed (`localePrefix: 'as-needed'`). |
| Library | `next-intl` 3.x — first-class Next.js 14 App Router, server + client symmetry, built-in `Accept-Language` middleware. |
| Locale persistence | Cookie only (`NEXT_LOCALE`). **No** `users.locale` column / no Supabase migration. |
| Admin panel | Stays Spanish (out of scope). |
| Emails | Translated; sender accepts `locale` parameter. |
| Domain errors | Carry **codes**, not localized strings (presentation layer translates). |

## Workflow

One session per phase, one PR per phase. Each phase leaves the Spanish app fully working — phases are independently mergeable.

Before starting a phase, branch off `staging`:

```bash
git checkout staging && git pull
git checkout -b feat/i18n-phase-<N>-<short-name>
```

## Phases

1. **[Phase 1 — Foundation](./phase-1-foundation.md)**: install `next-intl`, wire middleware, move pages under `[locale]`. No string migration. App still 100% Spanish but the wiring is in place.
2. **[Phase 2 — Dictionaries + switcher + navbar/landing](./phase-2-navbar-landing.md)**: translation files, locale switcher in navbar, navbar + landing page fully bilingual, auto-detect active.
3. **[Phase 3 — Migrate remaining UI strings](./phase-3-ui-migration.md)**: every customer-facing string in components/features moves into dictionaries. Domain errors switch to codes. Playwright tests updated.
4. **[Phase 4 — Formatting + emails](./phase-4-formatting-emails.md)**: centralized `Intl` formatting helpers; confirmation + cancellation emails localized.
5. **[Phase 5 — Validation + SEO polish](./phase-5-validation-seo.md)**: Zod messages as keys, `hrefLang` tags, sitemap.

## Out of scope (do not do as part of this work)

- `users.locale` column or any Supabase migration for locale.
- NextAuth session shape changes for locale.
- Admin panel translation.
- Localizing thrown messages inside `src/domain/errors.ts` (codes only — translation is a presentation-layer concern).
- Adding NextAuth route-protection middleware just because Phase 1 introduces `src/middleware.ts`.
- A third language, ICU pluralization beyond what next-intl provides, or a translation-management platform (Crowdin/Lokalise).
- Loosening CSP preemptively — only react to real, observed violations.

## End-to-end verification (after all phases ship)

1. Clear cookies, set browser language to French → visit `/` → land on `/en`. Browse, log in via Google, book a session → confirmation email arrives in English with English-formatted date/time.
2. Clear cookies, browser in Spanish → visit `/` → stays at `/` (no redirect). Book → email in Spanish, identical to today.
3. Logged-in user toggles the switcher mid-session: page re-renders in the new language, NextAuth session intact, subsequent emails follow the new locale.
4. `npm run build`, `npm run lint`, `npm test`, `npm run test:e2e` all clean.
5. Watch Sentry for 24h after each phase for new locale-related errors (routing, hydration, missing-key warnings).

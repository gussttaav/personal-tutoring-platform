# i18n summary: Spanish + English

**Date range:** 2026-05-22 (plan) → 2026-06-06 (last PR) · archived 2026-11-09
**Phases completed:** 5 / 5, shipped as 8 PRs, plus 1 follow-up PR
**Tag convention:** none (the plan predates per-task tags); work is traceable by PR and branch
`feat/i18n-*`.
**Archive note:** this plan had no status tracker. It was archived on 2026-11-09, five months after
it shipped, with status reconstructed from git history.

The live rules are in `CLAUDE.md` («Internationalization (i18n)»), not here. Some decisions in
[README.md](README.md) were changed after the plan, see **Superseded** below.

---

## Phases completed

| Phase | What | PR |
|-------|------|----|
| [1 — Foundation](phase-1-foundation.md) | `next-intl`, middleware, pages under `[locale]` | [#31](https://github.com/gussttaav/personal-tutoring-platform/pull/31) |
| [2 — Dictionaries + switcher + navbar/landing](phase-2-navbar-landing.md) | message files, locale switcher, bilingual navbar + landing | [#32](https://github.com/gussttaav/personal-tutoring-platform/pull/32) |
| [3 — Remaining UI strings](phase-3-ui-migration.md) | 3a errors as codes, 3b personal area, 3c booking flow, 3d the rest | [#33](https://github.com/gussttaav/personal-tutoring-platform/pull/33), [#34](https://github.com/gussttaav/personal-tutoring-platform/pull/34), [#35](https://github.com/gussttaav/personal-tutoring-platform/pull/35), [#36](https://github.com/gussttaav/personal-tutoring-platform/pull/36) |
| [4 — Formatting + emails](phase-4-formatting-emails.md) | `Intl` helpers, localized confirmation/cancellation emails | [#37](https://github.com/gussttaav/personal-tutoring-platform/pull/37) |
| [5 — Validation + SEO polish](phase-5-validation-seo.md) | Zod messages as keys, `hrefLang`, locale-aware sitemap | [#38](https://github.com/gussttaav/personal-tutoring-platform/pull/38) |
| Follow-up | Persist the locale in `users.locale` (migration `0010`), reconciled at login | [#39](https://github.com/gussttaav/personal-tutoring-platform/pull/39) |

## Key wins

- **Bilingual customer-facing app and emails**, Spanish unprefixed and English under `/en`, with the
  admin panel left in Spanish as planned.
- **Errors carry codes, not strings**: the presentation layer translates domain, HTTP and
  validation errors, so services stay language-free.
- **Background emails speak the user's language**: `users.locale` lets the Stripe webhook and other
  request-less flows pick the right locale.

## Superseded after the plan

- «Locale persistence: cookie only, no `users.locale` column»: replaced by PR #39 (`users.locale`,
  migration `0010`), which is now the account-level source of truth.
- «Auto-detect browser language»: `b682c5b` (2026-06-06) sent non-Spanish browsers to `/en`, and the
  SEO cycle's SEO-01 (2026-07-09) removed `Accept-Language` detection entirely, because it
  307-redirected Googlebot away from `/` (see `../seo-2026-07-12/`). Detection is now pathname, then
  the `NEXT_LOCALE` cookie, then Spanish.
- The plan names `next-intl` 3.x and Next.js 14; the app has since moved to `next-intl` 4 and
  Next.js 16.
- File links in the phase docs point at the code as it was; some files have moved since (for
  example `src/app/layout.tsx`, which phase 1 itself moved under `[locale]`).

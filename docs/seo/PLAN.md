# SEO Optimization — Plan & Status

**Date:** 2026-07-09
**Trigger:** Google Search Console email — some pages could not be indexed (email lost; diagnosis
re-derived from code). Root cause: the middleware 307-redirected the canonical Spanish root `/`
to `/en` for any cookieless visitor whose `Accept-Language` wasn't Spanish. Googlebot crawls
cookieless → "Page with redirect" indexing failures.

**Scope decision:** technical + on-page SEO only. No new content pages/blog this cycle.
**Out of scope** (belongs to refactor cycle 3, do not touch here): PaymentService,
WeeklyCalendar/AvailabilityModal dedupe, ScheduleService caching (R3-P3-02), rate limiting.

## Tasks

| Task | What | PR | Status |
|------|------|----|--------|
| SEO-00 | This tracking doc | PR 1 | ✅ Done |
| SEO-01 | Remove Accept-Language locale redirect (strip header in middleware; detection = pathname → NEXT_LOCALE cookie → es). THE indexing fix. | PR 1 | ✅ Done |
| SEO-02 | `noindex, nofollow` metadata on transactional/auth/admin pages (pass-through layouts for client pages) | PR 2 | ⬜ Pending |
| SEO-03 | OpenGraph + Twitter card metadata in root layout + `public/og.png` (1200×630) | PR 3 | ⬜ Pending |
| SEO-04 | JSON-LD structured data (`Person` + `Service`, price-free) on home | PR 3 | ⬜ Pending |
| SEO-05 | Sitemap `x-default` + www/non-www host default consistency | PR 4 | ⬜ Pending |
| SEO-06 | Verify home/legal pages stay prerendered (build route table) — verification only, no code | PR 1 | ✅ Done — `/[locale]`, `/[locale]/privacidad`, `/[locale]/terminos` all ● SSG (1h revalidate); only auth-gated routes are dynamic |
| SEO-07 | GSC workflow: validate diagnosis, request reindexing, resubmit sitemap (manual, post-deploy) | — | ⬜ Pending |

## Behavior change (SEO-01)

| Request | Before | After |
|---|---|---|
| Googlebot `/` (no cookie, `en-US` or no header) | 307 → `/en` | **200 Spanish** |
| Non-Spanish browser `/`, no cookie | 307 → `/en` | 200 Spanish (deliberate product change) |
| `/` with `NEXT_LOCALE=en` cookie | 307 → `/en` | 307 → `/en` (unchanged) |
| `/en` | 200 English | 200 English |
| Language switcher | works | works (next-intl sets the cookie client-side) |

Design note: `localeDetection: false` in `src/i18n/routing.ts` was rejected — it disables the
NEXT_LOCALE cookie too. Stripping `accept-language` in `src/middleware.ts` keeps cookie
persistence while removing browser-language detection.

## SEO-07 — Google Search Console checklist (manual, after PR 1 deploys)

1. Open https://search.google.com/search-console — confirm the `gustavoai.dev` property exists
   (the notification email implies it does). If access is lost, re-verify via DNS TXT (domain property).
2. Page indexing report → confirm the failures are "Page with redirect" (validates diagnosis).
3. URL Inspection → "Test live URL" → "Request indexing" for `/`, `/en`, `/privacidad`,
   `/en/privacidad`, `/terminos`, `/en/terminos`.
4. Sitemaps → (re)submit `https://gustavoai.dev/sitemap.xml`.
5. "Validate fix" on the redirect issue; recheck in 1–2 weeks. **Reindexing takes days to weeks —
   this is normal.**
6. After PR 3 deploys: run https://search.google.com/test/rich-results on `/`.
7. Confirm Vercel prod env has `NEXT_PUBLIC_BASE_URL=https://gustavoai.dev` and that
   `https://www.gustavoai.dev/` 308-redirects to non-www (Vercel domain settings).

## Contingencies

- If GSC ever reports "Indexed, though blocked by robots.txt" for a transactional URL, remove that
  path from `src/app/robots.ts` disallow so Google can crawl the page and see its `noindex`
  (SEO-02 adds the meta as defense-in-depth; robots.txt blocks crawling, not indexing).
- `offers`/pricing in JSON-LD deliberately omitted (prices live in the DB, staleness risk).
  If wanted later, feed from `getDisplayPrices()` (already loaded in the root layout).

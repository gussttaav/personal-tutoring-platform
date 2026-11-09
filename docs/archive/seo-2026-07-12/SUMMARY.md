# SEO summary: technical + on-page fixes

**Date range:** 2026-07-09 (plan, SEO-00/01) → 2026-07-12 (last code change) · archived 2026-11-09
**Tasks completed:** 8 / 8 (SEO-00 … SEO-07)
**Tag convention:** `SEO-NN` (in code comments, e.g. `src/app/sitemap.ts`, `src/lib/hreflang.ts`)
**Archive note:** the task table in [PLAN.md](PLAN.md) still showed SEO-02 … SEO-05 and SEO-07 as
pending, months after they shipped. It was reconciled at archive time: the code tasks from git
history (all on `main`), SEO-07 from Gustavo's confirmation on 2026-11-09 (the date he did it was
not recorded).

---

## Tasks completed

| Task | What | Commit |
|------|------|--------|
| SEO-00 | The tracking doc | — |
| SEO-01 | Stop the `Accept-Language` redirect that sent cookieless Googlebot from `/` to `/en` (the indexing fix) | `7c71583` |
| SEO-02 | `noindex, nofollow` on transactional, auth and admin pages | `127e228` |
| SEO-03 | OpenGraph + Twitter cards, `public/og.png` | `c358138`; image fixes `f15007a`, `f635a6a`; locale-specific image `d448833` |
| SEO-04 | JSON-LD structured data on the home | `c358138` |
| SEO-05 | Sitemap `x-default` + www/non-www consistency | `92e7c63`, `0d5df05` (`x-default` → English) |
| SEO-06 | Verify home and legal pages stay prerendered (verification only) | — |
| SEO-07 | Google Search Console: validate the diagnosis, request reindexing, resubmit the sitemap (manual) | Gustavo |

## Key wins

- **`/` answers 200 to Google again.** The root cause of the "Page with redirect" indexing failures
  was locale detection by `Accept-Language`; detection is now pathname → `NEXT_LOCALE` cookie →
  Spanish (the rule `CLAUDE.md` keeps as SEO-01: the home must stay static and cookieless-crawlable).
- **Share cards and structured data** on every public page, and a sitemap with consistent hreflang
  alternates (`x-default` → English).
- **Transactional pages are out of the index** by meta tag as well as robots.txt.

## Later work that built on this

- The redesign cycle (`../redesign-2026-09-19/`, REDESIGN-P2-04) made `/mentoria` indexable and added
  it to the GSC step.
- The course and blog structured data (`CourseStructuredData`, `LessonStructuredData`,
  `ArticleStructuredData`) followed the SEO-04 pattern.

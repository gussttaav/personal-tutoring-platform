# P6-01 — SEO: JSON-LD, sitemap, locale-correct hreflang

**Tag:** `COURSE-P6-01` · **Effort:** M · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

Make lessons indexable: `Course` + `LearningResource` JSON-LD, registry-driven sitemap entries,
and — the part with a real bug in it today — **hreflang that doesn't advertise English pages
that don't exist.**

## Context

- `src/app/sitemap.ts` hardcodes `["", "/privacidad", "/terminos"]` and emits both locale
  variants for every route. Courses must come from the registry.
- **`src/lib/hreflang.ts:localizedAlternates` always emits `es`, `en` and `x-default`.** That is
  correct for the existing pages, which exist in both languages. It is **wrong for courses**,
  which will be Spanish-only for months: it would advertise `/en/cursos/dl-nlp/...` URLs that
  404. Google reports these as errors and it degrades indexing of the Spanish pages that do exist.
- `src/app/robots.ts` uses `allow: "/"` with an explicit disallow list (api, admin, auth,
  área personal, pago-exitoso, sesión, cancelar, + their `/en` variants). `/cursos` is not on that
  list, so **it is already crawlable — no change needed.** Just confirm it stays that way.
- `src/components/seo/StructuredData.tsx` is the existing JSON-LD pattern (Person + Service).
- SEO-05 set `x-default` to the English URL. For a Spanish-only course, `x-default` must point at
  the **Spanish** URL — it is the only one that exists.

## Files affected

| File | Change |
|------|--------|
| `src/lib/hreflang.ts` | + `availableLocaleAlternates(route, locale, availableLocales)` |
| `src/app/sitemap.ts` | Registry-driven course + lesson entries, published + locale-aware |
| `src/components/seo/CourseStructuredData.tsx` (new) | `Course` JSON-LD |
| `src/components/seo/LessonStructuredData.tsx` (new) | `LearningResource` JSON-LD |
| `src/app/[locale]/cursos/[courseSlug]/page.tsx` | Mount course JSON-LD; use the new alternates helper |
| `src/app/[locale]/cursos/[courseSlug]/[lessonSlug]/page.tsx` | Mount lesson JSON-LD; same helper |
| `src/app/robots.ts` | No change expected — verify `/cursos` stays off the disallow list |

## The change

**Locale-aware alternates.** Add alongside the existing function; **do not modify
`localizedAlternates`** — the existing pages depend on its current behaviour.

```ts
// COURSE-P6-01: alternates for content that may not exist in every locale.
// Unlike localizedAlternates (which assumes both variants exist), this emits
// only the locales actually present, and points x-default at the sole
// available locale when there is only one.
export function availableLocaleAlternates(
  route: string, locale: string, available: readonly string[]
) { … }
```

With Spanish-only content this emits `{ es, x-default: es }` and **no `en` key**. When English
lands, the registry reports both and the helper starts emitting `en` with no code change.

**Sitemap.** Replace the hardcoded array for course routes with registry output: `/cursos`, each
published course landing, each published lesson — each emitted only for locales where the content
exists. Drafts and gated content must be absent. Keep the existing three static routes untouched.

**JSON-LD.**

- Course landing → `Course`: name, description, provider (reuse the existing `Person`/
  organisation identity), `inLanguage`, `educationalLevel`,
  `coursePrerequisites`, `isAccessibleForFree: true`, and `hasCourseInstance`.
- Lesson → `LearningResource`: name, description, `isPartOf` the course, `timeRequired`,
  `learningResourceType`, `inLanguage`.

Use the registry as the single source for all of it — never hand-maintain a parallel copy.

**Metadata per lesson.** Title, description from the lesson `summary`, canonical, OpenGraph.
A per-course OG image would be better than the generic one; if that's not ready, use the existing
`og.png` and note it. (Memory: `og.png` is currently a placeholder — worth fixing before a launch
that drives traffic.)

## Acceptance criteria

- [ ] `availableLocaleAlternates` emits **no `en` key** when English content is absent
- [ ] `x-default` points at Spanish for Spanish-only content
- [ ] `localizedAlternates` is unchanged and existing pages' hreflang is byte-identical to before
- [ ] Sitemap includes `/cursos`, the course landing and every published lesson — Spanish only, for now
- [ ] Draft and gated lessons absent from the sitemap
- [ ] `Course` and `LearningResource` JSON-LD both validate in Google's Rich Results Test
- [ ] Every lesson has a unique title and description (duplicates are an indexing problem)
- [ ] `robots.ts` still allows `/cursos` (verified, not assumed)
- [ ] No `/en/cursos/*` URL is advertised anywhere while it 404s
- [ ] `pnpm build` green

## Test plan

- **Unit** (`src/lib/__tests__/hreflang.test.ts`): `["es"]` → no `en`, `x-default` = es;
  `["es","en"]` → both + `x-default` per the existing SEO-05 convention; empty → route absent.
- **Unit** (sitemap): registry fixture with a draft and a published lesson → only the published
  one appears; correct locale variants.
- **Manual:** build, inspect `/sitemap.xml`, spot-check hreflang tags in built lesson HTML,
  validate JSON-LD.
- **Post-deploy:** submit the sitemap in Google Search Console and check for "alternate page"
  errors after crawling. (Per `docs/seo/PLAN.md`, GSC steps are still pending from the SEO cycle —
  fold these in there.)

## Notes / gotchas

- **Do not change `localizedAlternates`.** It is correct for pages that exist in both languages.
  Add the new helper; leave the old one alone.
- When English content eventually lands, this must be re-verified — the helper should switch
  automatically, but confirm rather than assume.
- Lesson descriptions come from `summary`, which was written for the sidebar. Check they read as
  meta descriptions (~150–160 chars) and are unique. Adjust the content if not.
- A 40-lesson sitemap addition is a large jump for a small site; expect gradual crawling.
- Don't add `Quiz` or `ExerciseAction` JSON-LD. Marginal value, extra surface to keep correct.

## Out of scope

- Per-course OG image design (worth doing; not blocking).
- GSC submission itself (operational, tracked in `docs/seo/PLAN.md`).
- English content or its hreflang (the helper handles it when it exists).

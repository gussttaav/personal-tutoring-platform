# P6-03 — Launch: bilingual catalog + Navbar/Footer link swap

**Tag:** `COURSE-P6-03` · **Effort:** M · **Owner:** _tbd_ · **Status:** ✅

## TL;DR

Flip the switch: courses become publicly reachable. Navbar and Footer "Cursos" point at
`/cursos` instead of opening the ComingSoonModal, and `/en/cursos` stops being an empty state —
the course gets a real English catalog card and a real English landing page, honest about the
lessons being Spanish-only.

**The `NEXT_PUBLIC_COURSES_ENABLED` gate this task originally specified was dropped.** See
Deviations below.

## Context

- `src/components/Navbar.tsx:33` — `{ label: t("courses"), href: "#", comingSoon: "courses" }`
- `src/components/Footer.tsx:125` — same pattern for both Cursos and Blog
- `src/components/ComingSoonModal.tsx` — took `type: "courses" | "blog"`. **Blog must keep
  working**; only the courses branch is retired.
- Before this task, `listCourses(locale)` was published-only *per locale*. English has a
  manifest but no `en/` lesson tree, so the English catalog rendered "Coming soon" while a
  finished course sat one directory away, and `/en/cursos/dl-nlp` 404'd.
- `src/app/[locale]/cursos/page.tsx:35` still used `localizedAlternates` (always both locales)
  while `sitemap.ts` omitted `/en/cursos` entirely — the page and the sitemap disagreed about
  whether that URL existed. Fixed here off a single source.

## The change

### One resolution rule

`src/lib/courses/catalog-view.ts` (new): **manifest from the requested locale, lessons from
whichever locale has them** — requested first, canonical as fallback — with the locale that
resolved carried along as `contentLocale`. Same pattern `registryCourseMeta` already uses in
`enrollment-view.ts`, and for the same reason.

Kept out of `registry.ts` on purpose: it imports `@/i18n/routing`, and the registry is loaded by
`scripts/lint-content.ts` under `tsx`, where pulling in next-intl would be a new dependency for
no gain.

**Lessons are not resolved this way.** A lesson URL exists in exactly the locales its MDX exists
in. The catalog and the landing are bilingual; the reader is not. That split is what keeps the
hreflang honest.

### English content

`content/courses/dl-nlp/course.en.yml` — the sibling manifest `course.es.yml`'s header always
anticipated. Prose only; `slug`, block `id`s and `estimatedHours` are locale-invariant and match.
The landing chrome (hero, prerequisites, syllabus headings, FAQ, instructor) was already
translated in `messages/en.json` — only the manifest was missing.

### The English reader's path

`contentLocale` is threaded into every component that builds a lesson href (`CourseHero`,
`CourseCta`, `CourseProgressResume`) and passed to next-intl's `<Link locale=…>`. That emits
`/es/cursos/...` **with** the prefix even though `as-needed` makes the Spanish URL unprefixed —
and the prefix is load-bearing. Locale detection is pathname → `NEXT_LOCALE` cookie → default
(`src/middleware.ts`), so an unprefixed `/cursos/...` clicked by a reader whose cookie says `en`
would be redirected to `/en/cursos/...` and 404. The prefixed URL flips the cookie to `es` and
redirects to the canonical unprefixed one — which is also right, because following that link
means the reader is now reading the Spanish site.

`CourseCard` and `ContentLanguageNotice` say so before the click, so the language switch is not
a surprise.

## Files affected

| File | Change |
|------|--------|
| `src/lib/courses/catalog-view.ts` (new) | `listCatalogEntries`, `getCatalogEntry`, `catalogLocales`, `courseLocales` |
| `content/courses/dl-nlp/course.en.yml` (new) | English manifest |
| `src/app/[locale]/cursos/page.tsx` | Catalog off `listCatalogEntries`; `availableLocaleAlternates`; notify card |
| `src/app/[locale]/cursos/[courseSlug]/page.tsx` | Landing off `getCatalogEntry`; threads `contentLocale`; renders the language notice |
| `src/features/courses/catalog/CourseCard.tsx` | Content-language badge |
| `src/features/courses/landing/{CourseHero,CourseCta,CourseProgressResume}.tsx` | `contentLocale` → `<Link locale=…>` |
| `src/features/courses/landing/ContentLanguageNotice.tsx` (new) | "The lessons are in Spanish" + the opt-in |
| `src/app/sitemap.ts` | Catalog + landing loops off `listCatalogEntries`; lesson loop unchanged |
| `src/components/Navbar.tsx` | Cursos → `/cursos`; one active-item rule; Mentoría via `useSessionsAnchor`; every branch closes the mobile panel |
| `src/components/Footer.tsx` | Cursos → `<Link href="/cursos">`; Mentoría via `useSessionsAnchor` |
| `src/hooks/useSessionsAnchor.ts` (new) | Shared "go to the sessions section" click, no URL fragment |
| `src/lib/courses/catalog-view.ts` | + `listLessonViews` / `getLessonView` / `lessonViewNeighbours` — per-lesson resolution |
| `src/app/[locale]/cursos/[courseSlug]/[lessonSlug]/page.tsx` | Spine-based params, fallback prose, `noindex` + canonical when untranslated |
| `src/features/courses/reader/TranslationPendingNotice.tsx` (new) | "This lesson is not translated yet" |
| `src/features/booking/InteractiveShell.tsx` | Consumes the scroll intent on arrival |
| `src/components/ComingSoonModal.tsx` | `type` narrowed to `"blog"`; courses branch removed |
| `messages/es.json` + `messages/en.json` | − `comingSoon.courses.*`; + `courses.landing.languageNotice.*`, `courses.catalog.card.contentLanguage` |

### The nav had to learn there is more than one page

Two defects surfaced the moment `/cursos` became a real destination, both from the same root:
`NAV_LINKS` was written for a site where every item was either a modal or an anchor on the one
page that existed.

1. **Mentoría stayed highlighted on the courses page.** Its green `accent` was a call to action,
   not a location, but with nothing else ever marked the two were indistinguishable — so on
   `/cursos` it read as "you are here", pointing at the wrong item.

   The first fix kept both ideas and marked the current page in white instead. That was wrong
   for a subtler reason: **two visual languages meant the two items could never render alike.**
   Clicking Cursos gave white + underline, clicking Mentoría gave green + none, for what a
   reader experiences as the same act. There is now ONE rule — the current item is green with a
   green underline, `aria-current="page"`, and nothing else is emphasised. Mentoría's `match` is
   `/`, because the landing page IS the mentoring offering; `#sessions` is a section of it. The
   landing page therefore looks as it always did; the difference is Mentoría stops claiming to
   be current anywhere else.

2. **Mentoría did nothing at all off the landing page.** `#sessions` and the
   `close-booking-overlay` listener both live in `InteractiveShell`, which is landing-only, so
   the handler's `preventDefault()` + dispatch was a silent no-op anywhere else — in the navbar
   *and* in the footer, which renders on `/cursos` too.

   Making it a real `/#sessions` link fixed the dead click but left the URL inconsistent: the
   fragment appeared when arriving from another page and not when clicking at home. Two repair
   attempts failed and are worth recording so they are not retried:
   - `history.replaceState` to strip it **corrupts the App Router's history bookkeeping.**
     Navbar Mentoría → Back → footer Mentoría reproducibly produced `/#sessions#sessions`.
   - The router's own `replace` **will not drop a fragment** on the route it is already on.

   So the fragment is never created. `src/hooks/useSessionsAnchor.ts` holds one handler shared
   by Navbar and Footer: at home it dispatches the existing event; elsewhere it records a
   read-once `sessionStorage` intent and pushes `/`, which `InteractiveShell` consumes on
   arrival. The `href` stays `/#sessions` so the link still works with JS disabled or on a
   middle-click. **Consuming the intent inside the timer, not in the effect body, is
   load-bearing under StrictMode** — consuming first meant mount #1 took the read-once value
   and its cleanup cancelled the scroll it was taken for.

### The language switcher was a guaranteed 404 (COURSE-P6-03b)

Making the catalog and landing bilingual while lessons stayed Spanish-only left one hole, and
it was bigger than it looked. Locale detection is **pathname → `NEXT_LOCALE` cookie → default**
(`src/middleware.ts`), so an unprefixed `/cursos/...` requested by anyone holding an `en` cookie
is redirected to `/en/cursos/...`. With no English lesson pages that was a 404 — reachable by:

- clicking **EN** on any of the 43 lesson pages, and
- **arriving from Google.** The sitemap lists the unprefixed Spanish lesson URLs; any reader who
  had previously browsed the site in English carried an `en` cookie into that click. (Googlebot
  crawls cookieless, so indexing itself was unaffected — only real readers hit it.)

**Every locale with a manifest now gets a page for every lesson.** Untranslated ones serve the
canonical prose behind `TranslationPendingNotice`, which also tells the reader their progress
still counts — it does, because lesson slugs are locale-invariant and the progress denominator
is pinned to the canonical locale (`catalog.ts`).

Such a page is deliberately **not indexable as that locale**: `noindex, follow`, no hreflang
alternate, no JSON-LD, and absent from the sitemap.

**No `rel=canonical`, and that is deliberate** — it was there at first and had to come out.
`noindex` and `canonical` are contradictory signals: canonical asserts "these two URLs are the
same page, index that one", so Google may consolidate the pair and carry the `noindex` over to
the canonical target. That target is the Spanish lesson — the pages the entire SEO case rests
on. `noindex` alone is unambiguous and already does the whole job. Google is only ever told about a lesson URL that genuinely serves the language it
claims. When a translation lands, that page becomes a first-class English page and every one of
those suppressions lifts on its own.

**Resolution is per lesson, not per course.** Course-level resolution had a cliff: the first
published English lesson flipped the whole English surface onto the English tree, collapsing a
43-lesson syllabus to 1 and leaving the reader at a `next` of `null`. The canonical list is now
the SPINE — it fixes order and membership, and each lesson independently uses the requested
locale's version when one exists. That is what makes **lesson-by-lesson translation** safe:
there is no broken intermediate state, so English content can ship a lesson at a time instead of
in one 43-lesson flip.

**Cost:** the build generates 157 pages instead of 114 (~2min → ~4min). Deliberate — the
alternative is on-demand rendering of the fallback pages, which would need the registry to read
`content/` at RUNTIME. It is a build-time-only module by design (`registry.ts` header), and
Next's file tracing would not reliably bundle the content tree for a serverless render.

## Acceptance criteria

- [x] Navbar and Footer link to `/cursos` in both desktop and mobile menus
- [x] Exactly one nav item is marked, always the current one, and both render identically
- [x] Mentoría reaches the sessions section from a courses page, from navbar and footer
- [x] The URL never gains a `#sessions` fragment, from any entry point
- [x] The language switcher on a lesson does not 404, in either direction
- [x] An `en`-cookie reader can open any Spanish lesson URL from search
- [x] An untranslated lesson page is `noindex, follow` with NO canonical, no hreflang, no JSON-LD
- [x] Reader prev/next walks the full spine, so no lesson is a dead end mid-translation
- [x] **Blog still opens the ComingSoonModal in both places**
- [x] `/en/cursos` shows the English card with a "Lessons in Spanish" badge
- [x] `/en/cursos/dl-nlp` renders in English; the syllabus lists the Spanish lesson titles
- [x] The English "Start the course" lands on the Spanish lesson, not a 404
- [x] Catalog + landing appear in the sitemap for both locales, hreflang-paired
- [x] **No `en` lesson URL and no `en` lesson alternate**
- [x] `pnpm lint` + `pnpm test` + `pnpm build` green

## Test plan

- **Unit:** `catalog-view.test.ts` — fully translated resolves to itself; manifest-only English
  pairs with Spanish lessons and reports `contentLocale: "es"`; drafts excluded from the
  fallback count; no English manifest → absent from the English catalog; no published lessons in
  any locale → excluded entirely.
- **Unit:** `sitemap.test.ts` — `/en/cursos` and `/en/cursos/dl-nlp` present and paired; still no
  English lesson URL or alternate.
- **E2E** (`e2e/courses-navigation.spec.ts`): es and en chrome → catalog → landing → reader,
  including the cross-locale hop; `aria-current` moves to Cursos and off Mentoría; Mentoría
  reaches `#sessions` from `/cursos` via navbar and footer; the mobile panel marks the current
  page and closes behind a plain navigation; blog still opens the modal from both places.
- **Manual:** mobile menu, both locales.

## Deviations

**The `NEXT_PUBLIC_COURSES_ENABLED` gate was not built.** The original task specified a
build-time env gate plugged into the registry's publication predicate, so preview deploys could
run with courses enabled while production stayed dark. That existed to keep `main` mergeable
through the months of Phase 5 content work — which is now finished. And because `NEXT_PUBLIC_*`
is inlined at build time, turning the gate off would require a redeploy, which is exactly what
reverting the link swap costs. It bought a kill-switch no cheaper than `git revert`, at the
price of a permanent branch in the one predicate every publication decision flows through.
`registry.ts:52` is unchanged and its comment reserving the spot has been left alone; if
per-environment visibility is ever wanted, that is still where it goes.

**The courses branch of `ComingSoonModal` was removed, not kept.** The original task deferred
this as later cleanup, on the reasoning that keeping it allowed turning the gate back off. With
no gate, there is nothing to turn back to, and a dead branch behind a `"courses" | "blog"` union
is worse than a narrowed type. `comingSoon.courses.*` was dropped from both message files.

**Scope grew to include the English surface.** The original task's only note about English was
"confirm the empty state reads sensibly there". It does not: an English visitor clicking Courses
and getting "Coming soon" while a 43-lesson course exists is a worse first impression than the
modal was. Fixing it properly meant `course.en.yml` and the locale-resolution rule above.

## Out of scope

- Translating lesson content (`content/courses/dl-nlp/en/`).
- The blog (still coming soon).
- Per-course gating — visibility is `draft` at the lesson level plus registry presence.

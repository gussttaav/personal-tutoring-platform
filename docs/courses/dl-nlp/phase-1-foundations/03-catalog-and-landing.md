# P1-03 — Catalog + course landing page

**Tag:** `COURSE-P1-03` · **Effort:** M · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

Build `/cursos` (catalog) and `/cursos/[courseSlug]` (course landing). The landing page is the
**conversion surface** — it decides whether someone starts the course — and later the main SEO
entry point. Both are statically generated from the registry.

## Context

- `/cursos` currently does not exist. Navbar (`src/components/Navbar.tsx:33`) and Footer
  (`src/components/Footer.tsx:125`) link to `#` and open `ComingSoonModal`. **Leave that alone
  in this task** — the swap happens in P6-03, so the catalog can be built and reviewed on a
  preview deploy without going public.
- Existing landing sections in `src/features/landing/` are the visual reference. Reuse the
  design tokens in `src/constants/`; do not invent a new visual language for courses.
- Route naming follows the existing Spanish-path convention (`/privacidad`, `/area-personal`).
  With `localePrefix: 'as-needed'` and no `pathnames` config, English is `/en/cursos/...` —
  same path, prefixed. Keep it that way.

## Files affected

| File | Change |
|------|--------|
| `src/app/[locale]/cursos/page.tsx` (new) | Catalog; `generateStaticParams` over locales |
| `src/app/[locale]/cursos/[courseSlug]/page.tsx` (new) | Course landing; `generateStaticParams` from the registry |
| `src/features/courses/catalog/CourseCard.tsx` (new) | Catalog card |
| `src/features/courses/landing/*.tsx` (new) | `CourseHero`, `Prerequisites`, `SyllabusAccordion`, `CourseFaq`, `CourseCta` |
| `messages/es.json` + `messages/en.json` | + `courses.catalog.*`, `courses.landing.*` (chrome only — **both files, key-for-key**) |

## The change

**Catalog** — with one course this is nearly trivial, and that is fine; it exists so course #2
costs nothing. Card shows title, tagline, level, hours, lesson count, block count.
Empty state matters: if the gate hides everything, render an honest "próximamente", not a blank page.

**Course landing**, in order:

1. **Hero** — title, tagline, and above all *what you will have built by the end*. For this
   course: a working Transformer implemented from scratch in NumPy.
2. **Prerequisites — explicit and prominent.** A course with real mathematical rigour must say
   "necesitas Python, álgebra lineal y derivadas parciales" up front. Hiding this produces
   frustrated students and bad word of mouth. Non-negotiable, not a nice-to-have.
3. **Syllabus accordion** — one panel per block, lesson titles + minutes inside, block totals.
   Server-rendered content inside a client-side disclosure, so the full syllabus is in the HTML
   for crawlers even when collapsed.
4. **Free sample lesson** — one prominent link to a fully-interactive lesson. This is the single
   biggest conversion lever; give it real visual weight, not a text link.
5. **Instructor** — short credibility block reusing the existing biography assets.
6. **FAQ** — cost, prerequisites, time commitment, is it in English (answer honestly: Spanish
   now, English planned), what you need installed (nothing — it runs in the browser).
7. **CTA** — "Empezar el curso" → first lesson. Sign-in is *not* required to read (P4-02).

## Acceptance criteria

- [ ] Both routes statically generated; `generateStaticParams` sourced from the registry
- [ ] Draft/gated lessons appear in neither the catalog counts nor the syllabus
- [ ] Prerequisites visible without scrolling on desktop, and within the first screenful on mobile
- [ ] Syllabus content present in server-rendered HTML while collapsed (verify with JS disabled)
- [ ] All UI strings via `t()`; keys added to **both** message files
- [ ] Responsive at 360 / 768 / 1440
- [ ] `generateMetadata` present on both routes (hreflang handling lands in P6-01 — use `localizedAlternates` for now and let P6-01 correct the es-only case)
- [ ] Navbar/Footer still show the ComingSoonModal — unchanged by this task
- [ ] `pnpm lint` + `pnpm build` green

## Test plan

- **Unit:** `SyllabusAccordion` groups and orders lessons correctly from a registry fixture,
  including a block whose lessons are all drafts (block should not render as empty-but-present).
- **Manual:** three viewports; JS disabled to confirm syllabus is in the HTML; catalog empty state.
- **E2E:** defer to P6 — these routes aren't publicly linked yet.

## Notes / gotchas

- The `en` variant of these routes will render with **zero courses** for months. Make sure it
  renders a sane empty state rather than throwing, and that P6-01 keeps it out of the sitemap.
- Don't build a "course progress" UI here — no persistence until P4. Design the hero so a
  progress bar can slot in later without a redesign.
- Keep the FAQ in the manifest or a message file, not hardcoded in JSX — you will edit it often.
- Resist adding a pricing section. The course is free; a "€0" badge invites the wrong question.

## Out of scope

- Lesson reader (P1-04).
- Progress indicators (P4).
- JSON-LD, sitemap entries, hreflang correction (P6-01).
- Navbar/Footer link swap (P6-03).

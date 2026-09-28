# Phase 6 — Launch

Make the course publicly visible: SEO surfaces, the link swap that replaces the ComingSoonModal
with real navigation, and the notification opt-in that replaces what the modal was collecting.

## Tasks

1. [01-seo.md](01-seo.md) — `COURSE-P6-01` (M) — JSON-LD, sitemap, hreflang
2. [02-course-notifications.md](02-course-notifications.md) — `COURSE-P6-02` (M) — "notify me" opt-in + admin announce route
3. [03-publication-gate.md](03-publication-gate.md) — `COURSE-P6-03` (M) — bilingual catalog + Navbar/Footer link swap

**Landing order:** P6-01 → P6-03 + P6-02. SEO first, so crawlers find a complete site. P6-02 and
P6-03 landed together on one branch: the opt-in lives on the pages P6-03 makes reachable, and
retiring the courses modal is what makes an opt-in necessary in the first place.

**The original plan had P6-02 last, as an irreversible waitlist email.** It isn't one any more.
`subscriptions` was empty in production — nobody ever signed up through the modal — so there was
no waitlist to announce to. P6-02 was rewritten as the opt-in plus a send mechanism that ships
**dry**: nothing is emailed at launch. The "never announce a URL before it's live" rule still
governs whenever that first send does happen.

## Exit criteria

- [x] Sitemap lists every published lesson
- [x] **No `en` hreflang alternate is emitted for a lesson while English lesson content does not exist**
- [ ] `Course` + `LearningResource` JSON-LD validates in Google's Rich Results Test
- [x] Navbar and Footer link to `/cursos`; the courses ComingSoonModal is gone (blog untouched)
- [x] `/en/cursos` shows a real English card, and `/en/cursos/dl-nlp` a real English landing page
- [x] A course-notification opt-in exists, with an unsubscribe path and a working send behind it
- [x] `pnpm test` + `pnpm build` green

## The SEO stake

Rigorous Spanish-language explainers on *el problema del gradiente desvanecido* or *codificación
posicional* are strong long-tail search targets with little good competition. This is plausibly
the largest organic-traffic opportunity the site will ever have — and each lesson page is static,
so the traffic costs nothing to serve. P6-01 is worth doing carefully.

The English landing page is a smaller but real second bet: it is genuine English content about a
course that exists, so it can rank for English queries and hand those readers a Spanish course
they were told about up front — rather than the "Coming soon" they would otherwise have hit.

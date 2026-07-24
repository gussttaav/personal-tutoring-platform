# Phase 6 — Launch

Make the course publicly visible: SEO surfaces, the waitlist email, and the gate flip that
replaces the ComingSoonModal with real links.

Small phase, but **irreversible in a way the others aren't** — P6-02 sends email to real people
and P6-03 makes the URLs public. Both go last, and both after the content is genuinely finished.

## Tasks

1. [01-seo.md](01-seo.md) — `COURSE-P6-01` (M) — JSON-LD, sitemap, hreflang
2. [02-waitlist-email.md](02-waitlist-email.md) — `COURSE-P6-02` (M) — announce to the `courses` subscribers
3. [03-publication-gate.md](03-publication-gate.md) — `COURSE-P6-03` (S) — flip the gate, swap the links

**Landing order:** P6-01 → P6-03 → P6-02. SEO first (so crawlers find a complete site), gate
second, **email last** — never announce a URL before it's live.

## Exit criteria

- [ ] Sitemap lists every published lesson
- [ ] **No `en` hreflang alternate is emitted while English content does not exist**
- [ ] `Course` + `LearningResource` JSON-LD validates in Google's Rich Results Test
- [ ] Waitlist email sent to `subscriptions WHERE type = 'courses'`, localised per `users.locale`
- [ ] Navbar and Footer link to `/cursos`; the courses ComingSoonModal is unreachable (blog untouched)
- [ ] `pnpm test` + `pnpm build` green

## The SEO stake

Rigorous Spanish-language explainers on *el problema del gradiente desvanecido* or *codificación
posicional* are strong long-tail search targets with little good competition. This is plausibly
the largest organic-traffic opportunity the site will ever have — and each lesson page is static,
so the traffic costs nothing to serve. P6-01 is worth doing carefully.

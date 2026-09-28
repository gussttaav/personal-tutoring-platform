# Phase 2 — Mentoría

`/mentoria` stops being a copy of the old landing and becomes the tutoring page from
`design/mentoria.html`: the inner-page header, «Cómo funciona», the bento it already has, the
testimonials, the sessions and packs it already has, the app section. Then it becomes
indexable and takes over the `Service` structured data.

New code lives in `src/features/mentoria/`. The booking shell, `SpecializationsSection`,
`SessionCard`, `PackCard` and every overlay are untouched; the page around them changes.

## Tasks

1. [01-header-and-how-it-works.md](01-header-and-how-it-works.md) — `REDESIGN-P2-01` (M) — the
   editorial header with CTAs, the four steps; `HeroSection` and `BiographySection` deleted with
   their dead keys
2. [02-testimonials.md](02-testimonials.md) — `REDESIGN-P2-02` (S) — three quotes, initials,
   Classgap link, original language
3. [03-app-section.md](03-app-section.md) — `REDESIGN-P2-03` (S) — `AppShowcase` after the packs
4. [04-mentoria-metadata.md](04-mentoria-metadata.md) — `REDESIGN-P2-04` (S) — `meta.mentoria`,
   `noindex` off, sitemap, `Service` JSON-LD

**Landing order:** 01 → 02 → 03 → 04. 01 needs P1-01 and P1-02 merged (they take `StatCard`
and the bio out of the components 01 deletes); 03 needs P1-04 (the component).

## Exit criteria

- [ ] `/mentoria` at 390 / 834 / 1440 matches `design/mentoria.html` section for section:
      header, cómo funciona, áreas, valoraciones, sesiones, packs, app, footer
- [ ] `src/features/landing/HeroSection.tsx` and `BiographySection.tsx` no longer exist; no
      `landing.hero.*` or `landing.bio.*` key is unused
- [ ] Booking a session, buying a pack, scheduling a pack class, rescheduling from an email link
      and opening the availability window all work on `/mentoria` as they did on `/`
- [ ] `/mentoria` is indexable, in `sitemap.xml` for both locales with hreflang pairs, and
      carries the `Service` JSON-LD; `/` carries the `Person`
- [ ] `pnpm lint` + `pnpm test` + `pnpm build` green; the booking e2e specs pass on staging

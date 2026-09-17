# Phase 1 — Home

`/` becomes the new home, from the top down. Each task replaces or adds one band of the page
and leaves the rest as it was, so the staging home is always a whole page: after 01 it is the
new hero over the old landing; after 04 it is the new home and nothing else. The booking shell
leaves `/` in the last composition task, once every CTA above it already points at `/mentoria`.

All new code lives in `src/features/home/` (page sections) and `src/components/` (the two
pieces Mentoría reuses: the app showcase and the closing band). Copy goes to a new `home.*`
namespace in both message files; existing keys are reused where the design reuses the text
(see `design/NOTES.md`, «Copy that is new»).

## Tasks

1. [01-hero.md](01-hero.md) — `REDESIGN-P1-01` (M) — two-column hero + the four stats;
   `StatCard` extracted; `?book=availability` added to the shell
2. [02-bio-and-areas.md](02-bio-and-areas.md) — `REDESIGN-P1-02` (S) — short bio + the compact
   six-area grid
3. [03-courses-and-posts.md](03-courses-and-posts.md) — `REDESIGN-P1-03` (M) — the two course
   cards and the two latest posts, from the registries, reusing the catalog and blog cards
4. [04-app-closing-and-static.md](04-app-closing-and-static.md) — `REDESIGN-P1-04` (M) — the
   app showcase, the closing band, the chat FAB without the shell; `/` becomes static
5. [05-home-metadata.md](05-home-metadata.md) — `REDESIGN-P1-05` (S) — title, description,
   JSON-LD split, OG check

**Landing order:** 01 → 02 → 03 → 04 → 05. Phase 2 may start after 02.

## Exit criteria

- [ ] `/` at 390 / 834 / 1440 matches `design/home.html` section for section: hero + stats,
      bio + areas, courses, posts, app, closing band, footer
- [ ] `src/app/[locale]/page.tsx` imports nothing from `features/booking/` or
      `features/landing/`; `pnpm build` prints `/[locale]` as ○ (static)
- [ ] «Reservar sesión ahora» → `/mentoria?book=smart`; «Ver disponibilidad» →
      `/mentoria?book=availability`; both open the right surface there
- [ ] Footer «Pregunta al asistente IA» and the closing band's link open the chat on `/`
- [ ] Every `home.*` key exists in both message files; the diff of the two key trees is empty
- [ ] `pnpm lint` + `pnpm test` + `pnpm build` green

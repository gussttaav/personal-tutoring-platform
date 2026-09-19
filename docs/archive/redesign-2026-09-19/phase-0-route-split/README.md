# Phase 0 — Route split

The tutoring landing becomes a page of its own before the home is touched. Two tasks, both
mechanical, both shippable on their own: after 01 the site has a second page nobody links to;
after 02 everything that meant «go to the booking» goes there.

Nothing visual changes on `/` in this phase. `/mentoria` is `noindex` until Phase 2 finishes,
so no two indexable pages are ever identical.

## Tasks

1. [01-mentoria-route-and-menu.md](01-mentoria-route-and-menu.md) — `REDESIGN-P0-01` (M) — the
   `/mentoria` route, «Inicio» in the menu, «Mentoría» as a page link, the scroll-intent hook
   deleted
2. [02-deep-links.md](02-deep-links.md) — `REDESIGN-P0-02` (M) — every `?book=`, `?reschedule=`,
   `?intent=` and `?action=` link, the reschedule links in the emails, the OAuth callbacks and
   the e2e specs retargeted to `/mentoria`; the rule written into `CLAUDE.md`

**Landing order:** 01 → 02.

## Exit criteria

- [ ] `/mentoria` and `/en/mentoria` render exactly what `/` renders today (hero, bio, areas,
      sessions, packs, overlays, chat), with `robots: noindex`, absent from `sitemap.ts`
- [ ] The navbar (desktop + mobile panel) and the footer read Inicio · Cursos · Mentoría · Blog /
      Cursos · Blog · Mentoría; the current-page rule marks Inicio on `/` and Mentoría on
      `/mentoria`; `src/hooks/useSessionsAnchor.ts` is deleted
- [ ] `grep -rn '"/#sessions\|/?book=\|/?reschedule=\|/?intent=\|/?action=' src e2e` returns
      only `/mentoria…` forms
- [ ] `booking-free`, `booking-single`, `booking-pack`, `reschedule` and `chat` specs drive
      `/mentoria`; the three `courses-navigation` tests about Mentoría assert the page, not the
      scroll
- [ ] `CLAUDE.md` states that the booking shell lives on `/mentoria` and that intents are carried
      by `?book=` / `?reschedule=` on that path
- [ ] `pnpm lint` + `pnpm test` + `pnpm build` green

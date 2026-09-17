# Home + Mentoría redesign — Master Plan

**Feature:** a real home page for gustavoai.dev, and the tutoring landing moved to its own page
**Planning date:** 2026-09-17
**Tag convention:** `REDESIGN-PN-NN` in code comments. One task = one PR.
**Design reference:** [`design/NOTES.md`](design/NOTES.md) (decisions), `design/home.html` and
`design/mentoria.html` (the mocks, exact values), and the canvas linked from the notes.

Same document conventions as [`docs/courses/llm-agents/`](../courses/llm-agents/PLAN.md): this
PLAN, a living [`STATUS.md`](STATUS.md), one README per phase, one md per task. Each task is
implemented in its own session with `/redesign-task <task md>` (a local command mirroring
`/course-task`; it is not tracked by git — see Phase 4).

---

## The premise

The site was built as a tutoring landing: `/` **is** the mentoring offer, and «Mentoría» in the
menu is an anchor into it (`/#sessions`). Since then two more things exist — two free courses and
a blog — and neither is visible from the entrance. The redesign gives the site a home that shows
all three, and gives the tutoring offer its own page.

**What does not change:** the visual system (Emerald Nocturne tokens, Manrope / Inter /
Newsreader, the card surfaces), the navbar and footer chrome, the booking flow and every
component that runs it (`InteractiveShell`, `SessionCard`, `PackCard`, the calendar, the
overlays), the course and blog pages. The redesign is composition and routing, not a reskin.

## The two pages

| `/` — Inicio | `/mentoria` — Mentoría |
|---|---|
| Hero (two columns: identity + headline + CTAs + free-meeting note, photo) and the four stats | Inner-page header (kicker + serif title + lead + CTAs + note) |
| Short bio + compact six-area grid | «Cómo funciona» — four steps |
| The two course cards + «Ver todos los cursos» | Áreas de Especialización — the current bento, unchanged |
| The two latest posts + «Ver todos los artículos» | Testimonials (three quotes + Classgap link) |
| App showcase | Sessions + packs — `InteractiveShell`, unchanged |
| Closing band («Cuéntame qué quieres aprender») | App showcase (same component) |

The home has **no booking shell**: its CTAs are links into `/mentoria` carrying the intent the
shell already understands (`?book=smart`, and a new `?book=availability`). That makes `/` a fully
static route — the `useSearchParams` bailout that forces the Suspense boundary today moves with
the shell to `/mentoria`.

## Locked decisions

Settled on the canvas; not re-opened during implementation:

1. **One hero, one inner header.** Only `/` has a hero. Mentoría uses the header pattern Cursos
   and Blog already have (`.lp-section-head` + `.lp-serif` title with the green italic accent).
2. **Menu:** Inicio · Cursos · Mentoría · Blog. «Mentoría» is a page, not an anchor; the
   `#sessions` scroll-intent machinery (`useSessionsAnchor`) is deleted, not adapted.
3. **The weekly calendar is not a section** of `/mentoria`. It keeps appearing after choosing a
   modality or from «Ver disponibilidad», as today.
4. **Testimonials** are three static quotes in a grid with initials, on `/mentoria` only, right
   before the prices, with a link to the verified Classgap reviews. No carousel, no photos until
   sharp ones with explicit consent exist, no translation of the quotes.
5. **The app section is one component** rendered on both pages. Store links are env-driven
   placeholders until the app ships.
6. **Prices, validity and the cancellation window are read, never written** — the mocks show
   literals, the pages read `PricesProvider`, `usePackValidityDays()` and
   `getScheduleConfig().cancelMinNoticeHours`.
7. **The compact areas grid stays on the home** even though `/mentoria` shows the full bento:
   the home summarises, Mentoría details.

## Phases

| Phase | Purpose | Tasks |
|-------|---------|-------|
| [0 — Route split](phase-0-route-split/README.md) | `/mentoria` exists, the menu has Inicio, every deep link and test points at the right page. Nothing visual changes on `/` yet. | 2 |
| [1 — Home](phase-1-home/README.md) | `/` becomes the new home, section by section, and ends fully static — with the booking overlays mounted (amendment below). | 6 |
| [2 — Mentoría](phase-2-mentoria/README.md) | `/mentoria` gets its header, «Cómo funciona», testimonials and the app section; becomes indexable. | 4 |
| [3 — QA](phase-3-qa/README.md) | Message-key parity, the e2e suite on staging, build and performance checks. | 2 |
| [4 — Cleanup](phase-4-cleanup/README.md) | The design reference, this plan and the local command leave the working tree. | 1 |

**Landing order:** Phase 0 complete before Phase 1 starts (the home's CTAs need `/mentoria` to
exist). Phase 1 and Phase 2 can interleave after P1-01, except that P2-01 (which deletes
`HeroSection` and `BiographySection`) must land after P1-01 and P1-02 (which take `StatCard` and
the bio out of them). Phase 3 after both. Phase 4 last.

## Sequencing rule: every PR leaves both pages coherent

Phase 0 ships `/mentoria` as a copy of today's landing, `noindex` until Phase 2 finishes, and
retargets the deep links to it while `/` still renders the old landing. Phase 1 then replaces `/`
from the top down — hero first, the old sections still below — and P1-04 removes the booking
shell from `/` last. At no point is a booking entry point dead, and at no point are two
indexable pages identical.

## Amendments

- **2026-09-17 — the booking screens open in place on the home.** The plan as written sent the
  home's «Reservar sesión ahora» and «Ver disponibilidad» to `/mentoria?book=…`, where the
  shell would open the right surface. Implemented (P1-01), it reads as a detour: the visitor
  sees Mentoría paint and then the calendar or the wizard appear over it. The decision now: the
  calendar opens on `/`, a slot pick continues into the booking confirmation on `/`, «Reservar
  sesión ahora» opens the right screen directly on `/`; the OAuth round-trip is unchanged and
  still lands on `/mentoria` with the booking open. Mechanism: `InteractiveShell` is split into
  `BookingProvider` + `BookingOverlays` (mounted on both pages, overlays dynamically imported)
  and the Mentoría-only sessions/packs sections; the reschedule reader stays inside Mentoría's
  `Suspense` boundary so `/` keeps its static-route target. Locked decision «No booking shell on
  the home» (`design/NOTES.md`) is reworded to «no sessions/packs sections on the home». New
  task P1-06; P1-01 and P1-04 amended; P3-02's home spec rewritten. The deep-link rules (P0-02)
  do not change: cross-page intents still travel as `/mentoria?book=…`, never `/?book=`.

## Risks

- **Deep links.** Eleven source files, the reschedule links in the booking emails and five e2e
  specs assume the booking shell lives on `/`. Phase 0 task 02 is the inventory; nothing else
  in the cycle may add a new `/?book=` or `/#sessions`.
- **OAuth return.** `signInWithPopup(callbackUrl = "/")` and the booking router's slot-restore
  path bring the user back to a URL after Google sign-in. Every caller on `/mentoria` must pass
  `/mentoria` (or the current pathname), or the restored booking lands on a page with no shell.
- **Message parity.** This cycle adds the most keys since i18n; nothing enforces es/en parity
  today. P3-01 adds the check; until then, every task's test plan diffs the two key trees.
- **The e2e suite is timing-flaky** and the local DB is unregistered (see the memory notes
  `project_e2e_flaky` / `project_e2e_local_db_unregistered`): verify against staging with
  `E2E_BASE_URL`, re-run before calling a failure a regression.

## Out of scope

- Any change to the booking flow, the calendar, the pack purchase, the personal area, the course
  reader, the blog reader or the admin.
- Translating testimonials, collecting new ones, or a testimonials admin.
- The mobile app itself; the section only announces it.
- A redesign of `/cursos` or `/blog` — they already carry the inner-page header this plan
  adopts for Mentoría.
- Removing `landing.consulting.*` and `ConsultingSection` (already dead, unrelated).

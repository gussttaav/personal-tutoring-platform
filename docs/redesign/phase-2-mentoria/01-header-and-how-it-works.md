# P2-01 — Header + «Cómo funciona»

**Tag:** `REDESIGN-P2-01` · **Effort:** M · **Owner:** _tbd_ · **Status:** ⬜
**Depends on:** P0-02, P1-01, P1-02

## TL;DR

Replace `HeroSection` and `BiographySection` on `/mentoria` with the page header from
`design/mentoria.html` — kicker + rule, the serif title «Supera temas difíciles, *con guía
experta y directa*», the lead, the two CTAs and the free-meeting note — and add the
«Cómo funciona» band: four numbered step cards. Then delete the two old components and every
message key only they used.

## Context

- `design/mentoria.html` — `.mt-head` (`96px` top padding, the inner-page pattern), `.mt-title`
  (Newsreader 500, `clamp(2rem, 5vw, 3.25rem)`, `-0.02em`, `1.08`, `.accent` italic green),
  `.mt-lead` (`1.0625rem`, `#bbcabf`, max 620px), `.cta-row` + `.free-note` (same as the home
  hero's), `.sec` / `.sec-k` / `.sec-h` / `.sec-s` (the `InteractiveShell` section-head values:
  11px kicker, Manrope 800 `clamp(1.4rem, 3.5vw, 2rem)`, 14px subtitle), `.steps` (1 / 2 / 4
  columns at 0 / 640 / 1024), `.step` (`#201f22`, `26px 24px`, `.n` green «01», title
  `1.0625rem`, body `0.875rem`), `.divider`.
- `src/app/[locale]/mentoria/page.tsx` — the P0-01 copy: `HeroSection`, `BiographySection`,
  `SpecializationsSection`, `Suspense` + `InteractiveShell`, `Footer`.
- `src/features/landing/HeroSection.tsx:452-521` — the CTAs dispatch `open-smart-book` and
  `open-availability-modal`; on `/mentoria` the shell is on the page, so the header keeps
  dispatching events (no navigation) — that is the one difference from the home hero.
- `src/features/courses/course-editorial.css` — `.lp-section-head`, `.lp-kicker`, `.lp-rule`,
  `.lp-serif`; `src/app/[locale]/cursos/page.tsx:78-103` — the exact header markup to mirror
  (kicker + rule, `h1.lp-serif` with `t.rich` accent, the subtitle).
- `src/lib/schedule-config.ts:32` — `getScheduleConfig()` (server, cached) →
  `ScheduleConfig.cancelMinNoticeHours` (`src/domain/types.ts:204`); the fourth step quotes it.
- `src/components/Chat.tsx:177` — the FAB looks for `#hero-cta-row`; keep the id on the
  header's CTA row.
- `messages/*.json` — `landing.hero.{taglinePart1, taglinePart2, subheading, skills, zoomTitle,
  subtitle}`, `landing.bio.{para1, para2}`: after this task nothing reads them except
  `StructuredData` (`hero.subtitle` → `jobTitle`).

## Files affected

| File | Change |
|------|--------|
| `src/features/mentoria/MentoriaHeader.tsx` | **New**, server, with a client island for the CTA row. Kicker `mentoria.header.kicker` («Mentoría»), `h1.lp-serif` with `mentoria.header.title` via `t.rich` accent («Supera temas difíciles, <accent>con guía experta y directa</accent>»), lead `mentoria.header.lead`, `<MentoriaCtas />` (client: two buttons dispatching `open-smart-book` / `open-availability-modal`, labels `landing.hero.cta.*`, `id="hero-cta-row"`), free note `mentoria.header.freeNote` |
| `src/features/mentoria/HowItWorks.tsx` | **New**, server. `id="como-funciona"`; section head (`mentoria.how.{kicker, heading, subtitle}`); four `.step` cards from `mentoria.how.steps.{initial, slot, zoom, changes}.{title, body}`; the `changes.body` takes `{hours}` = `cancelMinNoticeHours` passed by the page |
| `src/features/mentoria/mentoria.css` | **New.** `.mt-head`, `.mt-title`, `.mt-lead`, `.mt-sec*`, `.mt-steps`, `.mt-step`, `.mt-divider` — the design's values |
| `src/app/[locale]/mentoria/page.tsx` | `HeroSection` + `BiographySection` → `MentoriaHeader` + `HowItWorks` (with `const { cancelMinNoticeHours } = await getScheduleConfig()`); `import "@/features/courses/course-editorial.css"`, `"@/features/mentoria/mentoria.css"`; `REDESIGN-P2-01` header comment |
| `src/features/landing/HeroSection.tsx`, `BiographySection.tsx` | **Deleted** (`StatCard.tsx` stays, used by `HomeStats`) |
| `src/components/seo/StructuredData.tsx` | `jobTitle` reads `home.hero.jobTitle` — the value («Profesor de Programación, Matemáticas e IA») moves from `landing.hero.subtitle` to that key in both message files, because it outlives the hero |
| `messages/es.json`, `messages/en.json` | `+ mentoria.header.{kicker, title, lead, freeNote}`, `+ mentoria.how.{kicker, heading, subtitle, steps.initial.title, steps.initial.body, steps.slot.title, steps.slot.body, steps.zoom.title, steps.zoom.body, steps.changes.title, steps.changes.body}`, `+ home.hero.jobTitle`; `− landing.hero.{subtitle, taglinePart1, taglinePart2, subheading, skills, zoomTitle}`, `− landing.bio.{para1, para2}` — key-for-key in both |

## The change

**The header is the Cursos/Blog header plus the CTAs.** Same kicker, same rule, same serif
title, same subtitle size — so the three menu pages read as one family and the home keeps the
only hero. The two CTAs and the free note are kept because this page sells; they are the same
markup as the home hero's, but *buttons* dispatching the shell's events rather than links, since
the shell is right here. The subject chips from the old hero are gone (dropped on the canvas by
the author).

**«Cómo funciona» is new copy, from the mock, in four cards:**

| Step | ES title | ES body |
|------|----------|---------|
| initial | Encuentro inicial | Quince minutos, gratis. Me cuentas qué necesitas y salimos con un plan de trabajo, reserves después o no. |
| slot | Eliges día y hora | Ves los huecos libres en el calendario y reservas el que te encaje. Recibes la confirmación por correo y el evento en tu calendario. |
| zoom | La clase con Zoom en la app | Sala privada uno a uno que se abre desde la propia web. Compartimos pantalla y código, con un chat para pegar enlaces y errores. |
| changes | Si surge algo | Puedes cancelar o mover la clase hasta {hours} horas antes. Lo gestionas automáticamente desde la web o tu móvil. |

The `{hours}` is read, not written (`booking_settings.cancel_min_notice_hours`, the same value
the cancel guard enforces — see `BookingService.getCancelWindowMs()` in CLAUDE.md). Use ICU
plural if the English needs «hour/hours».

**Deleting, not orphaning.** `HeroSection` and `BiographySection` have no consumer after this
task. Delete them, and delete the keys only they read — a key present in the files but read by
nothing is exactly the silent rot the i18n section of CLAUDE.md warns about. `jobTitle` is the
one value that outlives them (JSON-LD); it moves under `home.hero`.

## Acceptance criteria

- [ ] `/mentoria` opens with the header as `design/mentoria.html` at the three widths; the title
      is Newsreader with the green italic tail; the CTAs stack below 640
- [ ] «Reservar sesión ahora» opens the smart booking in place; «Ver disponibilidad» opens the
      availability window in place (no navigation, URL unchanged)
- [ ] The chat FAB avoids the CTA row while it is on screen
- [ ] The steps band renders 1 / 2 / 4 columns at 390 / 834 / 1440; step 04 shows the configured
      hours (change `cancel_min_notice_hours` in `/admin/schedule` on staging and reload after
      the 60s cache)
- [ ] `/mentoria#como-funciona` (the home's bio link) lands on the steps
- [ ] `HeroSection.tsx` and `BiographySection.tsx` are deleted; `grep -rn "landing.hero.subtitle\|taglinePart\|landing.bio.para" src messages` is empty
- [ ] Both message files: identical key trees after the additions and removals
- [ ] `pnpm lint`, `pnpm test`, `pnpm build` green

## Test plan

```bash
pnpm lint
pnpm test
pnpm build
```

Browser pane on `/mentoria` and `/en/mentoria` at the three widths; both CTAs; the anchor.

## Gotchas

- `getScheduleConfig` is `unstable_cache`d with the ISR window (see the memory note about
  `revalidate` driving Vercel CPU): read it once in the page, pass the number down — do not call
  it from the component.
- The `Suspense` boundary around `InteractiveShell` stays exactly where P0-01 put it.
- `t.rich` accent renderer: copy from `cursos/page.tsx:94-98`.
- Removing keys: search `messages/` AND `src/` AND `e2e/` (the specs read the dictionaries) before
  deleting each one.

## Out of scope

- `SpecializationsSection` (unchanged, keeps its footer strip).
- Testimonials (P2-02), app section (P2-03), metadata (P2-04).

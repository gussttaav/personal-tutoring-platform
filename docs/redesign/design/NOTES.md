# Design reference — Home + Mentoría redesign

**Canvas (source of truth while the cycle is active):**
https://claude.ai/artifact/3aqG7h3yJfRDyr1NrG3ZY3 — page «Home» and page «Mentoría», each at
1440 / 834 / 390. Every visual decision below was settled there on 2026-09-16 and 2026-09-17.

**Files in this folder**

| File | What it is |
|------|------------|
| `home.html` | The home page mock as a standalone page: open it in a browser, inspect any element, and copy the exact values. It is the same HTML the three canvas frames render — the breakpoints are the page's own media queries. |
| `mentoria.html` | Same for `/mentoria`. Shares its `<style>` block with `home.html` (navbar, footer, tokens, buttons, app section) plus its own section styles at the end. |
| `avatar.jpg` | Referenced by both pages (`public/avatar.png`, downsampled). Not for production. |
| `home-1440.jpg`, `home-390.jpg`, `mentoria-1440.jpg`, `mentoria-390.jpg` | Half-scale previews of the same files, for a quick look without a browser. |

The mocks are HTML + CSS with **inline SVG icons** because the standalone page cannot load the
self-hosted Material Symbols font. The implementation keeps the real icon font wherever the
current components already use it (`SpecializationsSection`, the cards' arrows).

## Locked decisions

- **One hero on the site, one header for the menu pages.** The home keeps the hero (photo,
  identity line, gradient headline). Cursos, Blog and Mentoría share the inner-page header:
  kicker + hairline rule (`.lp-section-head`), title in Newsreader 500 `clamp(2rem,5vw,3.25rem)`
  with the accent in green italic, subtitle at `1.0625rem`. The Mentoría header additionally
  keeps the two booking CTAs and the free-meeting note, because that page has to convert.
- **Menu:** Inicio · Cursos · Mentoría · Blog. Inicio is current on `/`, Mentoría on
  `/mentoria`. One emphasis rule (green + 2px underline), unchanged.
- **Home order:** hero + stats → bio + compact areas → courses → latest posts → app → closing
  band. No prices on the home. No booking shell on the home: it becomes fully static.
- **Mentoría order:** header → «Cómo funciona» (4 steps) → Áreas de Especialización (the
  current bento, unchanged, including DAM/DAW and the assistant strip) → testimonials →
  sessions → packs → app. The weekly calendar keeps appearing where it does today (after
  choosing a modality, or in the «Ver disponibilidad» window); a permanent grid was mocked and
  rejected.
- **Testimonials:** three static quotes, no carousel, initials avatars (the same circle the
  navbar draws for users without a picture), a link to the verified Classgap reviews under the
  grid. Quotes are user-generated content and are **never translated**: on `/en` they render in
  their original language, the English one first.
- **App section:** one component mounted on both pages. The phone reproduces the app's real home
  screen without the OS status bar. Store links are placeholders until the app ships.
- **Breakpoints** are the mocks' media queries: 640 (button rows, two-column grids), 768
  (three-column session/quote grids, bento, footer), 1024 (hero and bio two-column layouts,
  four-column steps).

## Values that are not copy

Rendered as literals in the mocks, read from their source in the implementation:

| In the mock | Source |
|-------------|--------|
| €16 · €30 · €75 (€80) · €140 (€160), the savings pills and the per-hour rates | `pricing` table via `PricesProvider` / `useProductPrice` (`PackCard`, `SessionCard` already do this) |
| «180 días» | `pricing_settings.pack_validity_days` via `usePackValidityDays()` |
| «hasta 2 horas antes» | `booking_settings.cancel_min_notice_hours` via `getScheduleConfig().cancelMinNoticeHours` |
| 43 lecciones · 5 módulos, 1 lección · 1 módulo | `listCatalogEntries(locale)` counts, as `/cursos` computes them |
| The two post cards | `listPosts(locale).slice(0, 2)` |
| 15+ · 4700+ · 150+ · 4.9 | `HeroSection`'s `statCards` literals today; keep them where `StatCard` lands |

## Copy that is new (goes to `messages/es.json` **and** `messages/en.json`)

Home: the headline («Programación, matemáticas e IA, con la parte difícil incluida.»), the
subheading, the free-meeting note, the compact area one-liners, the blog section heading («En
clase parece simple, aquí profundizo»), the app section, the closing band.

Mentoría: the lead under the title («Clases individuales según tus necesidades: …»), the four
«Cómo funciona» steps, the testimonials section chrome (kicker, heading, subtitle, Classgap
link). The testimonial quotes themselves live in `src/constants/testimonials.ts`, not in the
message files.

Everything else on both pages is existing copy (`landing.*`, `booking.shell.*`,
`booking.packCard.*`, `courses.catalog.*`, `blog.*`, `nav.*`, `footer.*`).

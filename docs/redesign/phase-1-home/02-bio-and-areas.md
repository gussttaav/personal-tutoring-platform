# P1-02 — Bio + compact areas

**Tag:** `REDESIGN-P1-02` · **Effort:** S · **Owner:** _tbd_ · **Status:** ⬜
**Depends on:** P1-01

## TL;DR

Replace `BiographySection` and `SpecializationsSection` on `/` with the home's second band: the
short bio on the left (overline, headline, one paragraph, social links, a «Cómo funcionan las
clases» link into `/mentoria`), the six compact area cards on the right. Two columns from 1024px
(`5fr 7fr`), one below; the area grid is two columns from 640px.

## Context

- `design/home.html` — `.bio`, `.bio-grid`, `.bio p.body`, `.social`, `.bio-link`, `.exp-grid`,
  `.exp` (40px icon box, `0.9375rem` title, `0.8125rem` body, `#201f22` surface, `14px` radius,
  `18px 20px` padding).
- `src/features/landing/BiographySection.tsx` — `:9-52` the three social links with their SVGs
  and hover styles (reuse verbatim); `:63-75` overline; `:78-91` headline (`landing.bio.headline`)
  and the two paragraphs; `:99-130` the divider and links row. The photo column `:133-172` is
  now the hero's (P1-01) and is not rendered here.
- `src/features/landing/SpecializationsSection.tsx:8-75` — the six cards' icons (`code`, `dns`,
  `calculate`, `psychology`, `analytics`, `school` — Material Symbols) and their titles
  (`landing.specs.cards.*.title`). The bodies are the long ones; the home uses one-liners.
- `messages/*.json` — `landing.bio.{overline, headline, para1, para2, github, linkedin, email}`,
  `landing.specs.cards.{programming, backend, math, ai, data, cycles}.title`.

## Files affected

| File | Change |
|------|--------|
| `src/features/home/HomeBio.tsx` | **New**, server. Overline (`landing.bio.overline`), headline (`landing.bio.headline`), ONE paragraph (`home.bio.para` — the mock's merged paragraph), divider, the three social links (markup from `BiographySection.tsx:9-52`, as `<a>`s with the same inline styles; the hover handlers need a small client wrapper or CSS `:hover` in `home.css` — use CSS), then `<Link href="/mentoria#como-funciona">` with `home.bio.howLink` + arrow |
| `src/features/home/HomeAreas.tsx` | **New**, server. Overline (`landing.specs.overline`… no: the design's overline here reads «Áreas de especialización» — use `landing.specs.headline` as the overline text), six `.exp` cards: Material Symbol icon, `landing.specs.cards.<k>.title`, `home.areas.<k>` one-liner |
| `src/features/home/home.css` | `+ .home-bio-grid`, `.home-areas-grid`, `.home-social a:hover`, `.home-area:hover` |
| `src/app/[locale]/page.tsx` | `BiographySection` + `SpecializationsSection` → one `<section>` wrapping `HomeBio` + `HomeAreas` in the grid |
| `messages/es.json`, `messages/en.json` | `home.bio.{para, howLink}`, `home.areas.{programming, backend, math, ai, data, cycles}` — key-for-key. ES one-liners from the mock (Programación: «Estructuras de datos, algoritmos, concurrencia y patrones de diseño. Python, Java, C/C++, Haskell.» etc.); EN translated by the implementer, same length |

## The change

The bio is the current bio, shortened: the mock merges `para1` and `para2` into one paragraph
(«Graduado en Ciencias de la Computación… hasta la preparación de entrevistas técnicas y el
desarrollo de proyectos reales.»). It is a new key, `home.bio.para`, because `landing.bio.para1/2`
stay in use on `/mentoria` until P2-01 removes the bio there — after which P2-01 deletes them.

The areas grid is a *summary* of the bento `/mentoria` keeps: same six titles, same icons, a
one-line body each, no tags, no DAM/DAW button. The «Cómo funcionan las clases» link targets the
anchor P2-01 gives the steps section (`id="como-funciona"`); until then it lands at the top of
`/mentoria`, which is acceptable.

The social links' hover today is done with `onMouseEnter` handlers, which forces a client
component. Move the two hover values into `home.css` (`.home-social a:hover { border-color:
rgba(78,222,163,0.35); color: #4edea3 }`) and keep the component on the server.

## Acceptance criteria

- [ ] `/` shows the bio band as `design/home.html` at 390 (stacked: bio, then six cards in one
      column), 834 (six cards in two columns under the bio) and 1440 (bio left, 2×3 cards right)
- [ ] Social links open GitHub, LinkedIn and `mailto:` as before; hover matches today's
- [ ] «Cómo funcionan las clases» navigates to `/mentoria#como-funciona` (locale-aware)
- [ ] Icons render from the Material Symbols font (not inline SVG)
- [ ] `/mentoria` still renders `BiographySection` and `SpecializationsSection` unchanged
- [ ] Both message files carry the eight new keys
- [ ] `pnpm lint`, `pnpm test`, `pnpm build` green

## Test plan

```bash
pnpm lint
pnpm test
pnpm build
```

Browser pane at the three widths; hover a social link; click the how-link.

## Gotchas

- Do not reuse `.skills-grid` / `.skill-item` from `globals.css` (a different, older component
  with tooltips); the compact cards are their own thing.
- The design's `.exp` cards are 12px apart, the bento's 16px — keep the design's value here.
- `landing.specs.headline` («Áreas de Especialización») is used as this band's overline; do not
  add a duplicate key.

## Out of scope

- The bento on `/mentoria` (unchanged, ever).
- Removing `landing.bio.para1/2` (P2-01).

# P1-01 — Hero + stats

**Tag:** `REDESIGN-P1-01` · **Effort:** M · **Owner:** Claude · **Status:** ✅ (amended)
**Depends on:** P0-02 (the deep links point at `/mentoria`)

> **Amended 2026-09-17.** The CTAs are no longer links into `/mentoria?book=…`: they are the
> same buttons Mentoría's hero has, dispatching `open-smart-book` / `open-availability-modal`,
> so the calendar and the booking open *in place* on `/` (see `STATUS.md` «Cross-phase notes»
> and `PLAN.md` «Amendments»). Until P1-04 the shell is still mounted on `/` and hears them;
> P1-06 makes that survive P1-04. Struck-through text below is the original spec, kept for the
> record.

## TL;DR

Replace `HeroSection` on `/` with the home hero from `design/home.html`: identity line and
credential, the two-line headline with the gradient second line, the subheading, the two CTAs
(~~links into `/mentoria`~~ buttons dispatching the shell's events), the free-meeting note, and
the photo in the offset frame on the right
from 1024px up (the small glow-box photo above the text below that). The four stats keep
`StatCard` — extracted from `HeroSection` into its own file so P2-01 can delete `HeroSection`.

## Context

- `design/home.html` — `.hero`, `.hero-grid` (`7fr 5fr` at ≥1024, one column below),
  `.hero-copy`, `.hero-photo` / `.hero-photo-sm`, `.h1` (`clamp(2.4rem, 5.2vw, 4rem)`, Manrope
  800, `.grad` second line), `.hero-sub`, `.cta-row`, `.free-note`, `.photo-frame` (the bio's
  frame: accent dot, accent line, two offset blocks, `4/5` ratio, max 340px), `.stats`.
- `src/features/landing/HeroSection.tsx` — `:19-182` `StatCard` (self-contained: popover with
  outside-click and Escape, `landing.hero.statsHint` / `close`); `:203-240` the `statCards`
  array (the four values, labels, popover copy and Classgap/LinkedIn links); `:263-282` the
  glow-box photo; `:329-352` identity + credential; `:354-412` headline; `:452-521` the CTAs,
  which dispatch `open-smart-book` / `open-availability-modal` — events only the shell hears;
  `:524-537` the stats grid (`grid-cols-2 lg:grid-cols-4`, `gap 32`, top border).
- `src/features/landing/BiographySection.tsx:133-172` — the photo frame markup and values the
  hero now uses (the bio loses it in P1-02).
- `src/components/Chat.tsx:143-180` — the FAB watches `#hero-cta-row` to avoid overlapping the
  hero CTAs; the new hero must keep `id="hero-cta-row"` on its CTA row.
- `src/features/booking/InteractiveShell.tsx:181-203` — the `?book=` switch; no `availability`
  case yet. `:148-152` — `open-availability-modal` sets `showAvailabilityModal`.
- `src/app/[locale]/page.tsx` — composition; `.landing-column` (`src/app/globals.css:720-722`)
  is the column with 16/24/32 side padding; the design's `.column` is the same thing with
  `max-width 1200`.
- `messages/*.json` — `landing.hero.*`: `credential`, `cta.book`, `cta.availability`,
  `statsHint`, `close`, `stats.*` are reused; `subtitle`, `taglinePart1/2`, `subheading`,
  `skills` are Mentoría's (P2-01 decides their fate).

## Files affected

| File | Change |
|------|--------|
| `src/features/landing/StatCard.tsx` | **New.** `StatCard` + `StatCardProps` moved verbatim from `HeroSection.tsx:1-182`; `HeroSection` imports it (no behaviour change there) |
| `src/features/home/HomeHero.tsx` | **New**, server component. Identity + credential (`landing.hero.credential`), headline (`home.hero.headline1` / `headline2`), subheading (`home.hero.subheading`), CTA row (`id="hero-cta-row"`, `className="hero-cta-row"`, rendered by `HomeHeroCtas`), free note (`home.hero.freeNote`), photo (`next/image` `/avatar.png`, `sizes="(max-width: 1023px) 128px, 340px"`, `priority`), and `<HomeStats />` |
| `src/features/home/HomeHeroCtas.tsx` | **New** (amendment), client. The two `<button>`s — `landing.hero.cta.book` → `open-smart-book`, `landing.hero.cta.availability` → `open-availability-modal` — verbatim the dispatches of `HeroSection.tsx:462-521`, styled by the `.home-hero-cta*` classes |
| `src/features/home/HomeStats.tsx` | **New**, client. The `statCards` array from `HeroSection.tsx:203-240` and the stats grid `:524-535`, rendering `StatCard` |
| `src/features/home/home.css` | **New.** The hero's responsive rules from the design (`.home-hero-grid`, `.home-hero-copy`, photo visibility at 1024, `.home-stats`), imported by `page.tsx`. Inline styles for everything single-valued, as the existing sections do |
| `src/features/booking/InteractiveShell.tsx` | `+ case "availability": setShowAvailabilityModal(true); break;` in the `?book=` switch, with a `REDESIGN-P1-01` note — kept by the amendment as a deep-link case (nothing on the home links to it any more) |
| `src/app/[locale]/page.tsx` | `HeroSection` → `HomeHero`; `import "@/features/home/home.css"` |
| `messages/es.json`, `messages/en.json` | `home.hero.{headline1, headline2, subheading, freeNote}` — key-for-key. ES from the mock; EN: «Programming, mathematics and AI,» / «with the hard part included.» / «One-to-one classes with direct guidance, free courses that run in the browser, and a blog with one concept per article.» / «The first 15-minute meeting is free: we go over your case and set a work plan.» |

## The change

~~**Links, not events.** The old CTAs dispatched window events because the shell was on the same
page. On the home there is no shell: «Reservar sesión ahora» is `<Link href="/mentoria?book=smart"
rel="nofollow">` (the pattern `LessonCta` established: the deep link is the bridge, `nofollow`
because a `?book=` URL is a crawl signal worth not sending), «Ver disponibilidad» is `<Link
href="/mentoria?book=availability" rel="nofollow">`. The shell gains the one missing case.~~

**Events, like Mentoría (amendment).** The booking screens open in place on `/`: the CTAs are
buttons in a small client island (`HomeHeroCtas`) dispatching exactly what `HeroSection`'s
dispatch. The shell on `/` hears them today; after P1-04, `BookingOverlays` (P1-06) does. No
`?book=` link leaves the home, which also removes the crawl-signal concern the `nofollow` was
for. The `availability` deep-link case stays in the shell for external callers.

**The photo frame moves up.** The design puts the bio's offset-frame photo in the hero and
drops the bio's photo column; the hero renders the frame with the values from
`BiographySection.tsx:133-172` (dot 22px at −10/−10, line 3×40 at 24/−10, blocks 85% at −7/−7
and −14/−14, radius 14) at `max-width 340px`, `aspect-ratio 4/5`. Below 1024 the hero shows the
128px glow-box instead (the mock's `.hero-photo-sm`), centred above the text, as today's hero.

**Text alignment flips with the layout**: centred below 1024 (like today), left-aligned in the
two-column layout. The CTA row keeps `.hero-cta-row` (column below 640, row above) and its id.

**Stats stay exactly what they are** — same values, same popovers, same external links — just
in their own file. `HeroSection` keeps working for `/mentoria` until P2-01 deletes it.

## Acceptance criteria

- [ ] `/` renders the hero as `design/home.html` at 390 (glow-box photo, centred text, stacked
      CTAs, 2×2 stats), 834 (same, CTAs in a row) and 1440 (two columns, framed photo, 4 stats)
- [ ] The headline's second line uses the gradient clip with the descender fix
      (`paddingBottom: 0.15em; marginBottom: -0.15em`, as `HeroSection.tsx:392-393`)
- [x] ~~«Reservar sesión ahora» navigates to `/mentoria` and opens the smart booking;
      «Ver disponibilidad» opens the availability window there — both work signed out and
      signed in~~ (amendment) «Reservar sesión ahora» opens the smart-book surface on `/`
      (SignInGate signed out; the wizard / pack booking signed in); «Ver disponibilidad» opens
      the calendar on `/`, and a slot pick continues into the same surface with the slot
      pre-selected — no navigation; after an OAuth round-trip the user lands on `/mentoria`
      with the booking open, as today
- [ ] The chat FAB still moves out of the CTAs' way while `#hero-cta-row` is on screen
- [ ] Each stat opens its popover, closes on outside click and Escape, links out — unchanged
- [ ] `HeroSection` on `/mentoria` renders as before (it now imports `StatCard`)
- [ ] Both message files have the four `home.hero.*` keys
- [ ] `pnpm lint`, `pnpm test`, `pnpm build` green

## Test plan

```bash
pnpm lint
pnpm test
pnpm build
node -e "const a=require('./messages/es.json'),b=require('./messages/en.json');const k=(o,p='')=>Object.entries(o).flatMap(([x,v])=>typeof v==='object'&&!Array.isArray(v)?k(v,p+x+'.'):[p+x]);const A=new Set(k(a)),B=new Set(k(b));console.log([...A].filter(x=>!B.has(x)),[...B].filter(x=>!A.has(x)))"
```

Browser pane: `/` and `/en` at the three widths; click both CTAs (the calendar and the gate
open on `/`, the URL does not change); pick a slot and read the gate's callbackUrl; open a stat.

## Gotchas

- `HomeHero` is a server component; `HomeStats` is `"use client"` because `StatCard` holds state.
  Keep the boundary there — it keeps the hero's HTML static.
- `next/image` with `fill` needs a positioned parent with a size; the frame's `aspect-ratio`
  gives it one, but only if the wrapper has a width (`width: 100%; max-width: 340px`).
- The design's Newsreader is not used in the hero (Manrope only); do not import
  `course-editorial.css` here — P1-03 does, for the section heads.
- `landing.hero.cta.book` / `cta.availability` are reused for the button labels; do not
  duplicate them under `home.*`.
- (amendment) `HomeHeroCtas` is the hero's second client island (after `HomeStats`); both are
  leaves, the hero's HTML around them stays static. Buttons, not `<Link onClick>`: Mentoría's
  hero uses buttons and there is no no-JS path anywhere in the booking.

## Out of scope

- The bio, areas and everything below the stats (still the old sections after this task).
- Deleting `HeroSection.tsx` (P2-01).

# P1-04 — App showcase + closing band + static home

**Tag:** `REDESIGN-P1-04` · **Effort:** M · **Owner:** _tbd_ · **Status:** ⬜
**Depends on:** P1-03, P1-06 (the overlays must exist on their own before the shell leaves
`/`), and P0-02

> **Amended 2026-09-17** (see `STATUS.md` «Cross-phase notes»): the shell still leaves `/`, but
> `<BookingOverlays />` (P1-06) takes its place, so the home keeps the booking screens in place.
> The closing band's primary CTA dispatches `open-smart-book` like the hero's, instead of linking
> to `/mentoria?book=smart`.

## TL;DR

The last two bands of the home — the mobile-app showcase and the closing booking band — and the
composition change that finishes the page: `InteractiveShell` (the sessions/packs sections) and
its `Suspense` boundary leave `/`, `<BookingOverlays />` stays (mounted alone), the chat FAB is
mounted on its own, and `/` becomes a fully static route. The app showcase
and the closing band are shared components (`src/components/`) because `/mentoria` mounts them
too (P2-03).

## Context

- `design/home.html` — `.app` / `.app-grid` (`5fr 7fr` from 1024, phone first), `.soon` pill,
  `.benefits` / `.benefit` (40px icon box), `.stores` / `.store` (two placeholder buttons),
  `.phone` + every `.ap-*` rule (the app's home screen: greeting, next-class card with the join
  button, credit balance with the bar, two upcoming classes, «Reservar otra clase», the four-tab
  bar); `.cta-band` (the `CourseCta` surface: `24px` radius, green-mid border, the gradient fill,
  the bloom), `.btn-primary`, `.btn-ghost`.
- `src/features/courses/landing/CourseCta.tsx:67-100` — the band's surface and bloom values
  are copied there today; the new component owns them so both pages share one implementation.
- `src/app/[locale]/page.tsx` — the `Suspense` + `InteractiveShell` block and its comment («Only
  InteractiveShell needs the Suspense boundary: it uses `useSearchParams()`…»). After this task
  nothing on `/` reads search params.
- `src/features/booking/InteractiveShell.tsx:540` — `<Chat />` is rendered by the shell; the
  footer's «Pregunta al asistente IA» (`Footer.tsx:225-251`) dispatches `open-chat`, which
  `Chat.tsx:207` listens to. On the new home the FAB must exist without the shell.
- `src/components/Chat.tsx:143-180` — the FAB's hero-overlap logic reads `#hero-cta-row`
  (kept by P1-01).
- `next.config.*` / `pnpm build` output — the route table marks static routes ○; today
  `/[locale]` is ƒ because of the `useSearchParams` bailout.
- `messages/*.json` — nothing under `app.*` or `home.closing.*` yet.

## Files affected

| File | Change |
|------|--------|
| `src/components/AppShowcase.tsx` | **New**, server. Left: the phone mock as markup (all `.ap-*` markup from the design, sample data as literals inside the component — it is a picture, not content); right: `app.soon` pill, `app.heading`, `app.lead`, three benefits (`app.benefits.{join, book, credits}.{title, body}`), the two store buttons. Store buttons render as `<a>` only when `NEXT_PUBLIC_APP_STORE_URL` / `NEXT_PUBLIC_PLAY_STORE_URL` are set; otherwise as `<span aria-disabled>` with the bracketed placeholder label (`app.stores.appStore` = «[App Store]» …), so the placeholder is visible on purpose |
| `src/components/app-showcase.css` | **New.** Every `.app*`, `.phone`, `.ap-*`, `.store*` rule from the design |
| `src/components/ClosingCta.tsx` | **New**, server. The band: `heading`, `body`, primary button dispatching `open-smart-book` (`landing.hero.cta.book`) and ghost button dispatching `open-chat` (`footer.askAssistant`) — the two buttons are one client island (`ClosingCtaButtons`). ~~primary `<Link href="/mentoria?book=smart" rel="nofollow">`~~ (amendment: the overlays are on both pages, so the band opens the booking in place like the hero) |
| `src/components/HomeChat.tsx` | **New**, client, one line: `export default function HomeChat() { return <Chat />; }` — or mount `<Chat />` directly if it needs no wrapper; the point is that `Chat` is on `/` without `InteractiveShell` |
| `src/features/home/home.css` | `+ .home-closing` spacing only; the band's own rules live in `ClosingCta` inline |
| `src/app/[locale]/page.tsx` | Remove `Suspense`, `Spinner`, `InteractiveShell` and their comment; keep `<BookingOverlays />` (from P1-06) mounted alone, with no children; mount `AppShowcase`, `ClosingCta`, `HomeChat`; `import "@/components/app-showcase.css"`; add the `REDESIGN-P1-04` header comment stating that `/` is static, the booking overlays are mounted on both pages and the sessions/packs sections live on `/mentoria` |
| `messages/es.json`, `messages/en.json` | `app.{soon, heading, lead, benefits.join.title, benefits.join.body, benefits.book.title, benefits.book.body, benefits.credits.title, benefits.credits.body, stores.downloadOn, stores.availableOn, stores.appStore, stores.playStore}`, `home.closing.{heading, body}` — key-for-key; ES from the mock («Tus clases, también desde el móvil», «Cuéntame qué quieres aprender», …) |
| `.env.example` (if present) | `+ NEXT_PUBLIC_APP_STORE_URL=`, `+ NEXT_PUBLIC_PLAY_STORE_URL=` with a comment |

## The change

**The phone is markup, not an image.** The design renders the app's home screen with the site's
own tokens so it stays crisp at every DPR and recolours with the theme; an exported PNG would
blur on retina and go stale with the palette. The sample data («Hola, Lucía», «Hoy · 18:00»,
«5 créditos · Pack Esencial», Vie 18 / Lun 21) is decorative and lives in the component as
literals, not in the message files — it is not UI copy and must not be translated. The one
exception is the tab bar labels and the button labels visible in the picture: also literals,
Spanish, deliberately (it is a screenshot of the Spanish app).

**Store links are honest placeholders.** Until the app exists, the buttons show the bracketed
labels from the design and are not links. Two env vars flip them to real links without a code
change.

**The chat FAB moves out of the shell.** `Chat` is already a self-contained client component
listening to `open-chat`; the shell merely rendered it. On `/` it is mounted by the page. On
`/mentoria` the shell keeps rendering it (unchanged) — mounting it twice on the same page would
show two FABs, so the page must mount it only where the shell is absent.

**Static home.** With the sections gone, nothing on `/` calls `useSearchParams` (the reschedule
reader stays inside Mentoría's boundary via `RescheduleBridge`, P1-06), so the `Suspense`
boundary and the spinner go. `pnpm build` must list `/[locale]` as ○ — with `BookingOverlays`
mounted: it is a client island whose overlays are dynamically imported and state-gated, so the
prerender contains none of them. The `fadeUp` keyframes `<style>` block in `page.tsx` stays
(the sections use the animation).

## Acceptance criteria

- [ ] `/` renders the app band and the closing band as `design/home.html` at the three widths
      (phone above the copy below 1024, beside it above)
- [ ] The phone mock is pixel-close to `design/home.html`'s: greeting, next-class card, credit
      card, two rows, dashed «Reservar otra clase», tab bar with Inicio active
- [ ] Store buttons are disabled placeholders with «[App Store]» / «[Google Play]» when the env
      vars are unset; real links when set (verify with a local `.env.local`)
- [ ] «Reservar sesión ahora» in the band opens the smart-book surface on `/` (no navigation);
      «Pregunta al asistente IA» in the band and in the footer open the chat on `/`
- [ ] After removing the shell, the hero's and the band's CTAs still open the calendar / the
      booking on `/` (heard by `BookingOverlays`); the Navbar pack button and logo click still
      work on `/`
- [ ] Exactly one chat FAB on `/` and exactly one on `/mentoria`
- [ ] `src/app/[locale]/page.tsx` has no `Suspense`, no `InteractiveShell`, exactly one
      `<BookingOverlays />`; `pnpm build` lists `/[locale]` as ○ Static and its First Load JS
      excludes the calendar / wizard / pack-booking chunks (P1-06's criterion, re-checked here)
- [ ] Both message files carry the new keys
- [ ] `pnpm lint`, `pnpm test`, `pnpm build` green

## Test plan

```bash
pnpm lint
pnpm test
pnpm build 2>&1 | grep -E "^[○ƒ●] +/\[locale\]$|/\[locale\]"
```

Browser pane: `/` at the three widths; count `.chat-fab` on `/` and `/mentoria`; toggle the env
vars locally.

## Gotchas

- `Chat` uses `heroCtaOnScreen` from `#hero-cta-row`: with the id kept by P1-01 the FAB
  behaves as on the old landing.
- Do not add the closing band to `/mentoria` in this task (P2-03 decides; the Mentoría page
  ends on the app section per the design).
- The `.phone` mock is `aria-hidden`; the copy column carries the meaning.
- The design's `.app` section has a top border and 72px vertical padding; on the home it follows
  the posts band directly.

## Out of scope

- The app itself, real store links, any «notify me when the app ships» flow.
- `/mentoria`'s app section (P2-03).

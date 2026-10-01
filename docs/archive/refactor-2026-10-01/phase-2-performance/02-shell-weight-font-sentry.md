# P2-02 — Shell weight: icon-font subset + Sentry Replay

**Tag:** `REFACTOR-R4-P2-02` · **Severity:** 🟠 · **Effort:** M · **Owner:** Claude · **Status:** ✅ (JS target missed, accepted)

## TL;DR

Two assets ship on **every** page, static blog posts and lessons included, and neither is needed
there at that size:

- **A: the icon font.** `material-symbols-outlined.woff2` is the full variable font: 3.9 MB, every
  glyph (~3,800), four axes, `display: "block"`, preloaded by `next/font/local`. The app uses fewer
  than 100 icons, one weight, one optical size, and toggles only `FILL`. Gustavo's Lighthouse notes
  attribute a ~25 s mobile LCP to it. Replace it with a subset of the used icons, keeping only the
  `FILL` axis, and add a check so a new icon can't silently render as its ligature text.
- **B: Sentry Session Replay.** It's bundled eagerly: `replayIntegration` sits in `Sentry.init`
  although whole-session replay is off and only 10% of error sessions record. Sentry's chunks are
  ~186 KB of the 352 KB gzipped first-load JS on a blog post. Drop Replay, or lazy-load it (decision
  below).

One PR: both are "shared-shell payload" changes, measured the same way.

## Context

**A**
- `src/app/[locale]/layout.tsx:57-65`:
  ```ts
  const materialSymbols = localFont({
    src: "./fonts/material-symbols-outlined.woff2",
    display: "block",
    variable: "--font-icon",
    weight: "100 700",
  });
  ```
  The file is 3,943,736 bytes (`src/app/[locale]/fonts/`).
- Axes actually used:
  - `src/app/globals.css:116-128` fixes `"FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24`
  - only `FILL` is ever changed: `content-feedback.css:72`, `ZoomRoomSession.tsx:1410`, `CourseProgressCard.tsx:47,89`
- Icon names arrive three ways:
  - JSX text inside `<span className="material-symbols-outlined">…</span>` (~50 distinct literals)
  - `icon` props / config objects (`icon: "…"`, ~74 sites, e.g. tab and link arrays)
  - ternaries (`{copied ? "check" : "share"}`, `{isAdmin ? "admin_panel_settings" : "dashboard"}`)
- Existing guard scripts to model on: `scripts/check-bundle.ts`, `scripts/check-messages.ts` (`package.json:14-15`).

**B**
- `src/instrumentation-client.ts:1-28`: `replaysSessionSampleRate: 0`, `replaysOnErrorSampleRate: 0.1`,
  `integrations: [Sentry.replayIntegration({ maskAllText, maskAllInputs, blockAllMedia })]` (`:24`).
- Measured on the main checkout's build: the blog post `es/blog/de-newton-a-adamw` loads 352 KB
  gzipped JS. Chunk `04pustjv5alk9.js` (168 KB gz, 130 `sentry` + 83 `replay` references) and
  `0kb3aanq8pu_f.js` (18 KB gz) are Sentry. The home page loads 402 KB and a lesson 371 KB. The same
  chunk appears in all 36 prerendered HTML files checked.
- `@sentry/nextjs` is `^10.53.1` (`package.json:25`).

## Files affected

| File | Change |
|------|--------|
| `src/constants/icons.ts` (new) | `ICON_NAMES`: the sorted list the subset is built from |
| `scripts/icons/build-icon-font.ts` (new) + `package.json` | `build:icons`: downloads the subset woff2 from Google Fonts for `ICON_NAMES` |
| `scripts/check-icons.ts` (new) + `package.json` | `check:icons`: every icon literal found in `src/` is in `ICON_NAMES` |
| `src/app/[locale]/fonts/material-symbols-outlined.woff2` | Replaced by the subset |
| `src/app/[locale]/layout.tsx` | `weight: "400"`; comment explains the subset + how to add an icon |
| `src/app/globals.css` | `font-variation-settings` keeps only `"FILL" 0` (the other axes are pinned in the file) |
| `src/instrumentation-client.ts` | Drop or lazy-load Replay (decision) |
| `next.config.mjs` | Only if lazy-loading: add `https://browser.sentry-cdn.com` to `script-src` |
| CI workflow | Run `pnpm check:icons` next to `check:messages` |

## The change

### A1. The icon list and the subset build

```ts
// src/constants/icons.ts
// REFACTOR-R4-P2-02: the icon font is a SUBSET containing exactly these glyphs.
// Adding an icon = add its name here (keep the list sorted), run
// `pnpm build:icons`, commit the new woff2. `pnpm check:icons` fails CI otherwise.
export const ICON_NAMES = [
  "account_circle",
  "admin_panel_settings",
  // …
] as const;
```

```ts
// scripts/icons/build-icon-font.ts (sketch)
// Google Fonts serves a per-icon subset of Material Symbols via `icon_names`.
// Pin wght 400 / GRAD 0 / opsz 24 (what globals.css fixes) and keep FILL 0..1 variable.
const names = [...ICON_NAMES].sort().join(",");
const css = await (await fetch(
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0" +
  `&icon_names=${names}&display=block`,
  { headers: { "user-agent": MODERN_UA } },   // a woff2-capable UA, or Google returns ttf
)).text();
const woff2Url = /url\((https:[^)]+\.woff2)\)/.exec(css)?.[1];
// fetch woff2Url → write src/app/[locale]/fonts/material-symbols-outlined.woff2
```

### A2. The guard

`scripts/check-icons.ts` scans `src/**/*.tsx` for:
1. text children of elements whose `className` contains `material-symbols-outlined`
2. string literals in those children's ternaries
3. string values of `icon` props and `icon:` object keys

It fails listing every name not in `ICON_NAMES`, and every name in `ICON_NAMES` found nowhere
(stale entries bloat the subset). Anything it can't see statically (a name built at runtime) must
be added to `ICON_NAMES` by hand. Say so in the script's header.

### A3. Layout + CSS

```ts
// layout.tsx
const materialSymbols = localFont({
  src: "./fonts/material-symbols-outlined.woff2",   // SUBSET — see src/constants/icons.ts
  display: "block",
  variable: "--font-icon",
  weight: "400",
});
```

```css
/* globals.css — wght/GRAD/opsz are pinned in the subset; only FILL remains an axis */
font-variation-settings: "FILL" 0;
```

### B. Sentry Replay (decision: default = drop)

**Drop** (if no replay has been watched in the Sentry project in the last 90 days):

```ts
// src/instrumentation-client.ts
// REFACTOR-R4-P2-02: Session Replay removed. It was ~half the JS of every static page
// and error-session replays were not being used. Re-adding it: prefer lazy-loading.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.1,
});
```

**Lazy-load** (if replays are used):

```ts
Sentry.init({ /* …as above… */ replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 0.1 });

if (typeof window !== "undefined") {
  const load = () =>
    Sentry.lazyLoadIntegration("replayIntegration")
      .then((replay) => Sentry.addIntegration(replay({ maskAllText: true, maskAllInputs: true, blockAllMedia: true })))
      .catch(() => { /* CDN blocked: no replay, nothing else affected */ });
  ("requestIdleCallback" in window ? window.requestIdleCallback : setTimeout)(load);
}
```

`lazyLoadIntegration` fetches from `https://browser.sentry-cdn.com`. Add that origin to `script-src`
in **both** CSP branches of `next.config.mjs`. Confirm `lazyLoadIntegration` is exported by
`@sentry/nextjs` 10.x before choosing this path. If it isn't, drop Replay.

## Acceptance criteria

- [ ] Icon font ≤ 150 KB (record the exact size); `weight: "400"`
- [ ] `pnpm check:icons` green, wired into CI; adding an unknown icon literal to a component makes it fail
- [ ] Visual pass: no icon renders as its ligature word on `/`, `/mentoria`, `/area-personal` (all tabs), `/cursos`, a lesson (feedback thumbs, filled state), a blog post, `/admin` (nav), `/sesion/<token>` pre-join, and the booking overlays
- [ ] `FILL` toggles still work (content-feedback thumbs pressed state, `CourseProgressCard`)
- [ ] First-load gzipped JS on `es/blog/<any>` down by ≥ 60 KB vs. the pre-task measurement (both numbers in the PR)
- [ ] Client errors still reach Sentry (throw from a test button on a preview deploy)
- [ ] File-top comment blocks carry `REFACTOR-R4-P2-02`

## Test plan

- **Existing:** `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm check:bundle` (note the known
  pre-existing false positive on the `gt:pyodide-loaded` literal), and e2e `home.spec.ts` + one
  booking spec.
- **New:** a unit test for `check-icons`' extractor over a small fixture TSX (text child, ternary,
  `icon` prop, object key).
- **Measure:** sum gzipped first-load chunks from the built HTML (method used in the audit: collect
  `/_next/static/chunks/*.js` referenced by `.next/server/app/es/blog/<slug>.html`, gzip each, sum)
  before and after. Lighthouse mobile on `/` and a blog post, 3 runs each, median (see the Lighthouse
  local-setup notes). Record LCP before/after.
- **Visual:** screenshots of the pages in the acceptance list at desktop and mobile widths.

## Notes / gotchas

- **Decision (Gustavo): Replay drop vs. lazy.** The default is drop. Check the Sentry project's
  Replays tab. If nothing has been opened in 90 days, the 10% on-error sampling buys nothing.
- **Ligature fallback.** A name missing from the subset renders as the literal word ("calendar_month")
  in the icon's box. That's why the guard exists, and why the visual pass is part of acceptance.
- Google Fonts' `icon_names` expects the list **alphabetically sorted**. Keep `ICON_NAMES` sorted and sort again in the script.
- The build script needs a modern browser `user-agent`, or the CSS API serves TTF instead of woff2.
- With the subset, `display: "block"` is fine. The block period is now a few KB of download, not 3.9 MB.
- Don't hand-edit the woff2. It's a build artifact of `ICON_NAMES`, committed because
  `next/font/local` needs it at build time.

## Out of scope

- Replacing Material Symbols with inline SVG icons (a larger refactor; the subset gets most of the win).
- Sentry performance tracing on the client (`tracesSampleRate`), and server/edge Sentry config.
- The Google-font families in the layout (Manrope, Inter, Newsreader); `next/font/google` already subsets those.
- The `messages` payload in `NextIntlClientProvider` (~78 KB uncompressed per locale, including the
  server-only `emails` namespace). A candidate for a later cycle.

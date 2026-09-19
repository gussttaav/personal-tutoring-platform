# P1-05 — Home metadata

**Tag:** `REDESIGN-P1-05` · **Effort:** S · **Owner:** _tbd_ · **Status:** ⬜
**Depends on:** P1-04

## TL;DR

The home's `<title>`, description and structured data still describe «tutorías». Give `/` its
own `home.meta` keys that describe what the page now is (tutoring, courses, blog), keep the
`Person` JSON-LD on it, and prepare the `Service` JSON-LD to move to `/mentoria` (P2-04 mounts
it there). Check the OG image still fits the home.

## Context

- `src/app/[locale]/page.tsx` — `generateMetadata` reads `landing.meta.{title, description}`
  and `localizedAlternates("", locale)`.
- `src/app/[locale]/layout.tsx:66-111` — the root `generateMetadata`: `meta.root.*` for the
  default title/description, OpenGraph/Twitter with `/og.png` / `/og-en.png` (SEO-03), the
  icons. Page-level metadata overrides `title`/`description` but inherits `openGraph` unless
  overridden.
- `src/components/seo/StructuredData.tsx` — one component, `@graph: [Person, Service]`, both
  reading the `landing` namespace (`hero.subtitle` for `jobTitle`, `meta.title` /
  `meta.description` for the Service). Mounted by `page.tsx` only.
- `messages/*.json` — `meta.root` and `landing.meta` say the same thing today (title with a
  hyphen vs an em dash); `meta.cursos` is the model for a page-specific pair.
- `public/og.png`, `public/og-en.png` — the share images (a memory note says the ES one is a
  placeholder from the SEO cycle).

## Files affected

| File | Change |
|------|--------|
| `messages/es.json`, `messages/en.json` | `+ home.meta.{title, description}` — ES: «Gustavo Torres — Programación, matemáticas e IA: clases, cursos y blog» / «Clases particulares de programación, matemáticas e IA, cursos gratuitos que se ejecutan en el navegador y un blog con un concepto por artículo.»; EN equivalent. `meta.root` updated to the same wording (it is the layout fallback) |
| `src/app/[locale]/page.tsx` | `generateMetadata` → `home.meta.*`; `openGraph.title/description` overridden to the same values so the share card matches the tab |
| `src/components/seo/StructuredData.tsx` | Split into `variant: "home" \| "mentoria"`: `home` emits `Person` only (`jobTitle` from `landing.hero.subtitle` until P2-01 moves it to `home.hero.jobTitle`), `mentoria` emits `Person` (by `@id` reference) + `Service` with `url` = the Mentoría URL and name/description from `meta.mentoria.*` (P2-04 adds those keys; until then `mentoria` falls back to `landing.meta.*`). Keep the `@id`s (`#person`, `#service`) so the graph stays linkable |
| `src/app/[locale]/layout.tsx` | No change unless `meta.root` wording changes need the OG `alt` updated |

## The change

**One page, one description.** After P1-04 the home is a site entrance; its title and
description must say so, or search results will keep selling «tutorías» for a page whose first
screen is a hero and whose body is courses and posts. `meta.root` follows because it is what
every route without its own metadata inherits.

**JSON-LD follows the content.** The `Person` describes Gustavo and belongs on the home. The
`Service` describes the tutoring offer with its prices-free description and belongs on the page
that sells it. Splitting by `variant` keeps one file and one `@graph` shape; P2-04 mounts the
`mentoria` variant.

**OG image.** `/og.png` bakes the credential and the credibility stats into the picture — it
still fits a home whose hero shows exactly those. No change unless it is visibly the
placeholder; if it is, note it in STATUS rather than redesigning it here.

## Acceptance criteria

- [ ] `/` and `/en`: `<title>` and `<meta name="description">` are the `home.meta.*` values;
      `og:title` / `og:description` match
- [ ] `/`'s JSON-LD is a `@graph` with the `Person` only, `@id` `…/#person` unchanged
- [ ] `hreflang` alternates on `/` unchanged (`localizedAlternates("", locale)`)
- [ ] `pnpm build` green; the `StructuredData` unit test (if any under
      `src/components/seo/__tests__/`) updated for the variant prop
- [ ] Both message files carry `home.meta.*`; `meta.root` updated in both

## Test plan

```bash
pnpm lint
pnpm test
pnpm build
curl -s http://localhost:3000/ | grep -o '<title>[^<]*</title>\|"@type":"[A-Za-z]*"'
```

## Gotchas

- `metadata.openGraph` is not merged deeply: overriding `openGraph` at page level replaces the
  whole object — copy `type`, `siteName`, `url`, `locale`, `alternateLocale`, `images` from the
  layout or extract a small helper (`src/lib/og.ts`) so both places read one source.
- `alternates` must stay from `localizedAlternates`; do not hand-write `languages`.

## Out of scope

- `/mentoria` metadata and the `Service` mount (P2-04).
- A new OG image.

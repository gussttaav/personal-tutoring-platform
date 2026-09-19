# P2-04 — Mentoría metadata + indexability

**Tag:** `REDESIGN-P2-04` · **Effort:** S · **Owner:** _tbd_ · **Status:** ⬜
**Depends on:** P2-03 (the page is complete), P1-05 (the `StructuredData` variant)

## TL;DR

Give `/mentoria` its own title and description, drop the `noindex` P0-01 put on it, list it in
the sitemap with both locales, and mount the `Service` JSON-LD there. After this task the site
has two indexable entrances that describe different things.

## Context

- `src/app/[locale]/mentoria/page.tsx` — `generateMetadata` from P0-01: `landing.meta.*`,
  `robots: { index: false }`, `localizedAlternates("/mentoria", locale)`.
- `src/app/sitemap.ts:45-56` — `staticRoutes = ["", "/privacidad", "/terminos",
  "/eliminar-cuenta"]`, each emitted for both locales with `x-default` → `/en`.
- `src/app/robots.ts` — `allow: "/"` with a disallow list; `/mentoria` needs nothing there.
- `src/components/seo/StructuredData.tsx` — after P1-05: `variant="home"` (Person) and
  `variant="mentoria"` (Person by reference + Service). The Service's `url` must be the Mentoría
  URL (`${BASE}/mentoria` / `${BASE}/en/mentoria`), its `name`/`description` from
  `meta.mentoria.*`.
- `src/lib/hreflang.ts:56` — `localizedAlternates(route, locale)` (both locales always exist for
  a static route, which is the case here).
- `messages/*.json` — `landing.meta.*` («Gustavo Torres — Tutorías de programación, matemáticas
  e IA» / «Clases de programación, matemáticas e IA con Gustavo Torres.») is the right *idea*
  for this page; it becomes `meta.mentoria.*`, next to `meta.cursos` and `meta.blog`.
- `docs/seo/PLAN.md` — the SEO cycle's notes on Search Console; a new indexable URL is worth a
  line there if the plan is still maintained (check its status first).

## Files affected

| File | Change |
|------|--------|
| `messages/es.json`, `messages/en.json` | `+ meta.mentoria.{title, description}` — ES: «Mentoría en programación, matemáticas e IA — Gustavo Torres» / «Clases particulares uno a uno por Zoom: sesiones sueltas y packs, encuentro inicial gratuito de 15 minutos. Programación, matemáticas e inteligencia artificial.»; EN equivalent. `− landing.meta.{title, description}` (no reader left) |
| `src/app/[locale]/mentoria/page.tsx` | `generateMetadata` → `meta.mentoria.*`, `robots: { index: true, follow: true }`, `openGraph` overridden like the home's (P1-05 helper), `alternates` unchanged; mount `<StructuredData locale={locale} variant="mentoria" />` |
| `src/app/[locale]/page.tsx` | `<StructuredData … variant="home" />` if P1-05 left it implicit |
| `src/components/seo/StructuredData.tsx` | `mentoria` variant reads `meta.mentoria.*` (drop the P1-05 fallback to `landing.meta`) and sets the Service `url` to the Mentoría URL |
| `src/app/sitemap.ts` | `+ "/mentoria"` in `staticRoutes` (its comment: «Static marketing/legal routes exist in both locales») |
| `docs/seo/PLAN.md` | One line under the GSC steps if that list is live: «request indexing for `/mentoria` and `/en/mentoria`» |

## The change

Straightforward once the page is done. The one decision is the `x-default`: `staticRoutes`
point `x-default` at the English URL (SEO-05) and `/mentoria` follows the same rule — no
special case.

The `Service` moves here because this is the page that sells the service; its `@id` stays
`…/#service` and its `provider` still references `…/#person`, which now lives on `/`. Linked
data across two pages by `@id` is what `@id` is for.

## Acceptance criteria

- [ ] `/mentoria` and `/en/mentoria`: `<title>` / description from `meta.mentoria.*`; no
      `noindex`; `hreflang` pair present; `og:title` matches
- [ ] `sitemap.xml` lists `/mentoria` and `/en/mentoria` with `alternates.languages` es / en /
      x-default (→ `/en/mentoria`)
- [ ] `/mentoria`'s JSON-LD is `[Person(@id ref), Service]` with `url` ending in `/mentoria`;
      `/`'s is `[Person]`
- [ ] `grep -rn "landing.meta" src messages e2e` is empty
- [ ] `pnpm lint`, `pnpm test`, `pnpm build` green; the sitemap unit test (if any under
      `src/app/__tests__/`) updated

## Test plan

```bash
pnpm lint
pnpm test
pnpm build
pnpm start & curl -s localhost:3000/sitemap.xml | grep -A3 mentoria; curl -s localhost:3000/mentoria | grep -o '<title>[^<]*</title>\|name="robots"[^>]*'
```

## Gotchas

- `src/app/__tests__/` has sitemap/robots tests from the SEO cycle; run `pnpm test` before
  assuming.
- `localizedAlternates` builds the `es`/`en` pair for a route that exists in both locales —
  correct here; `availableLocaleAlternates` is for content-driven routes and is not needed.

## Out of scope

- A dedicated OG image for Mentoría (the home's is inherited).
- Redirects: `/#sessions` never was a distinct URL, so nothing to redirect.

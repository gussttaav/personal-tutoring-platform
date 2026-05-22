# Phase 5 — Validation messages + SEO polish

> See [README](./README.md) for project-wide context. Phases 1–4 must be merged first.

## Goal

Localize Zod validation error messages, emit `hrefLang` tags for SEO, and add locale-aware sitemap entries. This is the polish phase — short and contained.

## Branch

```bash
git checkout staging && git pull
git checkout -b feat/i18n-phase-5-validation-seo
```

## Steps

### 1. Zod messages as keys

Edit [src/lib/schemas.ts](../../src/lib/schemas.ts). Replace any hardcoded messages with stable keys:

```ts
z.string({ message: 'errors.validation.required' }).email({ message: 'errors.validation.email' })
```

Form components catch `ZodError`, extract `issue.message` (which is now a key), and call `t(issue.message)` to display it. Add the keys to `messages/{es,en}.json` under `errors.validation.*`.

If a schema is consumed in a non-form context (background job, API validation that just returns 400), the key is sent over the wire and the client translates it the same way other API errors are translated (per Phase 3 work).

### 2. `hrefLang` tags in the locale layout

Edit `src/app/[locale]/layout.tsx` — add alternates in `generateMetadata` or directly in the head:

```tsx
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return {
    alternates: {
      languages: {
        es: '/',
        en: '/en',
        'x-default': '/',
      },
    },
  };
}
```

For per-page hrefLang (recommended for canonical alternates on every route), generate them inside each page's `generateMetadata` based on the current pathname:

```ts
alternates: {
  canonical: locale === 'es' ? `/<route>` : `/en/<route>`,
  languages: {
    es: `/<route>`,
    en: `/en/<route>`,
    'x-default': `/<route>`,
  },
}
```

You can centralize this in a small helper (e.g., `src/lib/hreflang.ts`) so every page's `generateMetadata` calls a one-liner.

### 3. Sitemap

If the project already has a sitemap (`src/app/sitemap.ts` or similar), update it to emit both locale variants per URL:

```ts
import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://gustavoai.dev';
  const routes = ['', '/cursos', '/privacidad', '/terminos'];
  return routes.flatMap((r) => [
    { url: `${base}${r}`, alternates: { languages: { es: `${base}${r}`, en: `${base}/en${r}` } } },
    { url: `${base}/en${r}`, alternates: { languages: { es: `${base}${r}`, en: `${base}/en${r}` } } },
  ]);
}
```

If no sitemap exists, this is the moment to add one — but only if SEO matters for the English content from day one.

### 4. `robots.txt`

If a `robots.txt` exists, verify it doesn't block `/en/` paths.

### 5. Quick i18n audit

- Lighthouse → Accessibility / SEO sections clean for both `/` and `/en/`.
- View source on a few pages, confirm `<html lang>` is correct and `<link rel="alternate" hrefLang>` tags are present.
- Use Google Search Console URL Inspection tool (post-deploy) to verify both variants are indexable.

## Exit criteria

- [ ] Submitting a form with invalid input shows localized validation messages.
- [ ] Each customer-facing page has `hrefLang="es"`, `hrefLang="en"`, and `hrefLang="x-default"` link tags.
- [ ] Sitemap (if present) emits both locale variants.
- [ ] Lighthouse SEO clean for both locales.
- [ ] `npm run build`, `lint`, `test`, `test:e2e` clean.

## Verification

```bash
npm run build && npm start
# Open / and /en, view source:
#   - <html lang="es"> on /
#   - <html lang="en"> on /en
#   - <link rel="alternate" hrefLang="..."> tags present
# Submit a form with bad input — error message in the active language.
```

## PR description template

```
## Summary
- Zod validation messages converted to translation keys (errors.validation.*) and translated at the form-render boundary.
- generateMetadata emits hrefLang/canonical alternates per page (es, en, x-default).
- Sitemap emits both locale variants per URL.

## Test plan
- [ ] Form validation errors show in chosen language
- [ ] View source: <html lang> + hrefLang tags correct on / and /en
- [ ] Lighthouse SEO clean on both locales
- [ ] npm run build/lint/test/test:e2e pass
```

---

## After this phase

The work described in [README.md](./README.md) is complete. Possible next-steps (explicitly NOT in scope for this initiative, deferred until product needs them):

- Add a `users.locale` column so logged-in users' preferences survive across devices.
- Update background-job emails to read the user's locale from the DB.
- Add a third language.
- Move dictionaries to a translation-management platform (Crowdin, Lokalise) if volume grows.
- Translate the admin panel (only if a non-Spanish-speaking person ever needs to use it).

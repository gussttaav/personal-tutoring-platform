# Phase 1 — Foundation (no translations)

> See [README](./README.md) for project-wide context and decisions.

## Goal

Install and wire `next-intl`. Move all UI pages under a `[locale]` segment. **No strings are translated** — Spanish text stays inline. The app must behave identically to today; `/en/...` returns the same Spanish content (placeholder until Phase 2).

This is the lowest-risk, easiest-to-review first PR.

## Branch

```bash
git checkout staging && git pull
git checkout -b feat/i18n-phase-1-foundation
```

## Prerequisites & background

- Next.js 14.2.5 App Router. React 18.
- No existing middleware, no existing i18n config.
- Current root layout at [src/app/layout.tsx](../../src/app/layout.tsx) hardcodes `<html lang="es">`, wraps children in `AuthProvider`, loads Manrope + Inter fonts.
- API routes under `src/app/api/` must **not** be locale-rewritten (Stripe webhook, NextAuth `/api/auth/*`, QStash callback, Resend callback all hit fixed URLs).
- NextAuth v5 beta. Current app gates pages via server-side `auth()` calls inside the pages, **not** via middleware. Do not change this.

## Steps

### 1. Install

```bash
pnpm add next-intl
```

### 2. Create i18n config files

**`src/i18n/routing.ts`**:
```ts
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['es', 'en'],
  defaultLocale: 'es',
  localePrefix: 'as-needed', // Spanish unprefixed, English under /en
});
```

**`src/i18n/request.ts`** (placeholder — Phase 2 will load real JSON):
```ts
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as 'es' | 'en')) {
    locale = routing.defaultLocale;
  }
  return { locale, messages: {} };
});
```

**`src/i18n/navigation.ts`** (locale-aware navigation primitives — used by all internal links from Phase 2 onward):
```ts
import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
```

### 3. Add middleware

**`src/middleware.ts`**:
```ts
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Skip /api (Stripe webhook, NextAuth, QStash, Resend), _next, and anything with a file extension.
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
```

### 4. Wrap `next.config.mjs` with the plugin

Edit [next.config.mjs](../../next.config.mjs) — wrap the existing default export:

```js
import createNextIntlPlugin from 'next-intl/plugin';
// ... existing imports

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig = { /* ...existing config unchanged... */ };

// Apply existing Sentry wrapper, then next-intl. Order matters; next-intl can be outermost.
export default withNextIntl(withSentryConfig(nextConfig, /* ...existing args */));
```

**Do not touch CSP** in this phase. Revisit only if a real violation appears in the build or in browser smoke-tests.

### 5. Move UI pages under `[locale]`

Use `git mv` to preserve file history. From the repo root:

```bash
mkdir -p src/app/\[locale\]
git mv src/app/page.tsx           src/app/\[locale\]/page.tsx
git mv src/app/layout.tsx         src/app/\[locale\]/layout.tsx
git mv src/app/admin              src/app/\[locale\]/admin
git mv src/app/area-personal      src/app/\[locale\]/area-personal
git mv src/app/auth               src/app/\[locale\]/auth
git mv src/app/cancelar           src/app/\[locale\]/cancelar
git mv src/app/pago-exitoso       src/app/\[locale\]/pago-exitoso
git mv src/app/privacidad         src/app/\[locale\]/privacidad
git mv src/app/sesion             src/app/\[locale\]/sesion
git mv src/app/sesion-confirmada  src/app/\[locale\]/sesion-confirmada
git mv src/app/terminos           src/app/\[locale\]/terminos
```

**`src/app/api/` stays put.** Any other files at `src/app/` root (loading, error, not-found, opengraph-image, icon, robots, sitemap, etc.) — leave at the root unless they need translations; consult `git status` after moving.

If there were `loading.tsx` / `error.tsx` / `not-found.tsx` at `src/app/` that you want locale-aware, also move them under `[locale]/`. Inspect `ls src/app/` before and after to be sure nothing is left behind that needs moving.

### 6. Update the moved `layout.tsx`

The moved file is now `src/app/[locale]/layout.tsx`. Update it so the `<html>` tag uses the resolved locale and the tree is wrapped in `NextIntlClientProvider`:

```tsx
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
// ...existing imports (AuthProvider, fonts, etc.)

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as 'es' | 'en')) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} /* existing classes / font variables */>
      <body /* existing classes */>
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>{children}</AuthProvider>
          {/* Vercel Analytics, etc. */}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

Keep all existing layout content (fonts, metadata exports, providers) — only the wrapper and `lang` attribute change.

### 7. Sanity-fix imports

Some moved files may use relative imports like `../../components/...`. These usually still resolve, but if you encounter broken paths, prefer the `@/` alias (already configured in `tsconfig.json`).

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Middleware swallows `/api/auth/*` → NextAuth breaks | The `matcher` excludes `api`. Smoke-test `/api/auth/session` returns its normal JSON after the change. |
| Stripe webhook URL changes | API stays outside `[locale]` — webhook URL is unchanged. Do not regenerate webhook secret. |
| Forgetting `setRequestLocale` → static rendering breaks for some pages | Add `setRequestLocale(locale)` at the top of any page that uses `useTranslations`/`getTranslations` once Phase 3 begins. For Phase 1, only the layout needs it. |
| CSP violations from `next-intl` runtime | Build the app and open it; check the browser console. If no violations, do nothing. Don't loosen CSP preemptively. |
| Adding NextAuth middleware here "while we're at it" | Don't. Keep concerns separate; route protection stays in the pages. |

## Exit criteria

- [ ] `pnpm build` clean.
- [ ] `pnpm lint` clean.
- [ ] `pnpm test` clean.
- [ ] `pnpm test:e2e` clean (no test changes needed — Spanish text is unchanged).
- [ ] All existing URLs return their previous content: `/`, `/area-personal`, `/admin`, `/sesion/<token>`, `/cancelar`, `/pago-exitoso`, `/privacidad`, `/terminos`, `/sesion-confirmada`, `/auth/...`.
- [ ] `/en`, `/en/area-personal`, `/en/admin` return 200 with (still) Spanish content. (`/en` just shows the same page until Phase 2 translates anything.)
- [ ] `/api/auth/session` returns the normal NextAuth session payload.
- [ ] Stripe webhook endpoint (`/api/stripe/webhook` or equivalent — confirm in code) unchanged. If you have a way to trigger it from the Stripe CLI in staging, do so.
- [ ] QStash callback path unchanged.

## Verification

Manual:
```bash
pnpm dev
# In a browser:
#   http://localhost:3000/
#   http://localhost:3000/area-personal
#   http://localhost:3000/en
#   http://localhost:3000/en/area-personal
#   http://localhost:3000/api/auth/session
```

Each should match its pre-change behavior. Spanish content on both `/` and `/en/` is expected and correct for Phase 1.

Automated:
```bash
pnpm lint && pnpm build && pnpm test && pnpm test:e2e
```

## PR description template

```
## Summary
- Install next-intl 3.x and wire foundation: routing config, request config, middleware.
- Move all UI pages under src/app/[locale]/. API routes (Stripe webhook, NextAuth, QStash, Resend) untouched.
- Layout now emits <html lang={locale}> and wraps tree in NextIntlClientProvider.
- No string translation yet — Spanish content unchanged. /en/* renders the same Spanish content as / until Phase 2.

## Test plan
- [ ] pnpm build / lint / test / test:e2e pass
- [ ] / and /en/ both render correctly (Spanish)
- [ ] /api/auth/session works
- [ ] Stripe webhook + QStash callback URLs unchanged
```

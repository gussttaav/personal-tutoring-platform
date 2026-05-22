# Phase 2 — Dictionaries, switcher, navbar + landing

> See [README](./README.md) for project-wide context. Phase 1 must be merged first.

## Goal

Scaffold translation files, add a working locale switcher to the navbar, and translate the **navbar + landing page** fully. The rest of the app stays inline-Spanish (it renders fine — translations only replace what's been migrated).

After this phase, the auto-detect + switcher behavior is live and observable.

## Branch

```bash
git checkout staging && git pull
git checkout -b feat/i18n-phase-2-navbar-landing
```

## Steps

### 1. Create the dictionary files

Create `messages/es.json` and `messages/en.json` at the repo root (next-intl's default location). Use the following namespaces — leave most empty in this phase, fill `common`, `nav`, and `landing`:

```json
{
  "common": { /* shared buttons, "Cargar más", "Cerrar", "Cancelar", etc. */ },
  "nav": {
    "courses": "Cursos",
    "mentoring": "Mentoría",
    "blog": "Blog",
    "personalArea": "Área Personal",
    "adminPanel": "Panel de admin",
    "signIn": "Iniciar sesión",
    "signOut": "Cerrar sesión",
    "languageSwitcher": "Idioma"
  },
  "landing": { /* fill from the landing page literals */ },
  "auth": {},
  "areaPersonal": {},
  "booking": {},
  "legal": {},
  "errors": {},
  "emails": {}
}
```

`messages/en.json` mirrors the same keys with English values. Spanish is the canonical source — when you add a key, add it to both files.

### 2. Wire dictionaries into the request config

Replace the placeholder in [src/i18n/request.ts](../../src/i18n/request.ts):

```ts
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as 'es' | 'en')) {
    locale = routing.defaultLocale;
  }
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

### 3. Build the locale switcher

Create `src/components/LocaleSwitcher.tsx` (`"use client"`):

```tsx
'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

export function LocaleSwitcher() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function onChange(nextLocale: 'es' | 'en') {
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });
  }

  return (
    <label aria-label={t('languageSwitcher')}>
      <select
        value={locale}
        disabled={isPending}
        onChange={(e) => onChange(e.target.value as 'es' | 'en')}
      >
        {routing.locales.map((l) => (
          <option key={l} value={l}>{l.toUpperCase()}</option>
        ))}
      </select>
    </label>
  );
}
```

Style it to match the existing navbar aesthetic (Tailwind classes). A simple `<select>` is fine for a first pass; can be upgraded to a dropdown component later if needed.

next-intl writes the `NEXT_LOCALE` cookie automatically when `router.replace` runs with a different locale.

### 4. Migrate the navbar

Edit [src/components/Navbar.tsx](../../src/components/Navbar.tsx):

- Add `const t = useTranslations('nav');` at the top.
- Replace each hardcoded literal (`"Cursos"`, `"Mentoría"`, `"Blog"`, `"Área Personal"`, `"Panel de admin"`, `"Iniciar sesión"`, `"Cerrar sesión"`) with `t('courses')`, etc.
- Replace `Link` imports from `next/link` with `Link` from `@/i18n/navigation` so internal links auto-prefix the locale.
- Mount `<LocaleSwitcher />` in **both** the desktop dropdown area and the mobile hamburger panel.

### 5. Migrate the landing page

Edit `src/app/[locale]/page.tsx` (and any landing sub-components in `src/features/landing/` if they exist):

- For client components: `const t = useTranslations('landing');`.
- For server components: `const t = await getTranslations('landing');` — and add `setRequestLocale(locale)` at the top of the page component.
- Move every Spanish literal into `messages/es.json` under `landing.*`. Translate to `messages/en.json`.
- For metadata, convert `export const metadata` to:

```ts
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'landing.meta' });
  return { title: t('title'), description: t('description') };
}
```

### 6. Replace internal `Link` usages in migrated files

Anywhere you migrated text in this phase, also swap `import Link from 'next/link'` → `import { Link } from '@/i18n/navigation'`. Don't sweep the whole codebase — only files you touched.

## Auto-detect behavior (sanity check)

next-intl's middleware reads `Accept-Language` on the first request (no cookie set). If the best match isn't Spanish, it redirects to `/en` and writes `NEXT_LOCALE`. Subsequent requests read the cookie and skip detection.

## Persistence + NextAuth

Cookie only. **Do not** modify [src/auth.ts](../../src/auth.ts) session shape or run a Supabase migration. Switching language while logged in writes the cookie and refreshes the route; the NextAuth session is untouched.

## Exit criteria

- [ ] Switcher renders on both desktop and mobile navbar.
- [ ] Switching from ES to EN navigates from `/cursos` to `/en/cursos` (or analogous), and the navbar + landing copy actually changes.
- [ ] DevTools → set `Accept-Language: fr-FR`, clear cookies, visit `/` → redirects to `/en`. Switch to ES → cookie persists, refresh stays on `/`.
- [ ] DevTools → `Accept-Language: es-ES`, clear cookies, visit `/` → no redirect.
- [ ] Logged-in user can switch language without losing the session.
- [ ] All other pages still render in Spanish (they haven't been migrated yet — this is expected).
- [ ] `npm run build`, `lint`, `test`, `test:e2e` all clean. E2E suite is still Spanish-text-based; no test changes yet.

## Verification

```bash
npm run dev
# Manually click through navbar links in both ES and EN.
# Toggle the switcher on / and a few sub-pages — the URL should pick up /en/.
# Open Application → Cookies → confirm NEXT_LOCALE is set after a switch.
```

## PR description template

```
## Summary
- Add messages/{es,en}.json dictionaries.
- Wire request config to load locale messages.
- Add LocaleSwitcher component, mount in navbar (desktop + mobile).
- Translate navbar + landing page strings to t() lookups.
- Replace next/link with locale-aware Link from @/i18n/navigation in migrated files.

## Test plan
- [ ] Switcher works in both desktop and mobile navbar
- [ ] Accept-Language: fr → redirected to /en on first visit
- [ ] Accept-Language: es → no redirect
- [ ] NEXT_LOCALE cookie persists across reloads
- [ ] Logged-in users keep their session after switching
- [ ] npm run build/lint/test/test:e2e pass
```

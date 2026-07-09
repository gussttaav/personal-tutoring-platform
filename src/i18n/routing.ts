import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['es', 'en'],
  defaultLocale: 'es',
  localePrefix: 'as-needed', // Spanish unprefixed, English under /en
  // SEO-01: do NOT set `localeDetection: false` here. That flag disables the
  // NEXT_LOCALE cookie as well, breaking language persistence for returning
  // users. Accept-Language detection is instead disabled by stripping the
  // header in src/middleware.ts before next-intl runs.
});

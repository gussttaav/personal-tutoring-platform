import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['es', 'en'],
  defaultLocale: 'es',
  localePrefix: 'as-needed', // Spanish unprefixed, English under /en
  // Phase 1: keep behavior identical to today (no Accept-Language redirect).
  // Phase 2 enables auto-detect — flip this to true (or remove the line).
  localeDetection: false,
});

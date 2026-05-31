import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

// Phase 1 placeholder — Phase 2 will load real translation JSON here.
export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as 'es' | 'en')) {
    locale = routing.defaultLocale;
  }
  return { locale, messages: {} };
});

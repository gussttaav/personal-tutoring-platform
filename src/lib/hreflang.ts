/**
 * lib/hreflang.ts — locale-aware canonical + hreflang alternates for SEO.
 *
 * i18n Phase 5: Spanish is the default locale and lives at unprefixed URLs;
 * English lives under `/en`. Each indexable page feeds the route (without the
 * `/en` prefix) to `localizedAlternates` and spreads the result into its
 * `generateMetadata().alternates`. Paths are relative and resolve against the
 * `metadataBase` set in `src/app/[locale]/layout.tsx`.
 *
 * COURSE-P6-01: `availableLocaleAlternates` + `localeUrl` are added for content
 * that may not exist in every locale (courses are Spanish-only for months).
 */

import { routing } from "@/i18n/routing";

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "https://gustavoai.dev";

/**
 * Relative, locale-correct path under the `as-needed` prefix rule: the default
 * locale is unprefixed, every other locale is `/<locale>`-prefixed. Home ("")
 * collapses to "/". This is the single place that encodes the prefix rule.
 */
function localePath(route: string, locale: string): string {
  if (locale === routing.defaultLocale) return route || "/";
  return `/${locale}${route}`;
}

/**
 * Absolute, locale-correct URL for a route — for contexts that need a full URL
 * rather than a `metadataBase`-relative path (JSON-LD `url`/`@id`, sitemap).
 */
export function localeUrl(route: string, locale: string): string {
  const path = localePath(route, locale);
  return `${BASE}${path === "/" ? "" : path}`;
}

/**
 * Builds canonical + hreflang alternates for a customer-facing route.
 *
 * The `canonical` is locale-specific — it points at the *current* locale's URL
 * so each variant is indexed in its own right — while the hreflang `languages`
 * set is identical across variants and pairs them.
 *
 * SEO-05: `x-default` points at the English URL, not Spanish. This is a search
 * ranking signal only ("which page to show a searcher whose language matches
 * neither es nor en") — English is the intended international fallback, same
 * as the pre-i18n product rule. It does NOT affect what a live visitor with no
 * NEXT_LOCALE cookie sees when they load the bare domain: that stays Spanish,
 * decided purely by pathname/cookie in src/middleware.ts (SEO-01), with no
 * server-side language redirect (that redirect broke Googlebot indexing).
 *
 * @param route  Spanish (default-locale) path, e.g. "" for the landing page or
 *               "/privacidad". Do NOT include the `/en` prefix.
 * @param locale Current request locale ("es" | "en").
 */
export function localizedAlternates(route: string, locale: string) {
  const es = route || "/";
  const en = `/en${route}`;
  return {
    canonical: locale === "en" ? en : es,
    languages: {
      es,
      en,
      "x-default": en,
    },
  };
}

/**
 * COURSE-P6-01: alternates for content that may not exist in every locale.
 * Unlike `localizedAlternates` (which assumes both variants exist), this emits
 * only the locales actually present, and points `x-default` at the sole
 * available locale when there is only one.
 *
 * With Spanish-only content this returns `{ es, x-default: es }` and **no `en`
 * key** — so a lesson that 404s under `/en` is never advertised. When English
 * content lands, the registry reports both and the caller passes `["es","en"]`,
 * at which point `x-default` reverts to English (the SEO-05 convention) with no
 * change here.
 *
 * @param route     Default-locale path, e.g. "/cursos/dl-nlp". No `/en` prefix.
 * @param locale    Current request locale — its URL becomes the `canonical`.
 * @param available Locales the content actually exists in (must include `locale`).
 */
export function availableLocaleAlternates(
  route: string,
  locale: string,
  available: readonly string[],
) {
  const languages: Record<string, string> = {};
  for (const loc of available) languages[loc] = localePath(route, loc);

  // SEO-05 convention: English is the international fallback when it exists;
  // otherwise x-default points at the default locale, else the sole available one.
  const xDefaultLocale = available.includes("en")
    ? "en"
    : available.includes(routing.defaultLocale)
      ? routing.defaultLocale
      : available[0];
  if (xDefaultLocale) languages["x-default"] = localePath(route, xDefaultLocale);

  return {
    canonical: localePath(route, locale),
    languages,
  };
}

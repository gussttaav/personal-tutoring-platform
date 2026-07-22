/**
 * lib/hreflang.ts — locale-aware canonical + hreflang alternates for SEO.
 *
 * i18n Phase 5: Spanish is the default locale and lives at unprefixed URLs;
 * English lives under `/en`. Each indexable page feeds the route (without the
 * `/en` prefix) to `localizedAlternates` and spreads the result into its
 * `generateMetadata().alternates`. Paths are relative and resolve against the
 * `metadataBase` set in `src/app/[locale]/layout.tsx`.
 */

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

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
 * set is identical across variants and pairs them. `x-default` points at the
 * Spanish (default-locale) URL.
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
      "x-default": es,
    },
  };
}

import type { MetadataRoute } from "next";

/**
 * sitemap.ts — locale-aware sitemap (i18n Phase 5).
 *
 * Emits both locale variants for every public, indexable route: Spanish at the
 * unprefixed URL and English under `/en`. Each entry advertises the alternate
 * via `alternates.languages` so search engines pair them. Auth-gated and
 * transactional routes (área personal, pago-exitoso, sesión, cancelar, admin,
 * auth) are intentionally excluded — they are not SEO targets.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://gustavoai.dev";
  const routes = ["", "/privacidad", "/terminos"];

  return routes.flatMap((route) => {
    const languages = { es: `${base}${route}`, en: `${base}/en${route}` };
    return [
      { url: `${base}${route}`, alternates: { languages } },
      { url: `${base}/en${route}`, alternates: { languages } },
    ];
  });
}

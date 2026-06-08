import type { MetadataRoute } from "next";

/**
 * robots.ts — crawl directives (i18n Phase 5).
 *
 * Public marketing/legal pages (and their `/en` variants) are crawlable; API,
 * admin, auth, and transactional/auth-gated routes are disallowed. The disallow
 * rules use bare path prefixes so they apply to both the default (unprefixed)
 * and the `/en`-prefixed locale (e.g. `/area-personal` and `/en/area-personal`).
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://gustavoai.dev";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin",
        "/auth/",
        "/area-personal",
        "/pago-exitoso",
        "/sesion-confirmada",
        "/sesion/",
        "/cancelar",
        "/en/admin",
        "/en/auth/",
        "/en/area-personal",
        "/en/pago-exitoso",
        "/en/sesion-confirmada",
        "/en/sesion/",
        "/en/cancelar",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}

import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { listCourses, listLessons } from "@/lib/courses/registry";
import { availableLocaleAlternates } from "@/lib/hreflang";

/**
 * sitemap.ts — locale-aware sitemap (i18n Phase 5 + COURSE-P6-01).
 *
 * Static marketing/legal routes exist in both locales: Spanish at the unprefixed
 * URL and English under `/en`. Each entry advertises the alternate via
 * `alternates.languages` so search engines pair them. Auth-gated and transactional
 * routes (área personal, pago-exitoso, sesión, cancelar, admin, auth) are excluded —
 * they are not SEO targets.
 *
 * SEO-05: for the static routes `x-default` points at the English URL — the intended
 * international fallback for searchers whose language matches neither es nor en. This
 * is a search-ranking signal only; it does not change what a live visitor with no
 * NEXT_LOCALE cookie sees (that stays Spanish, see src/middleware.ts).
 *
 * COURSE-P6-01: course routes are registry-driven — `/cursos`, each published course
 * landing, and each published lesson — emitted only for the locales where the content
 * actually exists. Courses are Spanish-only for months, so no `/en/cursos/...` URL is
 * advertised while it 404s; there `x-default` is the Spanish URL (its only variant).
 * Drafts and gated content never appear because `listCourses`/`listLessons` are
 * published-only.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://gustavoai.dev";

  // ─── Static marketing/legal routes — both locales always exist ──────────────
  const staticRoutes = ["", "/privacidad", "/terminos"];
  const staticEntries = staticRoutes.flatMap((route) => {
    const languages = {
      es: `${base}${route}`,
      en: `${base}/en${route}`,
      "x-default": `${base}/en${route}`,
    };
    return [
      { url: `${base}${route}`, alternates: { languages } },
      { url: `${base}/en${route}`, alternates: { languages } },
    ];
  });

  // ─── Course routes — registry-driven, published + locale-aware ──────────────
  // `availableLocaleAlternates` yields relative, locale-correct paths for the
  // locales the content exists in; course paths always start with "/cursos", so
  // prefixing `base` is enough to make them absolute.
  const absolute = (route: string, locale: string, available: readonly string[]) => {
    const { languages } = availableLocaleAlternates(route, locale, available);
    const abs: Record<string, string> = {};
    for (const [key, path] of Object.entries(languages)) abs[key] = `${base}${path}`;
    return abs;
  };

  const courseEntries: MetadataRoute.Sitemap = [];

  // The catalog `/cursos` is listed for every locale that has ≥1 published course.
  const catalogLocales = routing.locales.filter((l) => listCourses(l).length > 0);
  for (const locale of catalogLocales) {
    const languages = absolute("/cursos", locale, catalogLocales);
    courseEntries.push({ url: `${base}${localePrefix(locale)}/cursos`, alternates: { languages } });
  }

  for (const locale of routing.locales) {
    for (const course of listCourses(locale)) {
      const courseRoute = `/cursos/${course.slug}`;
      const courseLocales = routing.locales.filter((l) =>
        listCourses(l).some((c) => c.slug === course.slug),
      );
      courseEntries.push({
        url: `${base}${localePrefix(locale)}${courseRoute}`,
        alternates: { languages: absolute(courseRoute, locale, courseLocales) },
      });

      for (const lesson of listLessons(course.slug, locale)) {
        const lessonRoute = `${courseRoute}/${lesson.slug}`;
        const lessonLocales = routing.locales.filter((l) =>
          listLessons(course.slug, l).some((x) => x.slug === lesson.slug),
        );
        courseEntries.push({
          url: `${base}${localePrefix(locale)}${lessonRoute}`,
          alternates: { languages: absolute(lessonRoute, locale, lessonLocales) },
        });
      }
    }
  }

  return [...staticEntries, ...courseEntries];
}

/** URL prefix for a locale under the `as-needed` rule: default is unprefixed. */
function localePrefix(locale: string): string {
  return locale === routing.defaultLocale ? "" : `/${locale}`;
}

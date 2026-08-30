/*
 * COURSE-P9-01 — The course search index, served as a static build artifact.
 *
 * PRERENDERED, NOT SERVERLESS. `generateStaticParams` + `dynamic = "force-static"` make
 * `next build` write the body once per course × locale, exactly the way `robots.txt` and
 * `sitemap.xml` already appear in `.next/server/app/` as `.body` + `.meta` pairs. Verified
 * in `.next/prerender-manifest.json`: a prerendered route handler keeps the headers it
 * sets, which is what lets this ship `immutable`. So the feature costs zero serverless
 * invocations, which is the property the Pagefind note in docs/courses/PLAN.md was really
 * about — see docs/courses/phase-9-search/01-course-search.md for why not Pagefind itself.
 *
 * The request object is deliberately UNUSED. Touching it opts the route out of static
 * rendering, silently, and the first sign would be a lambda cold-starting in production.
 *
 * `dynamicParams = false` matters more than it looks: `next.config.mjs` has no
 * `outputFileTracingIncludes`, and Next cannot statically trace the `path.join(cwd(),
 * "content", "courses")` the registry does — so `content/` may simply not exist in a
 * lambda. Refusing unknown params keeps that path unreachable from here. The in-handler
 * 404 below is the belt to that braces.
 *
 * Caching: `immutable` is safe because the client appends `?v=<index.hash>`, a hash of the
 * content itself. New content → new URL → fresh fetch; unchanged content → the browser
 * keeps its copy across unrelated deploys. The CDN ignores the query on a fully-static
 * prerender and serves the current deployment's body, which is by definition the matching
 * one.
 */

import { getSearchIndex } from "@/lib/courses/search/build-index";
import { listCourseManifests } from "@/lib/courses/registry";
import { routing } from "@/i18n/routing";

export const dynamic = "force-static";
export const dynamicParams = false;
export const revalidate = false;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    // Manifests, not published courses: a course whose lessons are still drafts gets an
    // (empty) index rather than a 404 on a preview deploy, matching how the landing page
    // is deliberately reviewable before publication.
    listCourseManifests(locale).map((course) => ({ courseSlug: course.slug, locale })),
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ courseSlug: string; locale: string }> },
) {
  const { courseSlug, locale } = await params;
  const index = getSearchIndex(courseSlug, locale);

  if (index.lessons.length === 0) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  return new Response(JSON.stringify(index), {
    headers: {
      "content-type":  "application/json; charset=utf-8",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}

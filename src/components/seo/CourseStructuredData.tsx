/**
 * COURSE-P6-01: JSON-LD structured data for a course landing page (schema.org/Course).
 *
 * Server component — the <script> ships in the prerendered HTML so crawlers see it
 * without executing JS (JSON-LD is inert, no CSP concern). Mirrors the SEO-04 pattern
 * in ./StructuredData.tsx.
 *
 * Everything is sourced from the build-time content registry (the `Course` metadata),
 * never hand-maintained. The provider reuses the site's Person identity by `@id`
 * (`${BASE}/#person`), inlined here because the course page does not render the home
 * page's Person node.
 */

import { localeUrl } from "@/lib/hreflang";
import type { Course } from "@/domain/types";

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "https://gustavoai.dev";

export default function CourseStructuredData({
  course,
  locale,
}: {
  course: Course;
  locale: string;
}) {
  const url = localeUrl(`/cursos/${course.slug}`, locale);

  const json = {
    "@context": "https://schema.org",
    "@type": "Course",
    "@id": `${url}#course`,
    name: course.title,
    description: course.tagline,
    url,
    inLanguage: locale,
    educationalLevel: course.level,
    // ISO 8601 duration — estimatedHours is a whole number of hours.
    timeRequired: `PT${course.estimatedHours}H`,
    coursePrerequisites: course.prerequisites,
    isAccessibleForFree: true,
    provider: {
      "@type": "Person",
      "@id": `${BASE}/#person`,
      name: "Gustavo Torres",
      url: BASE,
    },
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: "online",
      courseWorkload: `PT${course.estimatedHours}H`,
      inLanguage: locale,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}

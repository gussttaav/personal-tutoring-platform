/**
 * COURSE-P6-01: JSON-LD structured data for a lesson page (schema.org/LearningResource).
 *
 * Server component — the <script> ships in the prerendered HTML (JSON-LD is inert, no CSP
 * concern). Mirrors the SEO-04 pattern in ./StructuredData.tsx.
 *
 * `isPartOf` links back to the course's `Course` node by the same `@id` that
 * CourseStructuredData emits on the landing page (`${courseUrl}#course`). All fields come
 * from the build-time registry (`Course` + `Lesson` metadata), never hand-maintained.
 */

import { localeUrl } from "@/lib/hreflang";
import type { Course, Lesson } from "@/domain/types";

export default function LessonStructuredData({
  course,
  lesson,
  locale,
}: {
  course: Course;
  lesson: Lesson;
  locale: string;
}) {
  const courseUrl = localeUrl(`/cursos/${course.slug}`, locale);
  const url = localeUrl(`/cursos/${course.slug}/${lesson.slug}`, locale);

  const json = {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name: lesson.title,
    description: lesson.summary,
    url,
    inLanguage: locale,
    learningResourceType: "lesson",
    // ISO 8601 duration — minutes is a whole number of minutes.
    timeRequired: `PT${lesson.minutes}M`,
    isAccessibleForFree: true,
    isPartOf: {
      "@type": "Course",
      "@id": `${courseUrl}#course`,
      name: course.title,
      url: courseUrl,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}

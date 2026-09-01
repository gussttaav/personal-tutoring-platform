// COURSE-P4-01: In-memory ICourseCatalog — the published-content half.
//
// Built from a plain `{ courseSlug: publishedLessonSlugs }` map, which is the
// whole point of injecting the catalog: a test sets the progress denominator in
// one line instead of writing a temp MDX tree and re-pointing the registry.
// Drafts are modelled by simply leaving the slug out of the list.
import type { ICourseCatalog } from "@/domain/repositories/ICourseCatalog";

export class FakeCourseCatalog implements ICourseCatalog {
  constructor(private readonly courses: Record<string, string[]>) {}

  courseExists(courseSlug: string): boolean {
    return courseSlug in this.courses;
  }

  listLessonSlugs(courseSlug: string): string[] {
    return this.courses[courseSlug] ?? [];
  }
}

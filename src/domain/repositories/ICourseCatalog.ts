/*
 * COURSE-P4-01 — the content port.
 *
 * `CourseService` needs exactly two facts from the course content: does this
 * course exist, and which lessons are published. Both come from the build-time
 * registry (src/lib/courses/registry.ts), which reads the filesystem — so it is
 * injected rather than imported, keeping the service free of I/O and letting its
 * tests set the progress denominator with three lines instead of a temp MDX tree.
 *
 * Sync on purpose: the registry is a memoized synchronous read, and inventing an
 * async boundary that does not exist would only add `await`s that never yield.
 *
 * Not an `I*Repository` despite living here — `IConfigCache` sets that precedent.
 */
export interface ICourseCatalog {
  /** True when the course has a manifest for the canonical locale. */
  courseExists(courseSlug: string): boolean;

  /** Published lessons only, in reading order. `[]` for an unknown course. */
  listLessonSlugs(courseSlug: string): string[];
}

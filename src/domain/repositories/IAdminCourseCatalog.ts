/*
 * ADMIN-USERS-01 — the published-course port for the admin panel's course views.
 *
 * `AdminService` needs, per course, its title, its blocks and its published lessons (slug,
 * title, block) in reading order, and whether the course is fully written. All of it comes
 * from the build-time course registry (a memoized synchronous filesystem read), so — like
 * `ICourseCatalog` and `ICourseAnnouncementCatalog` — it is injected rather than imported,
 * and the service's tests declare a catalog in a few lines. Sync on purpose, same reasoning.
 *
 * The lessons are the CANONICAL locale's published spine, the same denominator
 * `CourseService` uses (`registryCourseCatalog`), so the admin's percentages match the
 * reader's.
 */

export interface AdminCatalogLesson {
  slug:  string;
  title: string;
  block: number;
}

export interface AdminCatalogCourse {
  slug:    string;
  title:   string;
  /** Every manifest block, in manifest order. */
  blocks:  { id: number; title: string }[];
  /** Published lessons only, in reading order. */
  lessons: AdminCatalogLesson[];
  /** COURSE-BUILD-01: no block is upcoming or partial. */
  complete: boolean;
}

export interface IAdminCourseCatalog {
  /** Published courses (at least one published lesson), in manifest scan order. */
  listCourses(): AdminCatalogCourse[];
  /** `null` for an unknown slug or a course with no published lesson. */
  getCourse(courseSlug: string): AdminCatalogCourse | null;
}

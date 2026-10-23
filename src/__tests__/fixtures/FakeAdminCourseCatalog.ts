// ADMIN-USERS-01: In-memory IAdminCourseCatalog — the published-course half of the admin
// course views, declared in a few lines instead of a temp MDX tree.
//
// Each course lists its published lessons as `{ slug, block }` (titles default to
// "Lección <slug>") and optionally its blocks (default: one per block id the lessons use,
// titled "Bloque <id>"). `complete` defaults to true.
import type { AdminCatalogCourse, IAdminCourseCatalog } from "@/domain/repositories/IAdminCourseCatalog";

export interface FakeCourseSpec {
  slug:      string;
  title?:    string;
  lessons:   { slug: string; block?: number; title?: string }[];
  blocks?:   { id: number; title: string }[];
  complete?: boolean;
}

export class FakeAdminCourseCatalog implements IAdminCourseCatalog {
  private readonly courses: AdminCatalogCourse[];

  constructor(specs: FakeCourseSpec[]) {
    this.courses = specs.map((spec) => {
      const lessons = spec.lessons.map((l) => ({
        slug:  l.slug,
        title: l.title ?? `Lección ${l.slug}`,
        block: l.block ?? 1,
      }));
      const blockIds = [...new Set(lessons.map((l) => l.block))];
      return {
        slug:     spec.slug,
        title:    spec.title ?? `Curso ${spec.slug}`,
        blocks:   spec.blocks ?? blockIds.map((id) => ({ id, title: `Bloque ${id}` })),
        lessons,
        complete: spec.complete ?? true,
      };
    });
  }

  listCourses(): AdminCatalogCourse[] {
    return this.courses;
  }

  getCourse(courseSlug: string): AdminCatalogCourse | null {
    return this.courses.find((c) => c.slug === courseSlug) ?? null;
  }
}

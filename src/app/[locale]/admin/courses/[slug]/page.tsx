/**
 * ADMIN-USERS-01: /admin/courses/<slug> — one course's readers and how far they get.
 * SEC-07: gated before its own data fetch — see students/page.tsx sibling note.
 *
 * Two parts: the readers (CourseReadersTable: status tabs, progress, last lesson, latest
 * activity first) and «Avance por lección», the funnel — for every published lesson in
 * reading order, how many readers opened it and how many completed it, against everyone
 * enrolled. 404 for a course that is not published.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { AdminCourseReadersQuerySchema } from "@/lib/schemas";
import { adminService, scheduleService } from "@/services";
import { COURSE_ACTIVE_DAYS, COURSE_READERS_PAGE_SIZE } from "@/services/AdminService";
import { PageHeader, Card, Empty } from "@/components/admin/ui";
import { CourseReadersTable } from "@/components/admin/CourseReadersTable";
import { plural } from "@/components/admin/format";

interface CourseReadersPageProps {
  params:       Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** A bar's share of everyone enrolled, 0–100. */
const share = (n: number, of: number): number => (of > 0 ? Math.round((n / of) * 100) : 0);

export default async function CourseReadersPage({ params, searchParams }: CourseReadersPageProps) {
  if (!isAdmin(await auth())) redirect("/");

  const { slug } = await params;
  const { status, page } = AdminCourseReadersQuerySchema.parse(await searchParams);

  const [readers, blocks, schedule] = await Promise.all([
    adminService.getCourseReaders(slug, { status, page, pageSize: COURSE_READERS_PAGE_SIZE }),
    adminService.getCourseLessonStats(slug),
    scheduleService.getConfig(),
  ]);
  if (!readers || !blocks) notFound();

  const { course, rows } = readers;
  const enrolled = course.counts.all;

  return (
    <div className="page-stack">
      <Link href="/admin/courses" className="back-link">
        <span className="material-symbols-outlined">arrow_back</span>
        Cursos
      </Link>

      <PageHeader
        overline={course.complete ? "Curso" : "Curso · en construcción"}
        title={course.title}
        subtitle={`${plural(course.totalLessons, "lección publicada", "lecciones publicadas")} · progreso medio ${course.avgPercent}% · «sin actividad»: ${COURSE_ACTIVE_DAYS} días sin abrir una lección`}
      />

      <CourseReadersTable
        course={course}
        rows={rows}
        status={status}
        page={page}
        pageSize={COURSE_READERS_PAGE_SIZE}
        activeDays={COURSE_ACTIVE_DAYS}
        timeZone={schedule.timezone}
      />

      <Card
        title="Avance por lección"
        action={<span className="card-meta">Sobre {plural(enrolled, "inscrito", "inscritos")}</span>}
      >
        {enrolled === 0 ? (
          <Empty icon="school" label="Sin lectores todavía." />
        ) : (
          <div className="funnel">
            <p className="funnel-legend">
              <span className="funnel-key is-done" aria-hidden="true" /> la terminaron
              <span className="funnel-key is-started" aria-hidden="true" /> la abrieron
            </p>
            {blocks.map((block) => (
              <section key={block.id} className="funnel-block" aria-label={`Bloque ${block.id}`}>
                <h3 className="funnel-block-title">
                  Bloque {block.id} · {block.title}
                </h3>
                <ol className="funnel-list">
                  {block.lessons.map((l) => (
                    <li key={l.slug} className="funnel-row">
                      <span className="funnel-lesson" title={l.title}>{l.title}</span>
                      <span
                        className="funnel-bar"
                        role="img"
                        aria-label={`${l.completed} la terminaron y ${l.started} la abrieron, de ${enrolled}`}
                      >
                        <span className="funnel-bar-started" style={{ width: `${share(l.started, enrolled)}%` }} />
                        <span className="funnel-bar-done" style={{ width: `${share(l.completed, enrolled)}%` }} />
                      </span>
                      <span className="funnel-nums" title={`${l.completed} la terminaron · ${l.started} la abrieron`}>
                        {l.completed} · {l.started}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

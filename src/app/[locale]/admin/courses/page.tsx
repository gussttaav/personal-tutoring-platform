/**
 * ADMIN-USERS-01: /admin/courses — who reads each published course and how far they got.
 * SEC-07: gated before its own data fetch — see students/page.tsx sibling note.
 *
 * One card per course with its reader counts by status (migration 0027: en curso /
 * terminado / sin actividad, a 30-day window) and the average progress against the
 * published lessons. A course still being written (COURSE-BUILD-01) says «al día» where a
 * finished one says «terminados». Each card opens /admin/courses/<slug>.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { adminService } from "@/services";
import { COURSE_ACTIVE_DAYS } from "@/services/AdminService";
import { PageHeader, Card, Empty } from "@/components/admin/ui";
import { plural } from "@/components/admin/format";

export default async function CoursesPage() {
  if (!isAdmin(await auth())) redirect("/");

  const courses = await adminService.listCourses();

  return (
    <div className="page-stack">
      <PageHeader
        overline="Contenido"
        title="Cursos"
        subtitle={`Quién lee cada curso y hasta dónde ha llegado. «Sin actividad»: ${COURSE_ACTIVE_DAYS} días sin abrir una lección.`}
      />

      {courses.length === 0 ? (
        <Card>
          <Empty icon="school" label="No hay cursos publicados." />
        </Card>
      ) : (
        <div className="course-grid">
          {courses.map((c) => (
            <Link key={c.slug} href={`/admin/courses/${c.slug}`} className="card course-card">
              <div className="course-card-head">
                <h2 className="course-card-title">{c.title}</h2>
                <span className="material-symbols-outlined chevron" aria-hidden="true">chevron_right</span>
              </div>
              <div className="chip-row">
                <span className="chip">{plural(c.totalLessons, "lección publicada", "lecciones publicadas")}</span>
                {!c.complete && <span className="chip">En construcción</span>}
              </div>
              <dl className="course-card-stats">
                <div>
                  <dt>Inscritos</dt>
                  <dd>{c.counts.all}</dd>
                </div>
                <div>
                  <dt>En curso</dt>
                  <dd>{c.counts.active}</dd>
                </div>
                <div>
                  <dt>{c.complete ? "Terminados" : "Al día"}</dt>
                  <dd>{c.counts.finished}</dd>
                </div>
                <div>
                  <dt>Sin actividad</dt>
                  <dd>{c.counts.inactive}</dd>
                </div>
              </dl>
              <div className="course-card-progress">
                <span className="cell-meta">Progreso medio</span>
                <div className="credit-bar">
                  <div className="credit-bar-track">
                    <div className="credit-bar-fill" style={{ width: `${c.avgPercent}%` }} />
                  </div>
                  <span className="credit-bar-label">{c.avgPercent}%</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

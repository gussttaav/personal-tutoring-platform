/**
 * ADMIN-USERS-01: the readers of one course at /admin/courses/<slug> — status tabs, the
 * table and pagination. URL-driven like UsersTable: the tabs set ?status=, pages are ?page=.
 *
 * The statuses partition the readers (migration 0027): en curso (activity in the last 30
 * days), terminado (every published lesson completed; «al día» while the course is still
 * being written) and sin actividad. Latest activity first. A row opens the user's page.
 * ADMIN-02 phone layout; ADMIN-03 dates in `timeZone`.
 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdminCourseReader, AdminCourseSummary, CourseReaderFilter } from "@/domain/types";
import { Card, Empty, StatusBadge } from "@/components/admin/ui";
import { courseStatusKey, fmtDate, fmtShort, initials } from "@/components/admin/format";

function readersHref(slug: string, { status, page }: { status?: CourseReaderFilter; page?: number }): string {
  const params = new URLSearchParams();
  if (status && status !== "all") params.set("status", status);
  if (page && page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/admin/courses/${slug}?${qs}` : `/admin/courses/${slug}`;
}

export function CourseReadersTable({
  course,
  rows,
  status,
  page,
  pageSize,
  activeDays,
  timeZone,
}: {
  course:     AdminCourseSummary;
  rows:       AdminCourseReader[];
  status:     CourseReaderFilter;
  page:       number;
  pageSize:   number;
  /** COURSE_ACTIVE_DAYS, for the empty-tab copy. */
  activeDays: number;
  timeZone:   string;
}) {
  const router = useRouter();

  const tabs: { status: CourseReaderFilter; label: string; empty: string }[] = [
    { status: "all",      label: "Todos",         empty: "Nadie se ha inscrito todavía." },
    { status: "active",   label: "En curso",      empty: `Nadie ha tenido actividad en los últimos ${activeDays} días.` },
    course.complete
      ? { status: "finished", label: "Terminados", empty: "Nadie lo ha terminado todavía." }
      : { status: "finished", label: "Al día",     empty: "Nadie está al día todavía." },
    { status: "inactive", label: "Sin actividad", empty: `Nadie lleva más de ${activeDays} días sin actividad.` },
  ];
  const tab = tabs.find((t) => t.status === status) ?? tabs[0];

  const count     = course.counts[status];
  const pageCount = Math.max(1, Math.ceil(count / pageSize));

  return (
    <>
      <nav className="filter-tabs filter-tabs-row" aria-label="Filtrar lectores">
        {tabs.map((t) => (
          <Link
            key={t.status}
            href={readersHref(course.slug, { status: t.status })}
            className={`filter-tab ${t.status === status ? "is-active" : ""}`}
            aria-current={t.status === status ? "page" : undefined}
          >
            {t.label}
            <span className="filter-tab-count">{course.counts[t.status]}</span>
          </Link>
        ))}
      </nav>

      <Card padding={false}>
        {rows.length === 0 ? (
          <div className="card-body">
            <Empty icon="school" label={tab.empty} />
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Progreso</th>
                <th>Última lección</th>
                <th>Última actividad</th>
                <th>Inscrito</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.email}
                  onClick={() => router.push(`/admin/students/${encodeURIComponent(r.email)}`)}
                >
                  <td className="c-main">
                    <div className="cell-row">
                      <div className="lc-avatar lc-avatar-sm">{initials(r.name)}</div>
                      <div className="cell-stack">
                        <span className="cell-strong">{r.name}</span>
                        <span className="cell-meta">{r.email}</span>
                      </div>
                    </div>
                  </td>
                  <td data-label="Progreso">
                    <div className="credit-bar">
                      <div className="credit-bar-track">
                        <div className="credit-bar-fill" style={{ width: `${r.percent}%` }} />
                      </div>
                      <span className="credit-bar-label">
                        {r.completedLessons}/{course.totalLessons}
                      </span>
                    </div>
                  </td>
                  <td className="muted" data-label="Última lección">{r.lastLessonTitle ?? "—"}</td>
                  <td className="muted" data-label="Última actividad">{fmtShort(r.lastActivityAt, timeZone)}</td>
                  <td className="muted" data-label="Inscrito">{fmtDate(r.enrolledAt, timeZone)}</td>
                  <td className="c-side">
                    <StatusBadge kind="course" status={courseStatusKey(r.status, course.complete)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {(pageCount > 1 || page > 1) && (
        <nav className="pager" aria-label="Paginación">
          {page > 1 ? (
            <Link
              className="btn-ghost-sm"
              href={readersHref(course.slug, { status, page: Math.min(page - 1, pageCount) })}
            >
              ← Anterior
            </Link>
          ) : (
            <button type="button" className="btn-ghost-sm" disabled>← Anterior</button>
          )}
          <span className="pager-status">Página {page} de {pageCount}</span>
          {page < pageCount ? (
            <Link className="btn-ghost-sm" href={readersHref(course.slug, { status, page: page + 1 })}>
              Siguiente →
            </Link>
          ) : (
            <button type="button" className="btn-ghost-sm" disabled>Siguiente →</button>
          )}
        </nav>
      )}
    </>
  );
}

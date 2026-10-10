/**
 * ADMIN-01: Students list — search + filter tabs + pagination.
 *
 * REFACTOR-R4-P3-02: URL-driven. The search box is a GET form (?q=), the tabs keep
 * ?filter=, and pages are ?page=; the server runs all three (admin_list_students,
 * migration 0024). This used to filter in the browser over the first 100 users by
 * email, so a student past #100 could not be found at all. Both tab counts come from
 * the query and cover the current search.
 * ADMIN-02: cells are marked for the phone layout (one card per student).
 */
"use client";

import Form from "next/form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { StudentSummary } from "@/domain/types";
import { PageHeader, Card, Empty } from "@/components/admin/ui";
import { fmtDate, fmtShort, initials } from "@/components/admin/format";

const LOW_CREDIT = "low-credit";

function studentsHref({ q, filter, page }: { q?: string; filter?: string; page?: number }): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (filter) params.set("filter", filter);
  if (page && page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/admin/students?${qs}` : "/admin/students";
}

export function StudentsTable({
  rows,
  total,
  lowCreditTotal,
  page,
  pageSize,
  filter,
  query,
}: {
  rows:           StudentSummary[];
  total:          number;
  lowCreditTotal: number;
  page:           number;
  pageSize:       number;
  filter?:        string;
  query:          string;
}) {
  const router = useRouter();
  const lowCredit = filter === LOW_CREDIT;
  const tabFilter = lowCredit ? LOW_CREDIT : undefined;

  const count     = lowCredit ? lowCreditTotal : total;
  const pageCount = Math.max(1, Math.ceil(count / pageSize));
  const first     = (page - 1) * pageSize + 1;
  const last      = (page - 1) * pageSize + rows.length;
  const shown     = rows.length === 0 ? "0" : `${first}–${last}`;

  return (
    <div className="page-stack">
      <PageHeader
        overline="Operaciones"
        title="Alumnos"
        subtitle={`Mostrando ${shown} de ${count} ${lowCredit ? "con ≤1 crédito" : "alumnos"}`}
        right={
          <div className="filter-tabs">
            <Link
              href={studentsHref({ q: query })}
              className={`filter-tab ${!lowCredit ? "is-active" : ""}`}
            >
              Todos
              <span className="filter-tab-count">{total}</span>
            </Link>
            <Link
              href={studentsHref({ q: query, filter: LOW_CREDIT })}
              className={`filter-tab ${lowCredit ? "is-active is-alert" : ""}`}
            >
              Pocos créditos
              <span className="filter-tab-count">{lowCreditTotal}</span>
            </Link>
          </div>
        }
      />

      <div className="toolbar">
        {/* A new search starts at page 1 and keeps the open tab. */}
        <Form action="/admin/students" className="search">
          <span className="material-symbols-outlined">search</span>
          <input
            key={query}
            type="text"
            name="q"
            placeholder="Buscar por email o nombre…"
            defaultValue={query}
          />
          {tabFilter && <input type="hidden" name="filter" value={tabFilter} />}
          {query && (
            <Link className="search-clear" href={studentsHref({ filter: tabFilter })} aria-label="Limpiar">
              ×
            </Link>
          )}
        </Form>
      </div>

      <Card padding={false}>
        {rows.length === 0 ? (
          <div className="card-body">
            <Empty label="No hay alumnos que coincidan." />
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Alumno</th>
                <th className="cell-right">Créditos</th>
                <th>Caduca</th>
                <th>Próxima sesión</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr
                  key={s.email}
                  onClick={() => router.push(`/admin/students/${encodeURIComponent(s.email)}`)}
                >
                  <td className="c-main">
                    <div className="cell-row">
                      <div className="lc-avatar lc-avatar-sm">{initials(s.name)}</div>
                      <div className="cell-stack">
                        <span className="cell-strong">{s.name}</span>
                        <span className="cell-meta">{s.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="cell-right c-side">
                    <div
                      className={`credits-pill ${s.totalCredits <= 1 ? "is-low" : ""} ${
                        s.totalCredits === 0 ? "is-zero" : ""
                      }`}
                    >
                      <span className="credits-num">{s.totalCredits}</span>
                      <span className="credits-label">cr.</span>
                    </div>
                  </td>
                  <td className="muted" data-label="Caduca">{s.earliestExpiry ? fmtDate(s.earliestExpiry) : "—"}</td>
                  <td className="muted" data-label="Próxima sesión">{s.nextSession ? fmtShort(s.nextSession) : "—"}</td>
                  <td className="cell-right c-chev">
                    <span className="material-symbols-outlined chevron">chevron_right</span>
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
              href={studentsHref({ q: query, filter: tabFilter, page: Math.min(page - 1, pageCount) })}
            >
              ← Anterior
            </Link>
          ) : (
            <button type="button" className="btn-ghost-sm" disabled>← Anterior</button>
          )}
          <span className="pager-status">Página {page} de {pageCount}</span>
          {page < pageCount ? (
            <Link className="btn-ghost-sm" href={studentsHref({ q: query, filter: tabFilter, page: page + 1 })}>
              Siguiente →
            </Link>
          ) : (
            <button type="button" className="btn-ghost-sm" disabled>Siguiente →</button>
          )}
        </nav>
      )}
    </div>
  );
}

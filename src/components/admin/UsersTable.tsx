/**
 * ADMIN-USERS-01: the «Usuarios» list at /admin/students — search + tabs + pagination.
 * Replaces StudentsTable (ADMIN-01, REFACTOR-R4-P3-02), which listed students only and
 * had a "Pocos créditos" tab.
 *
 * Every account but the admin's: an account now exists to book classes, to keep course
 * progress or to get blog/course emails, in any mix. One tab per relationship (definitions
 * and sort orders in migration 0027), each with its count over the current search. The
 * columns are the same on every tab, so a row reads the same wherever it is found.
 *
 * URL-driven, as before: the search box is a GET form (?q=), the tabs set ?filter=, pages
 * are ?page=. ADMIN-02: cells are marked for the phone layout (one card per user).
 * ADMIN-03: dates in `timeZone` (the tutor's ScheduleConfig.timezone, passed by the page).
 */
"use client";

import Form from "next/form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdminUserCounts, AdminUserSegment, AdminUserSummary } from "@/domain/types";
import { PageHeader, Card, Empty } from "@/components/admin/ui";
import {
  BLOG_AREA_LABEL,
  fmtDate,
  fmtDayMonth,
  fmtDayTime,
  initials,
  plural,
  shortCourseTitle,
} from "@/components/admin/format";

interface Tab {
  segment: AdminUserSegment;
  label:   string;
  /** "Mostrando 1–3 de 3 {noun}" */
  noun:    string;
  empty:   string;
}

const TABS: Tab[] = [
  { segment: "all",        label: "Todos",           noun: "usuarios",                   empty: "No hay usuarios que coincidan." },
  { segment: "credits",    label: "Con créditos",    noun: "con créditos sin reservar",  empty: "Nadie tiene créditos sin reservar." },
  { segment: "upcoming",   label: "Clases próximas", noun: "con clases próximas",        empty: "Nadie tiene clases próximas." },
  { segment: "booked",     label: "Han reservado",   noun: "que han reservado",          empty: "Nadie ha reservado todavía." },
  { segment: "courses",    label: "En cursos",       noun: "inscritos en algún curso",   empty: "Nadie se ha inscrito en un curso." },
  { segment: "subscribed", label: "Suscritos",       noun: "suscritos a avisos",         empty: "Nadie está suscrito a los avisos." },
];

function usersHref({ q, segment, page }: { q?: string; segment?: AdminUserSegment; page?: number }): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (segment && segment !== "all") params.set("filter", segment);
  if (page && page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/admin/students?${qs}` : "/admin/students";
}

function MentoringCell({ user, timeZone }: { user: AdminUserSummary; timeZone: string }) {
  const { unbookedCredits, earliestExpiry, nextSession, bookingsCount } = user;
  if (unbookedCredits === 0 && !nextSession && bookingsCount === 0) {
    return <span className="muted">—</span>;
  }
  return (
    <div className="cell-stack user-cell-lines">
      {unbookedCredits > 0 && (
        <span className="user-credits">
          <span className="credits-pill">
            <span className="credits-num">{unbookedCredits}</span>
            <span className="credits-label">cr.</span>
          </span>
          {earliestExpiry && <span className="cell-meta">caduca el {fmtDayMonth(earliestExpiry, timeZone)}</span>}
        </span>
      )}
      {nextSession && (
        <span className="cell-meta">
          Próxima: <span className="nowrap">{fmtDayTime(nextSession, timeZone)}</span>
        </span>
      )}
      {bookingsCount > 0 && <span className="cell-meta">{plural(bookingsCount, "reserva", "reservas")}</span>}
    </div>
  );
}

function CoursesCell({ user }: { user: AdminUserSummary }) {
  if (user.courses.length === 0) return <span className="muted">—</span>;
  return (
    <div className="cell-stack user-cell-lines">
      {user.courses.map((c) => (
        <span
          key={c.slug}
          className="course-mini"
          title={`${c.title}: ${c.completedLessons} de ${c.totalLessons} lecciones`}
        >
          <span className="course-mini-title">{shortCourseTitle(c.title)}</span>
          <span className="credit-bar-track" aria-hidden="true">
            <span className="credit-bar-fill" style={{ width: `${c.percent}%` }} />
          </span>
          <span className="course-mini-pct">{c.percent}%</span>
        </span>
      ))}
    </div>
  );
}

function SubscriptionsCell({ user }: { user: AdminUserSummary }) {
  if (user.subscriptions.length === 0) return <span className="muted">—</span>;
  return (
    <div className="chip-row">
      {user.subscriptions.map((s) => {
        if (s.type === "courses") return <span key={s.type} className="chip">Cursos</span>;
        const areas = s.areas?.map((a) => BLOG_AREA_LABEL[a]).join(" · ");
        return (
          <span key={s.type} className="chip" title={areas ? `Blog: ${areas}` : "Blog: todas las áreas"}>
            {s.areas ? `Blog · ${plural(s.areas.length, "área", "áreas")}` : "Blog"}
          </span>
        );
      })}
    </div>
  );
}

export function UsersTable({
  rows,
  counts,
  segment,
  page,
  pageSize,
  query,
  timeZone,
}: {
  rows:     AdminUserSummary[];
  counts:   AdminUserCounts;
  segment:  AdminUserSegment;
  page:     number;
  pageSize: number;
  query:    string;
  timeZone: string;
}) {
  const router = useRouter();
  const tab    = TABS.find((t) => t.segment === segment) ?? TABS[0];

  const count     = counts[segment];
  const pageCount = Math.max(1, Math.ceil(count / pageSize));
  const first     = (page - 1) * pageSize + 1;
  const last      = (page - 1) * pageSize + rows.length;
  const shown     = rows.length === 0 ? "0" : `${first}–${last}`;

  return (
    <div className="page-stack">
      <PageHeader
        overline="Operaciones"
        title="Usuarios"
        subtitle={`Mostrando ${shown} de ${count} ${tab.noun}`}
      />

      <nav className="filter-tabs filter-tabs-row" aria-label="Filtrar usuarios">
        {TABS.map((t) => (
          <Link
            key={t.segment}
            href={usersHref({ q: query, segment: t.segment })}
            className={`filter-tab ${t.segment === segment ? "is-active" : ""}`}
            aria-current={t.segment === segment ? "page" : undefined}
          >
            {t.label}
            <span className="filter-tab-count">{counts[t.segment]}</span>
          </Link>
        ))}
      </nav>

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
          {segment !== "all" && <input type="hidden" name="filter" value={segment} />}
          {query && (
            <Link className="search-clear" href={usersHref({ segment })} aria-label="Limpiar">
              ×
            </Link>
          )}
        </Form>
      </div>

      <Card padding={false}>
        {rows.length === 0 ? (
          <div className="card-body">
            <Empty label={query ? "No hay usuarios que coincidan." : tab.empty} />
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Mentoría</th>
                <th>Cursos</th>
                <th>Avisos</th>
                <th>Alta</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr
                  key={u.email}
                  onClick={() => router.push(`/admin/students/${encodeURIComponent(u.email)}`)}
                >
                  <td className="c-main">
                    <div className="cell-row">
                      <div className="lc-avatar lc-avatar-sm">{initials(u.name)}</div>
                      <div className="cell-stack">
                        <span className="cell-strong">{u.name}</span>
                        <span className="cell-meta">{u.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="c-block" data-label="Mentoría"><MentoringCell user={u} timeZone={timeZone} /></td>
                  <td className="c-block" data-label="Cursos"><CoursesCell user={u} /></td>
                  <td data-label="Avisos"><SubscriptionsCell user={u} /></td>
                  <td className="muted" data-label="Alta">{fmtDate(u.createdAt, timeZone)}</td>
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
              href={usersHref({ q: query, segment, page: Math.min(page - 1, pageCount) })}
            >
              ← Anterior
            </Link>
          ) : (
            <button type="button" className="btn-ghost-sm" disabled>← Anterior</button>
          )}
          <span className="pager-status">Página {page} de {pageCount}</span>
          {page < pageCount ? (
            <Link className="btn-ghost-sm" href={usersHref({ q: query, segment, page: page + 1 })}>
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

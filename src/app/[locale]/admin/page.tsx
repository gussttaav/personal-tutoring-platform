/**
 * ADMIN-01: Admin dashboard — operational summary.
 * SEC-07: gated before its own data fetch — see students/page.tsx sibling note.
 * REFACTOR-R4-P3-02: reads through adminService. "Alumnos pocos créditos" now counts
 * students (a booking or a credit pack) with <= 1 active credit, not every user
 * without a healthy balance: course readers who never bought anything used to count.
 * ADMIN-02: redesigned. KPI tiles carry a footnote; the next session gets a spotlight
 * (countdown, join link, student file); the upcoming sessions are an agenda grouped by
 * day instead of a table; low credit is amber so red only ever means a failed booking;
 * the header pill says whether anything needs attention. Dates are formatted in the
 * tutor's timezone (ScheduleConfig.timezone), not the server's UTC, so "Hoy" is today
 * where the classes happen.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { adminService, paymentService, scheduleService } from "@/services";
import type { AdminBookingRow } from "@/domain/types";
import { PageHeader, StatCard, Card, StatusBadge, Empty } from "@/components/admin/ui";
import {
  agendaDay,
  dayKey,
  durationMinutes,
  fmtDayMonth,
  fmtDayShort,
  fmtDayTime,
  fmtEuros,
  fmtLongDate,
  fmtTime,
  initials,
  relativeTime,
  sessionTypeLabel,
  sessionTypeTone,
} from "@/components/admin/format";

const AGENDA_SIZE = 5;

const studentHref = (email: string) => `/admin/students/${encodeURIComponent(email)}`;

export default async function AdminDashboard() {
  if (!isAdmin(await auth())) redirect("/");

  const [counts, revenueCents, bookings, lowCreditStudents, failed, schedule] =
    await Promise.all([
      adminService.dashboardCounts(),
      adminService.revenueLast30Days(),
      adminService.listAllBookings(),
      adminService.listStudents({ lowCredit: true, page: 1, pageSize: 4 }),
      paymentService.listFailedBookings(),
      scheduleService.getConfig(),
    ]);
  const {
    upcomingBookings:  upcomingCount,
    lowCreditStudents: lowCreditCount,
    failedBookings:    failedCount,
  } = counts;
  const tz = schedule.timezone;

  // eslint-disable-next-line react-hooks/purity -- Server Component: renders once per request, never re-renders on the client.
  const now = Date.now();
  const upcoming = bookings
    .filter((b) => b.status === "confirmed" && new Date(b.starts_at).getTime() > now)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .slice(0, AGENDA_SIZE);
  const next = upcoming[0];

  // The agenda, grouped by calendar day in the tutor's timezone.
  const days: { key: string; name: string; date: string; rows: AdminBookingRow[] }[] = [];
  for (const b of upcoming) {
    const key = dayKey(b.starts_at, tz);
    const last = days[days.length - 1];
    if (last?.key === key) last.rows.push(b);
    else days.push({ key, ...agendaDay(b.starts_at, now, tz), rows: [b] });
  }

  /** "hoy, 18:00" / "mañana, 10:00" / "lun 12 oct, 16:00" */
  const whenShort = (iso: string): string => {
    const { name } = agendaDay(iso, now, tz);
    const day = name === "Hoy" || name === "Mañana" ? name.toLowerCase() : fmtDayShort(iso, tz);
    return `${day}, ${fmtTime(iso, tz)}`;
  };

  // "1240,00 €" → a large "1240" and a smaller ",00 €".
  const revenue = fmtEuros(revenueCents);
  const decimalAt = revenue.lastIndexOf(",");
  const revenueValue =
    decimalAt === -1 ? revenue : (
      <>
        {revenue.slice(0, decimalAt)}
        <span className="kpi-value-minor">{revenue.slice(decimalAt)}</span>
      </>
    );

  const lowCredit = lowCreditStudents.rows;

  return (
    <div className="page-stack">
      <PageHeader
        overline={fmtLongDate(now, tz)}
        title="Resumen operativo"
        subtitle="Lo que pide atención hoy y lo que viene en tu agenda."
        right={
          failedCount > 0 ? (
            <Link href="/admin/failed-bookings" className="status-pill is-alert">
              <span className="status-pulse" aria-hidden="true" />
              {failedCount === 1
                ? "1 reserva fallida por revisar"
                : `${failedCount} reservas fallidas por revisar`}
              <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
            </Link>
          ) : (
            <span className="status-pill is-ok">
              <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
              Todo en orden
            </span>
          )
        }
      />

      <div className="kpi-grid">
        <StatCard
          label="Sesiones próximas"
          value={upcomingCount}
          icon="event_available"
          href="/admin/bookings"
          foot={next ? `Siguiente: ${whenShort(next.starts_at)}` : "Sin sesiones en agenda"}
        />
        <StatCard
          label="Ingresos · 30 días"
          value={revenueValue}
          icon="payments"
          href="/admin/payments"
          foot="Ver pagos"
          tone="green"
        />
        <StatCard
          label="Pocos créditos"
          value={lowCreditCount}
          icon="warning"
          href="/admin/students?filter=low-credit"
          foot="Alumnos con ≤ 1 crédito"
          tone={lowCreditCount > 0 ? "amber" : "neutral"}
        />
        <StatCard
          label="Reservas fallidas"
          value={failedCount}
          icon="report"
          href="/admin/failed-bookings"
          foot={failedCount > 0 ? "Pago cobrado sin clase" : "Nada pendiente"}
          tone={failedCount > 0 ? "red" : "neutral"}
        />
      </div>

      <div className="two-col">
        {next ? (
          <section className="card next-session" aria-label="Próxima sesión">
            <div className="next-session-top">
              <span className="overline">Próxima sesión</span>
              <span className="next-session-countdown">
                <span className="next-session-live" aria-hidden="true" />
                Empieza {relativeTime(next.starts_at)}
              </span>
            </div>
            <div className="next-session-main">
              <div className="next-session-when">
                <span className="next-session-day">
                  {agendaDay(next.starts_at, now, tz).name} · {fmtDayShort(next.starts_at, tz)}
                </span>
                <span className="next-session-time">{fmtTime(next.starts_at, tz)}</span>
                <span className="next-session-range">
                  hasta las {fmtTime(next.ends_at, tz)} · {durationMinutes(next.starts_at, next.ends_at)} min
                </span>
              </div>
              <div className="next-session-who">
                <div className="next-session-avatar" aria-hidden="true">{initials(next.name)}</div>
                <div className="next-session-meta">
                  <span className="next-session-name">{next.name}</span>
                  <span className="next-session-email">{next.email}</span>
                  <div className="next-session-tags">
                    <span className={`type-pill ${sessionTypeTone(next.session_type)}`}>
                      {sessionTypeLabel(next.session_type)}
                    </span>
                    <StatusBadge status={next.status} />
                  </div>
                </div>
              </div>
            </div>
            <div className="next-session-actions">
              {next.join_token && (
                <a href={`/sesion/${next.join_token}`} className="btn-primary">
                  <span className="material-symbols-outlined" aria-hidden="true">videocam</span>
                  Unirse a la sesión
                </a>
              )}
              <Link href={studentHref(next.email)} className="btn-ghost">
                <span className="material-symbols-outlined" aria-hidden="true">person</span>
                Ficha del alumno
              </Link>
            </div>
          </section>
        ) : (
          <Card title="Próxima sesión">
            <Empty icon="event_busy" label="Sin sesiones próximas." />
          </Card>
        )}

        <Card
          title="Pocos créditos"
          count={lowCreditCount}
          action={
            <Link href="/admin/students?filter=low-credit" className="link-emerald">
              Ver todos
              <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
            </Link>
          }
          padding={false}
        >
          {lowCredit.length === 0 ? (
            <Empty icon="check_circle" tone="good" label="Todos con créditos suficientes." />
          ) : (
            <ul className="lc-list">
              {lowCredit.map((s) => (
                <li key={s.email}>
                  <Link href={studentHref(s.email)} className="lc-row">
                    <span className="lc-avatar" aria-hidden="true">{initials(s.name)}</span>
                    <span className="person-meta">
                      <span className="person-name">{s.name}</span>
                      <span className="person-sub">
                        {s.totalCredits > 0 && s.earliestExpiry
                          ? `Caduca el ${fmtDayMonth(s.earliestExpiry, tz)}`
                          : "Sin créditos activos"}
                      </span>
                    </span>
                    <span className={`lc-credits ${s.totalCredits === 0 ? "is-zero" : ""}`}>
                      <span className="lc-credits-num">{s.totalCredits}</span>
                      <span className="lc-credits-label">
                        {s.totalCredits === 1 ? "crédito" : "créditos"}
                      </span>
                    </span>
                    <span className="material-symbols-outlined chevron" aria-hidden="true">chevron_right</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card
        title="Agenda"
        count={upcomingCount > 0 ? `${upcomingCount} ${upcomingCount === 1 ? "próxima" : "próximas"}` : undefined}
        action={
          <Link href="/admin/bookings" className="link-emerald">
            Todas las reservas
            <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
          </Link>
        }
        padding={false}
      >
        {days.length === 0 ? (
          <Empty icon="event_busy" label="Sin sesiones próximas." />
        ) : (
          <div className="agenda">
            {days.map((day) => (
              <div key={day.key}>
                <div className="agenda-day">
                  <span className="agenda-day-name">{day.name}</span>
                  <span className="agenda-day-date">{day.date}</span>
                  <span className="agenda-day-count">
                    {day.rows.length === 1 ? "1 sesión" : `${day.rows.length} sesiones`}
                  </span>
                </div>
                {day.rows.map((b) => (
                  <div key={b.id} className="agenda-row">
                    <div className="agenda-time">
                      <strong>{fmtTime(b.starts_at, tz)}</strong>
                      <span>{durationMinutes(b.starts_at, b.ends_at)} min</span>
                    </div>
                    <div className="agenda-who">
                      <span className="lc-avatar" aria-hidden="true">{initials(b.name)}</span>
                      <span className="person-meta">
                        <Link href={studentHref(b.email)} className="person-name">{b.name}</Link>
                        <span className="person-sub">{b.email}</span>
                      </span>
                    </div>
                    <div className="agenda-tags">
                      <span className={`type-pill ${sessionTypeTone(b.session_type)}`}>
                        {sessionTypeLabel(b.session_type)}
                      </span>
                      <StatusBadge status={b.status} />
                    </div>
                    <div className="agenda-act">
                      {b.join_token && (
                        <a
                          href={`/sesion/${b.join_token}`}
                          className="btn-ghost-sm"
                          aria-label={`Unirse a la sesión con ${b.name}`}
                        >
                          <span className="material-symbols-outlined" aria-hidden="true">videocam</span>
                          <span className="btn-label">Unirse</span>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card
        title="Reservas fallidas"
        count={failed.length}
        countTone={failed.length > 0 ? "red" : undefined}
        action={
          <Link href="/admin/failed-bookings" className="link-emerald">
            Ir a la cola
            <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
          </Link>
        }
        padding={false}
      >
        {failed.length === 0 ? (
          <Empty icon="check_circle" tone="good" label="Sin reservas fallidas. Cada pago cobrado tiene su clase." />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha fallo</th>
                <th>Alumno</th>
                <th>Hueco reservado</th>
                <th>Error</th>
                <th><span className="admin-sr">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {failed.map((e) => (
                <tr key={e.stripeSessionId}>
                  <td className="muted" data-label="Fallo">{fmtDayTime(e.failedAt, tz)}</td>
                  <td className="c-main">{e.email ?? "—"}</td>
                  <td className="muted" data-label="Hueco">{fmtDayTime(e.startIso, tz)}</td>
                  <td className="error-mono" data-label="Error" title={e.error}>{e.error}</td>
                  <td className="cell-right c-act">
                    <Link href="/admin/failed-bookings" className="btn-ghost-sm">
                      <span className="material-symbols-outlined" aria-hidden="true">refresh</span>
                      Revisar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

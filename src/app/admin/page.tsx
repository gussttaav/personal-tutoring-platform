/**
 * ADMIN-01: Admin dashboard — operational summary.
 */

import Link from "next/link";
import {
  countUpcomingBookings,
  countStudentsWithLowCredits,
  countFailedBookings,
  sumRevenueLast30Days,
  fetchAllBookings,
  fetchStudents,
} from "./_data";
import { paymentService } from "@/services";
import { PageHeader, StatCard, Card, StatusBadge, Empty } from "@/components/admin/ui";
import { fmtShort, relativeTime, initials } from "@/components/admin/format";

export default async function AdminDashboard() {
  const [upcomingCount, lowCreditCount, failedCount, revenueCents, bookings, lowCreditStudents, failed] =
    await Promise.all([
      countUpcomingBookings(),
      countStudentsWithLowCredits(),
      countFailedBookings(),
      sumRevenueLast30Days(),
      fetchAllBookings(),
      fetchStudents("low-credit"),
      paymentService.listFailedBookings(),
    ]);

  const revenue = (revenueCents / 100).toFixed(2);

  const now = Date.now();
  const upcoming = bookings
    .filter((b) => b.status === "confirmed" && new Date(b.starts_at).getTime() > now)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .slice(0, 5);

  const lowCredit = lowCreditStudents.slice(0, 4);

  const today = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="page-stack">
      <PageHeader
        overline="Panel de control"
        title="Resumen operativo"
        subtitle={today.charAt(0).toUpperCase() + today.slice(1)}
      />

      <div className="stat-grid">
        <StatCard
          label="Sesiones próximas"
          value={upcomingCount}
          icon="event_available"
          href="/admin/bookings"
        />
        <StatCard
          label="Alumnos pocos créditos"
          value={lowCreditCount}
          icon="warning"
          href="/admin/students?filter=low-credit"
          tone={lowCreditCount > 0 ? "alert" : "neutral"}
        />
        <StatCard
          label="Reservas fallidas"
          value={failedCount}
          icon="report"
          href="/admin/failed-bookings"
          tone={failedCount > 0 ? "alert" : "neutral"}
        />
        <StatCard
          label="Ingresos · 30 días"
          value={`€${revenue}`}
          icon="payments"
          href="/admin/payments"
        />
      </div>

      <div className="two-col">
        <Card
          title="Próximas sesiones"
          action={
            <Link href="/admin/bookings" className="link-emerald">
              Ver todas →
            </Link>
          }
          padding={false}
        >
          {upcoming.length === 0 ? (
            <div className="card-body">
              <Empty icon="event_busy" label="Sin sesiones próximas." />
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Alumno</th>
                  <th>Tipo</th>
                  <th>Inicio</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <div className="cell-stack">
                        <span className="cell-strong">{b.name}</span>
                        <span className="cell-meta">{b.email}</span>
                      </div>
                    </td>
                    <td className="muted">{b.session_type}</td>
                    <td>
                      <div className="cell-stack">
                        <span className="cell-strong">{fmtShort(b.starts_at)}</span>
                        <span className="cell-meta">{relativeTime(b.starts_at)}</span>
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={b.status} />
                    </td>
                    <td>
                      {b.join_token && (
                        <a
                          href={`/sesion/${b.join_token}`}
                          className="btn-ghost-sm"
                          style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>videocam</span>
                          Unirse
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card
          title="Alumnos con pocos créditos"
          action={
            <Link href="/admin/students?filter=low-credit" className="link-emerald">
              Ver todos →
            </Link>
          }
        >
          {lowCredit.length === 0 ? (
            <Empty icon="check_circle" label="Todos con créditos suficientes." />
          ) : (
            <ul className="lc-list">
              {lowCredit.map((s) => (
                <li key={s.email}>
                  <Link
                    href={`/admin/students/${encodeURIComponent(s.email)}`}
                    style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}
                  >
                    <div className="lc-avatar">{initials(s.name)}</div>
                    <div className="lc-meta">
                      <span className="lc-name">{s.name}</span>
                      <span className="lc-email">{s.email}</span>
                    </div>
                    <div className={`lc-credits ${s.totalCredits === 0 ? "is-zero" : ""}`}>
                      <span className="lc-credits-num">{s.totalCredits}</span>
                      <span className="lc-credits-label">
                        {s.totalCredits === 1 ? "crédito" : "créditos"}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Reservas fallidas — pendientes" padding={false}>
        {failed.length === 0 ? (
          <div className="card-body">
            <Empty icon="check_circle" label="Sin reservas fallidas." />
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha fallo</th>
                <th>Alumno</th>
                <th>Slot</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {failed.map((e) => (
                <tr key={e.stripeSessionId}>
                  <td className="muted">{fmtShort(e.failedAt)}</td>
                  <td>{e.email ?? "—"}</td>
                  <td className="muted">{fmtShort(e.startIso)}</td>
                  <td className="error-text" title={e.error}>
                    {e.error}
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

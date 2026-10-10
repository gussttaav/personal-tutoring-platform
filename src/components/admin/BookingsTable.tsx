/**
 * ADMIN-01: Bookings list — client status-filter tabs over server-fetched rows.
 * ADMIN-02: session types read as labels ("Sesión 1 h"), and every cell is marked
 * for the phone layout, where admin.css turns each row into a card.
 * ADMIN-03: dates are formatted in `timeZone` (the tutor's ScheduleConfig.timezone,
 * passed by the page). Without it the server render used UTC and hydration the
 * browser's zone, so the same cell could disagree between the two.
 */
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminBookingRow } from "@/domain/types";
import { PageHeader, Card, Empty } from "@/components/admin/ui";
import { StatusBadge } from "@/components/admin/ui";
import { fmtDateTime, relativeTime, sessionTypeLabel, sessionTypeTone } from "@/components/admin/format";

const TABS: [string, string][] = [
  ["all", "Todas"],
  ["confirmed", "Confirmadas"],
  ["completed", "Completadas"],
  ["cancelled", "Canceladas"],
  ["no_show", "No asistió"],
];

export function BookingsTable({
  bookings,
  timeZone,
}: {
  bookings: AdminBookingRow[];
  timeZone: string;
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("all");

  const counts = useMemo(
    () => ({
      all: bookings.length,
      confirmed: bookings.filter((b) => b.status === "confirmed").length,
      completed: bookings.filter((b) => b.status === "completed").length,
      cancelled: bookings.filter((b) => b.status === "cancelled").length,
      no_show: bookings.filter((b) => b.status === "no_show").length,
    }),
    [bookings],
  ) as Record<string, number>;

  const filtered = bookings.filter(
    (b) => statusFilter === "all" || b.status === statusFilter,
  );

  return (
    <div className="page-stack">
      <PageHeader
        overline="Operaciones"
        title="Reservas"
        subtitle="Hasta 100 reservas más recientes"
      />

      <div className="filter-tabs filter-tabs-row">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={statusFilter === key}
            className={`filter-tab ${statusFilter === key ? "is-active" : ""}`}
            onClick={() => setStatusFilter(key)}
          >
            {label}
            <span className="filter-tab-count">{counts[key]}</span>
          </button>
        ))}
      </div>

      <Card padding={false}>
        {filtered.length === 0 ? (
          <div className="card-body">
            <Empty icon="event_busy" label="No hay reservas que coincidan." />
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Alumno</th>
                <th>Tipo</th>
                <th>Inicio</th>
                <th>Fin</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr
                  key={b.id}
                  onClick={() => router.push(`/admin/students/${encodeURIComponent(b.email)}`)}
                >
                  <td className="c-main">
                    <div className="cell-stack">
                      <span className="cell-strong">{b.name}</span>
                      <span className="cell-meta">{b.email}</span>
                    </div>
                  </td>
                  <td data-label="Tipo">
                    <span className={`type-pill ${sessionTypeTone(b.session_type)}`}>
                      {sessionTypeLabel(b.session_type)}
                    </span>
                  </td>
                  <td data-label="Inicio">
                    <div className="cell-stack">
                      <span>{fmtDateTime(b.starts_at, timeZone)}</span>
                      <span className="cell-meta">{relativeTime(b.starts_at)}</span>
                    </div>
                  </td>
                  <td className="muted" data-label="Fin">{fmtDateTime(b.ends_at, timeZone)}</td>
                  <td className="c-side">
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="c-act">
                    {b.status === "confirmed" && b.join_token && (
                      <a
                        href={`/sesion/${b.join_token}`}
                        className="btn-ghost-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="material-symbols-outlined" aria-hidden="true">videocam</span>
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
    </div>
  );
}

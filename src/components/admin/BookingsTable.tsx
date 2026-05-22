/**
 * ADMIN-01: Bookings list — client status-filter tabs over server-fetched rows.
 */
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminBookingRow } from "@/app/admin/_data";
import { PageHeader, Card, Empty } from "@/components/admin/ui";
import { StatusBadge } from "@/components/admin/ui";
import { fmtDateTime, relativeTime } from "@/components/admin/format";

const TABS: [string, string][] = [
  ["all", "Todas"],
  ["confirmed", "Confirmadas"],
  ["completed", "Completadas"],
  ["cancelled", "Canceladas"],
  ["no_show", "No asistió"],
];

export function BookingsTable({ bookings }: { bookings: AdminBookingRow[] }) {
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
                  <td>
                    <div className="cell-stack">
                      <span className="cell-strong">{b.name}</span>
                      <span className="cell-meta">{b.email}</span>
                    </div>
                  </td>
                  <td className="muted">{b.session_type}</td>
                  <td>
                    <div className="cell-stack">
                      <span>{fmtDateTime(b.starts_at)}</span>
                      <span className="cell-meta">{relativeTime(b.starts_at)}</span>
                    </div>
                  </td>
                  <td className="muted">{fmtDateTime(b.ends_at)}</td>
                  <td>
                    <StatusBadge status={b.status} />
                  </td>
                  <td>
                    {b.status === "confirmed" && b.join_token && (
                      <a
                        href={`/sesion/${b.join_token}`}
                        className="btn-ghost-sm"
                        style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                        onClick={(e) => e.stopPropagation()}
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
    </div>
  );
}

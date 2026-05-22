/**
 * ADMIN-01: Students list — client search + filter tabs over server-fetched rows.
 */
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { StudentSummary } from "@/app/admin/_data";
import { PageHeader, Card, Empty } from "@/components/admin/ui";
import { fmtDate, fmtShort, initials } from "@/components/admin/format";

export function StudentsTable({
  students,
  filter,
}: {
  students: StudentSummary[];
  filter?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const lowCreditCount = useMemo(
    () => students.filter((s) => s.totalCredits <= 1).length,
    [students],
  );

  const filtered = useMemo(() => {
    let xs = filter === "low-credit" ? students.filter((s) => s.totalCredits <= 1) : students;
    if (query) {
      const q = query.toLowerCase();
      xs = xs.filter(
        (s) => s.email.toLowerCase().includes(q) || s.name.toLowerCase().includes(q),
      );
    }
    return xs;
  }, [filter, query, students]);

  return (
    <div className="page-stack">
      <PageHeader
        overline="Operaciones"
        title="Alumnos"
        subtitle={`Mostrando ${filtered.length} ${
          filter === "low-credit" ? "con ≤1 crédito" : "de hasta 100 alumnos"
        }`}
        right={
          <div className="filter-tabs">
            <Link
              href="/admin/students"
              className={`filter-tab ${!filter ? "is-active" : ""}`}
            >
              Todos
              <span className="filter-tab-count">{students.length}</span>
            </Link>
            <Link
              href="/admin/students?filter=low-credit"
              className={`filter-tab ${filter === "low-credit" ? "is-active is-alert" : ""}`}
            >
              Pocos créditos
              <span className="filter-tab-count">{lowCreditCount}</span>
            </Link>
          </div>
        }
      />

      <div className="toolbar">
        <div className="search">
          <span className="material-symbols-outlined">search</span>
          <input
            type="text"
            placeholder="Buscar por email o nombre…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="search-clear" onClick={() => setQuery("")} aria-label="Limpiar">
              ×
            </button>
          )}
        </div>
      </div>

      <Card padding={false}>
        {filtered.length === 0 ? (
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
              {filtered.map((s) => (
                <tr
                  key={s.email}
                  onClick={() => router.push(`/admin/students/${encodeURIComponent(s.email)}`)}
                >
                  <td>
                    <div className="cell-row">
                      <div className="lc-avatar lc-avatar-sm">{initials(s.name)}</div>
                      <div className="cell-stack">
                        <span className="cell-strong">{s.name}</span>
                        <span className="cell-meta">{s.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="cell-right">
                    <div
                      className={`credits-pill ${s.totalCredits <= 1 ? "is-low" : ""} ${
                        s.totalCredits === 0 ? "is-zero" : ""
                      }`}
                    >
                      <span className="credits-num">{s.totalCredits}</span>
                      <span className="credits-label">cr.</span>
                    </div>
                  </td>
                  <td className="muted">{s.earliestExpiry ? fmtDate(s.earliestExpiry) : "—"}</td>
                  <td className="muted">{s.nextSession ? fmtShort(s.nextSession) : "—"}</td>
                  <td className="cell-right">
                    <span className="material-symbols-outlined chevron">chevron_right</span>
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

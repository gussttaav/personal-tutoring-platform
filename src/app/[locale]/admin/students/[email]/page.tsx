/**
 * ADMIN-01: Student detail page — credit packs, bookings, audit log, and credit adjustment.
 * SEC-07: gated before its own data fetch — see students/page.tsx sibling note.
 * REFACTOR-R4-P3-02: reads through adminService (was ../../_data). Reachable for any
 * user, including course readers the students list leaves out.
 * ADMIN-02: cells are marked for the phone layout; session types read as labels.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { AdjustCreditsForm } from "@/components/admin/AdjustCreditsForm";
import { StudentPricingForm } from "@/components/admin/StudentPricingForm";
import { adminService, pricingService } from "@/services";
import { Card, StatusBadge, Empty } from "@/components/admin/ui";
import {
  fmtDate,
  fmtDateTime,
  fmtShort,
  relativeTime,
  initials,
  sessionTypeLabel,
  sessionTypeTone,
} from "@/components/admin/format";
import type { AuditEntry } from "@/domain/types";

interface StudentDetailPageProps {
  params: Promise<{ email: string }>;
}

export default async function StudentDetailPage({ params }: StudentDetailPageProps) {
  if (!isAdmin(await auth())) redirect("/");

  const { email: rawEmail } = await params;
  const email = decodeURIComponent(rawEmail);

  const [student, packs, bookings, audit, defaultPrices] = await Promise.all([
    adminService.getStudent(email),
    adminService.listCreditPacks(email),
    adminService.listStudentBookings(email),
    adminService.listAuditLog(email),
    // Public prices, for the "por defecto" column. Read from the service, never the
    // ISR cache — admin surfaces always show current values.
    pricingService.getAll(),
  ]);

  if (!student) notFound();

  // PRICING-STUDENT-01: keyed on users.id, so it needs the resolved student.
  const priceOverrides = await pricingService.getUserOverrides(student.id);

  // eslint-disable-next-line react-hooks/purity -- Server Component: renders once per request, never re-renders on the client.
  const now = Date.now();
  const activeCredits = packs
    .filter((p) => new Date(p.expires_at).getTime() > now)
    .reduce((sum, p) => sum + p.credits_remaining, 0);
  const completedCount = bookings.filter((b) => b.status === "completed").length;

  return (
    <div className="page-stack">
      <Link href="/admin/students" className="back-link">
        <span className="material-symbols-outlined">arrow_back</span>
        Alumnos
      </Link>

      <header className="student-hero">
        <div className="student-hero-avatar">{initials(student.name)}</div>
        <div className="student-hero-meta">
          <h1 className="student-hero-name">{student.name}</h1>
          <p className="student-hero-email">{student.email}</p>
          {activeCredits <= 1 && (
            <div className="student-hero-tags">
              <span className="chip chip-warn">Bajo en créditos</span>
            </div>
          )}
        </div>
        <div className="student-hero-stats">
          <div className="hero-stat">
            <span className="hero-stat-value">{activeCredits}</span>
            <span className="hero-stat-label">Créditos activos</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-value">{completedCount}</span>
            <span className="hero-stat-label">Sesiones completadas</span>
          </div>
        </div>
      </header>

      <Card
        title="Créditos"
        action={<span className="card-meta">{packs.length} packs</span>}
        padding={false}
      >
        {packs.length === 0 ? (
          <div className="card-body">
            <Empty icon="credit_card_off" label="Sin packs de créditos." />
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Pack</th>
                <th className="cell-right">Restantes</th>
                <th>Caduca</th>
                <th>Comprado</th>
                <th>Stripe</th>
              </tr>
            </thead>
            <tbody>
              {packs.map((p) => {
                const expired = new Date(p.expires_at).getTime() < now;
                const pct = p.pack_size > 0 ? (p.credits_remaining / p.pack_size) * 100 : 0;
                return (
                  <tr key={p.id} className={expired ? "is-faded" : ""}>
                    <td className="c-main">
                      <div className="cell-stack">
                        <span className="cell-strong">{p.pack_size} sesiones</span>
                        <span className="cell-meta">Pack de {p.pack_size}</span>
                      </div>
                    </td>
                    <td className="cell-right" data-label="Restantes">
                      <div className="credit-bar">
                        <div className="credit-bar-track">
                          <div className="credit-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="credit-bar-label">
                          {p.credits_remaining}/{p.pack_size}
                        </span>
                      </div>
                    </td>
                    <td className={expired ? "error-text" : "muted"} data-label="Caduca">
                      {fmtDate(p.expires_at)}
                      {expired && " · vencido"}
                    </td>
                    <td className="muted" data-label="Comprado">{fmtDate(p.created_at)}</td>
                    <td className="mono muted truncate" data-label="Stripe" title={p.stripe_payment_id}>
                      {p.stripe_payment_id}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <AdjustCreditsForm email={email} />
      </Card>

      {/* PRICING-STUDENT-01: private prices for this student. Blank = public price. */}
      <Card title="Precios personalizados">
        <StudentPricingForm
          email={email}
          defaults={defaultPrices}
          overrides={priceOverrides}
        />
      </Card>

      <Card
        title="Reservas"
        action={<span className="card-meta">Últimas 50</span>}
        padding={false}
      >
        {bookings.length === 0 ? (
          <div className="card-body">
            <Empty icon="event_busy" label="Sin reservas." />
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Inicio</th>
                <th>Fin</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td className="c-main">
                    <span className={`type-pill ${sessionTypeTone(b.session_type)}`}>
                      {sessionTypeLabel(b.session_type)}
                    </span>
                  </td>
                  <td className="muted" data-label="Inicio">{fmtDateTime(b.starts_at)}</td>
                  <td className="muted" data-label="Fin">{fmtDateTime(b.ends_at)}</td>
                  <td className="c-side">
                    <StatusBadge status={b.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Historial">
        {audit.length === 0 ? (
          <Empty icon="history" label="Sin entradas." />
        ) : (
          <ol className="audit-log">
            {audit.map((entry: AuditEntry, i) => {
              const ts = typeof entry.ts === "string" ? entry.ts : null;
              return (
                <li key={i} className="audit-row">
                  <div className="audit-time">
                    <span className="audit-date">{ts ? fmtShort(ts) : "—"}</span>
                    {ts && <span className="audit-rel">{relativeTime(ts)}</span>}
                  </div>
                  <div className="audit-rail">
                    <span className="audit-dot" />
                    {i < audit.length - 1 && <span className="audit-line" />}
                  </div>
                  <div className="audit-content">
                    <span className="audit-action">{entry.action}</span>
                    <span className="audit-meta">
                      {Object.entries(entry)
                        .filter(([k]) => k !== "action" && k !== "ts")
                        .map(([k, v]) => (
                          <span key={k} className="audit-kv">
                            <span className="audit-k">{k}</span>
                            <span className="audit-v">{String(v)}</span>
                          </span>
                        ))}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>
    </div>
  );
}

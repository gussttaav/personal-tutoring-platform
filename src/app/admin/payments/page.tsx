/**
 * ADMIN-01: Payment history — last 100 payments with 30-day revenue + sparkline.
 */

import Link from "next/link";
import { fetchPayments, sumRevenueLast30Days } from "../_data";
import { PageHeader, Card, StatusBadge, Empty } from "@/components/admin/ui";
import { fmtDateTime, relativeTime } from "@/components/admin/format";

function checkoutLabel(type: string): string {
  if (type === "single") return "Sesión única";
  const parts = type.split("_");
  return parts.length > 1 ? `Pack ${parts[1]}` : "Pack";
}

export default async function PaymentsPage() {
  const [payments, revenueCents] = await Promise.all([
    fetchPayments(),
    sumRevenueLast30Days(),
  ]);

  const revenue = (revenueCents / 100).toFixed(2);
  const succeeded = payments.filter((p) => p.status === "succeeded").length;
  const refunded = payments.filter((p) => p.status === "refunded").length;

  // Last-14-days revenue sparkline from succeeded payments.
  const days = 14;
  const buckets = new Array(days).fill(0) as number[];
  for (const p of payments) {
    if (p.status !== "succeeded") continue;
    const d = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86_400_000);
    if (d >= 0 && d < days) buckets[days - 1 - d] += p.amount_cents;
  }
  const sparkMax = Math.max(...buckets, 1);
  const points = buckets
    .map((v, i) => `${(i / (days - 1)) * 280},${48 - (v / sparkMax) * 40 - 4}`)
    .join(" ");

  return (
    <div className="page-stack">
      <PageHeader overline="Finanzas" title="Pagos" subtitle="Hasta 100 pagos más recientes" />

      <div className="stat-grid stat-grid-3">
        <div className="stat-card stat-card-static">
          <div className="stat-card-top">
            <span className="stat-card-label">Ingresos · 30 días</span>
            <span className="stat-card-icon material-symbols-outlined">payments</span>
          </div>
          <div className="stat-card-value">€{revenue}</div>
          <svg className="sparkline" viewBox="0 0 280 48" preserveAspectRatio="none">
            <defs>
              <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4edea3" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#4edea3" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polyline points={points} fill="none" stroke="#4edea3" strokeWidth="2" />
            <polygon points={`0,48 ${points} 280,48`} fill="url(#sparkFill)" />
          </svg>
        </div>
        <div className="stat-card stat-card-static">
          <div className="stat-card-top">
            <span className="stat-card-label">Cobros exitosos</span>
            <span className="stat-card-icon material-symbols-outlined">check_circle</span>
          </div>
          <div className="stat-card-value">{succeeded}</div>
        </div>
        <div className="stat-card stat-card-static">
          <div className="stat-card-top">
            <span className="stat-card-label">Reembolsos</span>
            <span className="stat-card-icon material-symbols-outlined">undo</span>
          </div>
          <div className="stat-card-value">{refunded}</div>
        </div>
      </div>

      <Card padding={false}>
        {payments.length === 0 ? (
          <div className="card-body">
            <Empty icon="receipt_long" label="No hay pagos." />
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Alumno</th>
                <th>Tipo</th>
                <th className="cell-right">Importe</th>
                <th>Estado</th>
                <th>Stripe ID</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="cell-stack">
                      <span>{fmtDateTime(p.created_at)}</span>
                      <span className="cell-meta">{relativeTime(p.created_at)}</span>
                    </div>
                  </td>
                  <td>
                    <Link href={`/admin/students/${encodeURIComponent(p.email)}`}>
                      <div className="cell-stack">
                        <span className="cell-strong">{p.name}</span>
                        <span className="cell-meta">{p.email}</span>
                      </div>
                    </Link>
                  </td>
                  <td>
                    <span className="type-pill">{checkoutLabel(p.checkout_type)}</span>
                  </td>
                  <td className="cell-right mono cell-strong">
                    €{(p.amount_cents / 100).toFixed(2)}
                  </td>
                  <td>
                    <StatusBadge status={p.status} kind="payment" />
                  </td>
                  <td className="mono muted truncate" title={p.stripe_payment_id}>
                    {p.stripe_payment_id}
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

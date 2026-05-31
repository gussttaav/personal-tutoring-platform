/**
 * ADMIN-01: Failed bookings (dead-letter) UI.
 * Uses paymentService.listFailedBookings() and the existing retry API (REL-03).
 */

import { paymentService } from "@/services";
import { RetryButton } from "@/components/admin/RetryButton";
import { PageHeader, Card, Empty } from "@/components/admin/ui";
import { fmtDateTime, relativeTime } from "@/components/admin/format";

export default async function FailedBookingsPage() {
  const entries = await paymentService.listFailedBookings();

  return (
    <div className="page-stack">
      <PageHeader
        overline="Operaciones"
        title="Reservas fallidas"
        subtitle="Cola de cartas muertas — pagos confirmados sin reserva creada"
      />

      <div className="alert">
        <span className="material-symbols-outlined">info</span>
        <div>
          <strong>¿Qué es esta lista?</strong>
          <p>
            Pagos que se cobraron correctamente pero la reserva no llegó a crearse en el
            calendario. Reintentar invoca <code>/api/admin/failed-bookings</code>; si sigue
            fallando hay que reembolsar manualmente desde Stripe.
          </p>
        </div>
      </div>

      <Card padding={false}>
        {entries.length === 0 ? (
          <div className="card-body">
            <Empty icon="check_circle" label="Sin reservas fallidas. Todo en orden." />
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha fallo</th>
                <th>Alumno</th>
                <th>Slot reservado</th>
                <th>Error</th>
                <th>Stripe</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.stripeSessionId}>
                  <td>
                    <div className="cell-stack">
                      <span>{fmtDateTime(e.failedAt)}</span>
                      <span className="cell-meta">{relativeTime(e.failedAt)}</span>
                    </div>
                  </td>
                  <td>{e.email ?? "—"}</td>
                  <td className="muted">{fmtDateTime(e.startIso)}</td>
                  <td className="error-text" style={{ maxWidth: 320 }} title={e.error}>
                    {e.error}
                  </td>
                  <td className="mono muted truncate" title={e.stripeSessionId}>
                    {e.stripeSessionId}
                  </td>
                  <td className="cell-right">
                    <RetryButton stripeSessionId={e.stripeSessionId} />
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

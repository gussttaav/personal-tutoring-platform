/**
 * Admin schedule — edit working hours, minimum advance notice, and timezone
 * (single source of truth). Auth/admin gating is handled by the admin layout.
 */

import { PageHeader, Card } from "@/components/admin/ui";
import { ScheduleForm } from "@/components/admin/ScheduleForm";
import { scheduleService } from "@/services";

export default async function SchedulePage() {
  const config = await scheduleService.getConfig();

  return (
    <div className="page-stack">
      <PageHeader
        overline="Reservas"
        title="Horarios"
        subtitle="Edita tus horas de trabajo, la antelación mínima y la zona horaria. Afecta a la disponibilidad al instante."
      />

      <Card>
        <ScheduleForm config={config} />
      </Card>
    </div>
  );
}

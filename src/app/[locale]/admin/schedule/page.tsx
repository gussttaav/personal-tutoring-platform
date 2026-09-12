/**
 * Admin schedule — edit working hours, minimum advance notice, and timezone
 * (single source of truth).
 * SEC-07: gated before its own data fetch — see students/page.tsx sibling note
 * (the layout's redirect alone does not stop this page's data fetch from running).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { PageHeader, Card } from "@/components/admin/ui";
import { ScheduleForm } from "@/components/admin/ScheduleForm";
import { scheduleService } from "@/services";

export default async function SchedulePage() {
  if (!isAdmin(await auth())) redirect("/");

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

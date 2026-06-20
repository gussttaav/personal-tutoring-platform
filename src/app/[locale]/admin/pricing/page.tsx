/**
 * Admin pricing — edit the four product prices (single source of truth).
 * Auth/admin gating is handled by the admin layout.
 */

import { PageHeader, Card } from "@/components/admin/ui";
import { PricingForm } from "@/components/admin/PricingForm";
import { pricingService } from "@/services";

export default async function PricingPage() {
  const prices = await pricingService.getAll();

  return (
    <div className="page-stack">
      <PageHeader
        overline="Finanzas"
        title="Precios"
        subtitle="Cambia el precio de sesiones y packs. Afecta al cobro y a la web al instante."
      />

      <Card>
        <PricingForm prices={prices} />
      </Card>
    </div>
  );
}

/**
 * Admin pricing — edit the four product prices (single source of truth).
 * Auth/admin gating is handled by the admin layout.
 */

import { PageHeader, Card } from "@/components/admin/ui";
import { PricingForm } from "@/components/admin/PricingForm";
import { pricingService } from "@/services";

export default async function PricingPage() {
  // Admin surfaces read the service directly (never the ISR cache), so the form
  // always shows the current values.
  const [prices, packValidityDays] = await Promise.all([
    pricingService.getAll(),
    pricingService.getPackValidityDays(),
  ]);

  return (
    <div className="page-stack">
      <PageHeader
        overline="Finanzas"
        title="Precios"
        subtitle="Cambia el precio de sesiones y packs. Afecta al cobro y a la web al instante."
      />

      <Card>
        <PricingForm prices={prices} packValidityDays={packValidityDays} />
      </Card>
    </div>
  );
}

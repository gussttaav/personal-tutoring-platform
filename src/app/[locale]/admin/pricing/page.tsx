/**
 * Admin pricing — edit the four product prices (single source of truth).
 * SEC-07: gated before its own data fetch — see students/page.tsx sibling note
 * (the layout's redirect alone does not stop this page's data fetch from running).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { PageHeader, Card } from "@/components/admin/ui";
import { PricingForm } from "@/components/admin/PricingForm";
import { pricingService } from "@/services";

export default async function PricingPage() {
  if (!isAdmin(await auth())) redirect("/");

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

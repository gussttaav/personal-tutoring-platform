// Application service for admin-editable pricing.
//
// The `pricing` table is the single source of truth for the four product
// prices (session1h, session2h, pack5, pack10). PaymentService reads the charge
// amount from here; the public UI reads display values from here too.
import type { IPricingRepository } from "@/domain/repositories/IPricingRepository";
import type { IAuditRepository } from "@/domain/repositories/IAuditRepository";
import type { PriceRecord, ProductKey } from "@/domain/types";
import { log } from "@/lib/logger";

export class PricingService {
  constructor(
    private readonly pricing: IPricingRepository,
    private readonly audit:   IAuditRepository,
  ) {}

  async getAll(): Promise<PriceRecord[]> {
    return this.pricing.list();
  }

  /**
   * Returns the charge amount (in cents) and currency for a product. Throws if
   * the product is missing — preserves the old "No price configured" failure
   * semantics that PaymentService relied on.
   */
  async getAmount(key: ProductKey): Promise<{ amount: number; currency: string }> {
    const record = await this.pricing.get(key);
    if (!record) throw new Error(`No price configured for product ${key}`);
    return { amount: record.amountCents, currency: record.currency };
  }

  async updatePrice(params: {
    key:         ProductKey;
    amountCents: number;
    by:          string;
    reason:      string;
  }): Promise<void> {
    const { key, amountCents, by, reason } = params;

    await this.pricing.update(key, amountCents, by);

    // Pricing isn't a per-student entity; attribute the audit entry to the
    // admin's own email (the IAuditRepository is keyed by email).
    await this.audit.append(by, {
      action:     "admin_update_price",
      productKey: key,
      amountCents,
      reason,
    });

    log("info", "Pricing updated", { service: "PricingService", productKey: key, amountCents, by });
  }
}

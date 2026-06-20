// Application service for admin-editable pricing.
//
// The `pricing` table is the single source of truth for the four product
// prices (session1h, session2h, pack5, pack10). PaymentService reads the charge
// amount from here; the public UI reads display values from here too.
import type { IPricingRepository } from "@/domain/repositories/IPricingRepository";
import type { IAuditRepository } from "@/domain/repositories/IAuditRepository";
import type {
  PriceRecord,
  ProductKey,
  PublicPricing,
  PublicSessionPrice,
  PublicPackPrice,
} from "@/domain/types";
import { log } from "@/lib/logger";

// Pack hours, used to derive the per-class rate and the strikethrough original.
const PACK_HOURS: Record<"pack5" | "pack10", number> = { pack5: 5, pack10: 10 };

export class PricingService {
  constructor(
    private readonly pricing: IPricingRepository,
    private readonly audit:   IAuditRepository,
  ) {}

  async getAll(): Promise<PriceRecord[]> {
    return this.pricing.list();
  }

  /**
   * Public, numeric pricing DTO for external clients (the mobile app). Returns
   * only the paid products with derived pack fields (per-class rate + the
   * 1h×hours strikethrough/savings); never exposes admin metadata.
   */
  async getPublicPricing(): Promise<PublicPricing> {
    const byKey = new Map((await this.pricing.list()).map((r) => [r.productKey, r]));

    const require = (key: ProductKey): PriceRecord => {
      const r = byKey.get(key);
      if (!r) throw new Error(`No price configured for product ${key}`);
      return r;
    };

    const session1h = require("session1h");

    const sessions: PublicSessionPrice[] = (["session1h", "session2h"] as const).map((key) => {
      const r = require(key);
      return { productKey: key, amountCents: r.amountCents, currency: r.currency };
    });

    const packs: PublicPackPrice[] = (["pack5", "pack10"] as const).map((key) => {
      const r = require(key);
      const hours = PACK_HOURS[key];
      const perClassCents = Math.round(r.amountCents / hours);

      // Derived original = buying the same hours as single 1h sessions.
      let originalAmountCents: number | null = null;
      let savingsCents: number | null = null;
      let savingsPct: number | null = null;
      const originalCents = session1h.amountCents * hours;
      if (originalCents > r.amountCents) {
        originalAmountCents = originalCents;
        savingsCents = originalCents - r.amountCents;
        savingsPct = Math.round((savingsCents / originalCents) * 100);
      }

      return {
        productKey: key,
        amountCents: r.amountCents,
        currency: r.currency,
        hours,
        perClassCents,
        originalAmountCents,
        savingsCents,
        savingsPct,
      };
    });

    return { currency: session1h.currency, sessions, packs };
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

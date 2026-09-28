// Application service for admin-editable pricing.
//
// The `pricing` table is the single source of truth for the four product
// prices (session1h, session2h, pack5, pack10). PaymentService reads the charge
// amount from here; the public UI reads display values from here too.
//
// PRICING-STUDENT-01: a student may have private prices in `user_pricing`. Every
// read that can be student-specific goes through resolve() below — the ONE place
// an override replaces a default — so the charge path and the display path can
// never disagree about what a given student pays.
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

  /**
   * Public prices only. Feeds the global ISR display cache and /admin/pricing,
   * both of which must stay student-agnostic — hence no userId parameter.
   */
  async getAll(): Promise<PriceRecord[]> {
    return this.pricing.list();
  }

  /**
   * PRICING-STUDENT-01: the merge point. Returns the price rows that apply to
   * one student — public rows with any of their overrides substituted in.
   *
   * Overrides are sparse (a row exists only for an overridden product), so a
   * student with a discounted pack but standard single classes gets exactly one
   * substitution. Passing no userId, or a userId with no overrides, returns the
   * public rows unchanged.
   */
  private async resolve(userId?: string): Promise<PriceRecord[]> {
    const defaults = await this.pricing.list();
    if (!userId) return defaults;

    const overrides = await this.pricing.listForUser(userId);
    if (overrides.length === 0) return defaults;

    const byKey = new Map(defaults.map((r) => [r.productKey, r]));
    for (const o of overrides) byKey.set(o.productKey, o);
    return [...byKey.values()];
  }

  /**
   * Public, numeric pricing DTO for external clients (the mobile app). Returns
   * only the paid products with derived pack fields (per-class rate + the
   * 1h×hours strikethrough/savings); never exposes admin metadata.
   *
   * With a userId, the derived fields are recomputed from that student's resolved
   * prices — so a student whose 1h class is discounted sees the pack savings
   * measured against *their* 1h rate, not the public one.
   */
  async getPublicPricing(userId?: string): Promise<PublicPricing> {
    const [rows, settings] = await Promise.all([this.resolve(userId), this.pricing.getSettings()]);
    const byKey = new Map(rows.map((r) => [r.productKey, r]));

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

    return {
      currency: session1h.currency,
      sessions,
      packs,
      packValidityDays: settings.packValidityDays,
    };
  }

  /** How many days a purchased pack stays redeemable. Read by the purchase path
   *  (PaymentService) to stamp each pack's expiry, and surfaced to clients. */
  async getPackValidityDays(): Promise<number> {
    return (await this.pricing.getSettings()).packValidityDays;
  }

  /**
   * Returns the charge amount (in cents) and currency for a product. Throws if
   * the product is missing — preserves the old "No price configured" failure
   * semantics that PaymentService relied on.
   *
   * This is what Stripe is actually charged, so it is the authoritative read of
   * a student's override. Never cached: an admin's edit takes effect on the very
   * next checkout.
   */
  async getAmount(
    key: ProductKey,
    userId?: string,
  ): Promise<{ amount: number; currency: string }> {
    const record = (await this.resolve(userId)).find((r) => r.productKey === key);
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

  async updatePackValidityDays(params: {
    days:   number;
    by:     string;
    reason: string;
  }): Promise<void> {
    const { days, by, reason } = params;

    await this.pricing.updateSettings({ packValidityDays: days, updatedBy: by });

    await this.audit.append(by, {
      action:           "admin_update_pack_validity",
      packValidityDays: days,
      reason,
    });

    log("info", "Pack validity updated", { service: "PricingService", packValidityDays: days, by });
  }

  // ─── PRICING-STUDENT-01: per-student overrides (admin) ──────────────────────

  /** This student's overrides, sparse. Empty array = they pay public prices. */
  async getUserOverrides(userId: string): Promise<PriceRecord[]> {
    return this.pricing.listForUser(userId);
  }

  /** Whether this student has any override at all. Drives the API response flag
   *  that lets the web client skip a pointless context update. */
  async hasUserOverrides(userId: string): Promise<boolean> {
    return (await this.pricing.listForUser(userId)).length > 0;
  }

  /**
   * Sets or clears this student's overrides. A null `amountCents` DELETEs the
   * row rather than storing a copy of the public price — so clearing a field
   * genuinely returns the student to the default, including any later change to
   * that default.
   */
  async setUserOverrides(params: {
    userId: string;
    email:  string;
    prices: Array<{ key: ProductKey; amountCents: number | null }>;
    by:     string;
    reason: string;
  }): Promise<void> {
    const { userId, email, prices, by, reason } = params;

    for (const { key, amountCents } of prices) {
      if (amountCents === null) {
        await this.pricing.deleteForUser(userId, key);
      } else {
        await this.pricing.upsertForUser(userId, key, amountCents, by);
      }
    }

    // Unlike updatePrice (which has no student to key on), this IS a per-student
    // change: key the entry on the student's email so it shows up in their audit
    // trail at /admin/students/<email>, and carry `by` for admin attribution.
    // Mirrors the manual credit grant in api/admin/students/[email]/route.ts.
    // Flat string, not an array of objects: the admin audit log renders every
    // value with String(v), so a nested shape would show as "[object Object]".
    // Cents, matching the amountCents wire format used everywhere else.
    await this.audit.append(email, {
      action: "admin_set_student_pricing",
      prices: prices
        .map(({ key, amountCents }) => `${key}=${amountCents === null ? "cleared" : amountCents}`)
        .join(", "),
      reason,
      by,
    });

    log("info", "Student pricing updated", {
      service: "PricingService",
      student: email,
      changed: prices.length,
      cleared: prices.filter((p) => p.amountCents === null).length,
      by,
    });
  }
}

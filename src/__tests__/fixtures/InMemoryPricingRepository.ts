// In-memory implementation of IPricingRepository for tests.
import type { IPricingRepository } from "@/domain/repositories/IPricingRepository";
import type { PriceRecord, PricingSettings, ProductKey } from "@/domain/types";

const DEFAULTS: Record<ProductKey, number> = {
  session1h: 1600,
  session2h: 3000,
  pack5:     7500,
  pack10:    14000,
};

export class InMemoryPricingRepository implements IPricingRepository {
  private store = new Map<ProductKey, PriceRecord>();
  private settings: PricingSettings = {
    packValidityDays: 180,
    updatedAt:        new Date().toISOString(),
    updatedBy:        null,
  };

  constructor() {
    for (const key of Object.keys(DEFAULTS) as ProductKey[]) {
      this.store.set(key, {
        productKey:  key,
        amountCents: DEFAULTS[key],
        currency:    "eur",
        updatedAt:   new Date().toISOString(),
        updatedBy:   null,
      });
    }
  }

  async list(): Promise<PriceRecord[]> {
    return Array.from(this.store.values());
  }

  async get(key: ProductKey): Promise<PriceRecord | null> {
    return this.store.get(key) ?? null;
  }

  async update(key: ProductKey, amountCents: number, updatedBy: string): Promise<void> {
    this.store.set(key, {
      productKey: key,
      amountCents,
      currency:   "eur",
      updatedAt:  new Date().toISOString(),
      updatedBy,
    });
  }

  async getSettings(): Promise<PricingSettings> {
    return { ...this.settings };
  }

  async updateSettings(settings: { packValidityDays: number; updatedBy: string }): Promise<void> {
    this.settings = {
      packValidityDays: settings.packValidityDays,
      updatedAt:        new Date().toISOString(),
      updatedBy:        settings.updatedBy,
    };
  }
}

import type { PriceRecord, PricingSettings, ProductKey } from "../types";

export interface IPricingRepository {
  /** Returns all price rows (the 4 products). */
  list(): Promise<PriceRecord[]>;
  /** Returns a single price row, or null if the product key is not configured. */
  get(key: ProductKey): Promise<PriceRecord | null>;
  /** Updates a product's charge amount. */
  update(key: ProductKey, amountCents: number, updatedBy: string): Promise<void>;
  /** Returns the singleton pricing settings (pack validity, …). */
  getSettings(): Promise<PricingSettings>;
  /** Updates the singleton pricing settings. */
  updateSettings(settings: { packValidityDays: number; updatedBy: string }): Promise<void>;
}

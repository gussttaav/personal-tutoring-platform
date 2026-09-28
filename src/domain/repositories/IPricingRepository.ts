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

  // ─── PRICING-STUDENT-01: per-student overrides ──────────────────────────────
  // Sparse: only overridden products have a row, so an empty array means "this
  // student pays the public price for everything".

  /** Returns this student's price overrides (0–4 rows). */
  listForUser(userId: string): Promise<PriceRecord[]>;
  /** Creates or replaces one override for this student. */
  upsertForUser(userId: string, key: ProductKey, amountCents: number, updatedBy: string): Promise<void>;
  /** Removes one override, returning the student to the public price for that product. */
  deleteForUser(userId: string, key: ProductKey): Promise<void>;
}

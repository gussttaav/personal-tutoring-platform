import type { PriceRecord, ProductKey } from "../types";

export interface IPricingRepository {
  /** Returns all price rows (the 4 products). */
  list(): Promise<PriceRecord[]>;
  /** Returns a single price row, or null if the product key is not configured. */
  get(key: ProductKey): Promise<PriceRecord | null>;
  /** Updates a product's charge amount. */
  update(key: ProductKey, amountCents: number, updatedBy: string): Promise<void>;
}

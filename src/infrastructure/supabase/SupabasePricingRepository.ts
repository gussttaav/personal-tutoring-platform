import type { IPricingRepository } from "@/domain/repositories/IPricingRepository";
import type { PriceRecord, ProductKey } from "@/domain/types";
import { supabase } from "./client";

interface PricingRow {
  product_key:  string;
  amount_cents: number;
  currency:     string;
  updated_at:   string;
  updated_by:   string | null;
}

function toRecord(row: PricingRow): PriceRecord {
  return {
    productKey:  row.product_key as ProductKey,
    amountCents: row.amount_cents,
    currency:    row.currency,
    updatedAt:   row.updated_at,
    updatedBy:   row.updated_by,
  };
}

export class SupabasePricingRepository implements IPricingRepository {
  async list(): Promise<PriceRecord[]> {
    const { data, error } = await supabase.from("pricing").select("*");
    if (error) throw error;
    return (data ?? []).map(r => toRecord(r as PricingRow));
  }

  async get(key: ProductKey): Promise<PriceRecord | null> {
    const { data, error } = await supabase
      .from("pricing")
      .select("*")
      .eq("product_key", key)
      .maybeSingle();

    if (error) throw error;
    return data ? toRecord(data as PricingRow) : null;
  }

  async update(key: ProductKey, amountCents: number, updatedBy: string): Promise<void> {
    const { error } = await supabase
      .from("pricing")
      .update({
        amount_cents: amountCents,
        updated_at:   new Date().toISOString(),
        updated_by:   updatedBy,
      })
      .eq("product_key", key);

    if (error) throw error;
  }
}

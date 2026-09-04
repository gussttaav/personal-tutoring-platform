import type { IPricingRepository } from "@/domain/repositories/IPricingRepository";
import type { PriceRecord, PricingSettings, ProductKey } from "@/domain/types";
import { supabase } from "./client";

interface PricingRow {
  product_key:  string;
  amount_cents: number;
  currency:     string;
  updated_at:   string;
  updated_by:   string | null;
}

interface PricingSettingsRow {
  pack_validity_days: number;
  updated_at:         string;
  updated_by:         string | null;
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

  async getSettings(): Promise<PricingSettings> {
    const { data, error } = await supabase
      .from("pricing_settings")
      .select("pack_validity_days, updated_at, updated_by")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("No pricing_settings row configured (expected id=1)");

    const row = data as PricingSettingsRow;
    return {
      packValidityDays: row.pack_validity_days,
      updatedAt:        row.updated_at,
      updatedBy:        row.updated_by,
    };
  }

  async updateSettings(settings: { packValidityDays: number; updatedBy: string }): Promise<void> {
    const { error } = await supabase
      .from("pricing_settings")
      .update({
        pack_validity_days: settings.packValidityDays,
        updated_at:         new Date().toISOString(),
        updated_by:         settings.updatedBy,
      })
      .eq("id", 1);
    if (error) throw error;
  }
}

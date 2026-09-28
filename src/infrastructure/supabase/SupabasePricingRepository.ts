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

// PRICING-STUDENT-01: user_pricing carries the same price columns as `pricing`
// (plus user_id, which the caller already knows), so toRecord() maps both.
type UserPricingRow = PricingRow;

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

  // ─── PRICING-STUDENT-01: per-student overrides ──────────────────────────────

  async listForUser(userId: string): Promise<PriceRecord[]> {
    const { data, error } = await supabase
      .from("user_pricing")
      .select("product_key, amount_cents, currency, updated_at, updated_by")
      .eq("user_id", userId);

    if (error) throw error;
    return (data ?? []).map(r => toRecord(r as UserPricingRow));
  }

  async upsertForUser(
    userId: string,
    key: ProductKey,
    amountCents: number,
    updatedBy: string,
  ): Promise<void> {
    // Upsert on the composite PK so re-setting an existing override is one round
    // trip and never leaves a duplicate.
    const { error } = await supabase
      .from("user_pricing")
      .upsert(
        {
          user_id:      userId,
          product_key:  key,
          amount_cents: amountCents,
          updated_at:   new Date().toISOString(),
          updated_by:   updatedBy,
        },
        { onConflict: "user_id,product_key" },
      );

    if (error) throw error;
  }

  async deleteForUser(userId: string, key: ProductKey): Promise<void> {
    const { error } = await supabase
      .from("user_pricing")
      .delete()
      .eq("user_id", userId)
      .eq("product_key", key);

    if (error) throw error;
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

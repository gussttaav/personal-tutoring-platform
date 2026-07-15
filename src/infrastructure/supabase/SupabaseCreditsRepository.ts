// DB-02: Supabase-backed implementation of ICreditsRepository.
// Credits are stored as per-pack rows in credit_packs; queries aggregate
// across all active (non-expired) packs ordered by expires_at ASC (FIFO).
import type { ICreditsRepository, DecrementResult } from "@/domain/repositories/ICreditsRepository";
import type { CreditResult, PackSize } from "@/domain/types";
import { PACK_VALIDITY_MONTHS } from "@/constants";
import { paymentChannelName } from "@/lib/realtime-channel";
import { supabase } from "./client";

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export class SupabaseCreditsRepository implements ICreditsRepository {
  async getCredits(email: string): Promise<CreditResult | null> {
    const userId = await this.findUserId(email);
    if (!userId) return null;

    const { data: packs, error } = await supabase
      .from("credit_packs")
      .select("credits_remaining, pack_size, expires_at")
      .eq("user_id", userId)
      .gt("expires_at", new Date().toISOString())
      .gt("credits_remaining", 0)
      .order("expires_at", { ascending: true });

    if (error) throw error;
    if (!packs?.length) return null;

    const total = packs.reduce((sum, p) => sum + p.credits_remaining, 0);

    const { data: user } = await supabase
      .from("users")
      .select("name")
      .eq("id", userId)
      .single();

    return {
      credits:   total,
      name:      user?.name ?? "",
      packSize:  packs[0].pack_size as PackSize,
      expiresAt: packs[0].expires_at,
    };
  }

  async addCredits(params: {
    email:           string;
    name:            string;
    creditsToAdd:    number;
    packLabel:       string;
    stripeSessionId: string;
  }): Promise<void> {
    const userId   = await this.upsertUser(params.email, params.name);
    const packSize = this.parsePackSize(params.packLabel, params.creditsToAdd);
    const expiresAt = addMonths(new Date(), PACK_VALIDITY_MONTHS).toISOString();

    const { error } = await supabase.from("credit_packs").insert({
      user_id:           userId,
      pack_size:         packSize,
      credits_remaining: params.creditsToAdd,
      stripe_payment_id: params.stripeSessionId,
      expires_at:        expiresAt,
    });

    // 23505 = unique_violation — stripe_payment_id already exists, idempotent
    if (error && error.code !== "23505") throw error;
  }

  async decrementCredit(email: string): Promise<DecrementResult> {
    const userId = await this.findUserId(email);
    if (!userId) return { ok: false, remaining: 0, packSize: null, packId: null };

    const { data, error } = await supabase.rpc("decrement_credit", {
      p_user_id: userId,
    });

    if (error) throw error;

    // REFACTOR-P3-03: SQL function returns pack_size; BOOKING-PACKLINK-01: and pack_id.
    const result = data as {
      ok: boolean; remaining: number; pack_size: number | null; pack_id: string | null;
    };
    return {
      ok:        result.ok,
      remaining: result.remaining,
      packSize:  (result.pack_size as PackSize | null) ?? null,
      packId:    result.pack_id ?? null,
    };
  }

  async restoreCredit(email: string): Promise<{ ok: boolean; credits: number }> {
    const userId = await this.findUserId(email);
    if (!userId) return { ok: false, credits: 0 };

    const { data, error } = await supabase.rpc("restore_credit", {
      p_user_id: userId,
    });

    if (error) throw error;
    return data as { ok: boolean; credits: number };
  }

  async hasProcessedPayment(stripeSessionId: string): Promise<boolean> {
    const { count } = await supabase
      .from("credit_packs")
      .select("id", { count: "exact", head: true })
      .eq("stripe_payment_id", stripeSessionId);
    return (count ?? 0) > 0;
  }

  // REFACTOR-P3-05: Broadcast on a per-PaymentIntent channel. The name is derived
  // via HMAC from paymentIntentId + REALTIME_CHANNEL_SECRET, so unguessable without
  // the secret. Fire-and-forget — persistence already happened in addCredits.
  async broadcastPaymentConfirmed(
    paymentIntentId: string,
    payload: { credits: number; name: string; packSize: number },
  ): Promise<void> {
    const channel = supabase.channel(paymentChannelName(paymentIntentId), {
      config: { broadcast: { ack: false } },
    });
    try {
      await channel.send({ type: "broadcast", event: "confirmed", payload });
    } finally {
      await supabase.removeChannel(channel);
    }
  }

  private async findUserId(email: string): Promise<string | null> {
    const { data } = await supabase
      .from("users")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();
    return data?.id ?? null;
  }

  private async upsertUser(email: string, name: string): Promise<string> {
    const normalized = email.toLowerCase().trim();
    const { data, error } = await supabase
      .from("users")
      .upsert({ email: normalized, name }, { onConflict: "email" })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }

  private parsePackSize(packLabel: string, creditsToAdd: number): 5 | 10 {
    if (packLabel.includes("10") || creditsToAdd === 10) return 10;
    return 5;
  }
}

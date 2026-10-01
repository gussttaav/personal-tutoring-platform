// DB-02: Supabase-backed implementation of IPaymentRepository.
// Idempotency keys → webhook_events table.
// Dead-letter failed bookings → failed_bookings table.
// SINGLE-SESSION-CONFIRM-01: slot-taken refunds → single_session_refunds table;
// single-session resolution broadcast on the per-PaymentIntent Realtime channel.
// REFACTOR-R4-P1-02: isProcessed / hasFailedBooking / wasRefunded fail CLOSED — a read
// error throws instead of reading as "absent", because the webhook treats "absent" as
// permission to process or refund.
import type { IPaymentRepository, FailedBookingEntry } from "@/domain/repositories/IPaymentRepository";
import type { RecordPaymentInput, SingleSessionResolved } from "@/domain/types";
import { paymentChannelName } from "@/lib/realtime-channel";
import { supabase } from "./client";

export class SupabasePaymentRepository implements IPaymentRepository {
  // REFACTOR-R4-P1-02: fail CLOSED. A read error must never read as "absent" — every
  // caller of this method treats `false` as permission to act (process / refund / erase).
  async isProcessed(idempotencyKey: string): Promise<boolean> {
    const { data, error } = await supabase
      .from("webhook_events")
      .select("idempotency_key")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (error) throw error;
    return data !== null;
  }

  async markProcessed(idempotencyKey: string): Promise<void> {
    const { error } = await supabase
      .from("webhook_events")
      .insert({ idempotency_key: idempotencyKey })
      .select()
      .single();
    // 23505 = unique_violation — already marked, safe to ignore
    if (error && error.code !== "23505") throw error;
  }

  async recordFailedBooking(entry: FailedBookingEntry): Promise<void> {
    const { error } = await supabase.from("failed_bookings").upsert({
      stripe_session_id: entry.stripeSessionId,
      user_id:           entry.userId,
      start_iso:         entry.startIso,
      failed_at:         entry.failedAt,
      error:             entry.error,
    });
    if (error) throw error;
  }

  async listFailedBookings(): Promise<FailedBookingEntry[]> {
    const { data, error } = await supabase
      .from("failed_bookings")
      .select("stripe_session_id, user_id, start_iso, failed_at, error, users(email)")
      .order("failed_at", { ascending: false });

    if (error) throw error;

    return (data ?? []).map(row => {
      const usersJoin = row.users as { email: string } | null;
      return {
        stripeSessionId: row.stripe_session_id,
        userId:          row.user_id,
        email:           usersJoin?.email,
        startIso:        row.start_iso,
        failedAt:        row.failed_at,
        error:           row.error,
      };
    });
  }

  async clearFailedBooking(stripeSessionId: string): Promise<void> {
    const { error } = await supabase
      .from("failed_bookings")
      .delete()
      .eq("stripe_session_id", stripeSessionId);
    if (error) throw error;
  }

  // REFACTOR-P4-01: reconciliation lookup — true if a dead-letter entry exists.
  // REFACTOR-R4-P1-02: throws on a read error (a false "no dead letter" is a false mismatch).
  async hasFailedBooking(stripeSessionId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from("failed_bookings")
      .select("stripe_session_id")
      .eq("stripe_session_id", stripeSessionId)
      .maybeSingle();
    if (error) throw error;
    return data !== null;
  }

  // SINGLE-SESSION-CONFIRM-01: idempotent slot-taken refund record. ON CONFLICT DO NOTHING
  // (upsert with ignoreDuplicates) so a duplicate webhook is a no-op.
  async recordSlotTakenRefund(paymentIntentId: string): Promise<void> {
    const { error } = await supabase
      .from("single_session_refunds")
      .upsert(
        { stripe_payment_id: paymentIntentId, reason: "slot_taken" },
        { onConflict: "stripe_payment_id", ignoreDuplicates: true },
      );
    if (error) throw error;
  }

  // SINGLE-SESSION-CONFIRM-01: true if a slot-taken refund was recorded for this PaymentIntent.
  // REFACTOR-R4-P1-02: throws on a read error — "not refunded" lets the webhook refund again.
  async wasRefunded(paymentIntentId: string): Promise<boolean> {
    const { count, error } = await supabase
      .from("single_session_refunds")
      .select("stripe_payment_id", { count: "exact", head: true })
      .eq("stripe_payment_id", paymentIntentId);
    if (error) throw error;
    return (count ?? 0) > 0;
  }

  // SINGLE-SESSION-CONFIRM-01: best-effort broadcast on the per-PaymentIntent channel.
  // Same HMAC capability model + fire-and-forget pattern as
  // SupabaseCreditsRepository.broadcastPaymentConfirmed.
  async broadcastSingleSessionResolved(
    paymentIntentId: string,
    payload: SingleSessionResolved,
  ): Promise<void> {
    const channel = supabase.channel(paymentChannelName(paymentIntentId), {
      config: { broadcast: { ack: false } },
    });
    try {
      await channel.send({ type: "broadcast", event: "resolved", payload });
    } finally {
      await supabase.removeChannel(channel);
    }
  }

  // PAYMENTS-AUDIT-01: idempotent insert into `payments`. The stripe_payment_id
  // UNIQUE constraint makes a duplicate webhook delivery a no-op (23505 tolerated,
  // mirroring SupabaseCreditsRepository.addCredits).
  async recordPayment(input: RecordPaymentInput): Promise<void> {
    const { error } = await supabase.from("payments").insert({
      user_id:           input.userId,
      stripe_payment_id: input.stripePaymentId,
      amount_cents:      input.amountCents,
      currency:          input.currency,
      checkout_type:     input.checkoutType,
      status:            input.status ?? "succeeded",
    });
    // 23505 = unique_violation — stripe_payment_id already recorded, idempotent no-op
    if (error && error.code !== "23505") throw error;
  }
}

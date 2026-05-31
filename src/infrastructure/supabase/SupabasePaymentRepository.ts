// DB-02: Supabase-backed implementation of IPaymentRepository.
// Idempotency keys → webhook_events table.
// Dead-letter failed bookings → failed_bookings table.
import type { IPaymentRepository, FailedBookingEntry } from "@/domain/repositories/IPaymentRepository";
import { supabase } from "./client";

export class SupabasePaymentRepository implements IPaymentRepository {
  async isProcessed(idempotencyKey: string): Promise<boolean> {
    const { data } = await supabase
      .from("webhook_events")
      .select("idempotency_key")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
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
  async hasFailedBooking(stripeSessionId: string): Promise<boolean> {
    const { data } = await supabase
      .from("failed_bookings")
      .select("stripe_session_id")
      .eq("stripe_session_id", stripeSessionId)
      .maybeSingle();
    return data !== null;
  }
}

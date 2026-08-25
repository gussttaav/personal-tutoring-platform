import type { ISubscriptionRepository } from "@/domain/repositories/ISubscriptionRepository";
import type { SubscriptionRecipient, SubscriptionType } from "@/domain/types";
import { supabase } from "./client";

export class SupabaseSubscriptionRepository implements ISubscriptionRepository {
  async subscribe(userId: string, type: SubscriptionType): Promise<void> {
    const { error } = await supabase
      .from("subscriptions")
      .insert({ user_id: userId, type });

    // 23505 = unique_violation — already subscribed, treat as idempotent success
    if (error && error.code !== "23505") throw error;
  }

  async isSubscribed(userId: string, type: SubscriptionType): Promise<boolean> {
    const { count, error } = await supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("type", type);

    if (error) throw error;
    return (count ?? 0) > 0;
  }

  // COURSE-P6-02: idempotent by construction — DELETE matching nothing is not an error.
  async unsubscribe(userId: string, type: SubscriptionType): Promise<void> {
    const { error } = await supabase
      .from("subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("type", type);

    if (error) throw error;
  }

  // COURSE-P6-02: inner join on `users` — the subscription table dropped its own `email`
  // column in migration 0003, so email and locale come from the FK. `!inner` makes it a
  // real inner join rather than a nullable embed, which is correct: the FK is NOT NULL.
  // A NULL `locale` (user who never hit seedLocaleOnLogin) defaults to Spanish, the same
  // fallback the booking emails use.
  async listByType(type: SubscriptionType): Promise<SubscriptionRecipient[]> {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("user_id, users!inner(email, locale)")
      .eq("type", type)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return (data ?? []).map((row) => {
      const user = row.users as unknown as { email: string; locale: string | null };
      return {
        userId: row.user_id,
        email:  user.email,
        locale: user.locale === "en" ? "en" : "es",
      };
    });
  }
}

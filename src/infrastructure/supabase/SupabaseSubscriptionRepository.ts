import type { ISubscriptionRepository } from "@/domain/repositories/ISubscriptionRepository";
import type { BlogArea, SubscriptionRecipient, SubscriptionType } from "@/domain/types";
import { BLOG_AREAS } from "@/constants/blog";
import { supabase } from "./client";

/** BLOG-15: the DB column is plain TEXT[]; keep only the areas the code still knows, so a
 *  retired area id left in a row can never reach the matcher or the UI. An array that
 *  filters down to nothing reads as "every area" rather than as a subscription to none. */
function toAreas(raw: string[] | null): BlogArea[] | null {
  if (!raw) return null;
  const known = raw.filter((a): a is BlogArea => (BLOG_AREAS as readonly string[]).includes(a));
  return known.length > 0 ? known : null;
}

export class SupabaseSubscriptionRepository implements ISubscriptionRepository {
  async subscribe(userId: string, type: SubscriptionType, areas: BlogArea[] | null = null): Promise<void> {
    const { error } = await supabase
      .from("subscriptions")
      .insert({ user_id: userId, type, areas });

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

  // BLOG-15: `maybeSingle` — the (user_id, type) UNIQUE constraint allows at most one row.
  async getAreas(userId: string, type: SubscriptionType): Promise<BlogArea[] | null | undefined> {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("areas")
      .eq("user_id", userId)
      .eq("type", type)
      .maybeSingle();

    if (error) throw error;
    if (!data) return undefined;
    return toAreas(data.areas);
  }

  // BLOG-15: `select` after the update returns the rows it touched, which is how "was there
  // a subscription to update?" is answered without a separate read.
  async updateAreas(userId: string, type: SubscriptionType, areas: BlogArea[] | null): Promise<boolean> {
    const { data, error } = await supabase
      .from("subscriptions")
      .update({ areas })
      .eq("user_id", userId)
      .eq("type", type)
      .select("id");

    if (error) throw error;
    return (data ?? []).length > 0;
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
      .select("user_id, areas, users!inner(email, locale)")
      .eq("type", type)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return (data ?? []).map((row) => {
      const user = row.users as unknown as { email: string; locale: string | null };
      return {
        userId: row.user_id,
        email:  user.email,
        locale: user.locale === "en" ? "en" : "es",
        areas:  toAreas(row.areas),
      };
    });
  }
}

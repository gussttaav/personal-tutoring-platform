// ACCOUNT-DELETE-01: deleteAccount() delegates to the delete_user_account stored
// procedure (supabase/migrations/0017_delete_user_account.sql) so the FK-safe walk
// across the 13 user-linked tables commits atomically.
import type { AccountDeletionCounts, IUserRepository } from "@/domain/repositories/IUserRepository";
import { UserNotFoundError } from "@/domain/errors";
import { supabase } from "./client";

export class SupabaseUserRepository implements IUserRepository {
  async upsert(email: string, name?: string, avatarUrl?: string): Promise<string> {
    const normalized = email.toLowerCase().trim();

    const payload: { email: string; name?: string; avatar_url?: string } = { email: normalized };
    if (name)      payload.name       = name;
    if (avatarUrl) payload.avatar_url = avatarUrl;

    const { data, error } = await supabase
      .from("users")
      .upsert(payload, { onConflict: "email" })
      .select("id")
      .single();

    if (error) throw error;
    return data.id;
  }

  async findByEmail(email: string): Promise<{ id: string } | null> {
    const normalized = email.toLowerCase().trim();
    const { data, error } = await supabase
      .from("users")
      .select("id")
      .eq("email", normalized)
      .maybeSingle();

    if (error) throw error;
    return data ?? null;
  }

  async getRole(email: string): Promise<"student" | "teacher" | "admin" | null> {
    const { data, error } = await supabase
      .from("users")
      .select("role")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return data.role as "student" | "teacher" | "admin";
  }

  async setRole(email: string, role: "student" | "teacher" | "admin"): Promise<void> {
    const { error } = await supabase
      .from("users")
      .update({ role })
      .eq("email", email.toLowerCase().trim());
    if (error) throw error;
  }

  async getLocale(email: string): Promise<"es" | "en" | null> {
    const { data, error } = await supabase
      .from("users")
      .select("locale")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();
    if (error) throw error;
    if (!data || data.locale === null) return null;
    return data.locale as "es" | "en";
  }

  async setLocale(email: string, locale: "es" | "en"): Promise<void> {
    const { error } = await supabase
      .from("users")
      .update({ locale })
      .eq("email", email.toLowerCase().trim());
    if (error) throw error;
  }

  async deleteAccount(email: string): Promise<AccountDeletionCounts> {
    const normalized = email.toLowerCase().trim();

    const { data, error } = await supabase.rpc("delete_user_account", { p_email: normalized });
    if (error) throw error;

    const result = (data ?? {}) as { found?: boolean } & AccountDeletionCounts;
    if (!result.found) throw new UserNotFoundError();

    const { found: _found, ...counts } = result;
    return counts as AccountDeletionCounts;
  }
}

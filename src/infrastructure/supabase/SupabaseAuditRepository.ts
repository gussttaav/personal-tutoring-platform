// DB-02: Supabase-backed implementation of IAuditRepository.
// Audit entries are appended to audit_log; newest-first via ORDER BY created_at DESC.
import type { IAuditRepository } from "@/domain/repositories/IAuditRepository";
import type { AuditEntry } from "@/domain/types";
import { supabase } from "./client";

const MAX_AUDIT_ENTRIES = 100;

export class SupabaseAuditRepository implements IAuditRepository {
  async append(email: string, entry: Omit<AuditEntry, "ts">): Promise<void> {
    const userId = await this.upsertUser(email);
    const ts     = new Date().toISOString();

    const { action, ...rest } = entry as { action: string } & Record<string, unknown>;

    const { error } = await supabase.from("audit_log").insert({
      user_id: userId,
      action,
      details: { ts, ...rest },
    });

    if (error) throw error;
  }

  async list(email: string, limit = MAX_AUDIT_ENTRIES): Promise<AuditEntry[]> {
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (!user) return [];

    const { data, error } = await supabase
      .from("audit_log")
      .select("action, details, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data ?? []).map(row => {
      const details = (row.details ?? {}) as Record<string, unknown>;
      const ts      = (details.ts as string) ?? row.created_at;
      return { action: row.action, ts, ...details } as AuditEntry;
    });
  }

  // COURSE-P6-02: `details` is JSONB, so `.contains` is an index-friendly @> match on the
  // key rather than a scan. The `users!inner` embed turns the user_id FK back into the
  // address the send actually keys on.
  async listNotifiedEmails(action: string, announcementKey: string): Promise<Set<string>> {
    const { data, error } = await supabase
      .from("audit_log")
      .select("users!inner(email)")
      .eq("action", action)
      .contains("details", { announcementKey });

    if (error) throw error;

    const emails = new Set<string>();
    for (const row of data ?? []) {
      const user = row.users as unknown as { email: string } | null;
      if (user?.email) emails.add(user.email.toLowerCase());
    }
    return emails;
  }

  private async upsertUser(email: string): Promise<string> {
    const normalized = email.toLowerCase().trim();
    const { data, error } = await supabase
      .from("users")
      .upsert({ email: normalized, name: "" }, { onConflict: "email" })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }
}

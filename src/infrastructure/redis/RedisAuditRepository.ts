// ARCH-11 — Redis-backed implementation of IAuditRepository.
// append delegates to kvModule.appendAuditLog (owns the lpush+ltrim logic).
// list reads directly from kv since no equivalent helper exists in kv.ts.
import type { IAuditRepository } from "@/domain/repositories/IAuditRepository";
import type { AuditEntry } from "@/domain/types";
import * as kvModule from "./credits-store";
import { kv } from "@/infrastructure/redis/client";

const MAX_AUDIT_ENTRIES = 100;

export class RedisAuditRepository implements IAuditRepository {
  async append(email: string, entry: Omit<AuditEntry, "ts">): Promise<void> {
    return kvModule.appendAuditLog(email, entry.action as string, entry as Record<string, unknown>);
  }

  async list(email: string, limit = MAX_AUDIT_ENTRIES): Promise<AuditEntry[]> {
    const raw = await kv.lrange<string>(`audit:${email.toLowerCase().trim()}`, 0, limit - 1);
    return raw
      .map(r => {
        try { return JSON.parse(typeof r === "string" ? r : JSON.stringify(r)) as AuditEntry; }
        catch { return null; }
      })
      .filter((e): e is AuditEntry => e !== null);
  }
}

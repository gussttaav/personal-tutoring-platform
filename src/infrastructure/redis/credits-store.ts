/**
 * lib/kv.ts — credits store backed by Upstash Redis
 *
 * Key schema
 * ──────────
 * credits:{email}          → CreditRecord  (JSON, no TTL)
 * audit:{email}            → Redis list of AuditEntry JSON strings (LPUSH, newest first)
 *                            Capped at MAX_AUDIT_ENTRIES (100) via LTRIM.
 *
 * Applied fixes (cumulative):
 *   Week 2 — ARCH-02: shared kv singleton from lib/redis.ts
 *   Week 4 — OBS-01:  structured log() calls
 *   Backlog — AUDIT:  appendAuditLog() writes every credit mutation to a
 *                     Redis list so disputes can be investigated without a
 *                     traditional database. The list is bounded to 100
 *                     entries per student via LTRIM — no unbounded growth.
 *   SEC-01 — Atomic decrement via Lua script. The previous GET/modify/SET
 *             pattern allowed two concurrent /api/book requests to both read
 *             credits=1, both pass the check, and both decrement — consuming
 *             one credit for two bookings. The Lua script below runs
 *             server-side in Redis and is atomic.
 */

import type { CreditResult, PackSize, CreditRecord, AuditEntry } from "@/domain/types";
import { PACK_SIZES, PACK_VALIDITY_MONTHS } from "@/constants";
import { kv } from "./client";
import { log } from "@/lib/logger";

// Maximum number of audit entries kept per student (newest first)
const MAX_AUDIT_ENTRIES = 100;

// SEC-01: Atomic check-and-decrement. Runs server-side in Redis so the read,
// validation, and write are a single serialized operation — no TOCTOU window.
const DECREMENT_SCRIPT = `
  local key = KEYS[1]
  local raw = redis.call('GET', key)
  if not raw then return cjson.encode({ok=false, remaining=0}) end
  local record = cjson.decode(raw)

  local now     = tonumber(ARGV[1])
  local expires = tonumber(ARGV[2]) or 0
  if expires > 0 and now > expires then
    return cjson.encode({ok=false, remaining=0})
  end

  if record.credits <= 0 then
    return cjson.encode({ok=false, remaining=0})
  end

  record.credits = record.credits - 1
  record.lastUpdated = ARGV[3]
  redis.call('SET', key, cjson.encode(record))
  return cjson.encode({ok=true, remaining=record.credits})
`;

// ─── Key helpers ──────────────────────────────────────────────────────────────

function key(email: string): string {
  return `credits:${email.toLowerCase().trim()}`;
}

function auditKey(email: string): string {
  return `audit:${email.toLowerCase().trim()}`;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function isExpired(expiresAt: string): boolean {
  if (!expiresAt) return false;
  return new Date() > new Date(expiresAt);
}

function parsePackSize(packLabel: string): PackSize | null {
  for (const size of PACK_SIZES) {
    if (packLabel.includes(String(size))) return size;
  }
  return null;
}

// ─── Audit log ────────────────────────────────────────────────────────────────

/**
 * Appends an audit entry to the student's Redis list.
 *
 * Uses LPUSH (prepend) so the list is always newest-first.
 * LTRIM caps the list at MAX_AUDIT_ENTRIES so it never grows unboundedly.
 *
 * This is best-effort: if Redis is unavailable the error is logged but not
 * propagated — a failed audit write should never block a real booking.
 */
export async function appendAuditLog(
  email: string,
  action: string,
  context: Record<string, unknown>
): Promise<void> {
  const entry: AuditEntry = {
    action,
    ts: new Date().toISOString(),
    ...context,
  };

  try {
    const k = auditKey(email);
    await kv.lpush(k, JSON.stringify(entry));
    await kv.ltrim(k, 0, MAX_AUDIT_ENTRIES - 1);
  } catch (err) {
    // Non-critical — log and continue
    log("warn", "Audit log write failed (non-fatal)", { service: "kv", action, email, error: String(err) });
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getCredits(email: string): Promise<CreditResult | null> {
  const record = await kv.get<CreditRecord>(key(email));
  if (!record) return null;

  const credits = isExpired(record.expiresAt) ? 0 : record.credits;
  return {
    credits,
    name:      record.name,
    packSize:  record.packSize ?? parsePackSize(record.packLabel),
    expiresAt: record.expiresAt,
  };
}

export async function addOrUpdateStudent(
  email: string,
  name: string,
  creditsToAdd: number,
  packLabel: string,
  stripeSessionId: string
): Promise<void> {
  const k        = key(email);
  const existing = await kv.get<CreditRecord>(k);

  if (existing?.stripeSessionId === stripeSessionId) {
    log("info", "Duplicate webhook skipped", { service: "kv", stripeSessionId });
    return;
  }

  const now         = new Date();
  const expiresAt   = addMonths(now, PACK_VALIDITY_MONTHS).toISOString();
  const baseCredits = existing && !isExpired(existing.expiresAt) ? existing.credits : 0;

  const record: CreditRecord = {
    email:          email.toLowerCase().trim(),
    name,
    credits:        baseCredits + creditsToAdd,
    packLabel,
    packSize:       parsePackSize(packLabel),
    expiresAt,
    lastUpdated:    now.toISOString(),
    stripeSessionId,
  };

  await kv.set(k, record);
  log("info", "Credits updated", { service: "kv", email, credits: record.credits });

  // Audit
  await appendAuditLog(email, "purchase", {
    creditsAdded: creditsToAdd,
    totalCredits: record.credits,
    stripeSessionId,
  });
}

export async function decrementCredit(
  email: string
): Promise<{ ok: boolean; remaining: number }> {
  const k      = key(email);
  const record = await kv.get<CreditRecord>(k);
  if (!record) return { ok: false, remaining: 0 };

  const expiresMs = record.expiresAt ? new Date(record.expiresAt).getTime() : 0;
  const result = await kv.eval<[number, number, string], string>(
    DECREMENT_SCRIPT,
    [k],
    [Date.now(), expiresMs, new Date().toISOString()]
  );
  // Upstash may return the Lua cjson result already deserialized (object) or
  // as a raw JSON string, depending on the client version. Handle both.
  const parsed = (typeof result === "string"
    ? JSON.parse(result)
    : result) as { ok: boolean; remaining: number };

  if (parsed.ok) {
    log("info", "Credit decremented", { service: "kv", email, remaining: parsed.remaining });
    await appendAuditLog(email, "decrement", {
      creditsBefore: parsed.remaining + 1,
      creditsAfter:  parsed.remaining,
    });
  }

  return parsed;
}

export async function restoreCredit(
  email: string
): Promise<{ ok: boolean; credits: number }> {
  const k      = key(email);
  const record = await kv.get<CreditRecord>(k);

  if (!record)                     return { ok: false, credits: 0 };
  if (isExpired(record.expiresAt)) return { ok: false, credits: 0 };

  const packSize = record.packSize ?? parsePackSize(record.packLabel) ?? 0;
  const restored = Math.min(record.credits + 1, packSize);

  const updated: CreditRecord = {
    ...record,
    credits:     restored,
    lastUpdated: new Date().toISOString(),
  };

  await kv.set(k, updated);
  log("info", "Credit restored", { service: "kv", email, credits: restored });

  // Audit
  await appendAuditLog(email, "restore", {
    creditsBefore: record.credits,
    creditsAfter:  restored,
  });

  return { ok: true, credits: restored };
}

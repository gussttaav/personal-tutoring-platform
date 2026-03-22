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
 */

import type { CreditResult, PackSize } from "@/types";
import { PACK_SIZES, PACK_VALIDITY_MONTHS } from "@/constants";
import { kv } from "@/lib/redis";
import { log } from "@/lib/logger";

// Maximum number of audit entries kept per student (newest first)
const MAX_AUDIT_ENTRIES = 100;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreditRecord {
  email:           string;
  name:            string;
  credits:         number;
  packLabel:       string;
  packSize:        PackSize | null;
  expiresAt:       string;       // ISO string
  lastUpdated:     string;       // ISO string
  stripeSessionId: string;       // last processed session — idempotency key
}

export interface AuditEntry {
  action:  string;
  ts:      string;
  [key: string]: unknown;
}

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

  if (!record)                     return { ok: false, remaining: 0 };
  if (isExpired(record.expiresAt)) return { ok: false, remaining: 0 };
  if (record.credits <= 0)         return { ok: false, remaining: 0 };

  const updated: CreditRecord = {
    ...record,
    credits:     record.credits - 1,
    lastUpdated: new Date().toISOString(),
  };

  await kv.set(k, updated);

  // Audit
  await appendAuditLog(email, "decrement", {
    creditsBefore: record.credits,
    creditsAfter:  updated.credits,
  });

  return { ok: true, remaining: updated.credits };
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

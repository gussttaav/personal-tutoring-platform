/**
 * Credits store backed by Vercel KV (Upstash Redis under the hood).
 *
 * Key schema
 * ──────────
 * credits:{email}   →  CreditRecord  (JSON, no TTL — expiry is stored inside the record)
 *
 * Why no key TTL?  Redis TTL would silently delete the record, making it
 * impossible to distinguish "user never purchased" from "pack expired".
 * We keep the record forever and check expiresAt at read time.
 */

import type { CreditResult, PackSize } from "@/types";
import { PACK_SIZES, PACK_VALIDITY_MONTHS } from "@/constants";
import { Redis } from "@upstash/redis";

const kv = Redis.fromEnv();

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreditRecord {
  email: string;
  name: string;
  credits: number;
  packLabel: string;
  packSize: PackSize | null;
  expiresAt: string;       // ISO string
  lastUpdated: string;     // ISO string
  stripeSessionId: string; // last processed session — idempotency key
}

// ─── Key helper ───────────────────────────────────────────────────────────────

function key(email: string): string {
  return `credits:${email.toLowerCase().trim()}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Read a student's active credit balance.
 * Returns null if the student has never purchased.
 */
export async function getCredits(email: string): Promise<CreditResult | null> {
  const record = await kv.get<CreditRecord>(key(email));
  if (!record) return null;

  const credits = isExpired(record.expiresAt) ? 0 : record.credits;

  return {
    credits,
    name: record.name,
    packSize: record.packSize ?? parsePackSize(record.packLabel),
    expiresAt: record.expiresAt,
  };
}

/**
 * Create or update a student's credit record after a successful Stripe payment.
 * Idempotent: calling with the same stripeSessionId twice is a no-op.
 */
export async function addOrUpdateStudent(
  email: string,
  name: string,
  creditsToAdd: number,
  packLabel: string,
  stripeSessionId: string
): Promise<void> {
  const k = key(email);
  const existing = await kv.get<CreditRecord>(k);

  // ── Idempotency check ────────────────────────────────────────────────────
  if (existing?.stripeSessionId === stripeSessionId) {
    console.info(`[kv] Duplicate webhook skipped: ${stripeSessionId}`);
    return;
  }

  const now = new Date();
  const expiresAt = addMonths(now, PACK_VALIDITY_MONTHS).toISOString();

  // If the existing pack is expired, reset credits to 0 before adding
  const baseCredits =
    existing && !isExpired(existing.expiresAt) ? existing.credits : 0;

  const record: CreditRecord = {
    email: email.toLowerCase().trim(),
    name,
    credits: baseCredits + creditsToAdd,
    packLabel,
    packSize: parsePackSize(packLabel),
    expiresAt,
    lastUpdated: now.toISOString(),
    stripeSessionId,
  };

  await kv.set(k, record);
  console.info(`[kv] Credits updated: ${email} credits=${record.credits}`);
}

/**
 * Decrement a student's credits by 1 when they book a class.
 * Returns { ok: false } if the student has no active credits.
 */
export async function decrementCredit(
  email: string
): Promise<{ ok: boolean; remaining: number }> {
  const k = key(email);
  const record = await kv.get<CreditRecord>(k);

  if (!record) return { ok: false, remaining: 0 };
  if (isExpired(record.expiresAt)) return { ok: false, remaining: 0 };
  if (record.credits <= 0) return { ok: false, remaining: 0 };

  const updated: CreditRecord = {
    ...record,
    credits: record.credits - 1,
    lastUpdated: new Date().toISOString(),
  };

  await kv.set(k, updated);
  return { ok: true, remaining: updated.credits };
}

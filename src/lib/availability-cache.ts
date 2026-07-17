// PERF-10 — Tiered availability caching.
// Cache key format: avail:v{version}:{date}:{duration}
// TTL depends on how far out the date is; cache is invalidated on any
// booking create/cancel that affects the date (per-date `invalidate`), and
// globally when the admin edits the schedule (`bumpScheduleVersion`).
import { kv } from "@/infrastructure/redis/client";

// Global version namespace. A schedule edit affects every future date, so rather
// than deleting per-date keys we bump this counter — all old keys are instantly
// orphaned and expire on their own TTL. Reads resolve the version once per call.
const VERSION_KEY = "avail:version";

/** Resolves the current version counter (0 when unset). Shared with the config cache. */
export async function currentVersion(): Promise<number> {
  const v = await kv.get<number | string>(VERSION_KEY);
  const n = typeof v === "string" ? parseInt(v, 10) : v;
  return Number.isFinite(n as number) ? (n as number) : 0;
}

/** Bumps the global availability cache version, orphaning every cached date. */
export async function bumpScheduleVersion(): Promise<void> {
  await kv.incr(VERSION_KEY);
}

export function cacheTTLSeconds(date: string): number {
  const daysAhead = Math.floor(
    (new Date(date).getTime() - Date.now()) / 86_400_000
  );
  if (daysAhead <= 1) return 0;
  if (daysAhead <= 7) return 300;
  return 900;
}

export function cacheKey(version: number, date: string, duration: number): string {
  return `avail:v${version}:${date}:${duration}`;
}

export async function getCached<T>(date: string, duration: number): Promise<T | null> {
  const ttl = cacheTTLSeconds(date);
  if (ttl === 0) return null;
  const version = await currentVersion();
  return kv.get<T>(cacheKey(version, date, duration));
}

export async function setCached<T>(date: string, duration: number, value: T): Promise<void> {
  const ttl = cacheTTLSeconds(date);
  if (ttl === 0) return;
  const version = await currentVersion();
  await kv.set(cacheKey(version, date, duration), value, { ex: ttl });
}

export async function invalidate(date: string): Promise<void> {
  const version = await currentVersion();
  await Promise.all([15, 30, 60, 120].map(d => kv.del(cacheKey(version, date, d))));
}

// REFACTOR-P3-03: Coalesce concurrent cache misses for the same key. The first
// caller acquires a short Redis lock and runs `compute`; concurrent callers wait
// briefly and re-read. Falls through to compute if the lock can't be acquired
// (avoid deadlock if Redis flakes). Near-term dates (ttl 0) skip cache + lock.
export async function getOrCompute<T>(
  key: string,
  compute: () => Promise<T>,
  ttlSec: number,
): Promise<T> {
  if (ttlSec === 0) return compute();

  const cached = await kv.get<T>(key);
  if (cached) return cached;

  const lockKey = `lock:${key}`;
  const locked = await kv.set(lockKey, "1", { nx: true, ex: 10 });

  if (!locked) {
    // Someone else is computing — wait briefly and re-read once.
    await new Promise(r => setTimeout(r, 250));
    const retry = await kv.get<T>(key);
    if (retry) return retry;
    // Fall through and compute ourselves rather than spin further.
  }

  try {
    const value = await compute();
    await kv.set(key, value, { ex: ttlSec });
    return value;
  } finally {
    if (locked) await kv.del(lockKey);
  }
}

/** Resolves the current cache key for a date+duration (version-namespaced). */
export async function resolveCacheKey(date: string, duration: number): Promise<string> {
  const version = await currentVersion();
  return cacheKey(version, date, duration);
}

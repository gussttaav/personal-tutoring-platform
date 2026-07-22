// REFACTOR-R3-P3-02 — Redis implementation of IConfigCache.
//
// Rides the existing `avail:version` counter rather than introducing a second
// one: an admin schedule edit already bumps it to orphan the availability keys,
// and that same edit is exactly what invalidates the cached config. Keeping one
// counter means the two caches can never disagree about which version is live.
// Version reads/bumps therefore delegate to availability-cache.ts, which owns it.
//
// No JSON handling here — @upstash/redis auto-serializes on set and parses on
// get; the cached values are plain objects.
import type { IConfigCache } from "@/domain/repositories/IConfigCache";
import { bumpScheduleVersion, currentVersion } from "@/lib/availability-cache";
import { kv } from "./client";

export class RedisConfigCache implements IConfigCache {
  async currentVersion(): Promise<number> {
    return currentVersion();
  }

  async get<T>(key: string): Promise<T | null> {
    return kv.get<T>(key);
  }

  async set<T>(key: string, value: T, ttlSec: number): Promise<void> {
    await kv.set(key, value, { ex: ttlSec });
  }

  async bumpVersion(): Promise<void> {
    await bumpScheduleVersion();
  }
}

export const redisConfigCache = new RedisConfigCache();

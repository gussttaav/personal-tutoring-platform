/**
 * lib/redis.ts — singleton Upstash Redis client
 *
 * ARCH-02: Three separate files (kv.ts, calendar.ts, ratelimit.ts) each called
 * Redis.fromEnv() independently, creating up to three Redis client instances
 * per cold start. While @upstash/redis clients are lightweight, each one
 * parses the environment variables and initialises its own HTTP fetch wrapper.
 *
 * This module creates the client once and exports it for shared use.
 * All other modules import `kv` from here instead of calling Redis.fromEnv().
 *
 * Usage:
 *   import { kv } from "@/lib/redis";
 */

import { Redis } from "@upstash/redis";

export const kv = Redis.fromEnv();

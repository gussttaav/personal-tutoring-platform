/**
 * lib/ratelimit.ts — Upstash rate limiters
 *
 * ARCH-02: Removed local Redis.fromEnv() call. The shared `kv` singleton
 * from lib/redis.ts is used instead, so only one Redis client is created
 * per process across kv.ts, calendar.ts, and ratelimit.ts.
 *
 * PERF-03: Added a dedicated `availabilityRatelimit` for /api/availability.
 * Previously that route borrowed `chatRatelimit` under the `avail:` prefix,
 * which meant availability and chat calls shared the same 20-req/min budget
 * under different key prefixes — defeating the purpose of separate limits.
 * The availability route is now on its own 60-req/min limiter.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { kv } from "@/lib/redis";

// AI chat: 20 messages per minute per IP
export const chatRatelimit = new Ratelimit({
  redis:   kv,
  limiter: Ratelimit.slidingWindow(20, "1 m"),
  prefix:  "rl:chat",
});

// Credits check: 60 requests per minute per IP
// (useUserSession re-fetches on tab visibility change, so the limit needs headroom)
export const creditsRatelimit = new Ratelimit({
  redis:   kv,
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  prefix:  "rl:credits",
});

// Stripe checkout: 10 requests per minute per IP
// (a real user never needs more than 1-2; this stops automated abuse)
export const checkoutRatelimit = new Ratelimit({
  redis:   kv,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix:  "rl:checkout",
});

// Calendar availability: 60 requests per minute per IP
// (PERF-03: dedicated limiter — was incorrectly sharing chatRatelimit)
export const availabilityRatelimit = new Ratelimit({
  redis:   kv,
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  prefix:  "rl:availability",
});

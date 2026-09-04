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
 *
 * REFACTOR-R3-P2-02: Added `cancelRatelimit` (the unauthenticated /api/cancel
 * route had no limiter at all) and `zoomTokenRatelimit` (/api/zoom/token was
 * piggybacking on `availabilityRatelimit` under a `zoom:token:` key prefix,
 * sharing that route's 60-req/min budget).
 *
 * REFACTOR-R3-P3-03: Added `paymentChannelRatelimit` — GET
 * /api/payment-confirmation/channel had no limiter at all.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { kv } from "@/infrastructure/redis/client";

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

// REL-04 — Anonymous chat: 5 messages per minute per IP.
// Authenticated users continue to use chatRatelimit (20/min).
export const chatRatelimitAnon = new Ratelimit({
  redis:   kv,
  limiter: Ratelimit.slidingWindow(5, "1 m"),
  prefix:  "rl:chat:anon",
});

// REL-04 — Anonymous chat daily cap: 30 messages per day per IP.
// Caps total Gemini spend per anonymous IP. Authenticated users
// rely on the 20/min limiter only (no daily cap for signed-in users).
export const chatRatelimitAnonDaily = new Ratelimit({
  redis:   kv,
  limiter: Ratelimit.slidingWindow(30, "1 d"),
  prefix:  "rl:chat:anon:daily",
});

// Subscribe: 10 requests per minute per IP for writes, 30 for reads.
// POST is a one-time action per user per type; low limit stops enumeration.
export const subscribeRatelimit = new Ratelimit({
  redis:   kv,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix:  "rl:subscribe",
});

// Post-class reviews: 20 requests per minute per IP. A single review involves
// up to ~3 writes (rating, comment, google decision); 20 leaves headroom while
// stopping abuse.
export const reviewRatelimit = new Ratelimit({
  redis:   kv,
  limiter: Ratelimit.slidingWindow(20, "1 m"),
  prefix:  "rl:review",
});

// Pricing: 60 requests per minute per IP (authenticated GET /api/pricing).
// The mobile app fetches prices after login; 60/min leaves headroom for refetches.
export const pricingRatelimit = new Ratelimit({
  redis:   kv,
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  prefix:  "rl:pricing",
});

// Schedule: 60 requests per minute per IP (authenticated GET /api/schedule).
// The mobile app fetches the working hours after login; 60/min leaves headroom.
export const scheduleRatelimit = new Ratelimit({
  redis:   kv,
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  prefix:  "rl:schedule",
});

// BOOKING-HISTORY-01: 60 requests per minute per IP (authenticated GET
// /api/my-bookings/history). The screen pages as the user scrolls, so the budget
// has to cover a burst of cursor follow-ups, not just one fetch per visit.
export const historyRatelimit = new Ratelimit({
  redis:   kv,
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  prefix:  "rl:history",
});

// MOBILE-AUTH-01: Google ID token → bearer exchange (POST /api/auth/mobile).
// 10 requests per minute per IP — this is a pre-auth endpoint; a legitimate app
// exchanges only on cold start / token expiry, so a low limit stops abuse.
export const mobileAuthRatelimit = new Ratelimit({
  redis:   kv,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix:  "rl:mobile-auth",
});

// REFACTOR-R3-P2-02: unauthenticated cancel endpoint — tight per-IP cap.
// A human cancels once per email link; 5/min is generous for people and
// hostile to token-guessing scanners.
export const cancelRatelimit = new Ratelimit({
  redis:   kv,
  limiter: Ratelimit.slidingWindow(5, "1 m"),
  prefix:  "rl:cancel",
});

// REFACTOR-R3-P2-02: dedicated limiter (was piggybacking on availabilityRatelimit).
// A token is requested once per session join, plus the occasional rejoin.
export const zoomTokenRatelimit = new Ratelimit({
  redis:   kv,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix:  "rl:zoomtoken",
});

// REFACTOR-R3-P3-03: payment-confirmation channel poll — 30 requests per minute,
// keyed by the AUTHENTICATED EMAIL, not the IP: it's an authenticated endpoint and
// mobile clients share carrier NATs, so per-IP would punish unrelated users. The web
// hook hits it once per mount plus once per Realtime (re)SUBSCRIBED; the mobile S08
// screen polls it. 30/min covers a 2s poll or any reconnect storm within the 30s
// confirmation window.
export const paymentChannelRatelimit = new Ratelimit({
  redis:   kv,
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  prefix:  "rl:paychannel",
});

// COURSE-P4-02: course progress + quiz attempts, keyed by the AUTHENTICATED EMAIL
// for the same reason as paymentChannelRatelimit above — these are authenticated
// endpoints, and students on a school or office NAT would otherwise share a budget.
// The limit is about abuse, not normal use: a lesson view writes once, and a
// 5-question quiz answered twice is ~10 writes, so 120/min is far above any real
// reader while still capping a scripted flood.
export const courseProgressRatelimit = new Ratelimit({
  redis:   kv,
  limiter: Ratelimit.slidingWindow(120, "1 m"),
  prefix:  "rl:courses",
});

// ACCOUNT-DELETE-01: account-deletion preflight + delete, keyed by the
// AUTHENTICATED EMAIL for the same reason as courseProgressRatelimit above. The
// budget covers a realistic loop — open the danger zone, get told to cancel two
// classes, cancel them, re-check — while capping a scripted flood against an
// irreversible endpoint.
export const accountDeletionRatelimit = new Ratelimit({
  redis:   kv,
  limiter: Ratelimit.slidingWindow(10, "1 h"),
  prefix:  "rl:accdel",
});

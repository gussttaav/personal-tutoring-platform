/**
 * lib/ip-utils.ts
 *
 * Safe extraction of the client IP from Next.js request headers.
 *
 * Why this matters:
 *   x-forwarded-for can contain a comma-separated list when the request
 *   passes through multiple proxies: "203.0.113.1, 10.0.0.1, 172.16.0.1"
 *   Using the full string as a Redis rate-limit key means an attacker who
 *   controls the header (on non-Vercel deployments, or via misconfigured
 *   proxies) can craft unique strings to bypass per-IP limits.
 *   We always take only the first (leftmost) address, which is the
 *   original client IP as set by the outermost trusted proxy.
 */

import type { NextRequest } from "next/server";

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "127.0.0.1";
}

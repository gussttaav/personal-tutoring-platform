/**
 * CONTENT-FEEDBACK-01 — the one line the vote and report routes share.
 *
 * Both endpoints accept anonymous readers, so the rate-limit key is tiered: the
 * session email when there is one, the client IP otherwise. Prefixed so the two
 * namespaces cannot collide (an email is never an IP, but the prefix makes the
 * Redis keys self-describing). See the limiter comment in src/lib/ratelimit.ts.
 */
import type { NextRequest } from "next/server";
import { getClientIp } from "@/lib/ip-utils";

export function feedbackLimitKey(req: NextRequest, email: string | null): string {
  return email ? `user:${email}` : `ip:${getClientIp(req)}`;
}

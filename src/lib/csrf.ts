/**
 * lib/csrf.ts — CSRF protection via Origin + Sec-Fetch-Site validation
 *
 * SEC-04: NextAuth's session cookie is SameSite=Lax, which mitigates the
 * basic form-POST CSRF vector. This adds defense in depth by rejecting any
 * state-mutating request whose Origin does not match our own origin OR whose
 * Sec-Fetch-Site indicates a cross-site request.
 *
 * REFACTOR-P2-04: Sec-Fetch-Site is unspoofable from page-controlled code
 * on all evergreen browsers (Chrome 76+, Firefox 90+, Safari 16+, Edge 79+).
 * It's checked first because:
 *   - It catches cross-site requests even when Origin happens to be missing
 *   - It's cheaper than parsing a URL
 *
 * Exemptions:
 *   - /api/stripe/webhook has signature verification (better auth than CSRF)
 *   - /api/internal/zoom-terminate has QStash signature verification
 *   - /api/internal/zoom-terminate-fallback has CRON_SECRET
 *   - /api/auth/* handled by NextAuth
 */

import type { NextRequest } from "next/server";

export function isValidOrigin(req: NextRequest): boolean {
  // REFACTOR-P2-04: Check Sec-Fetch-Site first. Values:
  //   "same-origin": from our own page — allow
  //   "same-site":   from a same-eTLD+1 subdomain — allow (we have none today)
  //   "none":        not from a page (user typed URL, browser opened directly) — allow
  //                  Also: not present in older browsers — fall through to Origin check
  //   "cross-site":  from a different site — DENY
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return false;

  // Origin check (existing behaviour)
  const origin  = req.headers.get("origin");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) return false;
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
}

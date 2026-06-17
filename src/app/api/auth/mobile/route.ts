/**
 * POST /api/auth/mobile
 *
 * MOBILE-AUTH-01: Exchanges a native Google Sign-In ID token for a bearer
 * credential the mobile app sends as `Authorization: Bearer <token>` on
 * subsequent requests.
 *
 * Returns 404 unless MOBILE_AUTH_ENABLED=true, so the feature can be deployed
 * dark and enabled per-environment without affecting web clients.
 *
 * CSRF: intentionally NO Origin check — this is a bearer-exchange endpoint hit
 * by a native app (which sends no Origin), it requires an attacker-unknown valid
 * Google ID token in the body, and it returns the credential in the JSON body
 * only (never a Set-Cookie), so it creates no ambient browser session.
 */

import { NextRequest, NextResponse } from "next/server";
import { MobileAuthSchema } from "@/lib/schemas";
import { mobileAuthService } from "@/services";
import { mintMobileBearer, MOBILE_BEARER_MAX_AGE } from "@/lib/session";
import { mapDomainErrorToResponse } from "@/lib/http-errors";
import { mobileAuthRatelimit } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/ip-utils";

export async function POST(req: NextRequest) {
  // Feature flag — deployable dark.
  if (process.env.MOBILE_AUTH_ENABLED !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Rate limit (pre-auth endpoint).
  const { success } = await mobileAuthRatelimit.limit(getClientIp(req));
  if (!success) {
    return NextResponse.json({ error: "Demasiadas peticiones" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = MobileAuthSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  try {
    const identity = await mobileAuthService.authenticate(parsed.data.idToken);
    const token = await mintMobileBearer(identity);

    return NextResponse.json({
      token,
      expiresIn: MOBILE_BEARER_MAX_AGE,
      user: {
        email:   identity.email,
        name:    identity.name,
        image:   identity.image,
        isAdmin: identity.isAdmin,
      },
    });
  } catch (err) {
    return mapDomainErrorToResponse(err, { route: "auth/mobile", email: undefined });
  }
}

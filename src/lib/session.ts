/**
 * lib/session.ts — unified identity resolution for cookie AND bearer clients.
 *
 * MOBILE-AUTH-01: The web app authenticates via the NextAuth HttpOnly cookie;
 * `auth()` resolves it. The mobile app cannot use cookies — it sends a bearer
 * credential as `Authorization: Bearer <token>`. `getSession()` accepts EITHER,
 * returning the exact same `Session` shape the routes already read.
 *
 * The bearer reuses the NextAuth JWE format (encode/decode from next-auth/jwt,
 * signed with AUTH_SECRET) but with a DISTINCT salt (`mobile-bearer`). This
 * cryptographically partitions the two credential classes: a web session cookie
 * (salted with the cookie name) cannot be replayed as a bearer, and vice versa —
 * `decode()` with the wrong salt fails.
 *
 * SEC: `getSession()` checks the cookie FIRST and returns `auth()`'s result
 * untouched, so cookie clients have ZERO behavior change. The bearer path is
 * only ever reached when there is no valid cookie session.
 */

import { headers } from "next/headers";
import { encode, decode } from "next-auth/jwt";
import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { MobileIdentity } from "@/services/MobileAuthService";

// Distinct from the NextAuth cookie salt (the cookie name) — see module comment.
export const MOBILE_BEARER_SALT = "mobile-bearer";

// Short-lived: the mobile app silently re-exchanges a fresh Google ID token on
// expiry, so a leaked bearer is only valid for this window.
export const MOBILE_BEARER_MAX_AGE = 60 * 60; // 1 hour (seconds)

/**
 * Mints a mobile bearer credential from a resolved identity. The token shape
 * mirrors what NextAuth's jwt callback stores so `decode()` reconstructs the
 * same `Session`.
 */
export async function mintMobileBearer(identity: MobileIdentity): Promise<string> {
  return encode<JWT>({
    token: {
      email:   identity.email,
      name:    identity.name ?? undefined,
      picture: identity.image ?? undefined,
      role:    identity.role,
      sub:     identity.email,
    },
    secret: process.env.AUTH_SECRET!,
    salt:   MOBILE_BEARER_SALT,
    maxAge: MOBILE_BEARER_MAX_AGE,
  });
}

/** Reads and decodes a mobile bearer token; returns null if absent or invalid. */
async function resolveBearerSession(): Promise<Session | null> {
  const authz = (await headers()).get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authz);
  if (!match) return null;

  let token: JWT | null;
  try {
    token = await decode<JWT>({
      token:  match[1].trim(),
      secret: process.env.AUTH_SECRET!,
      salt:   MOBILE_BEARER_SALT,
    });
  } catch {
    // Tampered / wrong-salt (e.g. a web cookie value) / malformed — reject.
    return null;
  }

  if (!token?.email) return null;

  // Synthesize the EXACT shape produced by the session callback in src/auth.ts:
  //   email = token.email, name = token.name, image = token.picture ?? null,
  //   isAdmin = token.role === "admin".
  return {
    user: {
      email:   token.email as string,
      name:    token.name as string,
      image:   (token.picture as string | undefined) ?? null,
      isAdmin: token.role === "admin",
    },
    expires: new Date(
      (token.exp ?? Math.floor(Date.now() / 1000) + MOBILE_BEARER_MAX_AGE) * 1000,
    ).toISOString(),
  };
}

/**
 * Resolves the current identity from EITHER a NextAuth session cookie OR a
 * mobile bearer token. Drop-in replacement for `auth()` in route handlers that
 * should accept mobile clients.
 */
export async function getSession(): Promise<Session | null> {
  // Cookie first — returned verbatim, so web clients are unaffected.
  const cookieSession = await auth();
  if (cookieSession) return cookieSession;

  // No cookie session — try a bearer credential.
  return resolveBearerSession();
}

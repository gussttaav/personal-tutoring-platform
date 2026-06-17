/**
 * GoogleIdTokenVerifier — verifies native Google Sign-In ID tokens.
 *
 * MOBILE-AUTH-01: The mobile app performs native Google Sign-In and receives a
 * Google ID token. This adapter verifies that token correctly before we mint a
 * bearer credential for it.
 *
 * SEC: verifyIdToken validates the JWS signature against Google's cached JWKS,
 * plus the issuer and expiry. We additionally PIN the audience to our mobile
 * OAuth client IDs (GOOGLE_MOBILE_CLIENT_IDS). This is the critical check: an
 * undefined audience makes verifyIdToken skip the `aud` check entirely, which
 * would accept ID tokens minted for ANY Google OAuth client (token substitution).
 * We therefore fail closed when the env var is missing or empty.
 */

import { OAuth2Client } from "google-auth-library";
import { InvalidGoogleTokenError } from "@/domain/errors";
import { log } from "@/lib/logger";
import type {
  IGoogleIdTokenVerifier,
  VerifiedGoogleIdentity,
} from "./IGoogleIdTokenVerifier";

export class GoogleIdTokenVerifier implements IGoogleIdTokenVerifier {
  // A client with no credentials is sufficient for ID-token verification — it
  // only needs Google's public keys, which the library fetches and caches.
  constructor(private readonly client: OAuth2Client = new OAuth2Client()) {}

  private audience(): string[] {
    const ids = (process.env.GOOGLE_MOBILE_CLIENT_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // Fail closed: never call verifyIdToken without a concrete audience.
    if (ids.length === 0) {
      log("error", "GOOGLE_MOBILE_CLIENT_IDS is not configured — refusing to verify", {
        service: "GoogleIdTokenVerifier",
      });
      throw new InvalidGoogleTokenError();
    }
    return ids;
  }

  async verify(idToken: string): Promise<VerifiedGoogleIdentity> {
    const audience = this.audience();

    let payload;
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience });
      payload = ticket.getPayload();
    } catch (err) {
      // Bad signature, expired, wrong audience, malformed — all land here.
      log("warn", "Google ID token verification failed", {
        service: "GoogleIdTokenVerifier",
        error: err instanceof Error ? err.message : String(err),
      });
      throw new InvalidGoogleTokenError();
    }

    if (!payload?.email) {
      throw new InvalidGoogleTokenError();
    }

    return {
      email:         payload.email,
      emailVerified: payload.email_verified === true,
      name:          payload.name,
      picture:       payload.picture,
    };
  }
}

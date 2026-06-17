/**
 * MobileAuthService — exchanges a verified Google ID token for an app identity.
 *
 * MOBILE-AUTH-01: Mirrors the web sign-in path (auth.ts signIn + jwt callbacks)
 * so a mobile user resolves to the SAME users row and role as the web flow:
 *   1. verify the Google ID token (signature/issuer/expiry/audience),
 *   2. require email_verified,
 *   3. ensureUser (register/update name+avatar) — same normalization as web,
 *   4. resolve the DB-backed role.
 *
 * The transport-level bearer minting lives in lib/session.ts (mintMobileBearer);
 * this service only produces the identity. Role is ALWAYS read from the DB —
 * never trusted from any client input — so a client cannot self-grant admin.
 */

import type { UserService } from "./UserService";
import type { IGoogleIdTokenVerifier } from "@/infrastructure/google/IGoogleIdTokenVerifier";
import { EmailNotVerifiedError } from "@/domain/errors";

/** Identity shape used to mint the bearer and returned to the client. */
export interface MobileIdentity {
  email:   string;
  name:    string | null;
  image:   string | null;
  role:    "student" | "teacher" | "admin";
  isAdmin: boolean;
}

export class MobileAuthService {
  constructor(
    private readonly verifier: IGoogleIdTokenVerifier,
    private readonly userService: UserService,
  ) {}

  async authenticate(idToken: string): Promise<MobileIdentity> {
    const identity = await this.verifier.verify(idToken); // throws InvalidGoogleTokenError

    if (!identity.emailVerified) {
      throw new EmailNotVerifiedError();
    }

    const email = identity.email.toLowerCase().trim();

    // Same as the web signIn callback: register/update the user record.
    await this.userService.ensureUser(email, identity.name, identity.picture);

    // Same as the web jwt callback: DB is the sole source of truth for role.
    const role = await this.userService.getRoleAndBootstrap(email);

    return {
      email,
      name:    identity.name ?? null,
      image:   identity.picture ?? null,
      role,
      isAdmin: role === "admin",
    };
  }
}

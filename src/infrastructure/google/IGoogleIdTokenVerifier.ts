// MOBILE-AUTH-01: Verifies a Google ID token (from native Google Sign-In on the
// mobile app) and returns the verified identity. Interface so MobileAuthService
// can be tested with a fake verifier.

export interface VerifiedGoogleIdentity {
  email:         string;
  emailVerified: boolean;
  name?:         string;
  picture?:      string;
}

export interface IGoogleIdTokenVerifier {
  /**
   * Verifies the signature (against Google's JWKS), issuer, expiry and audience
   * of a Google ID token. Throws {@link InvalidGoogleTokenError} on any failure.
   */
  verify(idToken: string): Promise<VerifiedGoogleIdentity>;
}

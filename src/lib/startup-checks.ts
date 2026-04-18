/**
 * lib/startup-checks.ts — environment variable validation
 *
 * Called by instrumentation.ts at server startup (before any request).
 * Kept in a separate module so it can be imported and tested independently
 * without pulling in the Next.js instrumentation lifecycle.
 *
 * Only truly required variables are listed here — ones whose absence causes
 * an immediate hard failure (auth broken, payments broken, calendar broken).
 * Optional variables with in-code fallbacks are intentionally excluded:
 *   - RESEND_FROM  → falls back to "Gustavo Torres <onboarding@resend.dev>"
 *   - NOTIFY_EMAIL → admin notifications are skipped when absent
 */

const REQUIRED_ENV_VARS = [
  // NextAuth v5 — reads AUTH_SECRET automatically by convention
  "AUTH_SECRET",

  // Google OAuth (SSO sign-in)
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",

  // Google Calendar (service account for event creation)
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
  "GOOGLE_CALENDAR_ID",

  // Stripe
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_ID_PACK5",
  "STRIPE_PRICE_ID_PACK10",
  "STRIPE_PRICE_ID_SESSION_1H",
  "STRIPE_PRICE_ID_SESSION_2H",

  // Upstash Redis (KV + rate limiting)
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",

  // Resend (RESEND_FROM and NOTIFY_EMAIL are optional — see module comment)
  "RESEND_API_KEY",

  // Zoom Video SDK
  "ZOOM_VIDEO_SDK_KEY",
  "ZOOM_VIDEO_SDK_SECRET",

  // App
  "NEXT_PUBLIC_BASE_URL",
  "CANCEL_SECRET",
  "GEMINI_API_KEY",
  "TUTOR_EMAIL",

  // Upstash QStash (delayed session termination — REL-01)
  "QSTASH_TOKEN",
  "QSTASH_CURRENT_SIGNING_KEY",
  "QSTASH_NEXT_SIGNING_KEY",
] as const;

export function validateEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `[startup] Missing required environment variables:\n  ${missing.join("\n  ")}\n` +
      `Check your .env.local file or Vercel project settings.`
    );
  }

  // Structural check: GOOGLE_PRIVATE_KEY must look like a PEM key.
  // A common mistake is copying the key without the header/footer lines,
  // or forgetting to escape newlines as \\n in the env file.
  const privateKey = process.env.GOOGLE_PRIVATE_KEY!;
  const hasPemHeader =
    privateKey.includes("-----BEGIN RSA PRIVATE KEY-----") ||
    privateKey.includes("-----BEGIN PRIVATE KEY-----");

  if (!hasPemHeader) {
    throw new Error(
      "[startup] GOOGLE_PRIVATE_KEY does not appear to be a valid PEM key. " +
      "Ensure the full key is set, with newlines escaped as \\\\n."
    );
  }

  // Structural check: CANCEL_SECRET should be at least 32 characters (256-bit entropy).
  // Shorter secrets weaken the HMAC used for cancellation token signing.
  const cancelSecret = process.env.CANCEL_SECRET!;
  if (cancelSecret.length < 32) {
    throw new Error(
      "[startup] CANCEL_SECRET is too short (minimum 32 characters). " +
      "Generate one with: openssl rand -hex 32"
    );
  }
}

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

  // Admin access (comma-separated emails — REL-03)
  "ADMIN_EMAILS",

  // Supabase (primary data store)
  // NEXT_PUBLIC_SUPABASE_URL is shared with the browser-side Realtime client;
  // the service-role key is server-only.
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",

  // REFACTOR-P3-01: browser-side Supabase Realtime client (broadcast only).
  // Anon key is intentionally public — RLS policies (REFACTOR-P2-01) enforce access.
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",

  // REFACTOR-P3-01: HMAC key that makes per-eventId chat channel names
  // unguessable. Generate with `openssl rand -hex 32`.
  "REALTIME_CHANNEL_SECRET",

  // Vercel cron authentication (session-cleanup cron)
  "CRON_SECRET",
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

  // TEST-02: E2E_MODE must never be enabled in production — it exposes an
  // unauthenticated auth bypass endpoint (/api/test/auth).
  // NODE_ENV is "production" on every Vercel deploy (preview too), so we use
  // VERCEL_ENV which is "production" only for the production branch and
  // "preview" for staging/feature-branch deploys.
  const isProdDeploy =
    process.env.VERCEL_ENV === "production" ||
    (process.env.NODE_ENV === "production" && !process.env.VERCEL_ENV);
  if (isProdDeploy && process.env.E2E_MODE === "true") {
    throw new Error("[startup] E2E_MODE must not be enabled in production");
  }

  // MOBILE-AUTH-01: When mobile auth is enabled, GOOGLE_MOBILE_CLIENT_IDS must be
  // set. It pins the `aud` claim of incoming Google ID tokens. Fail closed: an
  // unset audience would make verifyIdToken skip the audience check entirely,
  // accepting tokens minted for any Google OAuth client.
  if (process.env.MOBILE_AUTH_ENABLED === "true" && !process.env.GOOGLE_MOBILE_CLIENT_IDS) {
    throw new Error(
      "[startup] MOBILE_AUTH_ENABLED=true requires GOOGLE_MOBILE_CLIENT_IDS " +
      "(comma-separated mobile OAuth client IDs: iOS, Android, Expo web)."
    );
  }
}

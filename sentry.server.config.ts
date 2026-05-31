// OBS-02: Sentry server-side SDK configuration.
// Handles error aggregation, source maps, and PII protection for Node.js runtime.
//
// REFACTOR-P4-03: Tag events with the deployed git commit SHA so Sentry's
// Releases dashboard groups errors per deploy and regression detection works.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  environment: process.env.VERCEL_ENV ?? "development",

  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Disable in local dev unless explicitly opted in — avoids polluting the Sentry project
  enabled:
    process.env.NODE_ENV === "production" ||
    process.env.SENTRY_ENABLE_DEV === "true",

  beforeSend(event) {
    // Redact email addresses from error messages to reduce PII exposure
    if (event.message) {
      event.message = event.message.replace(
        /[\w.+-]+@[\w-]+\.[\w.-]+/g,
        "[redacted-email]"
      );
    }
    return event;
  },

  // Suppress expected operational errors — these are not bugs
  ignoreErrors: [
    /Autenticación requerida/, // 401 responses
    /Demasiadas peticiones/, // 429 rate limits
    /Datos de reserva inválidos/, // 400 validation errors
  ],
});

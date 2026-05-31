// OBS-02: Sentry edge-runtime SDK configuration.
// Covers middleware and edge routes. The edge runtime has a restricted API
// surface so beforeSend / ignoreErrors are omitted — server config handles those.
//
// REFACTOR-P4-03: Tag events with the deployed git commit SHA so Sentry's
// Releases dashboard groups errors per deploy and regression detection works.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  environment: process.env.VERCEL_ENV ?? "development",

  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  enabled:
    process.env.NODE_ENV === "production" ||
    process.env.SENTRY_ENABLE_DEV === "true",
});

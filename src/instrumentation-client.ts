// OBS-02: Sentry browser SDK configuration.
// Runs in the user's browser on every page load.
//
// REFACTOR-P4-03: Tag events with the deployed git commit SHA so Sentry's
// Releases dashboard groups errors per deploy and regression detection works.
// NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA is inlined at build time via next.config.mjs.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",

  // Only report in production — avoids polluting the project during development
  enabled: process.env.NODE_ENV === "production",

  tracesSampleRate: 0.1,

  // Capture replays only when an error occurs; session replay disabled (privacy)
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.1,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
    }),
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
